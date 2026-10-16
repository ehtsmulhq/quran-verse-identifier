// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initOptions,
  saveSettings,
  testApiKey,
  toggleKeyVisibility,
  POPULAR_TRANSLATIONS
} from '../../src/options/options.js';

describe('Options Page Component', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="options-container">
        <input type="password" id="gemini-api-key" />
        <button type="button" id="toggle-key-visibility">👁️</button>
        <button type="button" id="test-key-btn">Test Key</button>
        <div id="test-result"></div>

        <select id="translation-select"></select>
        <select id="model-select"></select>

        <button type="button" id="save-btn">Save Settings</button>
        <div id="status-message"></div>
      </div>
    `;

    globalThis.chrome = {
      storage: {
        sync: {
          get: vi.fn().mockImplementation((keys, cb) => {
            const data = {
              geminiApiKey: 'saved-api-key-xyz',
              translationId: 161,
              selectedModel: 'gemini-3.8-flash'
            };
            if (typeof cb === 'function') {
              cb(data);
            }
            return Promise.resolve(data);
          }),
          set: vi.fn().mockImplementation((items, cb) => {
            if (typeof cb === 'function') {
              cb();
            }
            return Promise.resolve();
          })
        }
      }
    };

    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization and Settings Loading', () => {
    it('populates translation and model options and loads saved settings from chrome.storage.sync', async () => {
      await initOptions();

      const apiKeyInput = document.getElementById('gemini-api-key');
      const translationSelect = document.getElementById('translation-select');
      const modelSelect = document.getElementById('model-select');

      // Verify translation select has options populated
      expect(translationSelect.options.length).toBeGreaterThan(0);
      expect(modelSelect.options.length).toBeGreaterThan(0);

      // Verify saved values were loaded into form fields
      expect(apiKeyInput.value).toBe('saved-api-key-xyz');
      expect(Number(translationSelect.value)).toBe(161);
      expect(modelSelect.value).toBe('gemini-3.8-flash');
    });

    it('defaults translation to 131 and model to gemini-3.8-flash if none is saved', async () => {
      chrome.storage.sync.get.mockImplementation((keys, cb) => {
        const data = {};
        if (typeof cb === 'function') cb(data);
        return Promise.resolve(data);
      });

      await initOptions();

      const apiKeyInput = document.getElementById('gemini-api-key');
      const translationSelect = document.getElementById('translation-select');
      const modelSelect = document.getElementById('model-select');

      expect(apiKeyInput.value).toBe('');
      expect(Number(translationSelect.value)).toBe(131);
      expect(modelSelect.value).toBe('gemini-3.8-flash');
    });
  });

  describe('Saving Settings', () => {
    it('saves Gemini API key, translation ID, and selectedModel into chrome.storage.sync.set', async () => {
      await saveSettings('my-new-api-key', 20, 'gemini-3.8-flash');

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          geminiApiKey: 'my-new-api-key',
          translationId: 20,
          selectedModel: 'gemini-3.8-flash'
        }),
        expect.any(Function)
      );

      const statusEl = document.getElementById('status-message');
      expect(statusEl.textContent.toLowerCase()).toContain('saved');
    });

    it('trims whitespace from API key before saving', async () => {
      await saveSettings('   key-with-spaces   ', '131');

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          geminiApiKey: 'key-with-spaces',
          translationId: 131
        }),
        expect.any(Function)
      );
    });
  });

  describe('Key Visibility Toggle', () => {
    it('toggles password input between password and text type', () => {
      const apiKeyInput = document.getElementById('gemini-api-key');
      const toggleBtn = document.getElementById('toggle-key-visibility');

      expect(apiKeyInput.type).toBe('password');

      toggleKeyVisibility(apiKeyInput, toggleBtn);
      expect(apiKeyInput.type).toBe('text');

      toggleKeyVisibility(apiKeyInput, toggleBtn);
      expect(apiKeyInput.type).toBe('password');
    });
  });

  describe('Test API Key Button', () => {
    it('succeeds with a valid mock Gemini response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }]
        })
      });

      const result = await testApiKey('valid-test-key');

      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-3.8-flash'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('fails gracefully when API key is empty', async () => {
      const result = await testApiKey('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Please enter');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reports error message when Gemini API rejects the key', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'API_KEY_INVALID: Key not valid' }
        })
      });

      const result = await testApiKey('invalid-test-key');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API_KEY_INVALID');
    });

    it('handles network failure during API key testing', async () => {
      global.fetch.mockRejectedValue(new Error('Network connection failed'));

      const result = await testApiKey('some-key');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network connection failed');
    });
  });
});
