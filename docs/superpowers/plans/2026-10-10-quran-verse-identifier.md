# Quran Recitation Verse Identifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension (Manifest V3) that identifies Quran verses recited in browser video streams (YouTube, Reels, Shorts) or via microphone using Google Gemini Audio and Quran.com API, displaying the results in a draggable floating on-page card.

**Architecture:** The extension uses an on-demand trigger model (`activeTab` / `Alt+Q`) to inject an isolated Shadow DOM floating HUD into the active webpage. Audio from the tab or microphone is captured via an offscreen document (with AudioContext audio pass-through to prevent muting), sent to Google Gemini Audio API for direct verse identification, verified and enriched via the official Quran.com REST API for authentic Uthmani script and translations, and presented on the draggable HUD.

**Tech Stack:** Chrome Extensions Manifest V3, JavaScript (ES Modules), Web Audio API, Google Gemini Audio (Gemini 2.0 Flash / 1.5 Flash), Quran.com API v4, HTML5/CSS3 (Shadow DOM), Vitest for unit testing.

**Spec:** `docs/superpowers/specs/2026-10-10-quran-verse-identifier-design.md`

## Global Constraints

- Chrome Extensions Manifest V3 compliant (no remote code execution; offscreen document for DOM/Web Audio APIs).
- Permissions strictly limited to `activeTab`, `tabCapture`, `offscreen`, `storage`, and `scripting`.
- Tab audio capture must never mute or interrupt audio playing to the user's speakers/headphones.
- Zero style bleed between webpage and extension UI using isolated Shadow DOM (`attachShadow({ mode: 'open' })`).
- Multi-verse spans (e.g., `112:1–4` or `55:12–13`) must be supported with unified Arabic text and translations.
- Zero server hosting required for end users; uses client-side calls to Google Gemini API (free tier) and Quran.com public API.

## Review Focus

1. **Audio pass-through failure:** Tab capture cutting off sound in user headphones. (Verified in Task 3 tests).
2. **Missing or invalid Gemini API key:** User triggers identification before setting up API key. HUD must present a clear setup guide and link to options rather than hanging. (Verified in Task 2 & Task 5 tests).
3. **Multi-verse range query failure:** Recitation spans multiple verses; Quran.com query must fetch and concatenate all verses cleanly without 404. (Verified in Task 1 tests).
4. **Duplicate injection / Rapid toggle:** Double-clicking the toolbar button or pressing `Alt+Q` multiple times must not spawn multiple HUD overlays or orphaned recorders. (Verified in Task 4 & Task 5 tests).
5. **No Quran match detected / Background noise:** Gemini detects ambient speech or non-Quranic noise; HUD must present a graceful "No verse detected - Try again" state. (Verified in Task 2 & Task 5 tests).

---

## File Structure

- `manifest.json` — Chrome MV3 manifest with permissions, commands, action, offscreen, options.
- `package.json` — Dev dependencies (Vitest, jsdom) for automated testing.
- `src/services/quran-api.js` — Quran.com v4 REST API client for verse metadata, Uthmani script, and translations.
- `src/services/gemini.js` — Google Gemini Audio client for multimodal audio analysis and structured JSON extraction.
- `src/services/matcher.js` — Coordinates Gemini analysis, fallback normalization, and Quran.com enrichment.
- `src/offscreen/offscreen.html` — Offscreen document HTML container.
- `src/offscreen/offscreen.js` — Captures tab audio (with pass-through) or microphone, encodes to WebM/Base64.
- `src/ui/floating-hud.js` — Unified on-page HUD component in Shadow DOM (radar, toggles, result card, minimization).
- `src/ui/floating-hud.css` — Modern, dark-mode CSS styles for HUD (Amiri font, drag handle, responsive layout).
- `src/background/service-worker.js` — Background service worker orchestrating actions, messages, and offscreen management.
- `src/options/options.html` — Options page for API key and default translation language.
- `src/options/options.js` — Logic for saving/testing API key and language preferences.
- `tests/services/quran-api.test.js` — Unit tests for Quran.com API client.
- `tests/services/gemini.test.js` — Unit tests for Gemini Audio recognition and JSON parsing.
- `tests/services/matcher.test.js` — Unit tests for matching logic and multi-verse coordination.
- `tests/ui/floating-hud.test.js` — Unit tests for HUD Shadow DOM rendering and state transitions.

