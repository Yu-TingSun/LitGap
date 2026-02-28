/**
 * LitGap - AI Client Module
 * Unified client for multiple AI providers (Anthropic, OpenAI, Google, Custom)
 *
 * @module aiClient
 * @version 2.0.0
 *
 * Supported Providers:
 *   - anthropic : claude-haiku-4-5-20251001 (default)
 *   - openai    : gpt-4o-mini (default)
 *   - google    : gemini-1.5-flash (default)
 *   - custom    : OpenAI-compatible endpoint (user-defined)
 *
 * Preference Keys (namespace: extensions.litgap.*)
 *   aiProvider       → 'anthropic' | 'openai' | 'google' | 'custom'
 *   aiApiKey         → API key (encrypted, use true flag when storing)
 *   aiModel          → model name override (optional)
 *   aiCustomBaseUrl  → base URL for custom provider only
 *
 * Error Codes thrown via Error.message:
 *   INVALID_KEY    → HTTP 401
 *   RATE_LIMIT     → HTTP 429
 *   NETWORK_ERROR  → fetch() threw (no connection, DNS failure, etc.)
 *   API_ERROR: NNN → other non-2xx HTTP status
 */

var AIClient = {

  // ─── Default models per provider ────────────────────────────────────────────

  DEFAULT_MODELS: {
    anthropic: 'claude-haiku-4-5-20251001',
    openai:    'gpt-4o-mini',
    google:    'gemini-1.5-flash',
    custom:    'gpt-4o-mini'
  },

  // ─── Anthropic API version header ───────────────────────────────────────────

  ANTHROPIC_VERSION: '2023-06-01',

  // ─── Max tokens for responses ───────────────────────────────────────────────
  // Keep reasonably large so full framework + gap analysis fit in one response.

  MAX_TOKENS: 4096,

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Create an AI client instance for a specific provider.
   *
   * @param {string} provider        - 'anthropic' | 'openai' | 'google' | 'custom'
   * @param {string} apiKey          - API key for authentication
   * @param {string} [model]         - Model name override (uses default if omitted/empty)
   * @param {string} [customBaseUrl] - Required when provider === 'custom'
   * @returns {Object} Client instance with complete() and testConnection() methods
   */
  create: function(provider, apiKey, model, customBaseUrl) {
    if (!provider) throw new Error('provider is required');
    if (!apiKey)   throw new Error('apiKey is required');

    const resolvedModel = (model && model.trim())
      ? model.trim()
      : (this.DEFAULT_MODELS[provider] || this.DEFAULT_MODELS.openai);

    // Capture values in a closure so each instance is independent
    const self     = this;
    const _provider       = provider;
    const _apiKey         = apiKey;
    const _model          = resolvedModel;
    const _customBaseUrl  = (customBaseUrl || '').replace(/\/$/, ''); // strip trailing slash

    return {
      provider:       _provider,
      model:          _model,
      customBaseUrl:  _customBaseUrl,

      /**
       * Send a prompt to the AI and return the response as a plain string.
       *
       * @param {string} prompt       - User prompt
       * @param {string} [systemPrompt] - Optional system/context instruction
       * @returns {Promise<string>} AI response text
       */
      complete: function(prompt, systemPrompt) {
        return self._dispatch(_provider, _apiKey, _model, _customBaseUrl, prompt, systemPrompt || '');
      },

      /**
       * Test the connection with a minimal prompt.
       * Safe to call before any real analysis.
       *
       * @returns {Promise<{ ok: boolean, error?: string }>}
       */
      testConnection: function() {
        return self._testConnection(_provider, _apiKey, _model, _customBaseUrl);
      }
    };
  },

  /**
   * Build a client instance by reading saved Zotero preferences.
   * Returns null if no provider or apiKey is stored.
   *
   * @returns {Object|null} Client instance or null
   */
  createFromPrefs: function() {
    try {
      const provider      = Zotero.Prefs.get('extensions.litgap.aiProvider', '');
      const apiKey        = Zotero.Prefs.get('extensions.litgap.aiApiKey', '');
      const model         = Zotero.Prefs.get('extensions.litgap.aiModel', '');
      const customBaseUrl = Zotero.Prefs.get('extensions.litgap.aiCustomBaseUrl', '');

      if (!provider || !apiKey) return null;
      return this.create(provider, apiKey, model, customBaseUrl);
    } catch (e) {
      Zotero.debug(`AIClient: Failed to create from prefs - ${e.message}`);
      return null;
    }
  },

  /**
   * Persist provider settings to Zotero preferences.
   *
   * @param {string} provider
   * @param {string} apiKey
   * @param {string} [model]
   * @param {string} [customBaseUrl]
   */
  saveToPrefs: function(provider, apiKey, model, customBaseUrl) {
    Zotero.Prefs.set('extensions.litgap.aiProvider',      provider);
    Zotero.Prefs.set('extensions.litgap.aiApiKey',        apiKey, true); // encrypted
    Zotero.Prefs.set('extensions.litgap.aiModel',         model         || '');
    Zotero.Prefs.set('extensions.litgap.aiCustomBaseUrl', customBaseUrl || '');
    Zotero.debug(`AIClient: Preferences saved for provider: ${provider}`);
  },

  /**
   * Clear stored API key (called on INVALID_KEY error).
   */
  clearApiKey: function() {
    try {
      Zotero.Prefs.set('extensions.litgap.aiApiKey', '');
      Zotero.debug('AIClient: API key cleared from preferences');
    } catch (e) {
      Zotero.debug(`AIClient: Failed to clear API key - ${e.message}`);
    }
  },

  // ─── Internal dispatch ───────────────────────────────────────────────────────

  /**
   * Route the request to the correct provider handler.
   *
   * @private
   */
  _dispatch: async function(provider, apiKey, model, customBaseUrl, prompt, systemPrompt) {
    Zotero.debug(`AIClient: Sending request to provider="${provider}" model="${model}"`);

    switch (provider) {
      case 'anthropic':
        return this._callAnthropic(apiKey, model, prompt, systemPrompt);
      case 'openai':
        return this._callOpenAI('https://api.openai.com', apiKey, model, prompt, systemPrompt);
      case 'google':
        return this._callGoogle(apiKey, model, prompt, systemPrompt);
      case 'custom':
        if (!customBaseUrl) throw new Error('customBaseUrl is required for custom provider');
        return this._callOpenAI(customBaseUrl, apiKey, model, prompt, systemPrompt);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  },

  // ─── Provider: Anthropic ────────────────────────────────────────────────────

  /**
   * Call the Anthropic Messages API.
   * Endpoint: POST https://api.anthropic.com/v1/messages
   *
   * @private
   */
  _callAnthropic: async function(apiKey, model, prompt, systemPrompt) {
    const url = 'https://api.anthropic.com/v1/messages';

    const body = {
      model:      model,
      max_tokens: this.MAX_TOKENS,
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await this._fetchWithErrorHandling(url, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': this.ANTHROPIC_VERSION
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return data.content[0].text;
  },

  // ─── Provider: OpenAI (and Custom / OpenAI-compatible) ─────────────────────

  /**
   * Call an OpenAI-compatible Chat Completions endpoint.
   * Endpoint: POST {baseUrl}/v1/chat/completions
   *
   * Used for: openai, custom (Qwen / DeepSeek / Kimi / Ollama / etc.)
   *
   * @private
   */
  _callOpenAI: async function(baseUrl, apiKey, model, prompt, systemPrompt) {
    const url = `${baseUrl}/v1/chat/completions`;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body = {
      model:      model,
      max_tokens: this.MAX_TOKENS,
      messages:   messages
    };

    const response = await this._fetchWithErrorHandling(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return data.choices[0].message.content;
  },

  // ─── Provider: Google Gemini ────────────────────────────────────────────────

  /**
   * Call the Google Gemini generateContent API.
   * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}
   *
   * @private
   */
  _callGoogle: async function(apiKey, model, prompt, systemPrompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = [];

    // Google doesn't use a separate "system" role in the same way;
    // prepend system instruction as a user turn if provided.
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const body = {
      contents: contents,
      generationConfig: {
        maxOutputTokens: this.MAX_TOKENS
      }
    };

    const response = await this._fetchWithErrorHandling(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  },

  // ─── Internal: fetch with unified error handling ─────────────────────────────

  /**
   * Wrapper around fetch() that maps HTTP error codes to standardised
   * Error objects consumed by kgmMain.js.
   *
   * @private
   * @param {string} url
   * @param {Object} options - fetch() options
   * @returns {Promise<Response>} Resolved response with 2xx status
   * @throws {Error} INVALID_KEY | RATE_LIMIT | NETWORK_ERROR | API_ERROR: NNN
   */
  _fetchWithErrorHandling: async function(url, options) {
    let response;

    try {
      response = await fetch(url, options);
    } catch (networkError) {
      Zotero.debug(`AIClient: Network error - ${networkError.message}`);
      throw new Error('NETWORK_ERROR');
    }

    if (response.ok) {
      return response;
    }

    // Map specific status codes to typed errors
    if (response.status === 401 || response.status === 403) {
      Zotero.debug(`AIClient: Authentication error (${response.status})`);
      throw new Error('INVALID_KEY');
    }

    if (response.status === 429) {
      Zotero.debug('AIClient: Rate limit reached (429)');
      throw new Error('RATE_LIMIT');
    }

    // Generic API error — include status code for diagnostics
    let errorDetail = '';
    try {
      const errBody = await response.text();
      errorDetail = errBody.substring(0, 200); // truncate for log
    } catch (_) { /* ignore parse failure */ }

    Zotero.debug(`AIClient: API error ${response.status} — ${errorDetail}`);
    throw new Error(`API_ERROR: ${response.status}`);
  },

  // ─── Internal: connection test ───────────────────────────────────────────────

  /**
   * Send a minimal prompt to verify credentials and connectivity.
   *
   * @private
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  _testConnection: async function(provider, apiKey, model, customBaseUrl) {
    const TEST_PROMPT = 'Reply with the single word: OK';

    try {
      const result = await this._dispatch(provider, apiKey, model, customBaseUrl, TEST_PROMPT, '');
      Zotero.debug(`AIClient: Connection test successful. Response: "${result.trim().substring(0, 20)}"`);
      return { ok: true };
    } catch (e) {
      Zotero.debug(`AIClient: Connection test failed - ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
};
