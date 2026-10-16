# Quran Recitation Verse Identifier (Recitation Shazam) 📖✨

> Instant, accurate Quran recitation identifier, live Ayah-by-Ayah follower, and multi-source classical Tafsir synthesizer for browser video streams (YouTube, Shorts, Instagram Reels, Facebook Reels, TikTok) and live ambient room recitations using **Google Gemini 3.8 Flash Live / 3.8 Flash** and **Quran.com REST API v4**.

Built strictly with **Chrome Manifest V3**, featuring a non-intrusive draggable **Shadow DOM Floating HUD**, **unmuted AudioContext pass-through**, and zero external build step dependencies.

---

## 🌟 Features

- 🎯 **Instant Seek Identification**:
  - **Direct Multimodal Audio Recognition**: Uses Google Gemini to identify the exact Surah and Ayah directly from audio waveforms without reciter bias or restrictive context locks.
  - **Authentic Uthmani Script**: Automatically enriches recognized verses with verified Uthmani calligraphy, verse keys, and translations from the Quran.com API v4.
  - **Graceful Search Fallback**: Automatically recovers verse boundaries via Quran.com search if verse numbering is omitted.

- 🌊 **Continuous Ayah-by-Ayah Live Streaming**:
  - Powered by **Google Gemini 3.8 Flash Live** (`models/gemini-3.8-live`) via bidirectional WebSockets (`BidiGenerateContent`).
  - Streams 16kHz linear 16-bit PCM audio in real time while **keeping tab audio unmuted** for the user.
  - Seamlessly tracks recitations verse-by-verse as the Qari continues reciting.

- 📖 **Multi-Source Classical Tafsir & Reflections**:
  - Concurrently ingests 3 classical commentaries from Quran.com API v4:
    - **Ibn Kathir** (Resource ID `169`)
    - **Ma'arif al-Qur'an** (Resource ID `168`)
    - **Tazkirul Quran** (Resource ID `817`)
  - Synthesizes easy-to-understand explanations with relatable stories and everyday analogies for normal readers across 3 selectable depths:
    - **⚡ 60–90s Quick**: Everyday analogy or vivid story, spoken pace (~120–160 words).
    - **📖 Detailed**: Context of revelation (*Asbab al-Nuzul*), core themes, practical guidance (~250–350 words).
    - **🏛️ Comprehensive Study**: In-depth comparison of Ibn Kathir, Ma'arif al-Qur'an, and Tazkirul Quran insights (~450–600 words).
  - **Read & Hear Modes**:
    - **Read View**: Integrated expandable drawer directly inside the on-page floating HUD.
    - **Hear View**: Built-in Web Speech API TTS player with Play/Pause and speed controls (`1x`, `1.25x`, `1.5x`).
  - **Decoupled Reading State**: An open Tafsir view or active speech session remains pinned to verse $N$ even as live recitation advances to $N+1$, with an intuitive `"Live is at {surah}:{ayah} [Switch]"` sync pill.
  - **Classical Deep-Link**: Direct one-click redirect to `https://quran.com/{surah}/{ayah}/tafsirs` for users wishing to consult the unabridged classical Arabic/English volumes.

- 🎧 **Dual Input Audio Capture**:
  - **Tab Audio Mode**: High-fidelity internal audio stream capture from active browser tabs (`chrome.tabCapture`) with AudioContext loopback so your video audio never mutes.
  - **Microphone Mode**: Capture live room recitations, Taraweeh prayers, lectures, or external speaker recitations with a single toggle.

- 🎨 **Floating Shadow DOM HUD**:
  - Injected directly into the active tab within an isolated Shadow DOM (`#quran-verse-hud-root`) to guarantee zero CSS interference with the host website.
  - Fully draggable anywhere on the screen with bounds clamping.
  - Minimizable to an ambient pill when you want to continue watching without obstruction.
  - One-click copy for Arabic verse and translation text.

