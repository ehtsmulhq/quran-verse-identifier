import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processAndEnrichRecitation } from '../../src/services/matcher.js';
import * as geminiService from '../../src/services/gemini.js';
import * as quranApiService from '../../src/services/quran-api.js';

describe('Recitation Matcher Coordinator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAudioBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  const mockMimeType = 'audio/webm';
  const mockApiKey = 'test-gemini-api-key';

  it('successfully orchestrates identification and enrichment returning unified result', async () => {
    vi.spyOn(geminiService, 'identifyQuranAudio').mockResolvedValue({
      matched: true,
      surahName: 'Ar-Rahman',
      surahNumber: 55,
      ayahStart: 13,
      ayahEnd: 13,
      confidence: 0.98,
      recitedArabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'
    });

    vi.spyOn(quranApiService, 'fetchVerseDetails').mockResolvedValue({
      surahName: 'Ar-Rahman',
      verseKey: '55:13',
      arabicText: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
      translationText: 'Which then of the bounties of your Lord will you deny?',
      quranComUrl: 'https://quran.com/55/13'
    });

    const result = await processAndEnrichRecitation(mockAudioBase64, mockMimeType, mockApiKey);

    expect(geminiService.identifyQuranAudio).toHaveBeenCalledWith(
      mockAudioBase64,
      mockMimeType,
      mockApiKey
    );
    expect(quranApiService.fetchVerseDetails).toHaveBeenCalledWith(55, 13, 13, 131);

    expect(result).toEqual({
      success: true,
      data: {
        surahName: 'Ar-Rahman',
        verseKey: '55:13',
        arabicText: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
        translationText: 'Which then of the bounties of your Lord will you deny?',
        quranComUrl: 'https://quran.com/55/13',
        confidence: 0.98,
        recitedArabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'
      }
    });
  });

  it('respects custom translationId when provided', async () => {
    vi.spyOn(geminiService, 'identifyQuranAudio').mockResolvedValue({
      matched: true,
      surahName: 'Al-Ikhlas',
      surahNumber: 112,
      ayahStart: 1,
      ayahEnd: 2,
      confidence: 0.95,
      recitedArabic: 'قل هو الله أحد الله الصمد'
    });

    vi.spyOn(quranApiService, 'fetchVerseDetails').mockResolvedValue({
      surahName: 'Al-Ikhlas',
      verseKey: '112:1–2',
      arabicText: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ',
      translationText: 'বলুন, তিনিই আল্লাহ, এক-অদ্বিতীয়। আল্লাহ কারও মুখাপেক্ষী নন।',
      quranComUrl: 'https://quran.com/112/1-2'
    });

    const result = await processAndEnrichRecitation(mockAudioBase64, mockMimeType, mockApiKey, 161);

    expect(quranApiService.fetchVerseDetails).toHaveBeenCalledWith(112, 1, 2, 161);
    expect(result.success).toBe(true);
    expect(result.data.verseKey).toBe('112:1–2');
    expect(result.data.translationText).toContain('আল্লাহ কারও মুখাপেক্ষী নন');
  });

  it('handles non-match from identifyQuranAudio passing through error status and message', async () => {
    vi.spyOn(geminiService, 'identifyQuranAudio').mockResolvedValue({
      matched: false,
      error: 'No Quran recitation recognized in audio sample'
    });

    const spyFetch = vi.spyOn(quranApiService, 'fetchVerseDetails');

    const result = await processAndEnrichRecitation(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result).toEqual({
      success: false,
      error: 'No Quran recitation recognized in audio sample'
    });
    expect(spyFetch).not.toHaveBeenCalled();
  });

  it('handles non-match without explicit error property with fallback message', async () => {
    vi.spyOn(geminiService, 'identifyQuranAudio').mockResolvedValue({
      matched: false
    });

    const result = await processAndEnrichRecitation(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result).toEqual({
      success: false,
      error: 'No Quran recitation recognized in audio sample'
    });
  });

  it('handles Gemini API failure (e.g. 401 unauthorized or missing key)', async () => {
    vi.spyOn(geminiService, 'identifyQuranAudio').mockResolvedValue({
      matched: false,
      error: 'API key is missing'
    });

    const result = await processAndEnrichRecitation(mockAudioBase64, mockMimeType, '');

    expect(result).toEqual({
      success: false,
      error: 'API key is missing'
    });
  });

  it('handles fetchVerseDetails failure cleanly', async () => {
    vi.spyOn(geminiService, 'identifyQuranAudio').mockResolvedValue({
      matched: true,
      surahNumber: 1,
      ayahStart: 1,
      ayahEnd: 7,
      confidence: 0.99,
      recitedArabic: '...'
    });

    vi.spyOn(quranApiService, 'fetchVerseDetails').mockRejectedValue(
      new Error('Quran.com API error: 500 Internal Server Error')
    );

    const result = await processAndEnrichRecitation(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result).toEqual({
      success: false,
      error: 'Quran.com API error: 500 Internal Server Error'
    });
  });

  it('handles unexpected exceptions during processing gracefully', async () => {
    vi.spyOn(geminiService, 'identifyQuranAudio').mockRejectedValue(
      new Error('Unexpected runtime crash')
    );

    const result = await processAndEnrichRecitation(mockAudioBase64, mockMimeType, mockApiKey);

    expect(result).toEqual({
      success: false,
      error: 'Unexpected runtime crash'
    });
  });
});

