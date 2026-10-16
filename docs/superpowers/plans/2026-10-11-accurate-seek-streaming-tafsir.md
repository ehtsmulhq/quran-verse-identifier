# Accurate Seek, Ayah Streaming, and Multi-Source Tafsir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate verse misidentification using deterministic Arabic normalization and Quran.com search verification, stream recitations Ayah-by-Ayah continuously in real time, and synthesize accessible, story/analogy-driven Tafsirs across 3 depth tiers grounded in 3 authentic classical commentaries with Read and Audio (TTS) modes and deep-links to Quran.com.

**Architecture:**
1. **Deterministic Seek Verification:** `src/services/arabic-normalizer.js` strips diacritics/tashkeel and normalizes letter variants. `matcher.js` verifies Gemini's predicted verse against the recited Arabic words; if mismatch or low confidence is detected, it queries Quran.com's search API to mathematically pinpoint the true verse.
2. **Surah Lock-In Context:** During streaming and seeking, Gemini is provided with current Surah context (`surahNumber`, `currentAyah`), collapsing the search space from 6,236 verses to just the current chapter and eliminating wrong Surah jumps.
3. **Continuous Audio Stream Loop:** `offscreen.js` provides a sliding audio chunk pipeline (every 4.5s) without tearing down the audio stream or muting the tab's sound. `service-worker.js` tracks sequential Ayah progression and broadcasts real-time updates.
4. **Multi-Source Tafsir Engine:** `src/services/tafsir-api.js` concurrently fetches Ibn Kathir (`169`), Ma'arif al-Qur'an (`168`), and Tazkirul Quran (`817`) from Quran.com API v4, and prompts Gemini to synthesize an easy-to-understand explanation using relatable analogies and everyday stories across 3 selectable depths (**Quick 60–90s**, **Detailed**, **Comprehensive Study**).
5. **Interactive HUD with Audio Player & Redirect:** `floating-hud.js` features a live stream toggle, auto-advancing Ayah feed, an expandable Tafsir drawer, Web Speech API audio player with speed controls (1x, 1.25x, 1.5x), and a deep-link redirect to full classical texts on Quran.com.

**Tech Stack:** Chrome Extension Manifest V3, Web Audio API, Web Speech API (`SpeechSynthesis`), Google Gemini Flash REST API, Quran.com REST API v4, Shadow DOM, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-accurate-seek-streaming-tafsir-design.md`

## Global Constraints
- Chrome Extensions Manifest V3 compliant. Pure ES Modules (`"type": "module"`).
- Tab audio pass-through to `AudioContext.destination` must be preserved so host video audio is never muted.
- All on-page UI must remain inside the isolated Shadow DOM (`attachShadow({ mode: 'open' })`) to prevent host website CSS bleeding.
- No third-party runtime dependencies. Use native browser APIs and `fetch`.
- All Arabic text and translations must come from authentic Quran.com v4 endpoints, never AI-generated.
- Tafsir commentary must be strictly grounded in the 3 fetched classical sources (Ibn Kathir, Ma'arif al-Qur'an, Tazkirul Quran), never ungrounded hallucinations.
- Reciter identification is strictly excluded; focus exclusively on accurate Surah, Ayah range, translation, and Tafsir reflections.
- Direct links to Quran.com (`https://quran.com/{surah}/{ayah}/tafsirs`) must open in a new tab (`target="_blank"`).

## Review Focus
1. **Arabic Diacritic & Letter Normalization:** Stripping Tashkeel (`َ ُ ِ ّ ْ ً ٌ ٍ ٰ`), Tatweel (`ـ`), standardizing Alif variants (`[إأآٱ] -> ا`), Ta Marbuta (`ة -> ه`), and Alif Maqsura (`ى -> ي`).
2. **False Match Recovery (Two-Stage Verification):** When Gemini hallucinates an Ayah number but transcribes words accurately, `matcher.js` must catch the mismatch and rescue the true verse via `searchQuran`.
3. **Continuous Audio Pass-Through & Memory:** Streaming sliding chunks in `offscreen.js` must never mute the host tab or leak `MediaStream` tracks when streaming is stopped.
4. **Tafsir Fallback & HTML Sanitization:** Quran.com classical Tafsir endpoints return raw HTML (paragraphs, spans); text must be cleanly stripped of HTML tags before feeding to Gemini, and missing individual sources must gracefully degrade without crashing.
5. **TTS Audio Lifecycle & Rate Control:** Audio playback using `speechSynthesis` must properly cancel, pause, resume, and switch playback speed without overlapping audio utterances.

