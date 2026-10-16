# Accurate Seek, Ayah Streaming, and Multi-Source Tafsir Engine - Design Document

**Date:** 2026-10-11  
**Status:** Ready for Review  
**Project:** Quran Verse Identifier (RecitID) Chrome Extension  

---

## 1. Intent and The Why

The extension has successfully implemented tab audio capture, Google Gemini audio identification, and Quran.com metadata enrichment. However, user testing revealed three critical opportunities for improvement:
1. **Seek Accuracy:** LLMs occasionally hallucinate Ayah numbers (e.g. confusing Ayah 20 with 21 or confusing identical phrases across chapters), even when they accurately transcribe the spoken Arabic words.
2. **Continuous Live Streaming (Ayah by Ayah):** Rather than a one-shot 5-second snapshot, users listening to extended recitations want the extension to automatically follow along verse-by-verse in real time.
3. **Understandable Tafsir & Audio Reflections:** Users want to not only read the translation but also understand the deeper meaning, context, and life lessons of the recited Ayahs through an accessible explanation (using everyday analogies and stories), grounded in three authentic classical commentaries, with options to Read or Listen.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Deterministic Two-Stage Seek Verification:** Use Arabic normalization to compare Gemini's transcribed words against the fetched verse. If there is a mismatch or low confidence, automatically override via Quran.com's authentic text search API to pinpoint the mathematically exact Surah and Ayah.
- **Surah Lock-In Context:** During sequential seeking or continuous streaming, restrict Gemini's search space to the locked-in chapter, eliminating cross-Surah jumps.
- **Ayah-by-Ayah Continuous Streaming:** Implement a sliding audio chunk pipeline in `offscreen.js` with unmuted audio pass-through that continuously tracks reciter progression across verse boundaries.
- **Multi-Source Classical Tafsir Ingestion:** Fetch 3 authentic English Tafsirs in parallel from Quran.com API v4:
  1. *Ibn Kathir (Abridged)* (ID 169)
  2. *Ma'arif al-Qur'an* (Mufti Muhammad Shafi, ID 168)
  3. *Tazkirul Quran* (Maulana Wahiduddin Khan, ID 817)
- **Multi-Depth Simplified Synthesis:** Prompt Gemini using the 3 classical Tafsir texts as strict ground truth to synthesize an easy-to-grasp explanation featuring relatable stories and everyday analogies across 3 user-selectable tiers:
  1. *Quick (60–90 seconds)*: Fast, memorable takeaway and core analogy.
  2. *Detailed*: Occasion of revelation (*Asbab al-Nuzul*) and practical life applications.
  3. *Comprehensive Study*: Multi-source comparative synthesis and spiritual wisdom.
- **Dual Consumption (Read & Hear):**
  - *Read:* Formatted markdown view inside an expandable HUD drawer.
  - *Hear:* Audio playback using natural text-to-speech with Play, Pause, and speed controls (1x, 1.25x, 1.5x).
- **Direct Classical Redirect:** Provide a clean `"Read Full Classical Tafsirs on Quran.com ↗"` deep-link (`https://quran.com/{surah}/{ayah}/tafsirs`) so users who want raw academic text can view it on Quran.com without bloating the extension.
- **Strict Scope Constraint:** Explicitly exclude reciter / Qari identification. Focus exclusively on Surah, Ayah range, translation, and Tafsir reflections.

### Non-Goals
- Local offline speech recognition models (remains cloud-based via Gemini REST API).
- Storing entire offline multi-megabyte classical Tafsir libraries inside the extension package.
- Direct voice cloning or third-party paid TTS APIs (uses browser `speechSynthesis` or Gemini audio).

### Anti-Goals
- **No Ungrounded AI Hallucinations for Tafsir:** Gemini must never invent religious commentary or rulings from scratch; all explanations must cite and ground themselves in the three fetched classical commentaries.
- **No Audio Muting:** Tab audio pass-through to `AudioContext.destination` must remain uninterrupted during both one-shot identification and continuous streaming.
- **No Page Layout Distortions:** All HUD elements (including Tafsir drawer and audio player) must remain isolated in Shadow DOM.

---

## 3. Architecture & System Flow

