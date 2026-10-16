import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGeminiLiveSession } from '../../src/services/gemini-live.js';

class MockWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sentMessages = [];
    MockWebSocket.instances.push(this);

    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  simulateMessage(payload) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(payload) });
    }
  }

  simulateError(err) {
    if (this.onerror) {
      this.onerror(err);
    }
  }
}

describe('Gemini 3.8 Flash Live WebSocket Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket;
  });

  it('connects to GenerativeService.BidiGenerateContent with apiKey and sends setup handshake', async () => {
    const session = createGeminiLiveSession('test-api-key', {
      surahContext: 67
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('GenerativeService.BidiGenerateContent');
    expect(ws.url).toContain('key=test-api-key');

    expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1);
    const setupMsg = JSON.parse(ws.sentMessages[0]);
    expect(setupMsg).toHaveProperty('setup');
    expect(setupMsg.setup.model).toBe('models/gemini-3.8-live');
    expect(setupMsg.setup.generationConfig.responseModalities).toEqual(['TEXT']);
    const instructionText = setupMsg.setup.systemInstruction.parts[0].text;
    expect(instructionText).toContain('CONTEXT LOCK: Surah 67');

    session.close();
    expect(ws.readyState).toBe(3);
  });

  it('sends 16kHz PCM audio chunks via realtimeInput.mediaChunks', async () => {
    const session = createGeminiLiveSession('test-api-key');
    await new Promise((r) => setTimeout(r, 10));

    const ws = MockWebSocket.instances[0];
    session.sendAudioChunk('base64-raw-pcm-data');

    const lastMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    expect(lastMsg).toEqual({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: 'base64-raw-pcm-data'
          }
        ]
      }
    });

    session.close();
  });

  it('parses server text content and dispatches onVerseIdentified callback', async () => {
    const onVerse = vi.fn();
    const session = createGeminiLiveSession('test-api-key', {
      onVerseIdentified: onVerse
    });
    await new Promise((r) => setTimeout(r, 10));

    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({
      serverContent: {
        modelTurn: {
          parts: [
            {
              text: JSON.stringify({
                matched: true,
                surah_name: 'Al-Mulk',
                surah_number: 67,
                ayah_start: 1,
                ayah_end: 1,
                confidence: 0.96,
                recited_arabic: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ'
              })
            }
          ]
        }
      }
    });

    expect(onVerse).toHaveBeenCalledWith(
      expect.objectContaining({
        matched: true,
        surahNumber: 67,
        ayahStart: 1,
        recitedArabic: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ'
      })
    );

    session.close();
  });

  it('triggers onError callback on WebSocket error', async () => {
    const onError = vi.fn();
    const session = createGeminiLiveSession('test-api-key', { onError });
    await new Promise((r) => setTimeout(r, 10));

    const ws = MockWebSocket.instances[0];
    ws.simulateError(new Error('Connection failed'));

    expect(onError).toHaveBeenCalled();
    session.close();
  });
});
