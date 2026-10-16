/**
 * Arabic Text Normalization and Verification Utilities
 * Strips diacritics, tatweel, normalizes letter variants, and calculates word overlap.
 */

// Tashkeel / Harakat and Quranic pronunciation marks
const TASHKEEL_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL_REGEX = /\u0640/g;
const HAMZA_ALIF_REGEX = /[إأآٱ]/g;

/**
 * Normalizes Arabic text for deterministic comparison.
 * @param {string} text - Raw Arabic text
 * @returns {string} Normalized Arabic text
 */
export function normalizeArabic(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let normalized = text
    .replace(TASHKEEL_REGEX, '')
    .replace(TATWEEL_REGEX, '')
    .replace(HAMZA_ALIF_REGEX, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

  // Remove non-word punctuation while preserving Arabic letters and digits
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, ' ');

  // Collapse whitespace
  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Calculates the ratio (0.0 to 1.0) of recited words found in the verse text.
 * @param {string} verseText - Full Quranic verse text
 * @param {string} recitedText - Transcribed or recited snippet
 * @returns {number} Overlap ratio between 0.0 and 1.0
 */
export function calculateWordOverlap(verseText, recitedText) {
  if (!verseText || !recitedText) {
    return 0;
  }

  const normVerse = normalizeArabic(verseText);
  const normRecited = normalizeArabic(recitedText);

  if (!normVerse || !normRecited) {
    return 0;
  }

  const recitedWords = normRecited.split(/\s+/).filter(Boolean);
  if (recitedWords.length === 0) {
    return 0;
  }

  const verseWordsSet = new Set(normVerse.split(/\s+/).filter(Boolean));
  let matchedCount = 0;

  for (const word of recitedWords) {
    if (verseWordsSet.has(word)) {
      matchedCount++;
    }
  }

  return matchedCount / recitedWords.length;
}

/**
 * Verifies whether recited words match or are contained within a given verse.
 * @param {string} verseText - Full verse text
 * @param {string} recitedText - Transcribed words
 * @param {number} [threshold=0.5] - Minimum required word overlap ratio
 * @returns {boolean} True if matched
 */
export function isVerseMatch(verseText, recitedText, threshold = 0.6) {
  if (!verseText || !recitedText) {
    return false;
  }

  const normVerse = normalizeArabic(verseText);
  const normRecited = normalizeArabic(recitedText);

  if (!normVerse || !normRecited) {
    return false;
  }

  // Exact substring match (handles continuous phrases)
  if (normVerse.includes(normRecited)) {
    return true;
  }

  return calculateWordOverlap(verseText, recitedText) >= threshold;
}
