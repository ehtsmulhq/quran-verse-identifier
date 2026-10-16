import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleIdentifyTrigger,
  ensureOffscreenDocument,
  handleRecordingComplete,
  handleRecordingError,
  handleMessage,
  initServiceWorker,
  getStreamingSession
} from '../../src/background/service-worker.js';
import * as matcher from '../../src/services/matcher.js';
import * as tafsirApi from '../../src/services/tafsir-api.js';

vi.mock('../../src/services/matcher.js', () => ({
  processAndEnrichRecitation: vi.fn()
}));

vi.mock('../../src/services/tafsir-api.js', () => ({
  generateSimplifiedTafsir: vi.fn()
}));

describe('Background Service Worker', () => {
  let mockTab;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTab = {
      id: 42,
      url: 'https://www.youtube.com/watch?v=example'
    };

    globalThis.chrome = {
      action: {
        onClicked: {
          addListener: vi.fn()
        }
      },
      commands: {
        onCommand: {
          addListener: vi.fn()
        }
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([])
      },
      offscreen: {
        hasDocument: vi.fn().mockResolvedValue(false),
        createDocument: vi.fn().mockResolvedValue(undefined)
      },
      tabCapture: {
        getMediaStreamId: vi.fn().mockResolvedValue('mock-stream-id-42')
      },
      runtime: {
        onMessage: {
          addListener: vi.fn()
        },
        sendMessage: vi.fn().mockResolvedValue({}),
        getURL: vi.fn((path) => `chrome-extension://mock-extension-id/${path}`),
        openOptionsPage: vi.fn()
      },
      tabs: {
        query: vi.fn().mockResolvedValue([mockTab]),
        sendMessage: vi.fn().mockResolvedValue({})
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            geminiApiKey: 'valid-gemini-key',
            translationId: 131
          }),
          set: vi.fn().mockResolvedValue(undefined)
        }
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleIdentifyTrigger', () => {
    it('injects floating HUD into tab using chrome.scripting.executeScript', async () => {
      await handleIdentifyTrigger(mockTab);

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: mockTab.id }
        })
      );
    });

    it('creates offscreen document via chrome.offscreen.createDocument if not open', async () => {
      await handleIdentifyTrigger(mockTab);

      expect(chrome.offscreen.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('offscreen.html'),
          reasons: expect.arrayContaining(['USER_MEDIA'])
        })
      );
    });

    it('does not re-create offscreen document if already open', async () => {
      chrome.offscreen.hasDocument.mockResolvedValue(true);

      await handleIdentifyTrigger(mockTab);

      expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
    });

    it('acquires tab stream ID via chrome.tabCapture.getMediaStreamId for tab capture', async () => {
      await handleIdentifyTrigger(mockTab, 'tab');

      expect(chrome.tabCapture.getMediaStreamId).toHaveBeenCalledWith({
        targetTabId: mockTab.id
      });
    });

    it('sends START_RECORDING message to offscreen document with acquired streamId', async () => {
      await handleIdentifyTrigger(mockTab, 'tab');

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          type: 'START_RECORDING',
          source: 'tab',
          streamId: 'mock-stream-id-42',
          durationMs: 5000
        })
      );
    });

    it('sets HUD state to listening on the active tab', async () => {
      await handleIdentifyTrigger(mockTab, 'tab');

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'listening',
          data: { source: 'tab' }
        })
      );
    });

    it('handles microphone source without tabCapture stream ID', async () => {
      await handleIdentifyTrigger(mockTab, 'mic');

      expect(chrome.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          type: 'START_RECORDING',
          source: 'mic',
          streamId: null
        })
      );
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'listening',
          data: { source: 'mic' }
        })
      );
    });
  });

  describe('Missing Gemini API Key Handling', () => {
    it('sends error message to tab instructing user to configure API key when key is empty', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        geminiApiKey: ''
      });

      await handleIdentifyTrigger(mockTab);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'error',
          data: expect.objectContaining({
            isApiKeyMissing: true,
            message: expect.stringMatching(/api key/i)
          })
        })
      );

      // Should not initiate offscreen recording when key is missing
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'START_RECORDING' })
      );
    });

    it('sends error message when storage returns undefined or null API key', async () => {
      chrome.storage.sync.get.mockResolvedValue({});

      await handleIdentifyTrigger(mockTab);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'error',
          data: expect.objectContaining({
            isApiKeyMissing: true
          })
        })
      );
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'START_RECORDING' })
      );
    });
  });

  describe('Successful Recognition Handling', () => {
    it('updates HUD to analyzing then calls processAndEnrichRecitation and sends matched state', async () => {
      const mockResultData = {
        surahName: 'Ar-Rahman',
        verseKey: '55:13',
        arabicText: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
        translationText: 'So which of the favors of your Lord would you deny?',
        confidence: 0.98,
        quranComUrl: 'https://quran.com/55/13'
      };

      vi.mocked(matcher.processAndEnrichRecitation).mockResolvedValue({
        success: true,
        data: mockResultData
      });

      await handleRecordingComplete(
        { base64: 'audio-base64-data', mimeType: 'audio/webm;codecs=opus' },
        mockTab.id
      );

      // Should show analyzing state first
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'analyzing'
        })
      );

      // Should call matcher with stored apiKey and translationId
      expect(matcher.processAndEnrichRecitation).toHaveBeenCalledWith(
        'audio-base64-data',
        'audio/webm;codecs=opus',
        'valid-gemini-key',
        131
      );

      // Should send matched state with Quranic data
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'matched',
          data: mockResultData
        })
      );
    });
  });

  describe('Error or Non-Match Handling', () => {
    it('sends error state message to tab when Gemini detects no recitation', async () => {
      vi.mocked(matcher.processAndEnrichRecitation).mockResolvedValue({
        success: false,
        error: 'No Quran recitation recognized in audio sample'
      });

      await handleRecordingComplete(
        { base64: 'ambient-noise-data', mimeType: 'audio/webm' },
        mockTab.id
      );

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'error',
          data: expect.objectContaining({
            message: 'No Quran recitation recognized in audio sample'
          })
        })
      );
    });

    it('sends error state to tab when offscreen recording encounters an error', async () => {
      await handleRecordingError('Microphone permission denied', mockTab.id);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'error',
          data: expect.objectContaining({
            message: 'Microphone permission denied'
          })
        })
      );
    });
  });

  describe('Runtime Message Routing & Lifecycle', () => {
    it('handles RECORDING_COMPLETE from offscreen document', async () => {
      vi.mocked(matcher.processAndEnrichRecitation).mockResolvedValue({
        success: true,
        data: { surahName: 'Al-Ikhlas', verseKey: '112:1' }
      });

      // Set active tab first
      await handleIdentifyTrigger(mockTab);

      const message = {
        type: 'RECORDING_COMPLETE',
        data: { base64: 'audio-data', mimeType: 'audio/webm' }
      };

      const sendResponse = vi.fn();
      const handled = handleMessage(message, {}, sendResponse);
      expect(handled).toBe(true);

      // Wait for async processing
      await vi.waitFor(() => {
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
          mockTab.id,
          expect.objectContaining({
            state: 'matched'
          })
        );
      });
    });

    it('handles SOURCE_CHANGED from content script by stopping and restarting capture', async () => {
      await handleIdentifyTrigger(mockTab, 'tab');

      const message = {
        type: 'SOURCE_CHANGED',
        source: 'mic'
      };

      const sendResponse = vi.fn();
      const handled = handleMessage(message, { tab: mockTab }, sendResponse);
      expect(handled).toBe(true);

      // Verifies stop was sent and mic was triggered
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          type: 'STOP_RECORDING'
        })
      );
    });

    it('handles CANCEL_IDENTIFICATION by stopping offscreen capture', async () => {
      const message = {
        type: 'CANCEL_IDENTIFICATION'
      };

      const sendResponse = vi.fn();
      const handled = handleMessage(message, {}, sendResponse);
      expect(handled).toBe(true);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          type: 'STOP_RECORDING'
        })
      );
    });

    it('handles IDENTIFY_AGAIN by restarting recitation identification on tab', async () => {
      const message = {
        type: 'IDENTIFY_AGAIN'
      };

      const sendResponse = vi.fn();
      const handled = handleMessage(message, { tab: mockTab }, sendResponse);
      expect(handled).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: mockTab.id }
        })
      );
    });

    it('wires action click listener and keyboard command listener on init', () => {
      initServiceWorker();

      expect(chrome.action.onClicked.addListener).toHaveBeenCalled();
      expect(chrome.commands.onCommand.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    it('handles START_STREAM by initiating offscreen streaming and updating session', async () => {
      const sendResponse = vi.fn();
      const message = {
        type: 'START_STREAM',
        source: 'tab',
        surahNumber: 67,
        currentAyah: 1
      };

      const handled = handleMessage(message, { tab: mockTab }, sendResponse);
      expect(handled).toBe(true);

      await vi.waitFor(() => {
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            target: 'offscreen',
            type: 'START_STREAMING',
            surahContext: 67
          })
        );
      });

      const session = getStreamingSession();
      expect(session.active).toBe(true);
      expect(session.currentSurah).toBe(67);
      expect(session.currentAyah).toBe(1);
    });

    it('handles STREAM_CHUNK with Surah lock-in context and updates HUD', async () => {
      matcher.processAndEnrichRecitation.mockResolvedValue({
        success: true,
        data: {
          surahName: 'Al-Mulk',
          surahNumber: 67,
          verseKey: '67:2',
          arabicText: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ',
          translationText: 'He who created death and life...',
          ayahStart: 2
        }
      });

      const sendResponse = vi.fn();
      const message = {
        type: 'STREAM_CHUNK',
        base64: 'mock-chunk-audio',
        mimeType: 'audio/webm'
      };

      const handled = handleMessage(message, {}, sendResponse);
      expect(handled).toBe(true);

      await vi.waitFor(() => {
        expect(matcher.processAndEnrichRecitation).toHaveBeenCalledWith(
          'mock-chunk-audio',
          'audio/webm',
          'valid-gemini-key',
          131,
          expect.objectContaining({ surahNumber: 67 })
        );
      });

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTab.id,
        expect.objectContaining({
          type: 'UPDATE_HUD_STATE',
          state: 'matched',
          data: expect.objectContaining({
            verseKey: '67:2',
            isStreaming: true
          })
        })
      );
    });

    it('handles STOP_STREAM by stopping offscreen capture and resetting session', async () => {
      const sendResponse = vi.fn();
      const message = {
        type: 'STOP_STREAM'
      };

      const handled = handleMessage(message, {}, sendResponse);
      expect(handled).toBe(true);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'offscreen',
          type: 'STOP_STREAMING'
        })
      );

      const session = getStreamingSession();
      expect(session.active).toBe(false);
    });

    it('handles REQUEST_TAFSIR by calling generateSimplifiedTafsir and responding with result', async () => {
      tafsirApi.generateSimplifiedTafsir.mockResolvedValue({
        text: 'Imagine a magnificent kingdom...',
        mode: 'quick',
        quranComUrl: 'https://quran.com/67/1/tafsirs'
      });

      const sendResponse = vi.fn();
      const message = {
        type: 'REQUEST_TAFSIR',
        surah: 67,
        ayah: 1,
        mode: 'quick',
        verseData: { surahName: 'Al-Mulk', surahNumber: 67, ayahStart: 1 }
      };

      const handled = handleMessage(message, {}, sendResponse);
      expect(handled).toBe(true);

      await vi.waitFor(() => {
        expect(tafsirApi.generateSimplifiedTafsir).toHaveBeenCalledWith(
          message.verseData,
          67,
          1,
          'quick',
          'valid-gemini-key'
        );
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          tafsir: expect.objectContaining({
            text: 'Imagine a magnificent kingdom...',
            mode: 'quick'
          })
        });
      });
    });
  });
});

