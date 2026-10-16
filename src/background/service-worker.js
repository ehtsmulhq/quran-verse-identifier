/**
 * Quran Verse Identifier - Chrome MV3 Background Service Worker
 * Orchestrates action clicks, keyboard shortcuts, offscreen audio capture,
 * Gemini audio recognition, Quran.com enrichment, and HUD state updates.
 */

import { processAndEnrichRecitation } from '../services/matcher.js';
import { generateSimplifiedTafsir } from '../services/tafsir-api.js';

let activeTabId = null;
let currentSource = 'tab';

let streamingSession = {
  active: false,
  tabId: null,
  currentSurah: null,
  currentAyah: null
};

export function getStreamingSession() {
  return streamingSession;
}

/**
 * Injects or mounts the Floating HUD UI into the active browser tab.
 * Uses dynamic import of web-accessible floating-hud.js inside the tab context.
 *
 * @param {number} tabId
 */
export async function injectHudIntoTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        // Prevent duplicate HUD injection on rapid clicks or shortcut presses
        if (document.getElementById('quran-verse-hud-root')) {
          return;
        }

        try {
          const hudUrl = chrome.runtime.getURL('src/ui/floating-hud.js');
          const { mountFloatingHud, updateHudState, destroyFloatingHud } = await import(hudUrl);

          mountFloatingHud({
            onSourceChange: (newSource) => {
              chrome.runtime.sendMessage({
                type: 'SOURCE_CHANGED',
                source: newSource
              }).catch(() => {});
            },
            onCancel: () => {
              chrome.runtime.sendMessage({
                type: 'CANCEL_IDENTIFICATION'
              }).catch(() => {});
            },
            onIdentifyAgain: () => {
              chrome.runtime.sendMessage({
                type: 'IDENTIFY_AGAIN'
              }).catch(() => {});
            }
          });

          // Register runtime listener for HUD updates from background service worker
          if (!window.__quranHudListenerRegistered) {
            window.__quranHudListenerRegistered = true;
            chrome.runtime.onMessage.addListener((message) => {
              if (message?.type === 'UPDATE_HUD_STATE') {
                updateHudState(message.state, message.data);
              } else if (message?.type === 'DESTROY_HUD') {
                destroyFloatingHud();
              }
            });
          }
        } catch (err) {
          console.error('[Quran Verse Identifier] Failed to initialize HUD in tab:', err);
        }
      }
    });
  } catch (err) {
    console.error('[Quran Verse Identifier] Scripting injection error:', err);
  }
}

/**
 * Ensures an offscreen document is open for Web Audio pass-through and MediaRecorder.
 */
export async function ensureOffscreenDocument() {
  if (chrome.offscreen?.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;
  }

  if (chrome.runtime?.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts && contexts.length > 0) return;
  }

  try {
    const offscreenUrl = chrome.runtime?.getURL
      ? chrome.runtime.getURL('src/offscreen/offscreen.html')
      : 'src/offscreen/offscreen.html';

    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['USER_MEDIA'],
      justification: 'Capture tab or microphone audio stream for Quran recitation identification'
    });
  } catch (err) {
    if (!err?.message?.includes('Only a single offscreen document may be created')) {
      throw err;
    }
  }
}

/**
 * Retrieves extension settings from chrome.storage.sync.
 *
 * @param {string[]} keys
 * @returns {Promise<object>}
 */
async function getStorageData(keys) {
  return new Promise((resolve) => {
    if (!chrome?.storage?.sync?.get) {
      resolve({});
      return;
    }
    const result = chrome.storage.sync.get(keys, (items) => {
      resolve(items || {});
    });
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(() => resolve({}));
    }
  });
}

/**
 * Triggers recitation identification on the specified browser tab.
 *
 * @param {chrome.tabs.Tab} tab
 * @param {'tab' | 'mic'} [source='tab']
 */
export async function handleIdentifyTrigger(tab, source = 'tab') {
  if (!tab || !tab.id) return;

  activeTabId = tab.id;
  currentSource = source;

  // 1. Inject Floating HUD overlay
  await injectHudIntoTab(tab.id);

  // 2. Validate Gemini API Key configuration
  const settings = await getStorageData(['geminiApiKey', 'translationId', 'preferredLanguageId']);
  const apiKey = settings?.geminiApiKey;

  if (!apiKey || !apiKey.trim()) {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'UPDATE_HUD_STATE',
      state: 'error',
      data: {
        message: 'Google Gemini API key is missing. Please configure your API key in extension settings.',
        isApiKeyMissing: true
      }
    });
    return;
  }

  // 3. Ensure offscreen capture document exists
  await ensureOffscreenDocument();

  // 4. Acquire stream ID if capturing active tab audio
  let streamId = null;
  if (source === 'tab') {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  }

  // 5. Instruct offscreen document to begin recording
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'START_RECORDING',
    source,
    streamId,
    durationMs: 5000
  });

  // 6. Set HUD to listening radar state
  await chrome.tabs.sendMessage(tab.id, {
    type: 'UPDATE_HUD_STATE',
    state: 'listening',
    data: { source }
  });
}

