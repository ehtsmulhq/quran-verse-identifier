/**
 * Quran.com REST API Client (v4)
 * Provides authenticated/public access to Quran verses, Uthmani calligraphy, and multilingual translations.
 */

export const SURAH_NAMES = [
  "", // 0-indexed placeholder so index matches Surah number (1-114)
  "Al-Fatihah",
  "Al-Baqarah",
  "Ali 'Imran",
  "An-Nisa",
  "Al-Ma'idah",
  "Al-An'am",
  "Al-A'raf",
  "Al-Anfal",
  "At-Tawbah",
  "Yunus",
  "Hud",
  "Yusuf",
  "Ar-Ra'd",
  "Ibrahim",
  "Al-Hijr",
  "An-Nahl",
  "Al-Isra",
  "Al-Kahf",
  "Maryam",
  "Ta-Ha",
  "Al-Anbiya",
  "Al-Hajj",
  "Al-Mu'minun",
  "An-Nur",
  "Al-Furqan",
  "Ash-Shu'ara",
  "An-Naml",
  "Al-Qasas",
  "Al-'Ankabut",
  "Ar-Rum",
  "Luqman",
  "As-Sajdah",
  "Al-Ahzab",
  "Saba",
  "Fatir",
  "Ya-Sin",
  "As-Saffat",
  "Sad",
  "Az-Zumar",
  "Ghafir",
  "Fussilat",
  "Ash-Shura",
  "Az-Zukhruf",
  "Ad-Dukhan",
  "Al-Jathiyah",
  "Al-Ahqaf",
  "Muhammad",
  "Al-Fath",
  "Al-Hujurat",
  "Qaf",
  "Adh-Dhariyat",
  "At-Tur",
  "An-Najm",
  "Al-Qamar",
  "Ar-Rahman",
  "Al-Waqi'ah",
  "Al-Hadid",
  "Al-Mujadila",
  "Al-Hashr",
  "Al-Mumtahanah",
  "As-Saff",
  "Al-Jumu'ah",
  "Al-Munafiqun",
  "At-Taghabun",
  "At-Talaq",
  "At-Tahrim",
  "Al-Mulk",
  "Al-Qalam",
  "Al-Haqqah",
  "Al-Ma'arij",
  "Nuh",
  "Al-Jinn",
  "Al-Muzzammil",
  "Al-Muddaththir",
  "Al-Qiyamah",
  "Al-Insan",
  "Al-Mursalat",
  "An-Naba",
  "An-Nazi'at",
  "'Abasa",
  "At-Takwir",
  "Al-Infitar",
  "Al-Mutaffifin",
  "Al-Inshiqaq",
  "Al-Buruj",
  "At-Tariq",
  "Al-A'la",
  "Al-Ghashiyah",
  "Al-Fajr",
  "Al-Balad",
  "Ash-Shams",
  "Al-Layl",
  "Ad-Duhaa",
  "Ash-Sharh",
  "At-Tin",
  "Al-'Alaq",
  "Al-Qadr",
  "Al-Bayyinah",
  "Az-Zalzalah",
  "Al-'Adiyat",
  "Al-Qari'ah",
  "At-Takathur",
  "Al-'Asr",
  "Al-Humazah",
  "Al-Fil",
  "Quraysh",
  "Al-Ma'un",
  "Al-Kawthar",
  "Al-Kafirun",
  "An-Nasr",
  "Al-Masad",
  "Al-Ikhlas",
  "Al-Falaq",
  "An-Nas"
];

/**
 * Strips HTML tags and footnote superscripts from translation texts.
 * @param {string} str
 * @returns {string}
 */
