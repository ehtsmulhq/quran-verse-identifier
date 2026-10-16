/**
 * Gemini 3.8 Flash Live WebSocket Client
 * Connects to Google GenerativeService.BidiGenerateContent via WebSockets
 * for bidirectional real-time audio streaming.
 */

const LIVE_WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

/**
 * Creates an active Gemini 3.8 Flash Live streaming session over WebSockets.
 *
 * @param {string} apiKey - Google Gemini API Key
 * @param {object} [options]
 * @param {string} [options.model='models/gemini-3.8-live']
 * @param {number} [options.surahContext] - Surah number context lock-in
 * @param {function} [options.onVerseIdentified] - Callback when verse is identified
 * @param {function} [options.onError] - Callback on error
 * @param {function} [options.onClose] - Callback when connection closes
 * @returns {{
 *   sendAudioChunk: (base64Pcm: string) => void,
 *   close: () => void,
 *   readonly isConnected: boolean
 * }}
 */
export function createGeminiLiveSession(apiKey, options = {}) {
  const {
    model = 'models/gemini-3.8-live',
    surahContext = null,
    onVerseIdentified = () => {},
    onError = () => {},
    onClose = () => {}
  } = options;

  const url = `${LIVE_WS_BASE}?key=${encodeURIComponent((apiKey || '').trim())}`;
  const WS = globalThis.WebSocket || window.WebSocket;
  const ws = new WS(url);

  let isConnected = false;

  let systemInstructionText = `You are a real-time Quran recitation recognition engine. Transcribe recited Arabic speech and identify the Surah and Ayah. Respond ONLY with a JSON object in format: {"matched": true, "surah_name": "...", "surah_number": 1, "ayah_start": 1, "ayah_end": 1, "confidence": 0.95, "recited_arabic": "..."}.`;

  if (surahContext) {
    systemInstructionText += `\nCONTEXT LOCK: Surah ${surahContext}. Restrict recognition to this Surah unless recitation clearly transitions.`;
  }

  const setupMessage = {
    setup: {
      model: model.startsWith('models/') ? model : `models/${model}`,
      generationConfig: {
        responseModalities: ['TEXT'],
        temperature: 0.2
      },
      systemInstruction: {
        parts: [{ text: systemInstructionText }]
      }
    }
  };

  ws.onopen = () => {
    isConnected = true;
    try {
      ws.send(JSON.stringify(setupMessage));
    } catch (err) {
      onError(err);
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      const parts = data?.serverContent?.modelTurn?.parts;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (part.text) {
            try {
              const parsed = JSON.parse(part.text);
              if (parsed && parsed.matched) {
                onVerseIdentified({
                  matched: true,
                  surahName: parsed.surah_name || parsed.surahName || '',
                  surahNumber: Number(parsed.surah_number ?? parsed.surahNumber),
                  ayahStart: Number(parsed.ayah_start ?? parsed.ayahStart),
                  ayahEnd: Number(parsed.ayah_end ?? parsed.ayahEnd ?? parsed.ayah_start ?? parsed.ayahStart),
                  confidence: Number(parsed.confidence || 0),
                  recitedArabic: parsed.recited_arabic || parsed.recitedArabic || ''
                });
              }
            } catch (_) {
              // Ignore partial text or non-JSON fragments
            }
          }
        }
      }
    } catch (err) {
      onError(err);
    }
  };

  ws.onerror = (err) => {
    onError(err);
  };

  ws.onclose = () => {
    isConnected = false;
    onClose();
  };

  return {
    sendAudioChunk(base64Pcm) {
      if (ws.readyState === 1) { // OPEN
        const mediaMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Pcm
              }
            ]
          }
        };
        ws.send(JSON.stringify(mediaMessage));
      }
    },
    close() {
      try {
        ws.close();
      } catch (_) {}
    },
    get isConnected() {
      return isConnected && ws.readyState === 1;
    }
  };
}
