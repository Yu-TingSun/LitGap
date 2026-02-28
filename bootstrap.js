/**
 * LitGap - Bootstrap with Dynamic Module Loading
 * Plugin lifecycle management for Zotero 7/8
 *
 * @version 2.0.1
 *
 * CHANGELOG v2.0.1:
 *   - Fixed: progressUI.js now loads BEFORE main.js so that ProgressUI is
 *     available in mainScope when main.js is executing.
 *   - Fixed: mainScope now includes ProgressUI so Feature 1 progress bar works.
 *   All other logic is unchanged from v2.0.0.
 *
 * CHANGELOG v2.0.0:
 *   - Added: aiClient.js, promptBuilder.js, kgmAnalyzer.js, kgmReporter.js modules
 *   - Added: progressUI.js (non-blocking floating progress bar)
 *   - Added: kgmMain.js (Feature 2 orchestrator)
 */

var LitGap = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,

  // Modules (will be loaded dynamically)
  Parser: null,
  API: null,
  Analyzer: null,
  Reporter: null,
  AIClient: null,
  PromptBuilder: null,
  KGMAnalyzer: null,
  KGMReporter: null,

  /**
   * Initialize LitGap and load all modules
   */
  init: async function({ id, version, rootURI }) {
    if (this.initialized) return;

    this.id = id;
    this.version = version;
    this.rootURI = rootURI;

    Zotero.debug(`LitGap ${version}: Initializing...`);

    try {
      await this.loadModules();

      this.initialized = true;

      Zotero.debug('\n' + '='.repeat(60));
      Zotero.debug(`LitGap v${version} is ready!`);
      Zotero.debug(`Zotero: ${Zotero.version}`);
      Zotero.debug(`Modules loaded: Parser, API, Analyzer, Reporter, AIClient, PromptBuilder, KGMAnalyzer, KGMReporter`);
      Zotero.debug('='.repeat(60) + '\n');

    } catch (e) {
      Zotero.debug(`LitGap: Initialization failed - ${e.message}`);
      Zotero.debug(e.stack);
      Zotero.logError(e);
      throw e;
    }
  },

  /**
   * Load all modules dynamically using loadSubScript.
   * All modules share one scope so they can reference each other
   * (e.g. kgmAnalyzer.js calls PromptBuilder directly).
   */
  loadModules: async function() {
    Zotero.debug('LitGap: Loading modules...');

    const moduleFiles = [
      // Feature 1 — original modules (order matters: api depends on nothing,
      // analyzer depends on nothing, reporter depends on nothing)
      'parser.js',
      'api.js',
      'analyzer.js',
      'reporter.js',
      // Feature 2 — new modules (kgmAnalyzer depends on promptBuilder)
      'aiClient.js',
      'promptBuilder.js',
      'kgmAnalyzer.js',
      'kgmReporter.js'
    ];

    // All modules share one scope so cross-module calls work
    // (kgmAnalyzer.js calls PromptBuilder.buildTopicPrompt() directly)
    const moduleScope = {
      Zotero: Zotero,
      Services: Services,
      LitGap: this,
      ChromeUtils: ChromeUtils
    };

    for (const fileName of moduleFiles) {
      try {
        const moduleURI = this.rootURI + 'modules/' + fileName;
        Zotero.debug(`  Loading ${fileName}...`);
        Services.scriptloader.loadSubScript(moduleURI, moduleScope);
        Zotero.debug(`  \u2713 ${fileName} loaded`);
      } catch (e) {
        Zotero.debug(`  \u2717 Failed to load ${fileName}: ${e.message}`);
        throw new Error(`Module loading failed: ${fileName} - ${e.message}`);
      }
    }

    // Assign loaded modules to LitGap namespace
    this.Parser      = moduleScope.Parser;
    this.API         = moduleScope.API;
    this.Analyzer    = moduleScope.Analyzer;
    this.Reporter    = moduleScope.Reporter;
    this.AIClient    = moduleScope.AIClient;
    this.PromptBuilder = moduleScope.PromptBuilder;
    this.KGMAnalyzer = moduleScope.KGMAnalyzer;
    this.KGMReporter = moduleScope.KGMReporter;

    // Verify all required modules loaded
    const required = ['Parser', 'API', 'Analyzer', 'Reporter',
                      'AIClient', 'PromptBuilder', 'KGMAnalyzer', 'KGMReporter'];
    const v1Modules = ['Parser', 'API', 'Analyzer', 'Reporter'];
    const v2Modules = ['AIClient', 'PromptBuilder', 'KGMAnalyzer', 'KGMReporter'];

    const missingV1 = v1Modules.filter(m => !this[m]);
    if (missingV1.length > 0) {
      // Feature 1 is broken — throw to abort startup
      throw new Error(`Core modules not loaded: ${missingV1.join(', ')}`);
    }

    const missingV2 = v2Modules.filter(m => !this[m]);
    if (missingV2.length > 0) {
      // Feature 2 modules missing — log warning but don't abort
      // (Feature 1 still works)
      Zotero.debug(`LitGap: WARNING — KGM modules not loaded: ${missingV2.join(', ')}`);
    }

    Zotero.debug('LitGap: All modules loaded successfully');
  }
};

