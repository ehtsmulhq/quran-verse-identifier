# Quran Recitation Verse Identifier Chrome Extension - Design Document

**Date:** 2026-10-10  
**Status:** Ready for Approval  
**Project:** Quran Recitation Verse Identifier  

---

## 1. Intent and The Why

Users frequently encounter Quranic recitations while browsing video platforms such as YouTube, YouTube Shorts, Instagram Reels, Facebook Reels, and TikTok. In many cases, video captions and comments do not mention which Surah or Ayah is playing. Finding the verse currently requires searching phonetics or asking in comments.

This project delivers a browser-based, instant Quran identifier—analogous to Shazam for Quranic recitation. With one click, the extension listens to audio playing in the browser tab or from the room microphone, identifies the recitation, and immediately presents the exact verse (or verse range), Arabic text, and translation in a draggable floating overlay directly on the page without disrupting video playback.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Dual Audio Capture:** Capture audio directly from the active browser tab (pristine internal audio) or from the user's microphone (external speakers, nearby recitation).
- **Gemini Audio AI Engine:** Leverage Google Gemini's native audio understanding (Gemini 2.0 Flash / 1.5 Flash Audio API / Live WebSocket) to directly recognize Quranic recitation with high acoustic and phonetic precision.
- **Accurate Quran Identification (Single & Multi-Verse Spans):** Accurately match recitations to the exact Surah and Ayah or Ayah span (e.g. `Al-Fatiha 1:1–3` or `Ar-Rahman 55:13`) among all 6,236 verses of the Quran.
- **Unified Draggable Floating HUD:** Display listening radar, audio source switch, and match results in a sleek, non-intrusive floating card (Shadow DOM) directly over the webpage/video, with drag-and-drop repositioning and minimize functionality.
- **Multilingual Translations & Authentic Script:** Display authentic Arabic text with translations in the user's preferred language (English, Urdu, Bengali, Indonesian, French, Turkish, etc.) verified and enriched via the official Quran.com API.
- **Instant Actions:** One-click copy for Arabic and translation text, and direct deep-linking to full Surah/Ayah view on Quran.com.
- **Zero Server Infrastructure:** Function as a standalone Chrome extension using Google Gemini's free-tier API without requiring users to host or pay for a backend server.

### Non-Goals
- Video downloading or local audio file storage.
- Identification of non-Quranic audio (such as nasheeds, lectures, or music).
- Offline speech recognition (offline WASM models are 40MB+ and high compute; Gemini cloud API is faster, lighter, and more accurate).

### Anti-Goals
- **No Page Layout Breakage:** Extension UI must not leak styles into host websites (strictly isolated using Shadow DOM).
- **No Tab Audio Disruption:** Tab audio capture must not mute or distort the sound playing to the user's headphones/speakers.
- **No Intrusive Permissions:** Avoid broad `<all_urls>` host permissions. Use on-demand activation via `activeTab`, `tabCapture`, `offscreen`, and `storage`.

---

## 3. Architecture & User Experience

### 3.1 Extension Components (Chrome Manifest V3)

```
[ Active Web Page (YouTube/Instagram) ]
        │ (Toolbar Click / Alt+Q via activeTab)
        ▼
[ Background Service Worker (background.js) ]
        │
        ├───> Injects [ Content Script (content.js) ] ──> Unified Floating HUD (Shadow DOM)
        │                                                  ├── State 1: Listening Radar + Tab/Mic Toggle
        │                                                  ├── State 2: Result Card
        │                                                  └── State 3: Minimized Pill
        │
        ▼
[ Offscreen Document (offscreen.js) ] ── (AudioContext Pass-through + MediaRecorder: WebM/Opus / PCM)
        │
        ▼
[ Google Gemini Audio / Live Engine (services/gemini.js) ] ──> Direct Quranic Audio Analysis (JSON)
        │
        ▼
[ Quran.com API Verifier (services/quran-verifier.js) ] ──> Official Uthmani Script & Verified Translations
```