/**
 * Handles completed audio recording: sends to Gemini and enriches with Quran.com.
 *
 * @param {{ base64: string, mimeType: string }} audioData
 * @param {number} [targetTabId]
 */
export async function handleRecordingComplete(audioData, targetTabId = null) {
  const tabId = targetTabId || activeTabId;
  if (!tabId) return;

  if (!audioData || !audioData.base64) {
    await handleRecordingError('Recorded audio data was empty or invalid', tabId);
    return;
  }

  // Transition HUD to analyzing/transcribing state
  await chrome.tabs.sendMessage(tabId, {
    type: 'UPDATE_HUD_STATE',
    state: 'analyzing',
    data: { message: 'Transcribing recitation & matching Ayah with Gemini...' }
  });

  const settings = await getStorageData(['geminiApiKey', 'translationId', 'preferredLanguageId']);
  const apiKey = settings?.geminiApiKey;
  const translationId = settings?.translationId || settings?.preferredLanguageId || 131;

  if (!apiKey || !apiKey.trim()) {
    await chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_HUD_STATE',
      state: 'error',
      data: {
        message: 'Google Gemini API key is missing. Please configure your API key in settings.',
        isApiKeyMissing: true
      }
    });
    return;
  }

  const result = await processAndEnrichRecitation(
    audioData.base64,
    audioData.mimeType,
    apiKey,
    Number(translationId)
  );

  if (result.success && result.data) {
    await chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_HUD_STATE',
      state: 'matched',
      data: result.data
    });
  } else {
    await chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_HUD_STATE',
      state: 'error',
      data: {
        message: result.error || 'No Quran recitation recognized in audio sample'
      }
    });
  }
}

/**
 * Handles audio recording errors from offscreen document.
 *
 * @param {string} errorMessage
 * @param {number} [targetTabId]
 */
export async function handleRecordingError(errorMessage, targetTabId = null) {
  const tabId = targetTabId || activeTabId;
  if (!tabId) return;

  const isMicPermission = currentSource === 'mic' && (
    Boolean(errorMessage && (
      errorMessage.includes('Permission') ||
      errorMessage.includes('NotAllowedError') ||
      errorMessage.includes('dismissed') ||
      errorMessage.includes('denied')
    ))
  );

  const displayMessage = isMicPermission
    ? 'Microphone permission has not been granted yet. Chrome requires granting permission once in extension settings.'
    : (errorMessage || 'Audio recording failed');

  await chrome.tabs.sendMessage(tabId, {
    type: 'UPDATE_HUD_STATE',
    state: 'error',
    data: {
      message: displayMessage,
      isMicPermissionMissing: isMicPermission
    }
  });

  if (isMicPermission && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

/**
 * Initiates continuous recitation streaming session on the specified tab.
 *
 * @param {object} targetTab
 * @param {object} [options]
 */
export async function handleStartStream(targetTab, options = {}) {
  const tabId = targetTab?.id || activeTabId;
  if (!tabId) return;

  activeTabId = tabId;
  const source = options.source || currentSource;
  currentSource = source;

  streamingSession = {
    active: true,
    tabId,
    currentSurah: options.surahNumber || null,
    currentAyah: options.currentAyah || null
  };

  await ensureOffscreenDocument();

  let streamId = null;
  if (source === 'tab' && chrome.tabCapture?.getMediaStreamId) {
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    } catch (_) {}
  }

  const settings = await chrome.storage.sync.get(['geminiApiKey', 'selectedModel']);
  const apiKey = settings?.geminiApiKey || '';

  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'START_STREAMING',
    source,
    streamId,
    apiKey,
    surahContext: streamingSession.currentSurah
  }).catch(() => {});

  await chrome.tabs.sendMessage(tabId, {
    type: 'UPDATE_HUD_STATE',
    state: 'listening',
    data: {
      isStreaming: true,
      source,
      surahNumber: streamingSession.currentSurah,
      currentAyah: streamingSession.currentAyah
    }
  }).catch(() => {});
}

/**
 * Halts active recitation streaming session.
 */
export async function handleStopStream() {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'STOP_STREAMING'
  }).catch(() => {});

  const tabId = streamingSession.tabId || activeTabId;
  streamingSession = {
    active: false,
    tabId: null,
    currentSurah: null,
    currentAyah: null
  };

  if (tabId) {
    await chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_HUD_STATE',
      state: 'matched',
      data: { isStreaming: false }
    }).catch(() => {});
  }
}

/**
 * Handles sliding audio chunk emitted from offscreen document during continuous streaming.
 *
 * @param {object} chunkData
 */
