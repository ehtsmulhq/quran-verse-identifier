/**
 * Chrome MV3 Offscreen Audio Capture Document
 * Handles tab and microphone audio capture, passes tab audio through
 * AudioContext to prevent muting host playback, and encodes to WebM/Base64.
 */

import { createGeminiLiveSession } from '../services/gemini-live.js';

let currentStream = null;
let currentRecorder = null;
let activeAudioContext = null;
let durationTimeoutId = null;
let activeLiveSession = null;
let isStreaming = false;

/**
 * Connects an audio stream to the AudioContext destination so tab audio
 * continues to play through the user's speakers/headphones and is not muted.
 *
 * @param {MediaStream} stream
 * @param {AudioContext} [audioContext]
 * @returns {{ sourceNode: MediaStreamAudioSourceNode, destination: AudioDestinationNode }}
 */
export function setupAudioCapture(stream, audioContext) {
  const ctx = audioContext || new (globalThis.AudioContext || window.AudioContext)();

  if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
    ctx.resume().catch(() => {});
  }

  const sourceNode = ctx.createMediaStreamSource(stream);
  sourceNode.connect(ctx.destination);

  return {
    sourceNode,
    destination: ctx.destination
  };
}

/**
 * Converts a Blob object to a clean Base64 string without data URL prefix.
 *
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new (globalThis.FileReader || window.FileReader)();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIndex = result.indexOf(',');
        resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
      } else {
        resolve('');
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read blob as Base64'));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Selects the optimal supported WebM audio MIME type for MediaRecorder.
 *
 * @returns {string}
 */
function getSupportedMimeType() {
  const MR = globalThis.MediaRecorder || window.MediaRecorder;
  if (!MR) return 'audio/webm';

  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm'
  ];

  for (const type of preferredTypes) {
    if (typeof MR.isTypeSupported === 'function' && MR.isTypeSupported(type)) {
      return type;
    }
  }

  return 'audio/webm';
}

/**
 * Cleans up active audio stream tracks and AudioContext instances.
 */
function cleanupTracksAndAudioContext() {
  if (currentStream) {
    const tracks = typeof currentStream.getTracks === 'function'
      ? currentStream.getTracks()
      : (typeof currentStream.getAudioTracks === 'function' ? currentStream.getAudioTracks() : []);

    tracks.forEach((track) => {
      try {
        if (typeof track.stop === 'function') {
          track.stop();
        }
      } catch (_) {}
    });
    currentStream = null;
  }

  if (activeAudioContext) {
    try {
      if (typeof activeAudioContext.close === 'function') {
        activeAudioContext.close().catch(() => {});
      }
    } catch (_) {}
    activeAudioContext = null;
  }

  currentRecorder = null;
}


/**
 * Starts audio recording from tab capture or microphone, auto-stopping after durationMs.
 *
 * @param {'tab' | 'mic'} [source='tab']
 * @param {string} [streamId]
 * @param {number} [durationMs=5000]
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
export async function startRecording(source = 'tab', streamId = null, durationMs = 5000) {
  // If an existing recording is active, stop and clean it up first
  stopRecording();

  const constraints = source === 'mic'
    ? { audio: true }
    : {
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        },
        video: false
      };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  currentStream = stream;

  // In tab capture mode, route audio through AudioContext to prevent muting playback
  if (source === 'tab') {
    activeAudioContext = new (globalThis.AudioContext || window.AudioContext)();
    setupAudioCapture(stream, activeAudioContext);
  }

  const mimeType = getSupportedMimeType();
  const MR = globalThis.MediaRecorder || window.MediaRecorder;
  const recorder = new MR(stream, { mimeType });
  currentRecorder = recorder;

  const chunks = [];

  return new Promise((resolve, reject) => {
    let resolved = false;

    recorder.ondataavailable = (event) => {
      if (event && event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      if (durationTimeoutId) {
        clearTimeout(durationTimeoutId);
        durationTimeoutId = null;
      }
      cleanupTracksAndAudioContext();

      if (resolved) return;
      resolved = true;

      try {
        const blob = new Blob(chunks, { type: mimeType });
        const base64 = await blobToBase64(blob);
        resolve({ base64, mimeType });
      } catch (err) {
        reject(err);
      }
    };

    recorder.onerror = (event) => {
      if (durationTimeoutId) {
        clearTimeout(durationTimeoutId);
        durationTimeoutId = null;
      }
      cleanupTracksAndAudioContext();

      if (resolved) return;
      resolved = true;
      reject(event?.error || new Error('MediaRecorder error'));
    };

    recorder.start();

    if (durationMs > 0) {
      durationTimeoutId = setTimeout(() => {
        if (currentRecorder && currentRecorder.state === 'recording') {
          currentRecorder.stop();
        }
      }, durationMs);
    }
  });
}

/**
 * Halts active recording, stops all media tracks, and closes AudioContext.
 */
export function stopRecording() {
  if (durationTimeoutId) {
    clearTimeout(durationTimeoutId);
    durationTimeoutId = null;
  }

  if (currentRecorder && currentRecorder.state === 'recording') {
    currentRecorder.stop();
  }

  cleanupTracksAndAudioContext();
}