---

### Task 1: Project Setup & Quran.com API Integration

**Files:**
- Create: `package.json`
- Create: `src/services/quran-api.js`
- Create: `tests/services/quran-api.test.js`

**Interfaces:**
- Produces: `fetchVerseDetails(surah: number, fromAyah: number, toAyah: number, translationId: number): Promise<{ surahName: string, verseKey: string, arabicText: string, translationText: string, quranComUrl: string }>`
- Produces: `getAvailableTranslations(): Promise<Array<{ id: number, languageName: string, name: string }>>`

- [ ] **Step 1: Write the failing test for `fetchVerseDetails` and `getAvailableTranslations`**

```javascript
// tests/services/quran-api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchVerseDetails, getAvailableTranslations } from '../../src/services/quran-api.js';

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

  it('fetches and joins multi-verse spans (e.g. 112:1-3)', async () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/quran-api.test.js`  
Expected: FAIL with "Cannot find module `../../src/services/quran-api.js`"

- [ ] **Step 3: Implement `fetchVerseDetails` and `getAvailableTranslations` in `src/services/quran-api.js`**

Implement mapping of 114 Surah names, fetching from `https://api.quran.com/api/v4/verses/by_chapter/{surah}?translations={translationId}&fields=text_uthmani`, filtering verses within `fromAyah` and `toAyah`, joining texts with verse markers, and providing safe error handling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/quran-api.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json src/services/quran-api.js tests/services/quran-api.test.js
git commit -m "feat(api): implement Quran.com REST API client for verse and translation retrieval"
```

---

### Task 2: Gemini Audio Engine for Quran Recitation Identification

**Files:**
- Create: `src/services/gemini.js`
- Create: `src/services/matcher.js`
- Create: `tests/services/gemini.test.js`
- Create: `tests/services/matcher.test.js`

**Interfaces:**
- Consumes: `fetchVerseDetails` from `src/services/quran-api.js`
- Produces: `identifyQuranAudio(audioBase64: string, mimeType: string, apiKey: string): Promise<{ matched: boolean, surahNumber?: number, ayahStart?: number, ayahEnd?: number, confidence?: number, recitedArabic?: string, error?: string }>`
- Produces: `processAndEnrichRecitation(audioBase64: string, mimeType: string, apiKey: string, translationId: number): Promise<{ success: boolean, data?: object, error?: string }>`

- [ ] **Step 1: Write failing tests for `identifyQuranAudio` and `processAndEnrichRecitation`**

```javascript
// tests/services/gemini.test.js
import { describe, it, expect, vi } from 'vitest';
import { identifyQuranAudio } from '../../src/services/gemini.js';

describe('Gemini Audio Engine', () => {
  it('returns structured verse identification from valid audio response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                matched: true,
                surah_name: "Ar-Rahman",
                surah_number: 55,
                ayah_start: 13,
                ayah_end: 13,
                confidence: 0.98,
                recited_arabic: "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ"
              })
            }]
          }
        }]
      })
    });

    const result = await identifyQuranAudio('fakeBase64Audio', 'audio/webm', 'fake-key');
    expect(result.matched).toBe(true);
    expect(result.surahNumber).toBe(55);
    expect(result.ayahStart).toBe(13);
    expect(result.ayahEnd).toBe(13);
  });

  it('handles missing API key with informative error', async () => {
    const result = await identifyQuranAudio('fakeBase64Audio', 'audio/webm', '');
    expect(result.matched).toBe(false);
    expect(result.error).toContain('API key is missing');
  });

  it('handles non-recitation or low-confidence audio cleanly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ matched: false, reason: "No Quran recitation detected" }) }]
          }
        }]
      })
    });

    const result = await identifyQuranAudio('fakeAudio', 'audio/webm', 'fake-key');
    expect(result.matched).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/gemini.test.js`  
Expected: FAIL with "Cannot find module `../../src/services/gemini.js`"

- [ ] **Step 3: Implement `src/services/gemini.js` and `src/services/matcher.js`**

Implement Gemini 2.0 Flash / 1.5 Flash endpoint (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`) with `inlineData` audio payload and system instructions instructing Gemini to strictly identify Quran recitations into JSON schema. Wire `processAndEnrichRecitation` in `matcher.js` to call `identifyQuranAudio` and enrich with `fetchVerseDetails`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/gemini.test.js tests/services/matcher.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/gemini.js src/services/matcher.js tests/services/gemini.test.js tests/services/matcher.test.js
git commit -m "feat(ai): integrate Gemini Audio identification and Quran enrichment coordinator"
```

---

### Task 3: Offscreen Audio Capture Document (Tab & Mic with Pass-Through)

**Files:**
- Create: `src/offscreen/offscreen.html`
- Create: `src/offscreen/offscreen.js`
- Create: `tests/offscreen/offscreen.test.js`

**Interfaces:**
- Produces: `startRecording(source: 'tab' | 'mic', streamId?: string, durationMs?: number): Promise<{ base64: string, mimeType: string }>`
- Produces: `stopRecording(): void`

- [ ] **Step 1: Write test for offscreen audio capture and AudioContext pass-through**

```javascript
// tests/offscreen/offscreen.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupAudioCapture } from '../../src/offscreen/offscreen.js';