```
[ Browser Video Stream / Mic ]
              │
              ▼
[ Offscreen Audio Capture (offscreen.js) ]
  ├── Mode A: One-Shot (7.5s buffer)
  └── Mode B: Continuous Stream (Sliding 5s chunks) ──> Web Audio Pass-Through (Unmuted)
              │
              ▼
[ Gemini Audio Engine (gemini.js) ]
  ├── Transcribes phonetic Arabic speech (recited_arabic)
  └── Predicts Surah & Ayah (with optional Surah Lock-In Context)
              │
              ▼
[ Recitation Matcher (matcher.js) ]
  ├── Step 1: Normalizes Arabic text (removes tashkeel, standardizes letters)
  ├── Step 2: Checks word overlap between recited words and fetched verse
  └── Step 3: If mismatch, queries Quran.com search API to rescue true verse
              │
              ▼
[ Floating HUD (floating-hud.js) ]
  ├── Displays Surah, Ayah Badge, Uthmani Calligraphy, Translation
  ├── Live Stream Toggle (Auto-advances Ayah by Ayah as reciter progresses)
  └── "📖 Tafsir & Reflections" Button
              │
              ▼ (When Tafsir clicked)
[ Multi-Tafsir Pipeline (tafsir-api.js & gemini.js) ]
  ├── Parallel Fetch from Quran.com:
  │     ├── 1. Ibn Kathir (169)
  │     ├── 2. Ma'arif al-Qur'an (168)
  │     └── 3. Tazkirul Quran (817)
  ├── Gemini Synthesis with selected mode (60-90s / Detailed / Comprehensive)
  ├── Render: Formatted Read Drawer + Audio Player (Play/Pause/Speed)
  └── Redirect Link: "Read Full Classical Tafsirs on Quran.com ↗"
```

---

## 4. Subsystem Details

### 4.1 Arabic Normalization & Verification (`src/services/arabic-normalizer.js`)
* `normalizeArabic(text)`:
  * Strips all Tashkeel / Harakat (`َ ُ ِ ّ ْ ً ٌ ٍ ٰ`).
  * Removes Tatweel / Kashida (`ـ`).
  * Normalizes Hamza variants: `[إأآٱ] -> ا`, `[ؤ] -> و`, `[ئ] -> ي`.
  * Normalizes Ta Marbuta (`ة -> ه`) and Alif Maqsura (`ى -> ي`).
* `calculateWordOverlap(textA, textB)`: Tokenizes into normalized word sets and computes intersection ratio.
* `isVerseMatch(verseText, recitedText, threshold = 0.5)`: Returns `true` if at least 50% of the recited words appear sequentially or collectively in the target verse.

### 4.2 Two-Stage Matcher (`src/services/matcher.js`)
1. Fetches candidate verse details from Quran.com API v4 based on Gemini's predicted `(surah, start, end)`.
2. Validates `isVerseMatch(candidateDetails.arabicText, geminiResult.recitedArabic)`.
3. If valid, returns enriched verse data immediately.
4. If invalid or confidence < 0.75:
   * Calls `searchQuran(geminiResult.recitedArabic)`.
   * If search finds a verified Ayah with higher overlap, re-fetches verified verse details from Quran.com.

### 4.3 Continuous Streaming Engine via Gemini 3.8 Flash Live (`src/offscreen/offscreen.js` & `src/services/gemini-live.js`)
* **Model:** Google **Gemini 3.8 Flash Live** (`models/gemini-3.8-live`).
* **Protocol:** Bidirectional WebSocket streaming via `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`.
* **Audio Capture Pipeline:**
  * Uses `AudioContext` connected to captured `MediaStreamSource`.
  * Downsamples audio to 16kHz linear 16-bit PCM.
  * Streams raw PCM chunks via WebSocket:
    `{ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm }] } }`.
  * Crucially, tab audio output remains routed to `AudioContext.destination` so playback is never muted.
* **Session & State Machine:**
  * Initial `setup` message configures `gemini-3.8-live`, `responseModalities: ["TEXT"]`, and Quran Surah lock-in instructions.
  * Server streams back real-time text tokens containing identified verses.
  * When recitation transitions from Ayah $N$ to $N+1$, the service worker updates `currentAyah = N+1` and notifies the HUD.
  * Fallback: Sliding chunk REST pipeline if WebSocket connection is unavailable.
* `STOP_STREAMING`: Closes WebSocket, stops media tracks, and cleans up AudioContext.