function stripHtml(str = '') {
  return str
    .replace(/<sup\b[^>]*>.*?<\/sup>/gis, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Parses verse number integer from verse object.
 * @param {object} verse
 * @returns {number}
 */
function extractVerseNumber(verse) {
  if (typeof verse.verse_number === 'number') {
    return verse.verse_number;
  }
  if (verse.verse_key) {
    const parts = verse.verse_key.split(':');
    return parseInt(parts[1], 10) || 0;
  }
  return 0;
}

/**
 * Fetches authentic Uthmani text and translation for a verse or verse span.
 *
 * @param {number} surah - Surah number (1-114)
 * @param {number} fromAyah - Starting Ayah number (>= 1)
 * @param {number} toAyah - Ending Ayah number (>= fromAyah)
 * @param {number} [translationId=131] - Quran.com translation resource ID (default: 131 - Dr. Mustafa Khattab)
 * @returns {Promise<{ surahName: string, verseKey: string, arabicText: string, translationText: string, quranComUrl: string }>}
 */
export async function fetchVerseDetails(surah, fromAyah, toAyah, translationId = 131) {
  const surahNum = Number(surah);
  if (!surahNum || surahNum < 1 || surahNum > 114) {
    throw new Error(`Invalid surah number: ${surah}`);
  }

  const start = Number(fromAyah) || 1;
  const end = Number(toAyah) || start;

  const url = `https://api.quran.com/api/v4/verses/by_chapter/${surahNum}?translations=${translationId}&fields=text_uthmani&per_page=300`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error while connecting to Quran.com API: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Quran.com API error: ${response.status} ${response.statusText || ''}`.trim());
  }

  const data = await response.json();
  const allVerses = data.verses || [];

  const targetVerses = allVerses.filter(verse => {
    const num = extractVerseNumber(verse);
    return num >= start && num <= end;
  });

  if (targetVerses.length === 0) {
    throw new Error(`No verses found in chapter ${surahNum} for range ${start}-${end}`);
  }

  // Join Arabic verses with authentic Ayah end marker for multi-verse spans
  const arabicText = targetVerses
    .map(v => v.text_uthmani || '')
    .filter(Boolean)
    .join(' ۝ ');

  // Join translation texts cleanly separated by spaces
  let translationText = targetVerses
    .map(v => {
      const transItem = v.translations?.[0];
      return transItem ? stripHtml(transItem.text) : '';
    })
    .filter(Boolean)
    .join(' ');

  // If translation was not embedded in verses (Quran.com API v4 production behavior),
  // fetch from dedicated /quran/translations endpoint with fallback to Saheeh International (20)
  if (!translationText) {
    try {
      const effectiveTransId = (Number(translationId) === 131 || !translationId) ? 20 : Number(translationId);
      let transRes = await fetch(`https://api.quran.com/api/v4/quran/translations/${effectiveTransId}?chapter_number=${surahNum}`);
      if (transRes.ok) {
        let transData = await transRes.json();
        if (!transData.translations || transData.translations.length === 0) {
          // Fallback to Saheeh International (20) if selected translation returned empty
          transRes = await fetch(`https://api.quran.com/api/v4/quran/translations/20?chapter_number=${surahNum}`);
          if (transRes.ok) transData = await transRes.json();
        }
        if (transData?.translations?.length) {
          const slice = transData.translations.slice(start - 1, end);
          translationText = slice
            .map(t => stripHtml(t.text))
            .filter(Boolean)
            .join(' ');
        }
      }
    } catch (_) {
      // Gracefully continue with whatever text is available
    }
  }

  const surahName = SURAH_NAMES[surahNum] || `Surah ${surahNum}`;
  const verseKey = start === end ? `${surahNum}:${start}` : `${surahNum}:${start}–${end}`;
  const quranComUrl = start === end
    ? `https://quran.com/${surahNum}/${start}`
    : `https://quran.com/${surahNum}/${start}-${end}`;

  let authorName = 'Saheeh International';
  if (Number(translationId) === 85) authorName = 'M.A.S. Abdel Haleem';
  else if (Number(translationId) === 161) authorName = 'Muhiuddin Khan (Bengali)';
  else if (Number(translationId) === 234) authorName = 'Fateh Muhammad Jalandhry (Urdu)';
  else if (Number(translationId) === 131) authorName = 'Dr. Mustafa Khattab (The Clear Quran)';

  return {
    surahName,
    verseKey,
    arabicText,
    translationText,
    translationAuthor: authorName,
    quranComUrl
  };
}

/**
 * Fetches the list of available translations from Quran.com.
 *
 * @returns {Promise<Array<{ id: number, languageName: string, name: string }>>}
 */
export async function getAvailableTranslations() {
  const url = 'https://api.quran.com/api/v4/resources/translations';

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error while connecting to Quran.com API: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Quran.com API error: ${response.status} ${response.statusText || ''}`.trim());
  }

  const data = await response.json();
  const list = data.translations || [];

  return list.map(t => ({
    id: t.id,
    languageName: t.language_name || '',
    name: t.name || t.author_name || ''
  }));
}

/**
 * Searches Quran.com by Arabic text query to find matching verse.
 *
 * @param {string} query - Arabic text query
 * @returns {Promise<{ surahNumber: number, ayahStart: number, ayahEnd: number, verseKey: string } | null>}
 */
export async function searchQuran(query) {
  if (!query || typeof query !== 'string' || !query.trim()) return null;
  const url = `https://api.quran.com/api/v4/search?q=${encodeURIComponent(query.trim())}&size=5`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.search?.results;
    if (results && results.length > 0) {
      const top = results[0];
      const parts = top.verse_key?.split(':');
      if (parts?.length === 2) {
        return {
          surahNumber: parseInt(parts[0], 10),
          ayahStart: parseInt(parts[1], 10),
          ayahEnd: parseInt(parts[1], 10),
          verseKey: top.verse_key
        };
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