- ⚙️ **Configurable Model & Settings**:
  - Configure your own free Gemini API key from Google AI Studio.
  - Choose between Gemini models (`gemini-3.8-flash`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`).
  - Select from 13+ global translations (English, Bengali, Urdu, Indonesian, French, Turkish, etc.).

- ⌨️ **Keyboard Shortcut `Alt+Q`**:
  - Trigger instant recognition without touching the mouse.

---

## 🚀 Quick Start Guide

### 1. Load the Unpacked Extension into Chrome

1. Clone or download this repository to your local computer:
   ```bash
   git clone https://github.com/your-username/quran-recitation-verse-identifier.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select this project's folder (`quran-verse-identifier`).
6. The extension **"Quran Verse Identifier - Recitation Shazam"** is now loaded and visible in your extensions list!

### 2. Obtain a Free Google Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API key"** and copy the generated key. (Gemini API provides free usage tier suitable for everyday use).

### 3. Configure API Key & Translation in Options

1. Click the Quran Verse Identifier icon in your Chrome toolbar, or right-click the extension icon and select **Options**.
2. Paste your Google Gemini API key into the **Google Gemini API Key** field.
3. Click **"Test API Key"** to verify that your key is active and connected.
4. Choose your preferred Quran translation language and Gemini model.
5. Click **Save Settings** (automatically saved to `chrome.storage.sync`).

---

## 🎯 How to Use

### 1. Identifying Verses in Videos (YouTube, Shorts, Reels, Podcasts)

1. Open any video containing Quran recitation in Chrome:
   - YouTube videos or YouTube Shorts
   - Instagram Reels
   - Facebook Reels or Facebook Watch
   - TikTok or Islamic podcasts / lectures
2. Press <kbd>Alt</kbd> + <kbd>Q</kbd> (or click the extension icon in the toolbar).
3. The floating HUD appears in the top-right corner of the tab in **Listening** mode.
4. The extension captures a brief audio sample while **keeping video audio playing smoothly** through your speakers.
5. Within seconds, the HUD transitions to **Matched**, displaying:
   - Surah Name and Ayah number (e.g., `Surah Al-Mulk (67:1)`)
   - Complete Uthmani Arabic script
   - Selected translation
   - **Follow Live Recitation** button
   - **Tafsir & Reflections** button
   - **Copy** button to copy the Ayah text
   - **Quran.com** link

### 2. Following Live Recitation Ayah-by-Ayah

1. Once a verse is matched (or from the HUD), click **▶ Follow Live Recitation**.
2. The HUD displays a pulsing emerald `● Live` badge.
3. As the reciter continues through consecutive verses, the HUD automatically updates to the current Ayah in real time.
4. Click **⏸ Pause Live Following** whenever you want to pause continuous tracking.

### 3. Reading and Listening to Tafsir & Reflections

1. Click **📖 Tafsir & Reflections** on any matched verse.
2. The Tafsir drawer opens with 3 depth tabs:
   - **⚡ 60-90s Quick**: A concise reflection with an engaging everyday analogy or story.
   - **📖 Detailed**: Context of revelation (*Asbab al-Nuzul*) and key thematic lessons.
   - **🏛️ Comprehensive**: Scholarly comparative insights from Ibn Kathir, Ma'arif al-Qur'an, and Tazkirul Quran.
3. Click **🔊 Listen to Tafsir** to hear the reflections read aloud using high quality text-to-speech. Adjust playback speed between `1x`, `1.25x`, and `1.5x`.
4. Click **View Full Classical Texts on Quran.com ↗** to read the complete unabridged classical commentaries directly on Quran.com.

### 4. Identifying Ambient Room Recitations (Microphone Audio)

1. When listening to live prayers, halaqahs, Taraweeh, or external speakers:
2. Open any active browser tab and trigger the extension (<kbd>Alt</kbd> + <kbd>Q</kbd>).
3. On the HUD, click the **Audio Source** switch to select **Microphone**.
4. Grant Chrome permission to access your microphone if prompted.
5. The extension records the ambient room recitation and identifies the verse immediately.

---

## 🏛️ Architecture & Technical Design

```
[ Active Web Tab ] <--------------------+
       |                                |
       | (Alt+Q / Toolbar Click)        | Injects Floating HUD (Shadow DOM)
       v                                | Updates HUD States (Listening -> Analyzing -> Matched)
[ Background Service Worker ]           |
       |                                |
       +---> [ Offscreen Document ]     |
       |        | (tabCapture streamId) |
       |        +-- AudioContext (Unmuted Loopback Destination)
       |        +-- MediaRecorder / 16kHz PCM Streamer
       |        v
       +<-- Audio Buffer (5s) or PCM chunks
       |
       +---> [ Gemini 3.8 Flash Live / 3.8 Flash ]
       |        v
       |     Phonetic Arabic Transcription + Surah/Ayah Predictions
       |
       +---> [ Arabic Normalizer & Two-Stage Matcher ]
       |        v (Word overlap verification & Quran.com text search rescue)
       |
       +---> [ Multi-Source Tafsir Engine ]
       |        +-- Parallel Fetch: Ibn Kathir (169), Ma'arif (168), Tazkirul (817)
       |        +-- Gemini Simplified Synthesis (Story & Analogy)
       |        v
       +--------------------------------+
```

### Module Breakdown

| Module | Location | Purpose |
| :--- | :--- | :--- |
| **Manifest V3** | [`manifest.json`](manifest.json) | Declares permissions (`activeTab`, `tabCapture`, `offscreen`, `storage`, `scripting`), keyboard command `Alt+Q`, and extension metadata. |
| **Service Worker** | [`src/background/service-worker.js`](src/background/service-worker.js) | Central hub orchestrating offscreen capture, live Ayah streaming, Tafsir generation, and HUD state updates. |
| **Offscreen Capture** | [`src/offscreen/offscreen.js`](src/offscreen/offscreen.js) | Captures `tabCapture` & mic streams, maintains unmuted Web Audio loopback, and streams audio data. |
| **Live WebSocket Engine** | [`src/services/gemini-live.js`](src/services/gemini-live.js) | Manages bidirectional WebSockets with Gemini 3.8 Flash Live for continuous real-time verse tracking. |
| **Arabic Normalizer** | [`src/services/arabic-normalizer.js`](src/services/arabic-normalizer.js) | Strips Tashkeel, normalizes Hamza and Alif variants, and calculates authentic text word overlap. |
| **Matcher Coordinator** | [`src/services/matcher.js`](src/services/matcher.js) | Coordinates two-stage verification, Surah lock-in, and Quran.com search fallback rescue. |
| **Tafsir API & Synthesis** | [`src/services/tafsir-api.js`](src/services/tafsir-api.js) | Concurrently ingests 3 classical commentaries and synthesizes 3 depth tiers with relatable analogies. |
| **Floating HUD** | [`src/ui/floating-hud.js`](src/ui/floating-hud.js) | Isolated Shadow DOM user interface with draggable header, live streaming controls, Tafsir drawer, and TTS player. |
| **Options Page** | [`src/options/options.js`](src/options/options.js) | User settings UI for API key verification, model selection, and translation preferences. |

---

## 🧪 Testing & Verification

The project includes an extensive Vitest unit test suite covering 100% of core business logic, audio pipelines, UI state transitions, and Chrome extension messaging.

### Running Tests

Ensure project dependencies are installed:
```bash
npm install
```

Run the Vitest test suite:
```bash
npm test
```

### Test Suite Structure

```
tests/
├── background/
│   └── service-worker.test.js   # Service worker message routing, streaming sessions, Tafsir dispatch (21 tests)
├── offscreen/
│   └── offscreen.test.js        # Tab capture, mic capture, AudioContext loopback, PCM streaming (16 tests)
├── ui/
│   └── floating-hud.test.js     # Shadow DOM isolation, drag gestures, streaming controls, Tafsir drawer, TTS (30 tests)
├── services/
│   ├── arabic-normalizer.test.js# Tashkeel removal, Hamza normalization, word overlap ratio (5 tests)
│   ├── gemini.test.js           # Multimodal prompt format, JSON schema parsing, Tafsir prompt synthesis (18 tests)
│   ├── gemini-live.test.js      # Gemini 3.8 Flash Live WebSocket session, PCM message framing (4 tests)
│   ├── quran-api.test.js        # Quran.com REST API endpoints, Uthmani text, caching (9 tests)
│   ├── tafsir-api.test.js       # Multi-source parallel ingestion (Ibn Kathir, Ma'arif, Tazkirul) (4 tests)
│   └── matcher.test.js          # Two-stage verification, Surah lock-in, search fallback rescue (9 tests)
├── options/
│   └── options.test.js          # API key persistence, model selection, connectivity probe (9 tests)
└── manifest.test.js             # MV3 manifest validity, icon PNG signatures, referenced paths (4 tests)
```

**Total: 129 passing tests across 11 suites** ✅

---

## 🔒 Privacy & Security

- **Ephemeral Audio Buffering**: Audio recorded during recognition is buffered in memory only during active identification, sent directly over TLS/HTTPS or secure WebSockets to Google Gemini API, and discarded immediately. No audio is ever recorded continuously without user intent, saved to disk, or sent to third-party tracking servers.
- **Local Credentials**: Your Google Gemini API key is stored securely on your browser via `chrome.storage.sync` and is never exposed to external web pages.
- **Isolated Shadow DOM**: Injected styles and elements exist exclusively within a closed Shadow DOM container, preventing host page scripts or trackers from altering or reading extension UI data.

---

## 📜 License

MIT License. Designed and engineered for the benefit of the global Muslim community and Quran learners worldwide.

