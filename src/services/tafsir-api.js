/**
 * Multi-Source Classical Tafsir API and Simplified Reflection Orchestrator
 * Fetches classical commentaries from Quran.com API v4:
 * - Ibn Kathir (ID 169)
 * - Ma'arif al-Qur'an (ID 168)
 * - Tazkirul Quran (ID 817)
 * And delegates to Gemini to synthesize an easy-to-understand explanation with analogies.
 */

import { synthesizeTafsir } from './gemini.js';

const TAFSIR_IDS = {
  IBN_KATHIR: 169,
  MAARIF: 168,
  TAZKIRUL: 817
};

const BASE_URL = 'https://api.quran.com/api/v4/tafsirs';

/**
 * Strips HTML tags, entity references, and collapses whitespace from raw Tafsir text.
 * @param {string} html
 * @returns {string} Plain text
 */
export function cleanTafsirHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Helper to fetch a single Tafsir resource safely.
 * @param {number} tafsirId
 * @param {number} surah
 * @param {number} ayah
 * @returns {Promise<string>}
 */
async function fetchSingleTafsir(tafsirId, surah, ayah) {
  try {
    const url = `${BASE_URL}/${tafsirId}/by_ayah/${surah}:${ayah}`;
    const res = await fetch(url);
    if (!res.ok) {
      return '';
    }
    const data = await res.json();
    const raw = data?.tafsir?.text || '';
    return cleanTafsirHtml(raw);
  } catch {
    return '';
  }
}

/**
 * Concurrently fetches Ibn Kathir, Ma'arif al-Qur'an, and Tazkirul Quran from Quran.com.
 * @param {number} surah
 * @param {number} ayah
 * @returns {Promise<{
 *   ibnKathir: string,
 *   maarif: string,
 *   tazkirul: string,
 *   quranComUrl: string
 * }>}
 */
export async function fetchMultiTafsir(surah, ayah) {
  const [ibnKathirRes, maarifRes, tazkirulRes] = await Promise.all([
    fetchSingleTafsir(TAFSIR_IDS.IBN_KATHIR, surah, ayah),
    fetchSingleTafsir(TAFSIR_IDS.MAARIF, surah, ayah),
    fetchSingleTafsir(TAFSIR_IDS.TAZKIRUL, surah, ayah)
  ]);

  return {
    ibnKathir: ibnKathirRes || '',
    maarif: maarifRes || '',
    tazkirul: tazkirulRes || '',
    quranComUrl: `https://quran.com/${surah}/${ayah}/tafsirs`
  };
}

/**
 * Orchestrates classical Tafsir ingestion and Gemini simplified synthesis.
 *
 * @param {object} verseData - Verse metadata { surahName, surahNumber, ayahStart, ayahEnd, arabicText, translationText }
 * @param {number} surah
 * @param {number} ayah
 * @param {'quick'|'detailed'|'comprehensive'} [mode='quick']
 * @param {string} apiKey - Gemini API Key
 * @returns {Promise<{
 *   text: string,
 *   mode: string,
 *   quranComUrl: string
 * }>}
 */
export async function generateSimplifiedTafsir(verseData, surah, ayah, mode = 'quick', apiKey = '') {
  const multiTafsir = await fetchMultiTafsir(surah, ayah);
  const text = await synthesizeTafsir(verseData, multiTafsir, mode, apiKey);

  return {
    text,
    mode,
    quranComUrl: multiTafsir.quranComUrl
  };
}
