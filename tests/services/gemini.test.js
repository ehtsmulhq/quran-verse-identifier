import { describe, it, expect, vi, beforeEach } from 'vitest';
import { identifyQuranAudio, synthesizeTafsir } from '../../src/services/gemini.js';

describe('Gemini Audio Recitation Identification Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAudioBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  const mockMimeType = 'audio/webm';
  const mockApiKey = 'test-gemini-api-key';

  it('successfully identifies Quran recitation and returns mapped camelCase result', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  matched: true,
                  surah_name: 'Ar-Rahman',
                  surah_number: 55,
                  ayah_start: 13,
                  ayah_end: 13,
                  confidence: 0.98,
                  recited_arabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'
                })
              }
            ]
          }
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('gemini-3.8-flash:generateContent');
    expect(url).toContain(`key=${mockApiKey}`);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[0].inlineData).toEqual({
      mimeType: mockMimeType,
      data: mockAudioBase64
    });
    expect(body.generationConfig.responseMimeType).toBe('application/json');

    expect(result).toEqual({
      matched: true,
      surahName: 'Ar-Rahman',
      surahNumber: 55,
      ayahStart: 13,
      ayahEnd: 13,
      confidence: 0.98,
      recitedArabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'
    });
  });

  it('seamlessly falls back to secondary model gemini-3.5-flash-lite if gemini-3.8-flash returns 404', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  matched: true,
                  surah_name: 'Al-Fatiha',
                  surah_number: 1,
                  ayah_start: 1,
                  ayah_end: 7,
                  confidence: 0.99,
                  recited_arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'
                })
              }
            ]
          }
        }
      ]
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: { message: 'Model not found' } })
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockGeminiResponse
      });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain('gemini-3.8-flash');
    expect(fetch.mock.calls[1][0]).toContain('gemini-3.5-flash-lite');
    expect(result.matched).toBe(true);
    expect(result.surahName).toBe('Al-Fatiha');
  });

  it('seamlessly falls back to gemini-1.5-flash if both 3.8-flash and 3.5-flash-lite return 503 or 404', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  matched: true,
                  surah_name: 'Al-Ikhlas',
                  surah_number: 112,
                  ayah_start: 1,
                  ayah_end: 4,
                  confidence: 0.99,
                  recited_arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ'
                })
              }
            ]
          }
        }
      ]
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        status: 503,
        ok: false,
        json: async () => ({ error: { message: 'High demand' } })
      })
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: { message: 'Not found' } })
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockGeminiResponse
      });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][0]).toContain('gemini-3.8-flash');
    expect(fetch.mock.calls[1][0]).toContain('gemini-3.5-flash-lite');
    expect(fetch.mock.calls[2][0]).toContain('gemini-1.5-flash');
    expect(result.matched).toBe(true);
    expect(result.surahName).toBe('Al-Ikhlas');
  });

  it('handles recitation not matched response from Gemini', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  matched: false,
                  reason: 'No Quran recitation recognized in audio sample'
                })
              }
            ]
          }
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(false);
    expect(result.error).toBe('No Quran recitation recognized in audio sample');
  });

  it('returns informative error when API key is missing or empty', async () => {
    global.fetch = vi.fn();

    const resultNoKey = await identifyQuranAudio(mockAudioBase64, mockMimeType, '');
    expect(resultNoKey).toEqual({
      matched: false,
      error: 'API key is missing'
    });

    const resultUndefined = await identifyQuranAudio(mockAudioBase64, mockMimeType, undefined);
    expect(resultUndefined).toEqual({
      matched: false,
      error: 'API key is missing'
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns informative error when audio data is missing', async () => {
    global.fetch = vi.fn();

    const result = await identifyQuranAudio('', mockMimeType, mockApiKey);
    expect(result).toEqual({
      matched: false,
      error: 'Audio data is missing'
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles HTTP 401 unauthorized error cleanly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: {
          code: 401,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'UNAUTHENTICATED'
        }
      })
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(false);
    expect(result.error).toContain('401');
    expect(result.error).toContain('API key not valid');
  });

  it('handles HTTP 429 rate limit error cleanly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED'
        }
      })
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(false);
    expect(result.error).toContain('429');
    expect(result.error).toContain('Resource has been exhausted');
  });

  it('handles network error when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(false);
    expect(result.error).toContain('Network error');
    expect(result.error).toContain('Failed to fetch');
  });

  it('handles markdown code fence wrapped JSON response from Gemini', async () => {
    const wrappedJson = '```json\n{\n  "matched": true,\n  "surah_name": "Al-Ikhlas",\n  "surah_number": 112,\n  "ayah_start": 1,\n  "ayah_end": 4,\n  "confidence": 0.99,\n  "recited_arabic": "قل هو الله أحد"\n}\n```';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: wrappedJson }]
            }
          }
        ]
      })
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(true);
    expect(result.surahName).toBe('Al-Ikhlas');
    expect(result.surahNumber).toBe(112);
    expect(result.ayahStart).toBe(1);
    expect(result.ayahEnd).toBe(4);
    expect(result.confidence).toBe(0.99);
    expect(result.recitedArabic).toBe('قل هو الله أحد');
  });

  it('handles malformed unparseable JSON gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'This is not valid JSON at all.' }]
            }
          }
        ]
      })
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(false);
    expect(result.error).toContain('Failed to parse Gemini response');
  });

  it('handles Gemini response with no candidates or empty parts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: []
      })
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(false);
    expect(result.error).toContain('No candidates returned');
  });

  it('rescues structured recitation data from JSON with trailing commas or unquoted keys', async () => {
    const imperfectJson = `{
      matched: true,
      surah_name: "An-Nur",
      surah_number: 24,
      ayah_start: 35,
      ayah_end: 35,
      confidence: 0.97,
      recited_arabic: "اللَّهُ نُورُ السَّمَاوَاتِ",
    }`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: imperfectJson }] } }]
      })
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(true);
    expect(result.surahName).toBe('An-Nur');
    expect(result.surahNumber).toBe(24);
    expect(result.ayahStart).toBe(35);
    expect(result.ayahEnd).toBe(35);
  });

  it('gracefully handles natural language response when Gemini detects background noise or no recitation', async () => {
    const plainTextNotice = 'I listened to the audio, but there was only background noise and no clear Quran recitation could be identified.';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: plainTextNotice }] } }]
      })
    });

    const result = await identifyQuranAudio(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result.matched).toBe(false);
    expect(result.error).toContain('No clear Quran recitation');
  });

  describe('synthesizeTafsir', () => {
    const fakeVerseData = {
      surahName: 'Al-Mulk',
      surahNumber: 67,
      ayahStart: 1,
      ayahEnd: 1,
      arabicText: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ',
      translationText: 'Blessed is He in Whose Hand is the dominion'
    };

    const fakeMultiTafsir = {
      ibnKathir: 'Ibn Kathir notes that Allah glorifies His Holy Self...',
      maarif: 'Maarif al-Quran highlights the kingdom of the universe...',
      tazkirul: 'Tazkirul Quran reminds us that creation is purposeful...',
      quranComUrl: 'https://quran.com/67/1/tafsirs'
    };

    it('synthesizes quick 60-90s reflection with an analogy/story', async () => {
      let promptSent = '';
      global.fetch = vi.fn().mockImplementation((url, opts) => {
        const body = JSON.parse(opts.body);
        promptSent = body.contents[0].parts[0].text;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: 'Imagine a painter who created a masterpiece... Allah controls the universe with supreme wisdom.'
                }]
              }
            }]
          })
        });
      });

      const result = await synthesizeTafsir(fakeVerseData, fakeMultiTafsir, 'quick', mockApiKey);

      expect(result).toContain('Imagine a painter');
      expect(promptSent).toContain('60-90 seconds');
      expect(promptSent).toContain('analogy');
      expect(promptSent).toContain('Ibn Kathir notes');
    });

    it('synthesizes detailed reflection with Asbab al-Nuzul and practical applications', async () => {
      let promptSent = '';
      global.fetch = vi.fn().mockImplementation((url, opts) => {
        const body = JSON.parse(opts.body);
        promptSent = body.contents[0].parts[0].text;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [{
              content: { parts: [{ text: 'Detailed study text' }] }
            }]
          })
        });
      });

      const result = await synthesizeTafsir(fakeVerseData, fakeMultiTafsir, 'detailed', mockApiKey);

      expect(result).toBe('Detailed study text');
      expect(promptSent).toContain('Asbab al-Nuzul');
    });

    it('returns error message if API key is missing or invalid', async () => {
      const result = await synthesizeTafsir(fakeVerseData, fakeMultiTafsir, 'quick', '');
      expect(result).toContain('API key is missing');
    });
  });
});