export async function handleStreamChunk(chunkData) {
  if (!streamingSession.active) return;
  const tabId = streamingSession.tabId || activeTabId;
  if (!tabId) return;

  const settings = await chrome.storage.sync.get(['geminiApiKey', 'translationId']);
  const apiKey = settings?.geminiApiKey || '';
  const translationId = settings?.translationId || 131;

  const context = {
    surahNumber: streamingSession.currentSurah,
    currentAyah: streamingSession.currentAyah
  };

  const result = await processAndEnrichRecitation(
    chunkData.base64,
    chunkData.mimeType || 'audio/webm',
    apiKey,
    translationId,
    context
  );

  if (result?.success && result?.data) {
    streamingSession.currentSurah = result.data.surahNumber || streamingSession.currentSurah;
    streamingSession.currentAyah = result.data.ayahStart || streamingSession.currentAyah;

    await chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_HUD_STATE',
      state: 'matched',
      data: {
        ...result.data,
        isStreaming: true
      }
    }).catch(() => {});
  }
}

/**
 * Handles Tafsir generation requests from HUD.
 *
 * @param {object} message
 * @param {function} sendResponse
 */
export async function handleRequestTafsir(message, sendResponse) {
  try {
    const settings = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKey = settings?.geminiApiKey || '';
    const tafsirRes = await generateSimplifiedTafsir(
      message.verseData,
      message.surah,
      message.ayah,
      message.mode || 'quick',
      apiKey
    );
    sendResponse?.({ success: true, tafsir: tafsirRes });
  } catch (err) {
    sendResponse?.({ success: false, error: err?.message || String(err) });
  }
}

/**
 * Routes runtime messages between offscreen document, content script HUD, and background.
 *
 * @param {object} message
 * @param {object} sender
 * @param {function} sendResponse
 * @returns {boolean}
 */
export function handleMessage(message, sender, sendResponse) {
  if (!message || !message.type) return false;

  if (message.type === 'RECORDING_COMPLETE') {
    handleRecordingComplete(message.data, activeTabId)
      .then(() => sendResponse?.({ success: true }))
      .catch((err) => sendResponse?.({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'RECORDING_ERROR') {
    handleRecordingError(message.error, activeTabId)
      .then(() => sendResponse?.({ success: true }))
      .catch((err) => sendResponse?.({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SOURCE_CHANGED') {
    // Stop active recording and restart capture with new source
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'STOP_RECORDING'
    }).catch(() => {});

    const targetTab = sender?.tab || (activeTabId ? { id: activeTabId } : null);
    if (targetTab) {
      handleIdentifyTrigger(targetTab, message.source);
    }
    sendResponse?.({ success: true });
    return true;
  }

  if (message.type === 'CANCEL_IDENTIFICATION') {
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'STOP_RECORDING'
    }).catch(() => {});

    sendResponse?.({ success: true });
    return true;
  }

  if (message.type === 'OPEN_OPTIONS') {
    if (chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
    sendResponse?.({ success: true });
    return true;
  }

  if (message.type === 'IDENTIFY_AGAIN') {
    const targetTab = sender?.tab || (activeTabId ? { id: activeTabId } : null);
    if (targetTab) {
      handleIdentifyTrigger(targetTab, currentSource);
    }
    sendResponse?.({ success: true });
    return true;
  }

  if (message.type === 'START_STREAM') {
    const targetTab = sender?.tab || (activeTabId ? { id: activeTabId } : null);
    handleStartStream(targetTab, message)
      .then(() => sendResponse?.({ success: true }))
      .catch((err) => sendResponse?.({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'STOP_STREAM') {
    handleStopStream()
      .then(() => sendResponse?.({ success: true }))
      .catch((err) => sendResponse?.({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'STREAM_CHUNK') {
    handleStreamChunk(message)
      .then(() => sendResponse?.({ success: true }))
      .catch((err) => sendResponse?.({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'REQUEST_TAFSIR') {
    handleRequestTafsir(message, sendResponse);
    return true;
  }

  return false;
}

/**
 * Initializes extension service worker event listeners.
 */
export function initServiceWorker() {
  // Action button click in Chrome toolbar
  if (chrome.action?.onClicked?.addListener) {
    chrome.action.onClicked.addListener((tab) => {
      handleIdentifyTrigger(tab, 'tab');
    });
  }

  // Keyboard shortcut command (Alt+Q)
  if (chrome.commands?.onCommand?.addListener) {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command === 'identify-recitation') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          handleIdentifyTrigger(tab, 'tab');
        }
      }
    });
  }

  // Runtime message dispatcher
  if (chrome.runtime?.onMessage?.addListener) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return handleMessage(message, sender, sendResponse);
    });
  }
}

// Auto-initialize when running inside Chrome Service Worker context
if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
  initServiceWorker();
}