/**
 * Starts continuous audio streaming capture with unmuted pass-through and periodic chunks.
 *
 * @param {'tab'|'mic'} [source='tab']
 * @param {string|null} [streamId=null]
 * @param {number} [intervalMs=4500]
 * @param {object} [liveOptions={}]
 * @returns {Promise<{ success: boolean, streaming: boolean }>}
 */
export async function startStreaming(source = 'tab', streamId = null, intervalMs = 4500, liveOptions = {}) {
  stopStreaming();

  const constraints = source === 'mic'
    ? { audio: true }
    : {
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        },
        video: false
      };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  currentStream = stream;

  if (source === 'tab') {
    activeAudioContext = new (globalThis.AudioContext || window.AudioContext)();
    setupAudioCapture(stream, activeAudioContext);
  }

  isStreaming = true;

  if (liveOptions.apiKey) {
    try {
      activeLiveSession = createGeminiLiveSession(liveOptions.apiKey, {
        surahContext: liveOptions.surahContext,
        onVerseIdentified: (verse) => {
          const chromeApi = getChromeApi();
          if (chromeApi?.runtime?.sendMessage) {
            chromeApi.runtime.sendMessage({
              type: 'STREAM_VERSE_MATCH',
              verse
            }).catch(() => {});
          }
        }
      });
    } catch (_) {}
  }

  const mimeType = getSupportedMimeType();
  const MR = globalThis.MediaRecorder || window.MediaRecorder;
  if (MR) {
    currentRecorder = new MR(stream, { mimeType });
    currentRecorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0 && isStreaming) {
        try {
          const base64 = await blobToBase64(e.data);
          const chromeApi = getChromeApi();
          if (chromeApi?.runtime?.sendMessage) {
            chromeApi.runtime.sendMessage({
              type: 'STREAM_CHUNK',
              base64,
              mimeType
            }).catch(() => {});
          }
        } catch (_) {}
      }
    };
    currentRecorder.start(intervalMs);
  }

  return { success: true, streaming: true };
}

/**
 * Stops active streaming capture, closes live session, and releases tracks.
 *
 * @returns {{ success: boolean }}
 */
export function stopStreaming() {
  isStreaming = false;

  if (activeLiveSession) {
    try {
      activeLiveSession.close();
    } catch (_) {}
    activeLiveSession = null;
  }

  if (currentRecorder && currentRecorder.state === 'recording') {
    try {
      currentRecorder.stop();
    } catch (_) {}
  }

  cleanupTracksAndAudioContext();
  return { success: true };
}


function getChromeApi() {
  if (typeof chrome !== 'undefined') return chrome;
  if (typeof globalThis !== 'undefined' && globalThis.chrome) return globalThis.chrome;
  if (typeof window !== 'undefined' && window.chrome) return window.chrome;
  return null;
}

/**
 * Handles incoming Chrome runtime messages for offscreen audio capture.
 *
 * @param {object} message
 * @param {object} sender
 * @param {function} [sendResponse]
 * @returns {boolean}
 */
export function handleMessage(message, sender, sendResponse) {
  if (!message || message.target !== 'offscreen') {
    return false;
  }

  const chromeApi = getChromeApi();

  if (message.type === 'START_RECORDING') {
    const { source = 'tab', streamId = null, durationMs = 5000 } = message;

    startRecording(source, streamId, durationMs)
      .then((data) => {
        if (chromeApi?.runtime?.sendMessage) {
          chromeApi.runtime.sendMessage({
            type: 'RECORDING_COMPLETE',
            data
          }).catch(() => {});
        }
        if (typeof sendResponse === 'function') {
          sendResponse({ success: true, data });
        }
      })
      .catch((err) => {
        const errorMessage = err?.message || String(err);
        if (chromeApi?.runtime?.sendMessage) {
          chromeApi.runtime.sendMessage({
            type: 'RECORDING_ERROR',
            error: errorMessage
          }).catch(() => {});
        }
        if (typeof sendResponse === 'function') {
          sendResponse({ success: false, error: errorMessage });
        }
      });

    return true; // Keep message channel open for async response
  }

  if (message.type === 'STOP_RECORDING') {
    stopRecording();
    if (typeof sendResponse === 'function') {
      sendResponse({ success: true });
    }
    return true;
  }

  if (message.type === 'START_STREAMING') {
    const { source = 'tab', streamId = null, intervalMs = 4500, apiKey = '', surahContext = null } = message;

    startStreaming(source, streamId, intervalMs, { apiKey, surahContext })
      .then((data) => {
        if (typeof sendResponse === 'function') {
          sendResponse(data);
        }
      })
      .catch((err) => {
        const errorMsg = err?.message || String(err);
        if (typeof sendResponse === 'function') {
          sendResponse({ success: false, error: errorMsg });
        }
      });

    return true;
  }

  if (message.type === 'STOP_STREAMING') {
    const res = stopStreaming();
    if (typeof sendResponse === 'function') {
      sendResponse(res);
    }
    return true;
  }

  return false;
}

// Auto-register Chrome runtime message listener in MV3 environment
if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage?.addListener) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    return handleMessage(message, sender, sendResponse);
  });
}
