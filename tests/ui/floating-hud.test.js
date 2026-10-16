// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mountFloatingHud,
  updateHudState,
  destroyFloatingHud,
  isHudMounted
} from '../../src/ui/floating-hud.js';

describe('Floating HUD Component (Shadow DOM)', () => {
  beforeEach(() => {
    destroyFloatingHud();
    document.body.innerHTML = '';
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
    // Mock chrome.runtime
    globalThis.chrome = {
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`)
      }
    };
    // Mock window dimensions
    window.innerWidth = 1024;
    window.innerHeight = 768;
  });

  afterEach(() => {
    destroyFloatingHud();
    vi.restoreAllMocks();
  });

  describe('Mounting & Lifecycle', () => {
    it('mounts into an isolated Shadow Root so host page styles do not bleed', () => {
      const container = mountFloatingHud();
      expect(container).toBeDefined();
      expect(container.id).toBe('quran-verse-hud-root');
      expect(container.shadowRoot).toBeDefined();
      expect(container.shadowRoot.mode).toBe('open');

      // Contains style tag and hud wrapper
      const styleTag = container.shadowRoot.querySelector('style');
      expect(styleTag).not.toBeNull();
      expect(styleTag.textContent).toContain('.quran-hud');

      const hud = container.shadowRoot.querySelector('.quran-hud');
      expect(hud).not.toBeNull();
      expect(isHudMounted()).toBe(true);
    });

    it('returns existing element if already mounted (idempotency, no duplicates)', () => {
      const first = mountFloatingHud();
      const second = mountFloatingHud();
      expect(first).toBe(second);
      expect(document.querySelectorAll('#quran-verse-hud-root').length).toBe(1);
    });

    it('preserves existing callbacks when mountFloatingHud is called with partial callbacks', () => {
      const onCancel = vi.fn();
      const onSourceChange = vi.fn();
      mountFloatingHud({ onCancel });
      mountFloatingHud({ onSourceChange });

      updateHudState('listening');
      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const cancelBtn = shadow.querySelector('.cancel-btn');
      cancelBtn.click();
      expect(onCancel).toHaveBeenCalled();
    });

    it('destroyFloatingHud cleanly removes HUD from DOM and resets state', () => {
      mountFloatingHud();
      expect(isHudMounted()).toBe(true);

      destroyFloatingHud();
      expect(document.getElementById('quran-verse-hud-root')).toBeNull();
      expect(isHudMounted()).toBe(false);
    });
  });

  describe('Listening State', () => {
    it('renders radar animation and audio source toggle with tab as default', () => {
      mountFloatingHud();
      updateHudState('listening', { source: 'tab' });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      expect(shadow.querySelector('.radar-container')).not.toBeNull();
      expect(shadow.querySelectorAll('.radar-wave').length).toBeGreaterThan(0);
      expect(shadow.querySelector('.audio-wave-visualizer')).not.toBeNull();
      expect(shadow.querySelectorAll('.wave-bar').length).toBeGreaterThan(0);
      expect(shadow.querySelector('.live-rec-badge')).not.toBeNull();

      const sourceToggle = shadow.querySelector('.source-toggle');
      expect(sourceToggle).not.toBeNull();

      const tabBtn = shadow.querySelector('[data-source="tab"]');
      const micBtn = shadow.querySelector('[data-source="mic"]');
      expect(tabBtn).not.toBeNull();
      expect(micBtn).not.toBeNull();
      expect(tabBtn.classList.contains('active')).toBe(true);
      expect(micBtn.classList.contains('active')).toBe(false);
    });

    it('clicking source toggle switches active state and invokes onSourceChange callback', () => {
      const onSourceChange = vi.fn();
      mountFloatingHud({ onSourceChange });
      updateHudState('listening', { source: 'tab' });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const micBtn = shadow.querySelector('[data-source="mic"]');
      micBtn.click();

      expect(onSourceChange).toHaveBeenCalledWith('mic');
      expect(micBtn.classList.contains('active')).toBe(true);
    });

    it('clicking cancel button triggers onCancel callback and closes HUD', () => {
      const onCancel = vi.fn();
      mountFloatingHud({ onCancel });
      updateHudState('listening');

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const cancelBtn = shadow.querySelector('.cancel-btn');
      expect(cancelBtn).not.toBeNull();
      cancelBtn.click();

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Analyzing State', () => {
    it('renders analyzing spinner and descriptive status text', () => {
      mountFloatingHud();
      updateHudState('analyzing', { message: 'Analyzing recitation with Gemini...' });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      expect(shadow.querySelector('.analyzing-spinner')).not.toBeNull();
      const statusText = shadow.querySelector('.hud-status');
      expect(statusText).not.toBeNull();
      expect(statusText.textContent).toContain('Analyzing recitation');
    });
  });

  describe('Matched State', () => {
    const matchData = {
      surahName: 'Ar-Rahman',
      surahNumber: 55,
      verseKey: '55:13',
      arabicText: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
      translationText: 'So which of the favors of your Lord would you deny?'
    };

    it('renders surah name, verseKey, uthmani arabic text, and translation', () => {
      mountFloatingHud();
      updateHudState('matched', matchData);

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      expect(shadow.querySelector('.surah-title').textContent).toContain('Ar-Rahman');
      expect(shadow.querySelector('.verse-badge').textContent).toContain('55:13');

      const arabicEl = shadow.querySelector('.arabic-text');
      expect(arabicEl.textContent).toContain('فَبِأَيِّ آلَاءِ');

      const translationEl = shadow.querySelector('.translation-text');
      expect(translationEl.textContent).toContain('favors of your Lord');

      const quranLink = shadow.querySelector('a.quran-link');
      expect(quranLink).not.toBeNull();
      expect(quranLink.getAttribute('href')).toBe('https://quran.com/55/13');
      expect(quranLink.getAttribute('target')).toBe('_blank');
    });

    it('copy button copies text to clipboard and shows feedback', async () => {
      mountFloatingHud();
      updateHudState('matched', matchData);

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const copyBtn = shadow.querySelector('.copy-btn');
      expect(copyBtn).not.toBeNull();

      copyBtn.click();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ')
      );
      expect(copyBtn.textContent).toContain('Copied');
    });

    it('renders drag handle, close button, and minimize button', () => {
      mountFloatingHud();
      updateHudState('matched', matchData);

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      expect(shadow.querySelector('.drag-handle')).not.toBeNull();
      expect(shadow.querySelector('.close-btn')).not.toBeNull();
      expect(shadow.querySelector('.minimize-btn')).not.toBeNull();
    });

    it('renders English translation header badge and recited transcript row if available', () => {
      mountFloatingHud();
      updateHudState('matched', {
        ...matchData,
        recitedArabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      expect(shadow.querySelector('.translation-badge').textContent).toContain('English Translation');
      expect(shadow.querySelector('.recited-transcript-row')).not.toBeNull();
      expect(shadow.querySelector('.recited-text').textContent).toContain('فَبِأَيِّ آلَاءِ');
    });

    it('clicking listen-again-btn triggers onIdentifyAgain and transitions to listening state', () => {
      const onIdentifyAgain = vi.fn();
      mountFloatingHud({ onIdentifyAgain });
      updateHudState('matched', matchData);

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const listenAgainBtn = shadow.querySelector('.listen-again-btn');
      expect(listenAgainBtn).not.toBeNull();

      listenAgainBtn.click();
      expect(onIdentifyAgain).toHaveBeenCalled();
      expect(shadow.querySelector('.audio-wave-visualizer')).not.toBeNull();
    });
  });

  describe('Minimized State & Toggle', () => {
    it('renders compact floating pill badge in minimized state', () => {
      mountFloatingHud();
      updateHudState('minimized');

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const pill = shadow.querySelector('.hud-pill');
      expect(pill).not.toBeNull();
    });

    it('clicking minimize button switches to minimized, clicking pill restores state', () => {
      mountFloatingHud();
      updateHudState('matched', {
        surahName: 'Al-Fatihah',
        verseKey: '1:1',
        arabicText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translationText: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.'
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const minimizeBtn = shadow.querySelector('.minimize-btn');
      minimizeBtn.click();

      expect(shadow.querySelector('.hud-pill')).not.toBeNull();
      expect(shadow.querySelector('.arabic-text')).toBeNull();

      // Click pill to restore
      const pill = shadow.querySelector('.hud-pill');
      pill.click();

      expect(shadow.querySelector('.arabic-text')).not.toBeNull();
      expect(shadow.querySelector('.surah-title').textContent).toContain('Al-Fatihah');
    });

    it('escapes HTML in minimized state to prevent XSS injection', () => {
      mountFloatingHud();
      updateHudState('minimized', {
        surahName: '<script>alert("xss")</script>',
        verseKey: '1:1"><img src=x onerror=alert(1)>'
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const pill = shadow.querySelector('.hud-pill');
      expect(pill.innerHTML).not.toContain('<script>');
      expect(pill.innerHTML).toContain('&lt;script&gt;');
      expect(pill.innerHTML).not.toContain('<img');
      expect(pill.innerHTML).toContain('&lt;img');
    });

    it('dragging the minimized pill does not trigger expansion click', () => {
      mountFloatingHud();
      updateHudState('matched', {
        surahName: 'Al-Ikhlas',
        verseKey: '112:1',
        arabicText: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
        translationText: 'Say, He is Allah, [who is] One.'
      });
      updateHudState('minimized');

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const pill = shadow.querySelector('.hud-pill');
      expect(pill).not.toBeNull();

      // Initiate drag on the pill with primary mouse button
      pill.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 100,
        clientY: 100
      }));

      // Move more than 4px threshold
      window.dispatchEvent(new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 150,
        clientY: 150
      }));

      // Release drag
      window.dispatchEvent(new MouseEvent('pointerup', {
        bubbles: true
      }));

      // Simulate the click event dispatched by browser after drag release
      pill.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      }));

      // Pill should STILL be minimized and NOT expanded to matched state
      expect(shadow.querySelector('.hud-pill')).not.toBeNull();
      expect(shadow.querySelector('.arabic-text')).toBeNull();
    });
  });

  describe('Error State', () => {
    it('renders error card with error message', () => {
      mountFloatingHud();
      updateHudState('error', { message: 'Network connection failed' });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const errorCard = shadow.querySelector('.error-card');
      expect(errorCard).not.toBeNull();
      expect(errorCard.textContent).toContain('Network connection failed');
      expect(shadow.querySelector('.open-settings-btn')).toBeNull();
    });

    it('renders settings link when API key is missing', () => {
      mountFloatingHud();
      updateHudState('error', {
        message: 'Gemini API key is missing. Please configure it in settings.',
        isApiKeyMissing: true
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const settingsBtn = shadow.querySelector('.open-settings-btn');
      expect(settingsBtn).not.toBeNull();

      settingsBtn.click();
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('clicking try-again-btn in error state triggers onIdentifyAgain and transitions to listening', () => {
      const onIdentifyAgain = vi.fn();
      mountFloatingHud({ onIdentifyAgain });
      updateHudState('error', { message: 'No Quran recitation recognized' });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const tryAgainBtn = shadow.querySelector('.try-again-btn');
      expect(tryAgainBtn).not.toBeNull();

      tryAgainBtn.click();
      expect(onIdentifyAgain).toHaveBeenCalled();
      expect(shadow.querySelector('.radar-container')).not.toBeNull();
    });
  });

  describe('Draggable Bounds Clamping', () => {
    it('clamps dragging position within window bounds', () => {
      mountFloatingHud();
      updateHudState('listening');

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const dragHandle = shadow.querySelector('.drag-handle');
      const hud = shadow.querySelector('.quran-hud');

      // Set explicit dimensions for the element
      Object.defineProperty(hud, 'offsetWidth', { value: 320, configurable: true });
      Object.defineProperty(hud, 'offsetHeight', { value: 200, configurable: true });
      Object.defineProperty(hud, 'getBoundingClientRect', {
        value: () => ({ width: 320, height: 200, left: 100, top: 100 }),
        configurable: true
      });

      // Pointer down on drag handle at (120, 110)
      dragHandle.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: 120,
        clientY: 110
      }));

      // Move way beyond right and bottom viewport (window is 1024x768)
      window.dispatchEvent(new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 2000,
        clientY: 2000
      }));

      window.dispatchEvent(new MouseEvent('pointerup', {
        bubbles: true
      }));

      // Clamped max left = 1024 - 320 = 704px
      // Clamped max top = 768 - 200 = 568px
      expect(parseInt(hud.style.left, 10)).toBeLessThanOrEqual(1024 - 320);
      expect(parseInt(hud.style.top, 10)).toBeLessThanOrEqual(768 - 200);

      // Now drag negative (past left and top)
      dragHandle.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: 500,
        clientY: 500
      }));

      window.dispatchEvent(new MouseEvent('pointermove', {
        bubbles: true,
        clientX: -500,
        clientY: -500
      }));

      window.dispatchEvent(new MouseEvent('pointerup', {
        bubbles: true
      }));

      expect(parseInt(hud.style.left, 10)).toBeGreaterThanOrEqual(0);
      expect(parseInt(hud.style.top, 10)).toBeGreaterThanOrEqual(0);
    });

    it('ignores non-primary mouse buttons when initiating drag', () => {
      mountFloatingHud();
      updateHudState('listening');

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const dragHandle = shadow.querySelector('.drag-handle');
      const hud = shadow.querySelector('.quran-hud');

      dragHandle.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 2, // Secondary / right click
        clientX: 100,
        clientY: 100
      }));

      window.dispatchEvent(new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 300,
        clientY: 300
      }));

      window.dispatchEvent(new MouseEvent('pointerup', {
        bubbles: true
      }));

      expect(hud.style.left).toBe('');
    });
  });

  describe('Live Recitation Streaming Controls', () => {
    it('renders follow live recitation button and dispatches onStartStream', () => {
      const onStartStream = vi.fn();
      mountFloatingHud({ onStartStream });
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        surahNumber: 67,
        ayahStart: 1,
        ayahEnd: 1,
        verseKey: '67:1',
        arabicText: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ',
        translationText: 'Blessed is He in whose hand is dominion',
        isStreaming: false
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const streamBtn = shadow.querySelector('.stream-toggle-btn');
      expect(streamBtn).not.toBeNull();
      expect(streamBtn.textContent).toContain('Follow Live Recitation');

      streamBtn.click();
      expect(onStartStream).toHaveBeenCalled();
    });

    it('renders live stream badge and pause button when streaming is active', () => {
      const onStopStream = vi.fn();
      mountFloatingHud({ onStopStream });
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        surahNumber: 67,
        ayahStart: 1,
        ayahEnd: 1,
        verseKey: '67:1',
        arabicText: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ',
        translationText: 'Blessed is He in whose hand is dominion',
        isStreaming: true
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const badge = shadow.querySelector('.live-stream-badge');
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain('Live');

      const streamBtn = shadow.querySelector('.stream-toggle-btn');
      expect(streamBtn.textContent).toContain('Pause Live Following');

      streamBtn.click();
      expect(onStopStream).toHaveBeenCalled();
    });

    it('updates verse text seamlessly on consecutive streaming chunks', () => {
      mountFloatingHud();
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        verseKey: '67:1',
        arabicText: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ',
        translationText: 'Blessed is He...',
        isStreaming: true
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      expect(shadow.querySelector('.arabic-text').textContent).toContain('تَبَارَكَ');

      // Live advances to verse 2
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        verseKey: '67:2',
        arabicText: 'الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ',
        translationText: 'He who created death and life...',
        isStreaming: true
      });

      expect(shadow.querySelector('.verse-badge').textContent).toBe('67:2');
      expect(shadow.querySelector('.arabic-text').textContent).toContain('الَّذِي خَلَقَ الْمَوْتَ');
    });
  });

  describe('Tafsir & Reflections Drawer', () => {
    beforeEach(() => {
      globalThis.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
          this.rate = 1;
          this.lang = 'en-US';
        }
      };
      globalThis.speechSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        speaking: false,
        paused: false
      };
    });

    it('renders Tafsir toggle button in matched state', () => {
      mountFloatingHud();
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        verseKey: '67:1',
        arabicText: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ'
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const tafsirBtn = shadow.querySelector('.tafsir-toggle-btn');
      expect(tafsirBtn).not.toBeNull();
      expect(tafsirBtn.textContent).toContain('Tafsir & Reflections');
    });

    it('opens drawer and triggers onRequestTafsir when Tafsir button is clicked', async () => {
      const onRequestTafsir = vi.fn().mockResolvedValue({
        text: 'This verse opens with majestic celebration of sovereignty. Think of a craftsman who designed the cosmos.',
        mode: 'quick',
        quranComUrl: 'https://quran.com/67/1/tafsirs'
      });

      mountFloatingHud({ onRequestTafsir });
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        surahNumber: 67,
        ayahStart: 1,
        verseKey: '67:1',
        arabicText: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ'
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      const tafsirBtn = shadow.querySelector('.tafsir-toggle-btn');
      tafsirBtn.click();

      expect(onRequestTafsir).toHaveBeenCalledWith(
        expect.anything(),
        67,
        1,
        'quick'
      );

      // Wait for promise resolution
      await vi.waitFor(() => {
        const drawer = shadow.querySelector('.tafsir-drawer');
        expect(drawer).not.toBeNull();
        expect(drawer.textContent).toContain('This verse opens with majestic celebration');
      });

      // Classical deep-link verification
      const classicalLink = shadow.querySelector('.quran-tafsir-link');
      expect(classicalLink).not.toBeNull();
      expect(classicalLink.getAttribute('href')).toBe('https://quran.com/67/1/tafsirs');
    });

    it('switches depth mode tabs and requests updated tafsir depth', async () => {
      const onRequestTafsir = vi.fn()
        .mockResolvedValueOnce({
          text: 'Quick summary with analogy...',
          mode: 'quick',
          quranComUrl: 'https://quran.com/67/1/tafsirs'
        })
        .mockResolvedValueOnce({
          text: 'Detailed commentary examining revelation context...',
          mode: 'detailed',
          quranComUrl: 'https://quran.com/67/1/tafsirs'
        });

      mountFloatingHud({ onRequestTafsir });
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        surahNumber: 67,
        ayahStart: 1,
        verseKey: '67:1'
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      shadow.querySelector('.tafsir-toggle-btn').click();

      await vi.waitFor(() => {
        expect(shadow.querySelector('.tafsir-drawer')).not.toBeNull();
      });

      const detailedTab = shadow.querySelector('[data-mode="detailed"]');
      expect(detailedTab).not.toBeNull();
      detailedTab.click();

      expect(onRequestTafsir).toHaveBeenCalledWith(
        expect.anything(),
        67,
        1,
        'detailed'
      );

      await vi.waitFor(() => {
        expect(shadow.querySelector('.tafsir-drawer').textContent).toContain('Detailed commentary');
      });
    });

    it('plays synthesized Tafsir via Web Speech API and controls rate', async () => {
      const onRequestTafsir = vi.fn().mockResolvedValue({
        text: 'Listen to this explanation of dominion and kingship.',
        mode: 'quick',
        quranComUrl: 'https://quran.com/67/1/tafsirs'
      });

      mountFloatingHud({ onRequestTafsir });
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        surahNumber: 67,
        ayahStart: 1,
        verseKey: '67:1'
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      shadow.querySelector('.tafsir-toggle-btn').click();

      await vi.waitFor(() => {
        expect(shadow.querySelector('.tts-play-btn')).not.toBeNull();
      });

      const playBtn = shadow.querySelector('.tts-play-btn');
      playBtn.click();

      expect(globalThis.speechSynthesis.speak).toHaveBeenCalled();

      // Test rate toggle to 1.25x
      const rateBtn = shadow.querySelector('[data-rate="1.25"]');
      expect(rateBtn).not.toBeNull();
      rateBtn.click();
      expect(shadow.querySelector('[data-rate="1.25"]').classList.contains('active')).toBe(true);
    });

    it('keeps active Tafsir drawer pinned to open verse when live recitation advances', async () => {
      const onRequestTafsir = vi.fn().mockResolvedValue({
        text: 'Tafsir strictly for Verse 1 of Al-Mulk.',
        mode: 'quick',
        quranComUrl: 'https://quran.com/67/1/tafsirs'
      });

      mountFloatingHud({ onRequestTafsir });
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        surahNumber: 67,
        ayahStart: 1,
        verseKey: '67:1',
        isStreaming: true
      });

      const shadow = document.getElementById('quran-verse-hud-root').shadowRoot;
      shadow.querySelector('.tafsir-toggle-btn').click();

      await vi.waitFor(() => {
        expect(shadow.querySelector('.tafsir-drawer')).not.toBeNull();
      });

      // Live streaming advances to verse 2 in background
      updateHudState('matched', {
        surahName: 'Al-Mulk',
        surahNumber: 67,
        ayahStart: 2,
        verseKey: '67:2',
        isStreaming: true
      });

      // The background verse card updated to 67:2
      expect(shadow.querySelector('.verse-badge').textContent).toBe('67:2');

      // The Tafsir drawer is STILL open and displays Verse 1
      const drawer = shadow.querySelector('.tafsir-drawer');
      expect(drawer).not.toBeNull();
      expect(drawer.textContent).toContain('Tafsir strictly for Verse 1 of Al-Mulk.');

      // Sync indicator pill is rendered
      const syncPill = shadow.querySelector('.tafsir-sync-pill');
      expect(syncPill).not.toBeNull();
      expect(syncPill.textContent).toContain('Viewing Tafsir for 67:1');
      expect(syncPill.textContent).toContain('Live is at 67:2');

      // Clicking Switch switches to 67:2
      const switchBtn = syncPill.querySelector('.sync-switch-btn');
      expect(switchBtn).not.toBeNull();
      switchBtn.click();

      expect(onRequestTafsir).toHaveBeenCalledWith(
        expect.anything(),
        67,
        2,
        'quick'
      );
    });
  });
});