### 3.2 Trigger Model & Unified HUD Interface
- **On-Demand Activation:** In compliance with privacy best practices, the extension is activated strictly on-demand. When the user clicks the extension toolbar icon (`chrome.action.onClicked`) or presses the global shortcut (`Alt+Q`), the background worker uses `activeTab` to summon the floating HUD directly on the page.
- **Unified On-Page HUD Lifecycle:**
  1. **Listening State:** A compact, draggable translucent HUD appears with an animated audio radar. Users can toggle between **Tab Audio** (default) and **Microphone Audio**, or cancel listening.
  2. **Analyzing State:** A smooth spinner/pulse indicating Gemini audio analysis.
  3. **Matched Result State:** Presents Surah name, Ayah badge (supporting spans like `55:12–13`), Arabic text in Uthmani script, translation in chosen language, "Copy Ayah", and "Open on Quran.com ↗".
  4. **Minimized Pill State:** Clicking the minimize button (`−`) collapses the card into a sleek floating Quran icon that can be clicked anytime to re-expand.

### 3.3 Audio Capture Pipeline
- **Offscreen Document (`offscreen.js`):**
  - For tab capture: Uses `chrome.tabCapture.getMediaStreamId`, establishes a `MediaStream`, connects to an `AudioContext` with `destination` output (so the user's video audio remains completely audible without muting), and captures 4–6 seconds of audio via `MediaRecorder` or raw PCM chunks for Gemini Live.
  - For mic capture: Uses `navigator.mediaDevices.getUserMedia({ audio: true })`.

### 3.4 Recognition & Multi-Verse Matching Engine (Google Gemini Live / Audio)
- **Gemini Audio Engine:** The audio sample is streamed or posted to Google Gemini (using the Gemini 2.0 Flash / 1.5 Flash Audio API with structured JSON output schema).
- **Structured Extraction:** Gemini natively analyzes the recitation acoustics, phonetic tajweed, and context, directly returning structured JSON:
  ```json
  {
    "matched": true,
    "surah_name": "Ar-Rahman",
    "surah_number": 55,
    "ayah_start": 13,
    "ayah_end": 13,
    "confidence": 0.98,
    "recited_arabic": "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ"
  }
  ```
- **Authoritative Verification via Quran.com:** The extension verifies and enriches the result using the official Quran.com REST API (`api.quran.com/api/v4/verses/by_chapter/{surah_id}` or `by_key`), fetching authentic Uthmani calligraphy, Juz/page numbers, and verified translations in the user's preferred language.

### 3.5 Options & Settings (`options.html` / `options.js`)
- Configurable free Google Gemini API Key (with 1-click link to Google AI Studio).
- Default translation language dropdown (English - Sahih International, Bengali, Urdu, Indonesian, French, Turkish, etc.).
- Persisted securely using `chrome.storage.sync`.

---

## 4. Key Architectural Calls

1. **Google Gemini Live / Audio Engine:** Leverages Gemini's multimodal audio capabilities to recognize Quranic recitations natively without lossy intermediate speech-to-text steps.
2. **On-Demand Execution via `activeTab`:** Avoids broad permissions and avoids complex SPA URL watchers. Users summon the tool whenever they want via icon click or `Alt+Q`.
3. **Unified On-Page Floating HUD (No standalone popup):** Eliminates the Chrome MV3 limitation where clicking the webpage dismisses `popup.html`. The entire interaction lifecycle lives directly on the page within an isolated Shadow DOM.
4. **Multi-Verse Span Support:** Handles audio capturing across verse boundaries (e.g., multiple short verses in reels) returning `{ surah, fromAyah, toAyah }` with combined Arabic text and translations.

---

## 5. What is Left to the Implementer
- Choice of Gemini audio format (base64 inlineData vs Gemini Live bidirectional WebSocket).
- Exact prompt tuning for structured JSON response from Gemini.
- Keyboard shortcut customization via `chrome.commands`.
