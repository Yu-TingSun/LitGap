/**
 * LitGap - KGM Main Orchestrator
 * Feature 2: Conceptual Map + Field Map analysis
 *
 * @module kgmMain
 * @version 3.0.0
 *
 * Injected globals (from bootstrap.js kgmScope):
 *   LitGap       → LitGap.KGMAnalyzer, LitGap.KGMReporter, LitGap.AIClient,
 *                  LitGap.PromptBuilder, LitGap.ProgressUI
 *   LitGapMain   → LitGapMain.run(collection, papers, options) — Feature 1 orchestrator
 *   Services     → Services.prompt.*
 *   Zotero       → Zotero.debug / Zotero.Prefs / Zotero.logError / Zotero.getMainWindow
 *   Components   → File picker
 *
 * NOTE: ProgressUI is accessed via LitGap.ProgressUI (not as a bare variable).
 *       In Zotero 8, loadSubScript scope isolation means bare variable names inside
 *       function closures cannot access injected scope variables. Always use
 *       LitGap.ProgressUI instead of typeof ProgressUI !== 'undefined'.
 *
 * Entry point:
 *   KGMMain.run(collection)  — called from overlay.js menu item
 *
 * Flow:
 *   [Pre-check]  collectLibraryData — bail if empty collection
 *   [Step 1]     _getMissingPapers  — load .md OR run Feature 1 (skipSave mode)
 *   [Step 2]     _ensureAIClient    — read Prefs or show settings dialog (with retry)
 *   [Step 3]     _confirmTopic      — AI topic detection + user confirmation / manual edit
 *   [Step 4]     _chooseOutputs     — user selects: Conceptual Map / Field Map / Both
 *   [Step 5]     _runAnalysis       — AI analysis steps based on chosen outputs
 *   [Step 6]     _saveReports       — File Picker → save chosen report files
 *   [finally]    LitGap.ProgressUI.hide()  — always runs
 *
 * CHANGELOG v3.0.0:
 *   - Renamed menu label from "Analyze Knowledge Gaps (KGM)" to "Map Your Research Field"
 *   - Added Step 4: output selection dialog (Conceptual Map / Field Map / Both)
 *   - _runAnalysis now accepts includeFieldMap flag, delegates to KGMAnalyzer.runAnalysis()
 *     with options.includeFieldMap when Field Map is requested
 *   - _saveReports now saves Conceptual Map and/or Field Map files based on selection
 *   - Progress steps updated: 2 steps (Conceptual Map only) or 4 steps (Both)
 *   - API cost notice updated: 2 calls for Conceptual Map, 4 calls for Both
 */