### 4.4 Tafsir & Reflections Module (`src/services/tafsir-api.js`)
* `fetchMultiTafsir(surah, ayah)`:
  * Concurrently fetches:
    - `https://api.quran.com/api/v4/tafsirs/169/by_ayah/${surah}:${ayah}` (Ibn Kathir)
    - `https://api.quran.com/api/v4/tafsirs/168/by_ayah/${surah}:${ayah}` (Ma'arif al-Qur'an)
    - `https://api.quran.com/api/v4/tafsirs/817/by_ayah/${surah}:${ayah}` (Tazkirul Quran)
  * Returns `{ ibnKathirText, maarifText, tazkirulText, quranComTafsirUrl }`.
* `generateSimplifiedTafsir(verseData, multiTafsir, mode, apiKey)`:
  * Prompt instructions to Gemini:
    - Strictly ground takeaways in the 3 provided texts.
    - Mode `quick`: 60–90 seconds spoken pace (~120–160 words). Include one vivid, relatable everyday analogy or story.
    - Mode `detailed`: Context of revelation (*Asbab al-Nuzul*), core themes, practical guidance (~250–350 words).
    - Mode `comprehensive`: In-depth multi-source study comparing the insights of Ibn Kathir, Ma'arif al-Qur'an, and Tazkirul Quran (~450–600 words).
    - No academic jargon; crystal clear for everyday Muslims and general readers.

### 4.5 HUD UI & Audio Player (`src/ui/floating-hud.js`)
* **Live Following Controls:**
  * Toggle button: `▶ Follow Live Recitation` / `⏸ Pause Following`.
  * Streaming indicator: pulsating emerald dot + active verse counter (`Surah 67:1 ➔ 67:2`).
  * Auto-scrolling verse transitions.
* **Tafsir Drawer:**
  * Clean sliding drawer below the verse card.
  * Mode segmented tabs: `[60s Quick] [Detailed] [Comprehensive]`.
  * **Listen Controls:** Play/Pause button, elapsed progress bar, and speed toggle (`1x`, `1.25x`, `1.5x`) using browser Web Speech API `SpeechSynthesisUtterance`.
  * **Classical Source Link:** `"View Full Classical Texts on Quran.com ↗"`.

---

## 5. Architectural Edge Cases & State Policies

### 5.1 Decoupled Tafsir Drawer vs. Live Streaming
* **Principle:** Tafsir reading and TTS audio playback are **strictly pinned** to the Ayah the user explicitly opened (`activeTafsirVerseKey`), independent of live recitation transitions.
* When recitation moves ($N \rightarrow N+1$), the background verse card updates smoothly to the live Ayah, but an open Tafsir Drawer or active TTS audio session is **never interrupted or overwritten**.
* A subtle pill inside the drawer indicates live status: `"Viewing Tafsir for 67:1 • Live is at 67:3 [Switch to 67:3]"`.
* Tafsir is generated **on-demand** only when the user requests it, never spammed on background streaming chunks.

### 5.2 Chapter Boundaries, Repetitions, and Video Scrubbing
* **Repetition:** Reciter repeating verse $N$ ($N \rightarrow N$) maintains the current Ayah without triggering an error.
* **Chapter Rollovers:** Surah metadata (ayah count per Surah) allows detecting when $N = \text{totalAyahs}$, permitting natural transition to Surah $S+1$, Ayah $1$.
* **Scrubbing / Drift Recovery:** If 2 consecutive chunks yield no word overlap with the expected $\pm 2$ Ayah window, Surah lock-in is temporarily relaxed to trigger an unconstrained global seek.

### 5.3 Cold Start vs. Warm Start Streaming
* `▶ Follow Live Recitation` can be launched from a matched card (Warm Start) or directly from empty/listening state (Cold Start).
* On Cold Start, Chunk 1 runs an unconstrained discovery seek to anchor `currentSurah` and `currentAyah`, which then transitions into sliding sequential tracking once confirmed.

### 5.4 Search Scoping under Surah Lock-In
* When Surah lock-in is active, fallback text searches in `matcher.js` prioritize results belonging to `currentSurah`. If no match in `currentSurah` meets the threshold, the engine suppresses spurious jumps to identical refrains in other chapters.

### 5.5 Tafsir Source Graceful Degradation
* Ingestion uses `Promise.allSettled`. If 1 or 2 classical sources are missing/empty for a specific verse, Gemini synthesizes using the available sources and notes them accordingly. If all 3 are unavailable, the UI gracefully informs the user with a direct deep-link to Quran.com.

