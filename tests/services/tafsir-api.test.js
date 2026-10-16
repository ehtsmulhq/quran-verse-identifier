import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanTafsirHtml, fetchMultiTafsir, generateSimplifiedTafsir } from '../../src/services/tafsir-api.js';
import * as geminiService from '../../src/services/gemini.js';

describe('Multi-Source Tafsir API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('cleanTafsirHtml strips HTML tags, entities, and extra whitespace', () => {
    const raw = '<p>This is a <b>test</b> explanation.&nbsp;Ref: 1:1</p><div>More text</div>';
    expect(cleanTafsirHtml(raw)).toBe('This is a test explanation. Ref: 1:1 More text');
    expect(cleanTafsirHtml('')).toBe('');
    expect(cleanTafsirHtml(null)).toBe('');
  });

  it('fetchMultiTafsir concurrently fetches all 3 classical tafsirs from Quran.com API v4', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      let text = 'Default commentary';
      if (url.includes('/169/')) text = 'Ibn Kathir commentary';
      if (url.includes('/168/')) text = 'Maarif al-Quran commentary';
      if (url.includes('/817/')) text = 'Tazkirul Quran commentary';
      return Promise.resolve({
        ok: true,
        json: async () => ({ tafsir: { text: `<p>${text}</p>` } })
      });
    });

    const result = await fetchMultiTafsir(67, 1);
    expect(result.ibnKathir).toBe('Ibn Kathir commentary');
    expect(result.maarif).toBe('Maarif al-Quran commentary');
    expect(result.tazkirul).toBe('Tazkirul Quran commentary');
    expect(result.quranComUrl).toBe('https://quran.com/67/1/tafsirs');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('fetchMultiTafsir gracefully degrades when 1 or 2 sources fail or are 404', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/169/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ tafsir: { text: '<p>Ibn Kathir available</p>' } })
        });
      }
      // 168 and 817 fail or return 404
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
    });

    const result = await fetchMultiTafsir(67, 1);
    expect(result.ibnKathir).toBe('Ibn Kathir available');
    expect(result.maarif).toBe('');
    expect(result.tazkirul).toBe('');
    expect(result.quranComUrl).toBe('https://quran.com/67/1/tafsirs');
  });

  it('generateSimplifiedTafsir orchestrates fetch and synthesis with selected mode', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tafsir: { text: '<p>Classical text</p>' } })
    });

    vi.spyOn(geminiService, 'synthesizeTafsir').mockResolvedValue(
      'Imagine a king who built a majestic castle... This reflects Allah\'s sovereignty.'
    );

    const fakeVerse = { surahNumber: 67, verseStart: 1, englishTranslation: 'Blessed is He...' };
    const res = await generateSimplifiedTafsir(fakeVerse, 67, 1, 'quick', 'fake-key');

    expect(res).toEqual({
      text: 'Imagine a king who built a majestic castle... This reflects Allah\'s sovereignty.',
      mode: 'quick',
      quranComUrl: 'https://quran.com/67/1/tafsirs'
    });
    expect(geminiService.synthesizeTafsir).toHaveBeenCalledWith(
      fakeVerse,
      expect.objectContaining({
        ibnKathir: 'Classical text',
        quranComUrl: 'https://quran.com/67/1/tafsirs'
      }),
      'quick',
      'fake-key'
    );
  });
});
