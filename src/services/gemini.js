/**
 * Gemini 2.0 Flash Audio Identification Service
 * Sends multimodal audio base64 payload to Gemini 2.0 Flash REST API
 * to identify Quran recitation (Surah and Ayah range).
 */

export const GEMINI_PROMPT = `You are an expert Quranic recitation recognition system with comprehensive knowledge of the 114 Surahs and 6,236 Ayahs. Listen to the audio recitation carefully.
Follow these steps:
1. Accurately transcribe the exact Arabic words recited.
2. Identify the exact Surah and specific Ayah (or Ayah range) being recited.
3. Pay strict attention to Mutashabihat (verses with similar phrasing across different Surahs) to verify the correct Surah.
4. For repeated verses (e.g. in Surah Ar-Rahman, Al-Mursalat, Ash-Shu'ara), verify the surrounding context to determine the precise Ayah number.

Return ONLY a JSON object with:
{
  "matched": true/false,
  "surah_name": "Name in English",
  "surah_number": integer (1-114),
  "ayah_start": integer,
  "ayah_end": integer,
  "confidence": float between 0 and 1,
  "recited_arabic": "Exact recited Arabic text"
}
If the audio is not Quran recitation or cannot be identified with high confidence, return {"matched": false, "reason": "No Quran recitation recognized in audio sample"}.
CRITICAL: Respond ONLY with a valid JSON object. Do not include any commentary, explanations, or text outside the JSON.`;

/**
 * Extracts and parses JSON safely from a Gemini response string,
 * handling markdown code fences (```json ... ```), raw JSON, trailing commas,
 * regex extraction fallbacks, or natural language negative answers.
 *
 * @param {string} rawText
 * @returns {object}
 */
export function extractAndParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response from Gemini');
  }

  const trimmed = rawText.trim();

  // 1. Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with code fences or regex
  }

  // 2. Check for markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue to repair/extraction
    }
  }

  // 3. Extract outermost JSON object { ... }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Try repairing common JSON malformations (trailing commas, unquoted keys)
      try {
        const cleaned = candidate
          .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'); // quote keys
        return JSON.parse(cleaned);
      } catch {
        // Fallback to regex field extraction below
      }
    }

    // 4. Regex field extraction fallback to rescue structured data
    const matchedMatch = candidate.match(/"?matched"?\s*:\s*(true|false)/i);
    const surahNumMatch = candidate.match(/"?surah_number"?\s*:\s*(\d+)/i);
    const ayahStartMatch = candidate.match(/"?ayah_start"?\s*:\s*(\d+)/i);
    const ayahEndMatch = candidate.match(/"?ayah_end"?\s*:\s*(\d+)/i);
    const surahNameMatch = candidate.match(/"?surah_name"?\s*:\s*"([^"]+)"/i);
    const confMatch = candidate.match(/"?confidence"?\s*:\s*([0-9.]+)/i);
    const arabicMatch = candidate.match(/"?recited_arabic"?\s*:\s*"([^"]+)"/i);
    const reasonMatch = candidate.match(/"?reason"?\s*:\s*"([^"]+)"/i);

    if (matchedMatch || surahNumMatch) {
      return {
        matched: matchedMatch ? matchedMatch[1].toLowerCase() === 'true' : Boolean(surahNumMatch),
        surah_number: surahNumMatch ? parseInt(surahNumMatch[1], 10) : undefined,
        ayah_start: ayahStartMatch ? parseInt(ayahStartMatch[1], 10) : undefined,
        ayah_end: ayahEndMatch
          ? parseInt(ayahEndMatch[1], 10)
          : (ayahStartMatch ? parseInt(ayahStartMatch[1], 10) : undefined),
        surah_name: surahNameMatch ? surahNameMatch[1] : undefined,
        confidence: confMatch ? parseFloat(confMatch[1]) : 0.9,
        recited_arabic: arabicMatch ? arabicMatch[1] : undefined,
        reason: reasonMatch ? reasonMatch[1] : undefined
      };
    }
  }

  // 5. If response is plain text stating recitation was not recognized
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('not quran') ||
    lower.includes('no quran') ||
    lower.includes('not recognized') ||
    lower.includes('not identify') ||
    lower.includes('could not') ||
    lower.includes('cannot identify') ||
    lower.includes('unable to') ||
    lower.includes('inaudible') ||
    lower.includes('background') ||
    lower.includes('noise') ||
    lower.includes('silence')
  ) {
    return {
      matched: false,
      reason: 'No clear Quran recitation recognized in audio sample'
    };
  }

  throw new Error('Unable to extract valid JSON from Gemini response');
}