var KGMMain = {

  // ─── Entry point ────────────────────────────────────────────────────────────

  /**
   * Main entry point. Called from overlay.js "Map Your Research Field" menu item.
   *
   * @param {Zotero.Collection} collection
   */
  run: async function(collection) {
    Zotero.debug('\n' + '='.repeat(60));
    Zotero.debug(`[KGMMain] Starting analysis for: ${collection.name}`);
    Zotero.debug('='.repeat(60));

    try {

      // ── Pre-check: ensure collection has papers ──────────────────────────
      const libraryData = LitGap.KGMAnalyzer.collectLibraryData(collection);

      if (libraryData.allTitles.length === 0) {
        Services.prompt.alert(null, 'LitGap',
          'No papers found in this collection.\n\n' +
          'Please add papers to the collection before running analysis.');
        return;
      }

      Zotero.debug(`[KGMMain] Library data: ${libraryData.allTitles.length} titles`);

      // ── Step 1: Get missing papers ───────────────────────────────────────
      const missingPapers = await this._getMissingPapers(collection);
      if (!missingPapers) return; // user cancelled

      Zotero.debug(`[KGMMain] Missing papers loaded: ${missingPapers.length}`);

      // ── Step 2: Ensure AI client is ready ────────────────────────────────
      const aiClient = await this._ensureAIClient();
      if (!aiClient) return; // user cancelled

      // ── Step 3: Detect and confirm research topic ─────────────────────────
      const confirmedDomain = await this._confirmTopic(libraryData, aiClient);
      if (!confirmedDomain) return; // user cancelled

      Zotero.debug(`[KGMMain] Confirmed domain: "${confirmedDomain}"`);

      // ── Step 4: Choose which outputs to generate ──────────────────────────
      const outputChoice = this._chooseOutputs();
      if (!outputChoice) return; // user cancelled

      Zotero.debug(`[KGMMain] Output choice: ${outputChoice}`);

      // ── Step 5: Run analysis ──────────────────────────────────────────────
      const includeFieldMap = (outputChoice === 'fieldmap' || outputChoice === 'both');
      const results = await this._runAnalysis(
        libraryData, missingPapers, confirmedDomain, aiClient, includeFieldMap
      );
      if (!results) return; // handled error

      // ── Step 6: Save reports ──────────────────────────────────────────────
      await this._saveReports(
        collection, libraryData, missingPapers, results, aiClient, outputChoice
      );

      Zotero.debug('[KGMMain] Workflow completed successfully');

    } catch (e) {
      // _KGMHandledError means a step already showed a dialog — do not double-alert
      if (e instanceof _KGMHandledError || e.name === '_KGMHandledError') {
        Zotero.debug(`[KGMMain] Handled error (no second dialog): ${e.message}`);
      } else {
        Zotero.debug(`[KGMMain] Unexpected error: ${e.message}`);
        Zotero.debug(e.stack || '(no stack)');
        Zotero.logError(e);
        Services.prompt.alert(null, 'LitGap',
          `An unexpected error occurred:\n${e.message}\n\n` +
          'Check Help > Debug Output Logging for details.');
      }
    } finally {
      if (LitGap.ProgressUI) LitGap.ProgressUI.hide();
    }
  },

  // ─── Step 1: Get missing papers ─────────────────────────────────────────────

  /**
   * Ask user how to get the LitGap missing-papers data:
   *   Option 0 — Load an existing .md report
   *   Option 1 — Run Feature 1 now (skipSave mode), then save + optionally continue
   *   Option 2 — Cancel
   *
   * @param {Zotero.Collection} collection
   * @returns {Promise<Array<{title,mentionCount}>|null>}
   */
  _getMissingPapers: async function(collection) {
    const result = Services.prompt.confirmEx(
      null,
      'LitGap — Map Your Research Field',
      'To analyze knowledge gaps, LitGap needs a Find Hidden Papers report ' +
      'for this collection.\n\n' +
      'Do you have an existing report, or would you like to run the analysis now?',
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) +
      (Services.prompt.BUTTON_TITLE_CANCEL   * Services.prompt.BUTTON_POS_2),
      '\uD83D\uDCC2 Load Existing Report',   // 0
      '\uD83D\uDD0D Run Find Hidden Papers',  // 1
      null,                                   // 2 = Cancel
      null, {}
    );

    if (result === 2 || result === -1) {
      Zotero.debug('[KGMMain] Step 1: User cancelled source selection');
      return null;
    }

    if (result === 0) return await this._loadReportFile();
    if (result === 1) return await this._runFeature1AndContinue(collection);

    return null;
  },

  /**
   * Open a File Picker to load an existing litgap_*.md report.
   *
   * @returns {Promise<Array|null>}
   */
  _loadReportFile: async function() {
    const win = Zotero.getMainWindow();
    const fp  = Components.classes['@mozilla.org/filepicker;1']
                  .createInstance(Components.interfaces.nsIFilePicker);

    fp.init(win.browsingContext, 'Select LitGap Report', fp.modeOpen);
    fp.appendFilter('Markdown Files', '*.md');
    fp.appendFilters(fp.filterAll);

    const rv = await new Promise(resolve => fp.open(r => resolve(r)));

    if (rv !== fp.returnOK) {
      Zotero.debug('[KGMMain] Load report: user cancelled file picker');
      return null;
    }

    let content;
    try {
      content = await IOUtils.readUTF8(fp.file.path);
    } catch (e) {
      Services.prompt.alert(null, 'LitGap',
        `Failed to read file:\n${fp.file.path}\n\n${e.message}`);
      return null;
    }

    const papers = LitGap.KGMAnalyzer.parseLitGapReport(content);

    if (papers.length === 0) {
      Services.prompt.alert(null, 'LitGap',
        'No missing papers found in the selected report.\n\n' +
        'Please make sure you selected a LitGap report (litgap_*.md), ' +
        'or run Find Hidden Papers to generate a new one.');
      return null;
    }

    Zotero.debug(`[KGMMain] Loaded ${papers.length} missing papers from report`);
    return papers;
  },

  /**
   * Run Feature 1 in skipSave mode, then show the three-option save dialog:
   *   [Continue to Map]  → save report → parse and return missing papers
   *   [Save Only]        → save report → show tip → return null
   *   [Cancel]           → return null
   *
   * @param {Zotero.Collection} collection
   * @returns {Promise<Array|null>}
   */
  _runFeature1AndContinue: async function(collection) {
    Zotero.debug('[KGMMain] Running Feature 1 in skipSave mode...');

    if (LitGap.ProgressUI) {
      LitGap.ProgressUI.show('LitGap: Finding Hidden Papers...');
    }

    let f1Result;
    try {
      f1Result = await LitGapMain.run(collection, null, { skipSave: true });
    } catch (e) {
      if (LitGap.ProgressUI) LitGap.ProgressUI.hide();
      Services.prompt.alert(null, 'LitGap',
        `Find Hidden Papers encountered an error:\n${e.message}`);
      return null;
    }

    if (LitGap.ProgressUI) LitGap.ProgressUI.hide();

    if (!f1Result || !f1Result.success) {
      Zotero.debug('[KGMMain] Feature 1 did not complete successfully');
      return null;
    }

    const { reportMarkdown, reportHTML, recommendations } = f1Result;
    Zotero.debug(`[KGMMain] Feature 1 complete: ${recommendations.length} recommendations`);

    const saveResult = Services.prompt.confirmEx(
      null,
      'LitGap \u2014 Find Hidden Papers Complete! \uD83C\uDF89',
      `Found ${recommendations.length} recommended paper(s).\n\n` +
      'What would you like to do next?',
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) +
      (Services.prompt.BUTTON_TITLE_CANCEL   * Services.prompt.BUTTON_POS_2),
      '\uD83D\uDDFA\uFE0F Continue to Map Your Research Field',  // 0
      '\uD83D\uDCBE Save Report Only',                            // 1
      null,                                                        // 2 = Cancel
      null, {}
    );

    if (saveResult === 2 || saveResult === -1) {
      Zotero.debug('[KGMMain] User discarded Feature 1 results');
      return null;
    }

    const savedPath = await this._saveFeature1Report(reportMarkdown, reportHTML, collection.name);

    if (!savedPath) {
      Zotero.debug('[KGMMain] User cancelled Feature 1 report save');
      return null;
    }

    if (saveResult === 1) {
      Services.prompt.alert(null, 'LitGap',
        'Report saved successfully.\n\n' +
        '\uD83D\uDCA1 Tip: You can run Map Your Research Field at any time by\n' +
        'right-clicking the collection and selecting\n' +
        '"Map Your Research Field".');
      return null;
    }

    // Continue (saveResult === 0) — parse the just-saved .md
    let content;
    try {
      content = await IOUtils.readUTF8(savedPath);
    } catch (e) {
      Services.prompt.alert(null, 'LitGap',
        `Report was saved, but could not be read back for analysis:\n${e.message}\n\n` +
        'You can load it manually from the menu.');
      return null;
    }

    const papers = LitGap.KGMAnalyzer.parseLitGapReport(content);

    if (papers.length === 0) {
      Services.prompt.alert(null, 'LitGap',
        'Report saved, but no missing papers could be parsed.\n\n' +
        'Your library may already be well-covered!');
      return null;
    }

    return papers;
  },

  /**
   * Save Feature 1 reports. Returns saved .md path or null if cancelled.
   *
   * @param {string} reportMarkdown
   * @param {string} reportHTML
   * @param {string} collectionName
   * @returns {Promise<string|null>}
   */
  _saveFeature1Report: async function(reportMarkdown, reportHTML, collectionName) {
    const win = Zotero.getMainWindow();
    const fp  = Components.classes['@mozilla.org/filepicker;1']
                  .createInstance(Components.interfaces.nsIFilePicker);

    const safeName = collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr  = new Date().toISOString().split('T')[0].replace(/-/g, '');

    fp.init(win.browsingContext, 'Save LitGap Report', fp.modeSave);
    fp.appendFilter('Markdown Files', '*.md');
    fp.defaultString    = `litgap_${safeName}_${dateStr}.md`;
    fp.defaultExtension = 'md';

    const rv = await new Promise(resolve => fp.open(r => resolve(r)));

    if (rv !== fp.returnOK && rv !== fp.returnReplace) return null;

    const mdPath   = fp.file.path;
    const htmlPath = mdPath.replace(/\.md$/, '.html');

    try {
      await IOUtils.writeUTF8(mdPath,   reportMarkdown);
      await IOUtils.writeUTF8(htmlPath, reportHTML);
      Zotero.debug(`[KGMMain] Feature 1 report saved: ${mdPath}`);
      return mdPath;
    } catch (e) {
      Services.prompt.alert(null, 'LitGap', `Failed to save report:\n${e.message}`);
      return null;
    }
  },

  // ─── Step 2: Ensure AI client ────────────────────────────────────────────────

  /**
   * Return a ready AIClient instance.
   * Uses saved Prefs if available; otherwise shows the settings dialog.
   *
   * @returns {Promise<Object|null>}
   */
  _ensureAIClient: async function() {
    const client = LitGap.AIClient.createFromPrefs();

    if (client) {
      Zotero.debug('[KGMMain] AI client loaded from preferences');
      return client;
    }

    Zotero.debug('[KGMMain] No saved AI settings — showing setup dialog');
    return await this._showAISettingsDialog();
  },

  /**
   * Multi-step AI settings dialog. Includes retry loop on connection failure.
   *
   * @returns {Promise<Object|null>}
   */
  _showAISettingsDialog: async function() {
    const ps = Services.prompt;

    while (true) {

      // ── 1. Choose provider ──────────────────────────────────────────────
      const providerInput = { value: 'anthropic' };
      const ok1 = ps.prompt(
        null,
        'LitGap \u2014 AI Setup (1/3)',
        'Choose your AI provider by typing one of the options below:\n\n' +
        '  anthropic  \u2192 Claude  (claude-haiku-4-5-20251001)\n' +
        '  openai     \u2192 GPT     (gpt-4o-mini)\n' +
        '  google     \u2192 Gemini  (gemini-1.5-flash)\n' +
        '  custom     \u2192 DeepSeek / Qwen / Kimi / Ollama / others\n\n' +
        'Conceptual Map uses 2 API calls (~$0.002).\n' +
        'Conceptual Map + Field Map uses 4 API calls (~$0.004).',
        providerInput, null, {}
      );

      if (!ok1) {
        Zotero.debug('[KGMMain] AI setup: user cancelled at provider selection');
        return null;
      }

      const provider = providerInput.value.trim().toLowerCase();

      if (!['anthropic', 'openai', 'google', 'custom'].includes(provider)) {
        ps.alert(null, 'LitGap',
          `"${provider}" is not a valid provider.\n\n` +
          'Please type one of: anthropic / openai / google / custom');
        continue;
      }

      // ── 2. Custom base URL (only for custom provider) ───────────────────
      let customBaseUrl = '';
      let customModel   = '';

      if (provider === 'custom') {
        const urlInput = { value: 'https://api.deepseek.com/v1' };
        const ok2 = ps.prompt(
          null,
          'LitGap \u2014 AI Setup (Custom Base URL)',
          'Enter the base URL of your OpenAI-compatible endpoint:\n\n' +
          'Presets:\n' +
          '  DeepSeek \u2192 https://api.deepseek.com/v1\n' +
          '  Qwen     \u2192 https://dashscope.aliyuncs.com/compatible-mode/v1\n' +
          '  Kimi     \u2192 https://api.moonshot.cn/v1\n' +
          '  Ollama   \u2192 http://localhost:11434/v1',
          urlInput, null, {}
        );

        if (!ok2) {
          Zotero.debug('[KGMMain] AI setup: user cancelled at base URL');
          return null;
        }

        customBaseUrl = urlInput.value.trim().replace(/\/$/, '');

        if (!customBaseUrl) {
          ps.alert(null, 'LitGap', 'Base URL cannot be empty. Please try again.');
          continue;
        }

        const modelInput = { value: '' };
        const okModel = ps.prompt(
          null,
          'LitGap \u2014 AI Setup (Model Name)',
          'Enter the model name to use (leave blank for default: gpt-4o-mini):\n\n' +
          'Examples: deepseek-chat, qwen-plus, moonshot-v1-8k',
          modelInput, null, {}
        );

        if (!okModel) {
          Zotero.debug('[KGMMain] AI setup: user cancelled at model name');
          return null;
        }

        customModel = modelInput.value.trim();
      }

      // ── 3. API Key ──────────────────────────────────────────────────────
      const keyInput = { value: '' };
      const ok3 = ps.prompt(
        null,
        'LitGap \u2014 AI Setup (2/3)',
        `Enter your ${provider} API key:\n\n` +
        '(Your key is stored securely in Zotero preferences and\n' +
        'never sent anywhere except the AI provider you selected.)',
        keyInput, null, {}
      );

      if (!ok3) {
        Zotero.debug('[KGMMain] AI setup: user cancelled at API key');
        return null;
      }

      const apiKey = keyInput.value.trim();

      if (!apiKey) {
        ps.alert(null, 'LitGap', 'API key cannot be empty. Please try again.');
        continue;
      }

      // ── 4. Test connection ──────────────────────────────────────────────
      ps.alert(null, 'LitGap \u2014 AI Setup (3/3)',
        'Testing connection to AI provider...\n\n' +
        '(Click OK to start the test)');

      const client = LitGap.AIClient.create(provider, apiKey, customModel, customBaseUrl);

      if (LitGap.ProgressUI) {
        LitGap.ProgressUI.show('LitGap: Testing AI connection...');
        LitGap.ProgressUI.update('Connecting to AI provider...', 50);
      }

      const { ok: connOk, error: connError } = await client.testConnection();

      if (LitGap.ProgressUI) LitGap.ProgressUI.hide();

      if (connOk) {
        LitGap.AIClient.saveToPrefs(provider, apiKey, customModel, customBaseUrl);
        ps.alert(null, 'LitGap',
          '\u2713 Connection successful!\n\nSettings saved. Ready to analyze.');
        Zotero.debug(`[KGMMain] AI setup complete: provider=${provider}`);
        return client;
      }

      // ── Connection failed: retry dialog ─────────────────────────────────
      let failMsg = 'Connection failed.';
      if (connError === 'INVALID_KEY') {
        failMsg = 'Invalid API key.\nPlease check that you copied the key correctly.';
      } else if (connError === 'NETWORK_ERROR') {
        failMsg = 'Network error.\nPlease check your internet connection.\n\n' +
                  'Note: Anthropic / OpenAI / Google APIs are not accessible\n' +
                  'from mainland China. Use "custom" with DeepSeek / Qwen / Kimi.';
      } else if (connError && connError.startsWith('API_ERROR')) {
        failMsg = `API error: ${connError}\nCheck that the model name and base URL are correct.`;
      }

      const retryResult = Services.prompt.confirmEx(
        null,
        'LitGap \u2014 Connection Failed',
        failMsg + '\n\nWhat would you like to do?',
        (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
        (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) +
        (Services.prompt.BUTTON_TITLE_CANCEL   * Services.prompt.BUTTON_POS_2),
        '\uD83D\uDD04 Try Again (same settings)',  // 0
        '\u2699\uFE0F Change Settings',             // 1
        null,                                        // 2 = Cancel
        null, {}
      );

      if (retryResult === 0) {
        Zotero.debug('[KGMMain] AI setup: retrying with same settings');

        if (LitGap.ProgressUI) {
          LitGap.ProgressUI.show('LitGap: Retrying connection...');
          LitGap.ProgressUI.update('Connecting to AI provider...', 50);
        }

        const { ok: retryOk } = await client.testConnection();

        if (LitGap.ProgressUI) LitGap.ProgressUI.hide();

        if (retryOk) {
          LitGap.AIClient.saveToPrefs(provider, apiKey, customModel, customBaseUrl);
          ps.alert(null, 'LitGap', '\u2713 Connection successful!\n\nSettings saved.');
          return client;
        }

        ps.alert(null, 'LitGap',
          'Connection still failing.\n\nReturning to settings to let you make changes.');
        continue;

      } else if (retryResult === 1) {
        Zotero.debug('[KGMMain] AI setup: user chose to change settings');
        continue;
      } else {
        Zotero.debug('[KGMMain] AI setup: user cancelled after connection failure');
        return null;
      }
    }
  },

  // ─── Step 3: Confirm research topic ─────────────────────────────────────────

  /**
   * Use AI to detect the research domain, then ask user to confirm or edit.
   * Falls back to manual input if AI detection fails.
   *
   * @param {{ allTitles: string[] }} libraryData
   * @param {Object} aiClient
   * @returns {Promise<string|null>}
   */
  _confirmTopic: async function(libraryData, aiClient) {
    Zotero.debug('[KGMMain] Detecting research topic...');

    if (LitGap.ProgressUI) {
      LitGap.ProgressUI.show('LitGap: Detecting research area...');
      LitGap.ProgressUI.update('Analyzing your paper titles...', 30);
    }

    let detectedTopic = null;

    try {
      detectedTopic = await LitGap.KGMAnalyzer.detectTopic(libraryData, aiClient);
      Zotero.debug(`[KGMMain] Topic detected: "${detectedTopic}"`);
    } catch (e) {
      Zotero.debug(`[KGMMain] Topic detection failed: ${e.message}`);
      detectedTopic = null;
    } finally {
      if (LitGap.ProgressUI) LitGap.ProgressUI.hide();
    }

    // ── AI detection failed → manual input ──────────────────────────────────
    if (!detectedTopic) {
      Services.prompt.alert(null, 'LitGap',
        'Could not automatically detect your research area.\n\n' +
        'Please enter it manually in the next dialog.');

      const manualInput = { value: '' };
      const okManual = Services.prompt.prompt(
        null,
        'LitGap \u2014 Research Area',
        'Enter your research area (one sentence):\n\n' +
        'Example: "Machine learning applications in clinical genomics"',
        manualInput, null, {}
      );

      if (!okManual || !manualInput.value.trim()) {
        Zotero.debug('[KGMMain] Topic: user cancelled manual input');
        return null;
      }

      return manualInput.value.trim();
    }

    // ── Confirmation dialog ──────────────────────────────────────────────────
    const topicResult = Services.prompt.confirmEx(
      null,
      'LitGap \u2014 Research Area',
      'LitGap identified your research area as:\n\n' +
      `"${detectedTopic}"\n\n` +
      'Is this correct?',
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) +
      (Services.prompt.BUTTON_TITLE_CANCEL   * Services.prompt.BUTTON_POS_2),
      '\u2713 Correct',  // 0
      '\u270E Edit',     // 1
      null,               // 2 = Cancel
      null, {}
    );

    if (topicResult === 0) return detectedTopic;

    if (topicResult === 1) {
      const editInput = { value: detectedTopic };
      const okEdit = Services.prompt.prompt(
        null,
        'LitGap \u2014 Edit Research Area',
        'Edit your research area:',
        editInput, null, {}
      );

      if (!okEdit || !editInput.value.trim()) {
        Zotero.debug('[KGMMain] Topic: user cancelled edit');
        return null;
      }

      return editInput.value.trim();
    }

    Zotero.debug('[KGMMain] Topic: user cancelled confirmation');
    return null;
  },
