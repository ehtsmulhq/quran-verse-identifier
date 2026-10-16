/**
 * Quran Verse Identifier - Extension Options & Settings
 * Manages Gemini API Key configuration, testing, and preferred translation language.
 */

export const POPULAR_TRANSLATIONS = [
  { id: 131, language: 'English', author: 'Dr. Mustafa Khattab (The Clear Quran)' },
  { id: 20, language: 'English', author: 'Saheeh International' },
  { id: 161, language: 'Bengali', author: 'Muhiuddin Khan' },
  { id: 234, language: 'Urdu', author: 'Fateh Muhammad Jalandhry' },
  { id: 33, language: 'Indonesian', author: 'Indonesian Islamic Affairs Ministry' },
  { id: 31, language: 'French', author: 'Muhammad Hamidullah' },
  { id: 77, language: 'Turkish', author: 'Diyanet Isleri' },
  { id: 83, language: 'Spanish', author: 'Muhammad Isa Garcia' },
  { id: 27, language: 'German', author: 'Abu Rida Muhammad ibn Ahmad' },
  { id: 45, language: 'Russian', author: 'Elmir Kuliev' },
  { id: 125, language: 'Hindi', author: 'Muhammad Farooq Khan & Muhammad Ahmed' },
  { id: 47, language: 'Somali', author: 'Mahmud Muhammad Abduh' },
  { id: 135, language: 'Persian', author: 'Hosein Soleyman' }
];

export const AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Recommended - Fastest Seek Accuracy)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
];

/**
 * Toggles the visibility of the API key input field.
 *
 * @param {HTMLInputElement} inputEl
 * @param {HTMLButtonElement} btnEl
 */
export function toggleKeyVisibility(inputEl, btnEl) {
  if (!inputEl) return;
  const isPassword = inputEl.type === 'password';
  inputEl.type = isPassword ? 'text' : 'password';
  if (btnEl) {
    btnEl.textContent = isPassword ? '🙈' : '👁️';
    btnEl.setAttribute('aria-label', isPassword ? 'Hide API Key' : 'Show API Key');
  }
}

/**
 * Saves configuration values to chrome.storage.sync.
 *
 * @param {string} apiKey
 * @param {number|string} translationId
 * @param {string} [selectedModel='gemini-3.8-flash']
 * @returns {Promise<void>}
 */
export async function saveSettings(apiKey, translationId, selectedModel = 'gemini-3.8-flash') {
  const cleanKey = (apiKey || '').trim();
  const cleanTransId = Number(translationId) || 131;
  const cleanModel = (selectedModel || 'gemini-3.8-flash').trim();

  return new Promise((resolve) => {
    if (!chrome?.storage?.sync?.set) {
      resolve();
      return;
    }

    chrome.storage.sync.set(
      {
        geminiApiKey: cleanKey,
        translationId: cleanTransId,
        selectedModel: cleanModel
      },
      () => {
        const statusEl = document.getElementById('status-message');
        if (chrome.runtime?.lastError) {
          if (statusEl) {
            statusEl.textContent = '✕ Error saving settings: ' + chrome.runtime.lastError.message;
            statusEl.className = 'status-message error';
          }
          resolve();
          return;
        }

        if (statusEl) {
          statusEl.textContent = '✓ Settings Saved Successfully!';
          statusEl.className = 'status-message success';
          setTimeout(() => {
            if (statusEl.textContent === '✓ Settings Saved Successfully!') {
              statusEl.textContent = '';
              statusEl.className = 'status-message';
            }
          }, 3000);
        }
        resolve();
      }
    );
  });
}

/**
 * Validates the Gemini API key against Google's Generative Language API.
 *
 * @param {string} apiKey
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function testApiKey(apiKey) {
  const key = (apiKey || '').trim();
  if (!key) {
    return {
      success: false,
      error: 'Please enter a Google Gemini API key to test.'
    };
  }

  try {
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash'];
    const testPayload = JSON.stringify({
      contents: [
        {
          parts: [{ text: 'Ping test' }]
        }
      ]
    });

    let response;
    for (const model of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: testPayload
      });

      if (response.ok) {
        break;
      }

      if (response.status === 404 || response.status === 503 || response.status === 429) {
        continue;
      }

      break;
    }

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorDetail = errJson.error.message;
        }
      } catch (_) {}
      return {
        success: false,
        error: `API key validation failed: ${errorDetail}`
      };
    }

    return {
      success: true,
      message: '✓ Gemini API key is valid and connected!'
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error connecting to Gemini API: ${err.message}`
    };
  }
}

/**
 * Initializes the options page: populates form fields and attaches listeners.
 */