/**
 * Identifies Quran recitation from base64 audio data using Gemini 2.0 Flash REST API.
 *
 * @param {string} audioBase64 - Base64 encoded audio string
 * @param {string} mimeType - Audio mime type (e.g. 'audio/webm', 'audio/wav', 'audio/mp3')
 * @param {string} apiKey - Google Gemini API Key
 * @returns {Promise<{
 *   matched: boolean,
 *   surahName?: string,
 *   surahNumber?: number,
 *   ayahStart?: number,
 *   ayahEnd?: number,
 *   confidence?: number,
 *   recitedArabic?: string,
 *   reason?: string,
 *   error?: string
 * }>}
 */
export async function identifyQuranAudio(audioBase64, mimeType = 'audio/webm', apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return {
      matched: false,
      error: 'API key is missing'
    };
  }

  if (!audioBase64 || typeof audioBase64 !== 'string' || !audioBase64.trim()) {
    return {
      matched: false,
      error: 'Audio data is missing'
    };
  }

  const requestBody = {
    systemInstruction: {
      parts: [{ text: GEMINI_PROMPT }]
    },
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      responseMimeType: 'application/json'
    }
  };

  // Try gemini-3.8-flash (primary), gemini-3.5-flash-lite (secondary), and gemini-1.5-flash (fallback)
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash'];
  let response;
  let lastError = null;

  try {
    for (const model of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // If successful, proceed immediately
      if (response.ok) {
        break;
      }

      // If overloaded (503), not found (404), or rate limited (429), try next model
      if (response.status === 503 || response.status === 404 || response.status === 429) {
        continue;
      }

      // For client errors like invalid API key (400, 403), do not retry
      break;
    }
  } catch (err) {
    return {
      matched: false,
      error: `Network error: ${err.message}`
    };
  }

  if (!response.ok) {
    let errorDetail = response.statusText || 'Unknown error';
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // Keep statusText or default
    }
    return {
      matched: false,
      error: `Gemini API error (${response.status}): ${errorDetail}`
    };
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    return {
      matched: false,
      error: `Failed to parse Gemini response: ${err.message}`
    };
  }

  const candidate = data?.candidates?.[0];
  if (!candidate || !candidate.content?.parts?.length) {
    const blockReason = data?.promptFeedback?.blockReason;
    const msg = blockReason
      ? `Content generation blocked: ${blockReason}`
      : 'No candidates returned from Gemini API';
    return {
      matched: false,
      error: msg
    };
  }

  const rawText = candidate.content.parts[0]?.text;
  let parsed;
  try {
    parsed = extractAndParseJson(rawText);
  } catch (err) {
    return {
      matched: false,
      error: `Failed to parse Gemini response: ${err.message}`
    };
  }

  if (!parsed || !parsed.matched) {
    return {
      matched: false,
      reason: parsed?.reason,
      error: parsed?.reason || 'No Quran recitation recognized in audio sample'
    };
  }

  return {
    matched: true,
    surahName: parsed.surah_name || parsed.surahName || '',
    surahNumber: Number(parsed.surah_number ?? parsed.surahNumber),
    ayahStart: Number(parsed.ayah_start ?? parsed.ayahStart),
    ayahEnd: Number(parsed.ayah_end ?? parsed.ayahEnd ?? parsed.ayah_start ?? parsed.ayahStart),
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : parseFloat(parsed.confidence) || 0,
    recitedArabic: parsed.recited_arabic || parsed.recitedArabic || ''
  };
}