---

### Task 1: Arabic Normalization & Verification Helper

**Files:**
- Create: `src/services/arabic-normalizer.js`
- Test: `tests/services/arabic-normalizer.test.js`

**Interfaces:**
- Produces:
  - `normalizeArabic(text: string): string`: Strips diacritics, tatweel, and standardizes letter variants.
  - `calculateWordOverlap(verseText: string, recitedText: string): number`: Computes ratio (0.0 to 1.0) of recited words found in the verse text.
  - `isVerseMatch(verseText: string, recitedText: string, threshold?: number): boolean`: Returns true if recited words match or overlap >= threshold (default 0.5) with verse.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/services/arabic-normalizer.test.js
import { describe, it, expect } from 'vitest';
import { normalizeArabic, calculateWordOverlap, isVerseMatch } from '../../src/services/arabic-normalizer.js';

describe('Arabic Normalizer & Verification', () => {
  it('normalizes diacritics, tatweel, and letter variants', () => {
    const raw = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    const normalized = normalizeArabic(raw);
    expect(normalized).toBe('بسم الله الرحمن الرحيم');
  });

  it('normalizes hamza variants, ta marbuta, and alif maqsura', () => {
    expect(normalizeArabic('إِنَّا أَعْطَيْنَاكَ')).toBe('انا اعطيناك');
    expect(normalizeArabic('الْقَارِعَةُ')).toBe('القارعه');
    expect(normalizeArabic('هُدًى')).toBe('هدي');
  });

  it('calculates word overlap between recited snippet and full verse', () => {
    const verse = 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ';
    const recited = 'فباي الاء ربكما';
    const overlap = calculateWordOverlap(verse, recited);
    expect(overlap).toBeGreaterThan(0.7);
  });

  it('validates verse match when recited words are present in verse', () => {
    const fullVerse = 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ';
    const recitedPart = 'لا اله الا هو الحي';
    expect(isVerseMatch(fullVerse, recitedPart)).toBe(true);
    expect(isVerseMatch(fullVerse, 'قل هو الله احد')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/arabic-normalizer.test.js`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `src/services/arabic-normalizer.js`**

Implement `normalizeArabic(text)`:
- Remove tashkeel `[\u064B-\u065F\u0670]`
- Remove tatweel `\u0640`
- Replace `[إأآٱ]` with `ا`, `ؤ` with `و`, `ئ` with `ي`
- Replace `ة` with `ه`, `ى` with `ي`
- Strip non-Arabic punctuation and collapse whitespace

Implement `calculateWordOverlap(verseText, recitedText)`:
- Normalize both strings.
- Tokenize recited words into set $R$ and verse words into set $V$.
- Return $|R \cap V| / |R|$ (or 0 if $|R| == 0$).

Implement `isVerseMatch(verseText, recitedText, threshold = 0.5)`:
- Returns `calculateWordOverlap(verseText, recitedText) >= threshold`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/arabic-normalizer.test.js`  
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add src/services/arabic-normalizer.js tests/services/arabic-normalizer.test.js
git commit -m "feat(arabic): add arabic normalization and verse text verification helpers"
```

---

### Task 2: Two-Stage Verification & Contextual Matcher

**Files:**
- Modify: `src/services/gemini.js`
- Modify: `src/services/matcher.js`
- Test: `tests/services/gemini.test.js`
- Test: `tests/services/matcher.test.js`

**Interfaces:**
- Consumes:
  - `normalizeArabic`, `isVerseMatch` from `arabic-normalizer.js`
  - `fetchVerseDetails`, `searchQuran` from `quran-api.js`
- Produces:
  - `identifyQuranAudio(audioBase64, mimeType, apiKey, context?: { surahNumber?: number, currentAyah?: number }): Promise<IdentificationResult>`
  - `processAndEnrichRecitation(audioBase64, mimeType, apiKey, translationId?: number, context?: object): Promise<EnrichedResult>`

- [ ] **Step 1: Write failing tests in `matcher.test.js` and `gemini.test.js`**

Add tests to `tests/services/gemini.test.js` verifying that passing `context: { surahNumber: 67, currentAyah: 1 }` includes the Surah Lock-In constraint in the Gemini prompt.

Add tests to `tests/services/matcher.test.js` verifying that when Gemini hallucinates the Ayah number (e.g. suggests Ayah 20, but `recitedArabic` is "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ" from Ayah 13), `matcher.js` detects the mismatch via `isVerseMatch`, queries `searchQuran`, rescues the true Ayah (55:13), and marks `{ isRescued: true }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/matcher.test.js tests/services/gemini.test.js`  
Expected: FAIL on new test assertions

- [ ] **Step 3: Implement Surah Lock-In in `gemini.js` and Two-Stage Verification in `matcher.js`**

1. In `src/services/gemini.js`:
   Append context lock-in to system instructions:
   ```javascript
   if (context?.surahNumber) {
     promptText += `\nCONTEXT LOCK: The reciter is currently in Surah ${context.surahNumber}${context.currentAyah ? `, near Ayah ${context.currentAyah}` : ''}. Restrict identification to this Surah unless recitation clearly transitions.`;
   }
   ```
2. In `src/services/matcher.js`:
   - Fetch candidate verse details via `fetchVerseDetails`.
   - Check `const matched = isVerseMatch(verseDetails.arabicText, identification.recitedArabic)`.
   - If `!matched`:
     - Call `const searchResults = await searchQuran(identification.recitedArabic)`.
     - Prioritize candidates matching `context?.surahNumber` to prevent jumping across chapters on identical phrases.
     - If top verified candidate matches, re-fetch verse details for rescued `verse_key` (e.g. `55:13`), setting `isRescued: true`.
     - If search yields no better match in current Surah, retain candidate with warning.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/matcher.test.js tests/services/gemini.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/gemini.js src/services/matcher.js tests/services/gemini.test.js tests/services/matcher.test.js
git commit -m "feat(matcher): add two-stage text alignment verification and Surah context lock-in"
```

---

### Task 3: Multi-Source Classical Tafsir API & Gemini Reflection Synthesis

**Files:**
- Create: `src/services/tafsir-api.js`
- Modify: `src/services/gemini.js`
- Test: `tests/services/tafsir-api.test.js`
- Test: `tests/services/gemini.test.js`

**Interfaces:**
- Produces:
  - `cleanTafsirHtml(html: string): string`: Strips HTML tags, decodes common entities, and normalizes spacing.
  - `fetchMultiTafsir(surah: number, ayah: number): Promise<{ ibnKathir: string, maarif: string, tazkirul: string, quranComUrl: string }>`: Concurrently fetches 3 classical Tafsirs from Quran.com API v4 (Ibn Kathir `169`, Ma'arif al-Qur'an `168`, Tazkirul Quran `817`).
  - `synthesizeTafsir(verseData: object, multiTafsir: object, mode: string, apiKey: string): Promise<string>` in `gemini.js`: Prompts Gemini to synthesize a simplified explanation with analogies/stories based strictly on the 3 classical sources.
  - `generateSimplifiedTafsir(verseData: object, surah: number, ayah: number, mode: string, apiKey: string): Promise<{ text: string, mode: string, quranComUrl: string }>` in `tafsir-api.js`: Coordinates fetch and synthesis.

- [ ] **Step 1: Write failing tests in `tests/services/tafsir-api.test.js` and `tests/services/gemini.test.js`**

```javascript
// tests/services/tafsir-api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanTafsirHtml, fetchMultiTafsir, generateSimplifiedTafsir } from '../../src/services/tafsir-api.js';

describe('Multi-Source Tafsir API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('cleanTafsirHtml strips tags and entities', () => {
    const raw = '<p>This is a <b>test</b> explanation.&nbsp;Ref: 1:1</p>';
    expect(cleanTafsirHtml(raw)).toBe('This is a test explanation. Ref: 1:1');
  });

  it('fetchMultiTafsir fetches all 3 classical tafsirs concurrently', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      let text = 'Default tafsir text';
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
  });

  it('generateSimplifiedTafsir orchestrates fetch and synthesis', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tafsir: { text: 'Classical commentary' } })
    });

    const fakeVerse = { surahNumber: 67, verseStart: 1, englishTranslation: 'Blessed is He...' };
    const res = await generateSimplifiedTafsir(fakeVerse, 67, 1, 'quick', 'fake-key');
    expect(res).toHaveProperty('text');
    expect(res).toHaveProperty('mode', 'quick');
    expect(res.quranComUrl).toBe('https://quran.com/67/1/tafsirs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/tafsir-api.test.js`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `src/services/tafsir-api.js` and `synthesizeTafsir` in `src/services/gemini.js`**

1. In `src/services/tafsir-api.js`:
   - Implement `cleanTafsirHtml`: removes `<[^>]*>`, replaces `&nbsp;` with space, collapses whitespace.
   - Implement `fetchMultiTafsir(surah, ayah)`:
     - Uses `Promise.all([fetch169, fetch168, fetch817])` with per-promise error catch returning `''`.
     - Returns `{ ibnKathir, maarif, tazkirul, quranComUrl: 'https://quran.com/' + surah + '/' + ayah + '/tafsirs' }`.
   - Implement `generateSimplifiedTafsir(verseData, surah, ayah, mode, apiKey)`.
2. In `src/services/gemini.js`:
   - Implement `synthesizeTafsir(verseData, multiTafsir, mode, apiKey)`:
     - Mode instructions:
       - `quick`: 60-90s spoken pace (~120-160 words). Must include 1 clear, relatable everyday story or analogy explaining the verse's core wisdom.
       - `detailed`: ~250-350 words. Explains Context of Revelation (*Asbab al-Nuzul*), key thematic lessons, and practical life applications.
       - `comprehensive`: ~450-600 words. Systematic comparative study weaving insights from Ibn Kathir, Ma'arif al-Qur'an, and Tazkirul Quran.
     - Strict rule: Must ground takeaways strictly in the provided classical texts; no ungrounded theology.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/tafsir-api.test.js tests/services/gemini.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/tafsir-api.js src/services/gemini.js tests/services/tafsir-api.test.js tests/services/gemini.test.js
git commit -m "feat(tafsir): implement multi-source classical tafsir ingestion and Gemini simplified synthesis"
```

---

### Task 4: Offscreen Audio Streaming & Gemini 3.8 Flash Live Engine

**Files:**
- Create: `src/services/gemini-live.js`
- Modify: `src/offscreen/offscreen.js`
- Test: `tests/services/gemini-live.test.js`
- Test: `tests/offscreen/offscreen.test.js`

**Interfaces:**
- Produces:
  - `createGeminiLiveSession(apiKey, options)`:
    - Connects via WebSocket to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`.
    - Sends setup handshake specifying `models/gemini-3.8-live` and Quran verse identification prompt.
    - `session.sendAudioChunk(base64Pcm)`: sends 16kHz PCM media chunks.
    - `session.close()`: cleanly closes WebSocket.
    - Triggers `options.onVerseIdentified(result)` on server messages.
  - In `offscreen.js`:
    - Handles `START_STREAMING`: captures tab/mic, routes tab audio to `AudioContext.destination` (never muted), captures 16kHz PCM samples, and streams chunks to Gemini 3.8 Flash Live (with sliding REST chunk fallback).
    - Handles `STOP_STREAMING`: closes live session, clears intervals, and releases media tracks.

- [ ] **Step 1: Write failing tests in `tests/services/gemini-live.test.js` and `tests/offscreen/offscreen.test.js`**

Add tests for:
1. `createGeminiLiveSession` sends initial setup handshake with `models/gemini-3.8-live`.
2. `sendAudioChunk` formats `realtimeInput.mediaChunks` with `audio/pcm;rate=16000`.
3. Server text messages are parsed into identification results and passed to `onVerseIdentified`.
4. `offscreen.js` handles `START_STREAMING` and `STOP_STREAMING` with audio pass-through preserved.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/gemini-live.test.js tests/offscreen/offscreen.test.js`  
Expected: FAIL with "Cannot find module" / missing live session

- [ ] **Step 3: Implement `src/services/gemini-live.js` and PCM streaming in `src/offscreen/offscreen.js`**

Implement `gemini-live.js` WebSocket client and audio conversion in `offscreen.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/gemini-live.test.js tests/offscreen/offscreen.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/gemini-live.js src/offscreen/offscreen.js tests/services/gemini-live.test.js tests/offscreen/offscreen.test.js
git commit -m "feat(streaming): implement Gemini 3.8 Flash Live WebSocket engine and 16kHz PCM audio streaming"
```

---

### Task 5: Background Streaming & Tafsir Orchestration

**Files:**
- Modify: `src/background/service-worker.js`
- Test: `tests/background/service-worker.test.js`

**Interfaces:**
- Consumes:
  - `processAndEnrichRecitation` from `matcher.js`
  - `generateSimplifiedTafsir` from `tafsir-api.js`
- Produces:
  - State tracking: `streamingSession = { active: boolean, tabId: number, currentSurah: number, currentAyah: number }`
  - Message handlers for `START_STREAM`, `STOP_STREAM`, `STREAM_CHUNK`, and `REQUEST_TAFSIR`.

- [ ] **Step 1: Write failing tests in `tests/background/service-worker.test.js`**

Add tests proving:
1. `START_STREAM` initiates streaming and marks session active.
2. `STREAM_CHUNK` identifies audio chunk with Surah lock-in context, and updates HUD state to `'streaming'`.
3. `STOP_STREAM` shuts down streaming session.
4. `REQUEST_TAFSIR` calls `generateSimplifiedTafsir` with requested mode and returns the generated reflection.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/background/service-worker.test.js`  
Expected: FAIL on stream and tafsir handlers

- [ ] **Step 3: Implement streaming & Tafsir coordination in `src/background/service-worker.js`**

1. Wire `START_STREAM` and `STOP_STREAM` messages to offscreen document.
2. In `STREAM_CHUNK` handler:
   - Call `processAndEnrichRecitation(base64, mimeType, apiKey, translationId, { surahNumber: session.currentSurah, currentAyah: session.currentAyah })`.
   - Update `currentSurah` and `currentAyah` when recitation advances.
   - Send `UPDATE_HUD_STATE` to active tab with `{ state: 'streaming', data: { ...verseDetails, isStreaming: true } }`.
3. In `REQUEST_TAFSIR` handler:
   - Call `generateSimplifiedTafsir(message.verseData, message.surah, message.ayah, message.mode, apiKey)`.
   - Send response back to sender.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/background/service-worker.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/service-worker.js tests/background/service-worker.test.js
git commit -m "feat(background): orchestrate live Ayah streaming and Tafsir synthesis requests"
```

---

### Task 6: Floating HUD UI - Streaming Tracker, Tafsir Drawer & Audio TTS Player

**Files:**
- Modify: `src/ui/floating-hud.js`
- Modify: `src/ui/floating-hud.css`
- Test: `tests/ui/floating-hud.test.js`

**Interfaces:**
- Consumes:
  - Callbacks `onStartStream`, `onStopStream`, `onRequestTafsir`
- Produces:
  - Live Stream Toggle Button (`▶ Follow Live Recitation` / `⏸ Pause Live Following`).
  - Active Streaming Indicator (pulsing emerald badge).
  - Auto-advancing Ayah updates in HUD.
  - Expandable Tafsir Drawer:
    - Mode Segmented Tabs (`⚡ 60-90s Quick`, `📖 Detailed`, `🏛️ Comprehensive`).
    - Tafsir Read View.
    - Web Speech API Audio Player (Play/Pause, speed selector `1x`, `1.25x`, `1.5x`).
    - Classical Tafsir Deep-Link (`Read Full Classical Tafsirs on Quran.com ↗`).

- [ ] **Step 1: Write failing tests in `tests/ui/floating-hud.test.js`**

Add tests verifying:
1. HUD renders Stream Toggle Button and fires `onStartStream` / `onStopStream`.
2. In streaming mode, renders streaming indicator and seamlessly updates verse content without resetting UI.
3. Renders `"📖 Tafsir & Reflections"` button in matched/streaming states.
4. Clicking Tafsir opens drawer, dispatches `onRequestTafsir`, and switches between `quick`, `detailed`, and `comprehensive` tabs.
5. Renders TTS audio controls (Play/Pause/Speed) and Quran.com classical deep-link.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/floating-hud.test.js`  
Expected: FAIL on new UI elements

- [ ] **Step 3: Implement UI in `src/ui/floating-hud.js` & `src/ui/floating-hud.css`**

- Add Live Streaming toggle button and pulsing indicator styles.
- Add Tafsir Drawer markup and CSS in Shadow DOM.
- Decouple Tafsir state: keep `activeTafsirVerseKey` pinned to the Ayah the user opened, so streaming updates to the background verse card do not interrupt TTS playback or discard reading view. Include a `"Live is at {surah}:{ayah} [Switch]"` pill if streaming advances ahead of the active Tafsir view.
- Wire Web Speech API (`window.speechSynthesis`, `new SpeechSynthesisUtterance`) with Play/Pause state and rate selection (`1x`, `1.25x`, `1.5x`).
- Add Quran.com classical link button (`https://quran.com/${surah}/${ayah}/tafsirs`) opening in new tab.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/floating-hud.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/floating-hud.js src/ui/floating-hud.css tests/ui/floating-hud.test.js
git commit -m "feat(ui): add live streaming tracker, multi-depth Tafsir drawer, and TTS audio player"
```

---

### Task 6.5: Options Page Model Selection

**Files:**
- Modify: `src/options/options.html`
- Modify: `src/options/options.js`
- Test: `tests/options/options.test.js`

**Interfaces:**
- Produces:
  - Model selection dropdown in Options: `gemini-2.5-flash` (recommended default), `gemini-2.0-flash`, `gemini-1.5-flash`.
  - Stored in `chrome.storage.sync` under `selectedModel`.

- [ ] **Step 1: Write failing test in `tests/options/options.test.js`**
- [ ] **Step 2: Implement model selector in options UI & storage sync**
- [ ] **Step 3: Verify tests pass**
- [ ] **Step 4: Commit**

```bash
git add src/options/options.html src/options/options.js tests/options/options.test.js
git commit -m "feat(options): add configurable Gemini model selection in options page"
```

---

### Task 7: Full Integration Verification & Documentation

**Files:**
- Modify: `README.md`
- Run: Full test suite (`npm test`)

- [ ] **Step 1: Run complete test suite**

Run: `npm test`  
Expected: 100% tests passing across all suites (100+ tests).

- [ ] **Step 2: Update `README.md`**

Document:
- Two-stage deterministic seek verification.
- Live Ayah-by-Ayah streaming mode.
- Multi-source Tafsir (Ibn Kathir, Ma'arif al-Qur'an, Tazkirul Quran) with 3 synthesis depths.
- Read & Audio (TTS) features and Quran.com classical deep-link.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document accurate seek, continuous streaming, and multi-source Tafsir engine"
```
