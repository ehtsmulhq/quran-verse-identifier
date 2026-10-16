import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchVerseDetails, getAvailableTranslations, searchQuran, SURAH_NAMES } from '../../src/services/quran-api.js';

describe('Quran API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches single verse details with Uthmani text and translation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        verses: [
          {
            verse_key: '55:13',
            text_uthmani: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
            translations: [{ text: 'So which of the favors of your Lord would you deny?' }]
          }
        ]
      })
    });

    const result = await fetchVerseDetails(55, 13, 13, 131);
    expect(result.surahName).toBe('Ar-Rahman');
    expect(result.verseKey).toBe('55:13');
    expect(result.arabicText).toBe('فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ');
    expect(result.translationText).toContain('favors of your Lord');
    expect(result.quranComUrl).toBe('https://quran.com/55/13');
  });

  it('fetches and joins multi-verse spans (e.g. 112:1-2)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        verses: [
          { verse_key: '112:1', text_uthmani: 'قُلْ هُوَ اللَّهُ أَحَدٌ', translations: [{ text: 'Say, "He is Allah, [who is] One,' }] },
          { verse_key: '112:2', text_uthmani: 'اللَّهُ الصَّمَدُ', translations: [{ text: 'Allah, the Eternal Refuge.' }] }
        ]
      })
    });

    const result = await fetchVerseDetails(112, 1, 2, 131);
    expect(result.verseKey).toBe('112:1–2');
    expect(result.arabicText).toContain('قُلْ هُوَ اللَّهُ أَحَدٌ');
    expect(result.arabicText).toContain('اللَّهُ الصَّمَدُ');
    expect(result.translationText).toContain('Eternal Refuge');
  });

  it('fetches available translations list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        translations: [
          { id: 131, language_name: 'english', name: 'Dr. Mustafa Khattab, The Clear Quran' },
          { id: 161, language_name: 'bengali', name: 'Taisirul Quran' }
        ]
      })
    });

    const list = await getAvailableTranslations();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe(131);
  });

  it('throws error for invalid surah number', async () => {
    await expect(fetchVerseDetails(0, 1, 1)).rejects.toThrow('Invalid surah number');
    await expect(fetchVerseDetails(115, 1, 1)).rejects.toThrow('Invalid surah number');
  });

  it('throws error when Quran.com API returns non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await expect(fetchVerseDetails(1, 1, 1)).rejects.toThrow('Quran.com API error: 500');
  });

  it('throws error when no verses match the specified range', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        verses: [
          { verse_key: '1:1', text_uthmani: 'بِسْمِ اللَّهِ', translations: [{ text: 'In the name of Allah' }] }
        ]
      })
    });

    await expect(fetchVerseDetails(1, 10, 15)).rejects.toThrow('No verses found in chapter 1 for range 10-15');
  });

  it('strips HTML tags and footnote references from translations', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        verses: [
          {
            verse_key: '2:1',
            text_uthmani: 'الۤمۤ',
            translations: [{ text: 'Alif-Lâm-Mîm. <sup foot_note=1>1</sup>' }]
          }
        ]
      })
    });

    const result = await fetchVerseDetails(2, 1, 1);
    expect(result.translationText).toBe('Alif-Lâm-Mîm.');
  });

  it('verifies all 114 Surah names are populated', () => {
    expect(SURAH_NAMES.length).toBe(115);
    expect(SURAH_NAMES[1]).toBe('Al-Fatihah');
    expect(SURAH_NAMES[55]).toBe('Ar-Rahman');
    expect(SURAH_NAMES[114]).toBe('An-Nas');
  });

  it('searches Quran by Arabic text and extracts matching verse key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        search: {
          results: [
            {
              verse_key: '55:13',
              text: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'
            }
          ]
        }
      })
    });

    const res = await searchQuran('فَبِأَيِّ آلَاءِ');
    expect(res).toEqual({
      surahNumber: 55,
      ayahStart: 13,
      ayahEnd: 13,
      verseKey: '55:13'
    });
  });
});