/**
 * Synthesizes an accessible, relatable Tafsir explanation from authentic classical sources.
 *
 * @param {object} verseData - { surahName, surahNumber, ayahStart, ayahEnd, arabicText, translationText }
 * @param {object} multiTafsir - { ibnKathir, maarif, tazkirul, quranComUrl }
 * @param {'quick'|'detailed'|'comprehensive'} [mode='quick']
 * @param {string} apiKey - Gemini API Key
 * @returns {Promise<string>} Synthesized reflection text
 */
export async function synthesizeTafsir(verseData, multiTafsir, mode = 'quick', apiKey = '') {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return 'API key is missing. Please set your Google Gemini API key in the extension options.';
  }

  const surahName = verseData?.surahName || `Surah ${verseData?.surahNumber || ''}`;
  const verseRef = `${verseData?.surahNumber || ''}:${verseData?.ayahStart || ''}${verseData?.ayahEnd && verseData.ayahEnd !== verseData.ayahStart ? `–${verseData.ayahEnd}` : ''}`;
  const arabic = verseData?.arabicText || '';
  const translation = verseData?.translationText || '';

  const ibnKathirText = multiTafsir?.ibnKathir ? `[Ibn Kathir]:\n${multiTafsir.ibnKathir.slice(0, 3000)}` : '';
  const maarifText = multiTafsir?.maarif ? `[Ma'arif al-Qur'an]:\n${multiTafsir.maarif.slice(0, 3000)}` : '';
  const tazkirulText = multiTafsir?.tazkirul ? `[Tazkirul Quran]:\n${multiTafsir.tazkirul.slice(0, 2000)}` : '';

  let modeInstruction = '';
  if (mode === 'quick') {
    modeInstruction = `MODE: Quick 60-90 seconds (~130-160 words).
- Focus on the single most powerful takeaway.
- Include ONE vivid, everyday story or relatable analogy that illustrates the lesson in modern terms.
- Keep it engaging, direct, and conversational.`;
  } else if (mode === 'detailed') {
    modeInstruction = `MODE: Detailed Study (~250-350 words).
- Outline the Context of Revelation (Asbab al-Nuzul) and historical background.
- Detail the core linguistic and spiritual themes.
- Provide 2-3 clear, actionable life applications.`;
  } else {
    modeInstruction = `MODE: Comprehensive Multi-Source Study (~450-600 words).
- Systematically synthesize and compare insights from the classical authorities provided below (Ibn Kathir, Ma'arif al-Qur'an, Tazkirul Quran).
- Analyze nuanced meanings and spiritual wisdom.
- Provide deep theological reflection and timeless lessons.`;
  }

  const promptText = `You are a compassionate, scholarly Quranic teacher explaining ${surahName} (${verseRef}) to an everyday reader.

VERSE:
Arabic: ${arabic}
Translation: ${translation}

AUTHENTIC CLASSICAL TAFSIR SOURCES (STRICT GROUND TRUTH):
${ibnKathirText}
${maarifText}
${tazkirulText}

INSTRUCTIONS:
1. Ground your reflection strictly in the classical commentaries provided above. Do NOT introduce unverified theological claims.
2. Avoid academic jargon; write in clear, inspiring, and beautiful English.
3. ${modeInstruction}
4. Write in clean markdown with concise paragraphs.`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      topP: 0.95
    }
  };

  const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash'];
  let response;

  try {
    for (const model of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) break;
      if (response.status === 503 || response.status === 404 || response.status === 429) continue;
      break;
    }
  } catch (err) {
    return `Network error while generating Tafsir: ${err.message}`;
  }

  if (!response?.ok) {
    return `Failed to generate Tafsir (${response?.status || 'Unknown error'})`;
  }

  try {
    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return generatedText ? generatedText.trim() : 'No reflection could be generated for this verse.';
  } catch (err) {
    return `Error parsing reflection: ${err.message}`;
  }
}