/**
 * Startup - Called when plugin is loaded
 *
 * Load order (v2.0.1):
 *   1. overlay.js       — UI menu items (no ProgressUI dependency)
 *   2. progressUI.js    — Floating progress bar  ← MOVED before main.js
 *   3. main.js          — Feature 1 orchestrator (needs ProgressUI in scope)
 *   4. kgmMain.js       — Feature 2 orchestrator (needs LitGapMain + ProgressUI)
 */
async function startup({ id, version, rootURI }) {
  Zotero.debug('LitGap: startup() called');

  // Wait for Zotero to be ready
  await Zotero.uiReadyPromise;

  Zotero.debug('LitGap: Zotero UI is ready');

  // Initialize preferences
  if (!Zotero.Prefs.get('extensions.zotero.litgap.initialized')) {
    Zotero.Prefs.set('extensions.zotero.litgap.initialized', true);
    Zotero.debug('LitGap: Preferences initialized');
  }

  // Initialize LitGap (loads all modules)
  await LitGap.init({ id, version, rootURI });

  // ── Step 1: Load UI overlay ──────────────────────────────────────────────
  try {
    Services.scriptloader.loadSubScript(
      rootURI + 'chrome/content/overlay.js',
      { LitGap: LitGap, Services: Services, Zotero: Zotero }
    );
    Zotero.debug('LitGap: Overlay loaded');
  } catch (e) {
    Zotero.debug(`LitGap: Failed to load overlay - ${e.message}`);
    Zotero.logError(e);
  }

  // ── Step 2: Load ProgressUI ──────────────────────────────────────────────
  // MUST load before main.js so ProgressUI is in mainScope for Feature 1.
  // Non-fatal: Feature 1 and 2 still work without progress UI (all calls are
  // guarded with typeof ProgressUI !== 'undefined').
  try {
    const progressScope = { Zotero: Zotero };
    Services.scriptloader.loadSubScript(
      rootURI + 'chrome/content/progressUI.js',
      progressScope
    );
    if (progressScope.ProgressUI) {
      globalThis.ProgressUI = progressScope.ProgressUI;
      LitGap.ProgressUI = progressScope.ProgressUI;  
      Zotero.debug('LitGap: ProgressUI loaded');
    } else {
      Zotero.debug('LitGap: ProgressUI not defined in progressUI.js');
    }
  } catch (e) {
    Zotero.debug(`LitGap: Failed to load progressUI - ${e.message}`);
    // Non-fatal — continue without progress bar
  }

  // ── Step 3: Load main orchestrator (Feature 1) ───────────────────────────
  // ProgressUI is now in globalThis and injected into mainScope so that
  // main.js can call ProgressUI.show() / update() / hide() directly.
  try {
    const mainScope = {
      LitGap: LitGap,
      Services: Services,
      Zotero: Zotero,
      Components: Components,
      ProgressUI: globalThis.ProgressUI   // ← v2.0.1: inject ProgressUI
    };
    Services.scriptloader.loadSubScript(
      rootURI + 'chrome/content/main.js',
      mainScope
    );
    if (mainScope.LitGapMain) {
      globalThis.LitGapMain = mainScope.LitGapMain;
      Zotero.debug('LitGap: Main orchestrator loaded');
    } else {
      throw new Error('LitGapMain not defined in main.js');
    }
  } catch (e) {
    Zotero.debug(`LitGap: Failed to load main orchestrator - ${e.message}`);
    Zotero.logError(e);
  }

  // ── Step 4: Load KGM Main orchestrator (Feature 2) ───────────────────────
  // Non-fatal: Feature 1 still works if this fails.
  try {
    const kgmScope = {
      LitGap: LitGap,
      LitGapMain: globalThis.LitGapMain,
      ProgressUI: globalThis.ProgressUI,
      Services: Services,
      Zotero: Zotero,
      Components: Components
    };
    Services.scriptloader.loadSubScript(
      rootURI + 'chrome/content/kgmMain.js',
      kgmScope
    );
    if (kgmScope.KGMMain) {
      globalThis.KGMMain = kgmScope.KGMMain;
      Zotero.debug('LitGap: KGMMain loaded');
    } else {
      Zotero.debug('LitGap: KGMMain not defined in kgmMain.js');
    }
  } catch (e) {
    Zotero.debug(`LitGap: Failed to load KGMMain - ${e.message}`);
    // Non-fatal
  }
}

/**
 * Shutdown - Called when plugin is unloaded
 */
function shutdown() {
  Zotero.debug('LitGap: Shutting down...');

  if (LitGap.initialized) {
    if (typeof LitGapOverlay !== 'undefined' && LitGapOverlay.unload) {
      LitGapOverlay.unload();
    }
  }

  LitGap.initialized = false;
}

/**
 * Install - Called when plugin is first installed
 */
function install() {
  Zotero.debug('LitGap: Installed');
}

/**
 * Uninstall - Called when plugin is removed
 */
function uninstall() {
  Zotero.debug('LitGap: Uninstalled');
}
