/**
 * Recitation Matcher Coordinator
 * Coordinates Gemini audio recitation identification with Quran.com metadata enrichment.
 */

import { identifyQuranAudio } from './gemini.js';
import { fetchVerseDetails, searchQuran } from './quran-api.js';

/**
 * Processes audio recitation:
 * 1. Sends audio to Gemini for Surah and Ayah identification.
 * 2. If matched, enriches with authentic Uthmani text and translation from Quran.com.
 *
 * @param {string} audioBase64 - Base64 encoded audio data
 * @param {string} [mimeType='audio/webm'] - Mime type of the audio stream
 * @param {string} apiKey - Google Gemini API key
 * @param {number} [translationId=131] - Quran.com translation ID (defaults to 131: Dr. Mustafa Khattab)
 * @returns {Promise<{
 *   success: boolean,
 *   data?: {
 *     surahName: string,
 *     verseKey: string,
 *     arabicText: string,
 *     translationText: string,
 *     quranComUrl: string,
 *     confidence: number,
 *     recitedArabic: string
 *   },
 *   error?: string
 * }>}
 */
export async function processAndEnrichRecitation(
  audioBase64,
  mimeType = 'audio/webm',
  apiKey,
  translationId = 131
) {
  try {
    const result = await identifyQuranAudio(audioBase64, mimeType, apiKey);

    if (!result || !result.matched) {
      return {
        success: false,
        error: result?.error || 'No Quran recitation recognized in audio sample'
      };
    }

    let finalSurah = result.surahNumber;
    let finalStart = result.ayahStart;
    let finalEnd = result.ayahEnd;

    // Disambiguate if verse numbers are missing or confidence is low
    if ((!finalSurah || !finalStart || result.confidence < 0.7) && result.recitedArabic) {
      try {
        const searchRes = await searchQuran(result.recitedArabic);
        if (searchRes) {
          finalSurah = searchRes.surahNumber;
          finalStart = searchRes.ayahStart;
          finalEnd = searchRes.ayahEnd;
        }
      } catch (_) {}
    }

    let verseDetails;
    try {
      verseDetails = await fetchVerseDetails(
        finalSurah,
        finalStart,
        finalEnd,
        translationId
      );
    } catch (fetchErr) {
      // If fetching fails (e.g. invalid verse numbers), attempt search rescue
      if (result.recitedArabic) {
        const searchRes = await searchQuran(result.recitedArabic);
        if (searchRes) {
          verseDetails = await fetchVerseDetails(
            searchRes.surahNumber,
            searchRes.ayahStart,
            searchRes.ayahEnd,
            translationId
          );
        } else {
          throw fetchErr;
        }
      } else {
        throw fetchErr;
      }
    }

    return {
      success: true,
      data: {
        ...verseDetails,
        confidence: result.confidence,
        recitedArabic: result.recitedArabic
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'An unexpected error occurred during recitation processing'
    };
  }
}