describe('Offscreen Audio Capture', () => {
  it('connects tab audio stream to AudioContext destination so sound is not muted', async () => {
    const mockDestination = {};
    const mockSourceNode = { connect: vi.fn() };
    const mockAudioContext = {
      createMediaStreamSource: vi.fn().mockReturnValue(mockSourceNode),
      destination: mockDestination
    };

    const mockStream = { getAudioTracks: () => [{ stop: vi.fn() }] };
    setupAudioCapture(mockStream, mockAudioContext);

    expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    expect(mockSourceNode.connect).toHaveBeenCalledWith(mockDestination);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/offscreen/offscreen.test.js`  
Expected: FAIL with "Cannot find module `../../src/offscreen/offscreen.js`"

- [ ] **Step 3: Implement `src/offscreen/offscreen.html` and `src/offscreen/offscreen.js`**

Implement `setupAudioCapture` with pass-through, `MediaRecorder` collecting WebM chunks for 5 seconds (or until stopped), converting blob to Base64 via `FileReader`, and sending the result back to the background script via `chrome.runtime.sendMessage`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/offscreen/offscreen.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/offscreen/offscreen.html src/offscreen/offscreen.js tests/offscreen/offscreen.test.js
git commit -m "feat(capture): implement offscreen audio capture with AudioContext unmuted pass-through"
```

---

### Task 4: Unified Draggable Floating HUD UI (Shadow DOM)

**Files:**
- Create: `src/ui/floating-hud.js`
- Create: `src/ui/floating-hud.css`
- Create: `tests/ui/floating-hud.test.js`

**Interfaces:**
- Produces: `mountFloatingHud(): HTMLElement`
- Produces: `updateHudState(state: 'listening' | 'analyzing' | 'matched' | 'error' | 'minimized', data?: object): void`
- Produces: `destroyFloatingHud(): void`

- [ ] **Step 1: Write failing test for HUD Shadow DOM creation, state transitions, and dragging**

```javascript
// tests/ui/floating-hud.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mountFloatingHud, updateHudState, destroyFloatingHud } from '../../src/ui/floating-hud.js';

describe('Floating HUD Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts into an isolated Shadow Root so host page styles do not bleed', () => {
    const container = mountFloatingHud();
    expect(container).toBeDefined();
    expect(container.shadowRoot).toBeDefined();
    expect(container.shadowRoot.querySelector('.quran-hud')).not.toBeNull();
  });

  it('renders listening radar and source toggle in listening state', () => {
    mountFloatingHud();
    updateHudState('listening', { source: 'tab' });
    const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
    expect(shadow.querySelector('.radar-container')).not.toBeNull();
    expect(shadow.querySelector('.source-toggle')).not.toBeNull();
  });

  it('renders Arabic verse and translation in matched state', () => {
    mountFloatingHud();
    updateHudState('matched', {
      surahName: 'Ar-Rahman',
      verseKey: '55:13',
      arabicText: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
      translationText: 'So which of the favors of your Lord would you deny?'
    });
    const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
    expect(shadow.querySelector('.surah-title').textContent).toContain('Ar-Rahman');
    expect(shadow.querySelector('.arabic-text').textContent).toContain('فَبِأَيِّ آلَاءِ');
    expect(shadow.querySelector('.translation-text').textContent).toContain('favors of your Lord');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/floating-hud.test.js`  
Expected: FAIL with "Cannot find module `../../src/ui/floating-hud.js`"

- [ ] **Step 3: Implement `src/ui/floating-hud.js` and `src/ui/floating-hud.css`**

Implement Shadow DOM container `#quran-verse-hud-root`. Add draggable pointer event handlers on header handle. Implement rendering for:
- State `listening`: Pulsing audio radar animation, Tab/Mic switch buttons, Cancel button.
- State `analyzing`: Smooth spinner with "Analyzing recitation with Gemini...".
- State `matched`: Surah badge, Uthmani calligraphy, translation card, language dropdown, Copy button, Quran.com link.
- State `minimized`: Compact circular floating badge with Quran icon.
- State `error`: Helpful error card with "Open Settings" link if API key is missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/floating-hud.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/floating-hud.js src/ui/floating-hud.css tests/ui/floating-hud.test.js
git commit -m "feat(ui): implement draggable on-page Floating HUD with isolated Shadow DOM"
```

---

### Task 5: Background Service Worker, Options Page & Manifest Wiring

**Files:**
- Create: `manifest.json`
- Create: `src/background/service-worker.js`
- Create: `src/options/options.html`
- Create: `src/options/options.js`
- Create: `src/options/options.css`

**Interfaces:**
- Consumes: `src/offscreen/offscreen.js`, `src/services/matcher.js`, `src/ui/floating-hud.js`
- Produces: Chrome Extension bundle runnable in browser (`chrome://extensions`)

- [ ] **Step 1: Write `manifest.json` with Manifest V3 specifications**

Declare permissions (`activeTab`, `tabCapture`, `offscreen`, `storage`, `scripting`), command (`Alt+Q` with description "Identify Quran recitation in active tab"), background service worker (`src/background/service-worker.js`), options page (`src/options/options.html`), and web accessible resources.

- [ ] **Step 2: Implement `src/options/options.html` and `src/options/options.js`**

Create clean options interface for:
- Google Gemini API Key input with password toggle, link to Google AI Studio, and "Test API Key" button.
- Translation language selector (English, Bengali, Urdu, Indonesian, French, Turkish, Spanish, etc.) fetched from Quran.com.
- Auto-save to `chrome.storage.sync`.

- [ ] **Step 3: Implement `src/background/service-worker.js`**

Implement lifecycle:
1. `chrome.action.onClicked` & `chrome.commands.onCommand`: Check if HUD is already present in `activeTab`. If not, inject `src/ui/floating-hud.js` and call `mountFloatingHud()`.
2. Ensure offscreen document exists (`chrome.offscreen.createDocument`).
3. Handle message `START_CAPTURE`: Get media stream ID via `chrome.tabCapture.getMediaStreamId`, pass to offscreen document.
4. On audio capture complete: Retrieve stored Gemini API key and preferred language, call `processAndEnrichRecitation`, and message result to content script to trigger `updateHudState('matched', data)` or `updateHudState('error', err)`.

- [ ] **Step 4: Run end-to-end integration test suite**

Run: `npx vitest run`  
Expected: All test suites PASS.

- [ ] **Step 5: Commit**

```bash
git add manifest.json src/background/service-worker.js src/options/ tests/
git commit -m "feat(ext): wire background service worker, options page, and manifest configuration"
```

---

### Task 6: Manual Extension Verification & Packaging

**Files:**
- Create: `README.md` (Installation and user guide)
- Create: `assets/icons/` (Extension icons 16, 48, 128)

**Interfaces:**
- Produces: Fully loadable unpacked extension ready for Chrome testing.

- [ ] **Step 1: Create extension icons in `assets/icons/`**

Generate SVG/PNG icon assets representing Quran/audio waves for 16x16, 48x48, and 128x128 sizes.

- [ ] **Step 2: Create comprehensive `README.md`**

Document:
1. How to load unpacked extension in Chrome (`chrome://extensions` -> Developer Mode -> Load unpacked).
2. How to get a free Google Gemini API key in 1 minute from Google AI Studio.
3. How to use on YouTube, YouTube Shorts, Instagram Reels, and via microphone.
4. Keyboard shortcut guide (`Alt+Q`).

- [ ] **Step 3: Verification**

Run validation checks on `manifest.json` schema and test suite.

- [ ] **Step 4: Commit**

```bash
git add README.md assets/
git commit -m "docs: add user setup guide and icon assets"
```