export async function initOptions() {
  const apiKeyInput = document.getElementById('gemini-api-key');
  const toggleBtn = document.getElementById('toggle-key-visibility');
  const testBtn = document.getElementById('test-key-btn');
  const testResultEl = document.getElementById('test-result');
  const translationSelect = document.getElementById('translation-select');
  const saveBtn = document.getElementById('save-btn');

  // Populate translation options
  if (translationSelect) {
    translationSelect.innerHTML = '';
    POPULAR_TRANSLATIONS.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = `${item.language}: ${item.author}`;
      translationSelect.appendChild(option);
    });
  }

  // Populate model options
  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    modelSelect.innerHTML = '';
    AVAILABLE_MODELS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      modelSelect.appendChild(option);
    });
  }

  // Load saved settings from storage
  if (chrome?.storage?.sync?.get) {
    chrome.storage.sync.get(['geminiApiKey', 'translationId', 'preferredLanguageId', 'selectedModel'], (items) => {
      const savedKey = items?.geminiApiKey || '';
      const savedTransId = items?.translationId || items?.preferredLanguageId || 131;
      const savedModel = items?.selectedModel || 'gemini-3.8-flash';

      if (apiKeyInput) {
        apiKeyInput.value = savedKey;
      }
      if (translationSelect) {
        translationSelect.value = String(savedTransId);
      }
      if (modelSelect) {
        modelSelect.value = savedModel;
      }
    });
  }

  // Attach toggle visibility button handler
  if (toggleBtn && apiKeyInput) {
    toggleBtn.onclick = () => {
      toggleKeyVisibility(apiKeyInput, toggleBtn);
    };
  }

  // Attach test key button handler
  if (testBtn && apiKeyInput && testResultEl) {
    testBtn.onclick = async () => {
      testBtn.disabled = true;
      testResultEl.textContent = 'Testing connection to Gemini...';
      testResultEl.className = 'test-result-box testing';

      const result = await testApiKey(apiKeyInput.value);

      testBtn.disabled = false;
      if (result.success) {
        testResultEl.textContent = result.message;
        testResultEl.className = 'test-result-box success';
      } else {
        testResultEl.textContent = result.error;
        testResultEl.className = 'test-result-box error';
      }
    };
  }

  // Attach save button handler
  if (saveBtn && apiKeyInput && translationSelect) {
    saveBtn.onclick = () => {
      const modelVal = modelSelect ? modelSelect.value : 'gemini-3.8-flash';
      saveSettings(apiKeyInput.value, translationSelect.value, modelVal);
    };
  }

  // Microphone permission testing & enablement
  const enableMicBtn = document.getElementById('enable-mic-btn');
  const micBadge = document.getElementById('mic-badge');
  const micResultEl = document.getElementById('mic-result');

  if (navigator?.permissions?.query && micBadge) {
    try {
      navigator.permissions.query({ name: 'microphone' }).then((status) => {
        const updateStatus = () => {
          if (status.state === 'granted') {
            micBadge.textContent = 'Enabled';
            micBadge.className = 'badge success';
          } else if (status.state === 'denied') {
            micBadge.textContent = 'Blocked';
            micBadge.className = 'badge error';
          } else {
            micBadge.textContent = 'Not Enabled';
            micBadge.className = 'badge';
          }
        };
        updateStatus();
        status.onchange = updateStatus;
      }).catch(() => {});
    } catch (_) {}
  }

  if (enableMicBtn && micResultEl) {
    enableMicBtn.onclick = async () => {
      enableMicBtn.disabled = true;
      micResultEl.textContent = 'Requesting microphone permission...';
      micResultEl.className = 'test-result-box testing';

      const res = await testOrEnableMicrophone();

      enableMicBtn.disabled = false;
      if (res.success) {
        micResultEl.textContent = res.message;
        micResultEl.className = 'test-result-box success';
        if (micBadge) {
          micBadge.textContent = 'Enabled';
          micBadge.className = 'badge success';
        }
      } else {
        micResultEl.textContent = res.error;
        micResultEl.className = 'test-result-box error';
        if (micBadge) {
          micBadge.textContent = 'Blocked';
          micBadge.className = 'badge error';
        }
      }
    };
  }
}

/**
 * Requests microphone permission from the user in a visible extension page.
 * Once granted, Chrome permanently stores the permission for the extension origin.
 *
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function testOrEnableMicrophone() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    return {
      success: false,
      error: 'MediaDevices API is not available in this context.'
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((track) => track.stop());
    }
    return {
      success: true,
      message: '✓ Microphone access is enabled! You can now use the Microphone toggle in the Floating HUD.'
    };
  } catch (err) {
    return {
      success: false,
      error: `Microphone permission denied or blocked: ${err.message}`
    };
  }
}

// Auto-run when loaded in browser page
if (typeof document !== 'undefined' && document.getElementById('gemini-api-key')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptions);
  } else {
    initOptions();
  }
}