// ─── Step 4: Choose outputs ──────────────────────────────────────────────────

  /**
   * Show output selection dialog.
   *
   * Button layout (left → right on macOS):
   *   Button 2 / result -1 = Cancel         (leftmost / window close)
   *   Button 1 / result 1  = Conceptual Map only  (centre)
   *   Button 0 / result 0  = Conceptual Map + Field Map  (right, blue default)
   *
   * Returns:
   *   'both'        — result 0
   *   'conceptual'  — result 1
   *   null          — result 2 / -1 (Cancel)
   *
   * Note: Field Map always runs Step A (framework) internally because FM-A
   * depends on framework output. 'conceptual' skips FM-A + FM-B only.
   */
  _chooseOutputs: function() {
    const result = Services.prompt.confirmEx(
      null,
      'LitGap \u2014 Choose Output',
      'What would you like to generate?\n\n' +
      '\uD83D\uDDFA\uFE0F  Conceptual Map\n' +
      '     Technical dimensions and knowledge gaps in your field\n' +
      '     (2 API calls)\n\n' +
      '\uD83C\uDF10  Conceptual Map + Field Map\n' +
      '     Full analysis: dimensions, debates, node relationships,\n' +
      '     foundational papers, and priority reading list\n' +
      '     (4 API calls)',
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) +
      (Services.prompt.BUTTON_TITLE_CANCEL   * Services.prompt.BUTTON_POS_2),
      '\u2728 Conceptual Map + Field Map',  // 0 — right, blue default
      '\uD83D\uDDFA\uFE0F Conceptual Map only',    // 1 — centre
      null,                                          // 2 = Cancel — left
      null, {}
    );

    if (result === 2 || result === -1) {
      Zotero.debug('[KGMMain] Output choice: cancelled');
      return null;
    }

    const choice = result === 0 ? 'both' : 'conceptual';
    Zotero.debug(`[KGMMain] Output choice: result=${result} → ${choice}`);
    return choice;
  },

  // ─── Step 5: Run analysis ────────────────────────────────────────────────────

  /**
   * Run AI analysis steps with ProgressUI feedback.
   * Delegates to KGMAnalyzer.runAnalysis() with includeFieldMap flag.
   *
   * @param {{ allTitles, topAbstracts }} libraryData
   * @param {Array<{title, mentionCount}>} missingPapers
   * @param {string} confirmedDomain
   * @param {Object} aiClient
   * @param {boolean} includeFieldMap
   * @returns {Promise<{ framework, gapAnalysis, fieldMap? }|null>}
   */
  _runAnalysis: async function(libraryData, missingPapers, confirmedDomain, aiClient, includeFieldMap) {
    Zotero.debug(`[KGMMain] Starting analysis (includeFieldMap=${includeFieldMap})...`);

    const totalSteps = includeFieldMap ? 4 : 2;

    if (LitGap.ProgressUI) {
      LitGap.ProgressUI.show('LitGap: Analyzing your research field...');
      LitGap.ProgressUI.update(`Step 1/${totalSteps}: Generating domain framework...`, 10);
    }

    try {
      const result = await LitGap.KGMAnalyzer.runAnalysis(
        libraryData,
        missingPapers,
        confirmedDomain,
        aiClient,
        (step, total, message) => {
          if (LitGap.ProgressUI) {
            const pct = Math.round(10 + (step / total) * 75);
            LitGap.ProgressUI.update(`Step ${step}/${total}: ${message}`, pct);
          }
        },
        { includeFieldMap }
      );

      Zotero.debug('[KGMMain] Analysis complete');
      return result;

    } catch (e) {
      if (e.message === 'INVALID_KEY') {
        LitGap.AIClient.clearApiKey();
        Services.prompt.alert(null, 'LitGap',
          'Invalid API key.\n\n' +
          'Your saved key has been cleared. Please restart the analysis\n' +
          'to enter a new key.');
      } else if (e.message === 'RATE_LIMIT') {
        Services.prompt.alert(null, 'LitGap',
          'Rate limit reached.\n\n' +
          'The AI provider is temporarily limiting requests.\n' +
          'Please wait a minute and try again.');
      } else if (e.message === 'NETWORK_ERROR') {
        Services.prompt.alert(null, 'LitGap',
          'Network connection failed.\n\n' +
          'Please check your internet connection and try again.');
      } else {
        Services.prompt.alert(null, 'LitGap',
          `Analysis failed:\n${e.message}\n\n` +
          'Check Help > Debug Output Logging for details.');
        Zotero.logError(e);
      }

      throw new _KGMHandledError(e.message);
    }
  },

  // ─── Step 6: Save reports ────────────────────────────────────────────────────

  /**
   * Generate and save report files based on the user's output choice.
   * Saves to user-chosen base path via a single File Picker.
   *
   * Files saved:
   *   'conceptual' → conceptual-map_NAME_DATE.md + .html
   *   'fieldmap'   → field-map_NAME_DATE.md + .html
   *   'both'       → both pairs of files
   *
   * @param {Zotero.Collection} collection
   * @param {{ allTitles, topAbstracts }} libraryData
   * @param {Array<{title, mentionCount}>} missingPapers
   * @param {{ framework, gapAnalysis, fieldMap? }} results
   * @param {Object} aiClient
   * @param {string} outputChoice  — 'conceptual' | 'fieldmap' | 'both'
   */
  _saveReports: async function(collection, libraryData, missingPapers, results, aiClient, outputChoice) {
    if (LitGap.ProgressUI) {
      LitGap.ProgressUI.update('Generating reports...', 90);
    }

    const providerDisplayNames = {
      anthropic: 'Anthropic Claude',
      openai:    'OpenAI GPT',
      google:    'Google Gemini'
    };
    const providerName = aiClient.provider === 'custom'
      ? 'Custom AI'
      : (providerDisplayNames[aiClient.provider] || aiClient.provider);

    const safeName = collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr  = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // ── Generate report content ──────────────────────────────────────────────
    let conceptualReports = null;
    let fieldMapReports   = null;

    if (true) {
      conceptualReports = LitGap.KGMReporter.generate(
        collection.name, libraryData, missingPapers,
        results.framework, results.gapAnalysis, providerName
      );
    }

    if (outputChoice ===  'both' && results.fieldMap) {
      fieldMapReports = LitGap.KGMReporter.generateFieldMap(
        collection.name, results.fieldMap, providerName
      );
    }

    // ── File Picker — ask for save location ──────────────────────────────────
    const win = Zotero.getMainWindow();
    const fp  = Components.classes['@mozilla.org/filepicker;1']
                  .createInstance(Components.interfaces.nsIFilePicker);

    // Default filename based on what's being saved
    let defaultName;
    if (outputChoice === 'conceptual') {
      defaultName = `conceptual-map_${safeName}_${dateStr}.md`;
    } else if (outputChoice === 'fieldmap') {
      defaultName = `field-map_${safeName}_${dateStr}.md`;
    } else {
      defaultName = `conceptual-map_${safeName}_${dateStr}.md`;
    }

    fp.init(win.browsingContext, 'Save Reports', fp.modeSave);
    fp.appendFilter('Markdown Files', '*.md');
    fp.defaultString    = defaultName;
    fp.defaultExtension = 'md';

    const rv = await new Promise(resolve => fp.open(r => resolve(r)));

    if (rv !== fp.returnOK && rv !== fp.returnReplace) {
      Zotero.debug('[KGMMain] Save reports: user cancelled file picker');
      return;
    }

    // Derive base directory from the chosen path
    const chosenPath = fp.file.path;
    const dir        = chosenPath.substring(0, chosenPath.lastIndexOf(
      (chosenPath.includes('/') ? '/' : '\\')
    ) + 1);

    // ── Write files ───────────────────────────────────────────────────────────
    const savedFiles = [];

    try {
      if (conceptualReports) {
        const cmMd   = dir + `conceptual-map_${safeName}_${dateStr}.md`;
        const cmHtml = dir + `conceptual-map_${safeName}_${dateStr}.html`;
        await IOUtils.writeUTF8(cmMd,   conceptualReports.markdown);
        await IOUtils.writeUTF8(cmHtml, conceptualReports.html);
        savedFiles.push(cmMd, cmHtml);
        Zotero.debug(`[KGMMain] Conceptual Map saved: ${cmMd}`);
      }

      if (fieldMapReports) {
        const fmMd   = dir + `field-map_${safeName}_${dateStr}.md`;
        const fmHtml = dir + `field-map_${safeName}_${dateStr}.html`;
        await IOUtils.writeUTF8(fmMd,   fieldMapReports.markdown);
        await IOUtils.writeUTF8(fmHtml, fieldMapReports.html);
        savedFiles.push(fmMd, fmHtml);
        Zotero.debug(`[KGMMain] Field Map saved: ${fmMd}`);
      }
    } catch (e) {
      Services.prompt.alert(null, 'LitGap', `Failed to save reports:\n${e.message}`);
      return;
    }

    // ── Show completion ───────────────────────────────────────────────────────
    const fileList = savedFiles
      .filter(f => f.endsWith('.html'))
      .map(f => '\u2022 ' + f.split(/[/\\]/).pop())
      .join('\n');

    const completionMsg =
      '\u2713 Analysis complete!\n\n' +
      'Reports saved:\n' + fileList + '\n\n' +
      'Open the .html files in your browser to read the reports.';

    if (LitGap.ProgressUI) {
      LitGap.ProgressUI.showComplete(completionMsg);
    } else {
      Services.prompt.alert(null, 'LitGap \u2014 Complete!', completionMsg);
    }
  }

};

// ─── Internal sentinel error class ──────────────────────────────────────────
// Used to signal that _runAnalysis already displayed an error dialog,
// so the outer catch in run() should NOT show a second dialog.
function _KGMHandledError(originalMessage) {
  this.message = `[already handled] ${originalMessage}`;
  this.name    = '_KGMHandledError';
}
_KGMHandledError.prototype = Object.create(Error.prototype);

Zotero.debug('LitGap: KGMMain v3.0 loaded');
