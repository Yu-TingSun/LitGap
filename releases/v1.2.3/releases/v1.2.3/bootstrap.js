/**
 * LitGap - Bootstrap with Dynamic Module Loading
 * Plugin lifecycle management for Zotero 7
 * 
 * @version 1.3.1
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
      // Load all modules
      await this.loadModules();
      
      this.initialized = true;
      
      // Show startup message
      Zotero.debug("\n" + "=".repeat(60));
      Zotero.debug(`LitGap v${version} is ready!`);
      Zotero.debug(`Zotero: ${Zotero.version}`);
      Zotero.debug(`Modules loaded: Parser, API, Analyzer, Reporter`);
      Zotero.debug("=".repeat(60) + "\n");
      
    } catch (e) {
      Zotero.debug(`LitGap: Initialization failed - ${e.message}`);
      Zotero.debug(e.stack);
      Zotero.logError(e);
      throw e;
    }
  },
  
  /**
   * Load all modules dynamically using loadSubScript
   */
  loadModules: async function() {
    Zotero.debug("LitGap: Loading modules...");
    
    const moduleFiles = [
      'parser.js',
      'api.js',
      'analyzer.js',
      'reporter.js'
    ];
    
    // Create module scope with shared context
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
        
        // Load module into shared scope
        Services.scriptloader.loadSubScript(moduleURI, moduleScope);
        
        Zotero.debug(`  Ã¢Å“â€¦ ${fileName} loaded`);
        
      } catch (e) {
        Zotero.debug(`  Ã¢ÂÅ’ Failed to load ${fileName}: ${e.message}`);
        throw new Error(`Module loading failed: ${fileName} - ${e.message}`);
      }
    }
    
    // Assign loaded modules to LitGap
    this.Parser = moduleScope.Parser;
    this.API = moduleScope.API;
    this.Analyzer = moduleScope.Analyzer;
    this.Reporter = moduleScope.Reporter;
    
    // Verify all modules loaded
    const missingModules = [];
    if (!this.Parser) missingModules.push('Parser');
    if (!this.API) missingModules.push('API');
    if (!this.Analyzer) missingModules.push('Analyzer');
    if (!this.Reporter) missingModules.push('Reporter');
    
    if (missingModules.length > 0) {
      throw new Error(`Modules not loaded: ${missingModules.join(', ')}`);
    }
    
    Zotero.debug("LitGap: All modules loaded successfully");
  }
};

/**
 * Startup - Called when plugin is loaded
 */
async function startup({ id, version, rootURI }) {
  Zotero.debug(`LitGap: startup() called`);
  
  // Wait for Zotero to be ready
  await Zotero.uiReadyPromise;
  
  Zotero.debug("LitGap: Zotero UI is ready");
  
  // Initialize preferences
  if (!Zotero.Prefs.get('extensions.zotero.litgap.initialized')) {
    Zotero.Prefs.set('extensions.zotero.litgap.initialized', true);
    Zotero.debug("LitGap: Preferences initialized");
  }
  
  // Initialize LitGap
  await LitGap.init({ id, version, rootURI });
  
  // Load UI overlay
  try {
    Services.scriptloader.loadSubScript(
      rootURI + "chrome/content/overlay.js",
      { LitGap: LitGap, Services: Services, Zotero: Zotero }
    );
  } catch (e) {
    Zotero.debug(`LitGap: Failed to load overlay - ${e.message}`);
    Zotero.logError(e);
  }
  
  // Load main orchestrator
  try {
    const mainScope = {
      LitGap: LitGap,
      Services: Services,
      Zotero: Zotero,
      Components: Components
    };
    Services.scriptloader.loadSubScript(
      rootURI + "chrome/content/main.js",
      mainScope
    );
    // Make LitGapMain globally available
    if (mainScope.LitGapMain) {
      globalThis.LitGapMain = mainScope.LitGapMain;
      Zotero.debug("LitGap: Main orchestrator loaded");
    } else {
      throw new Error("LitGapMain not defined in main.js");
    }
  } catch (e) {
    Zotero.debug(`LitGap: Failed to load main orchestrator - ${e.message}`);
    Zotero.logError(e);
  }
}

/**
 * Shutdown - Called when plugin is unloaded
 */
function shutdown() {
  Zotero.debug("LitGap: Shutting down...");
  
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
  Zotero.debug("LitGap: Installed");
}

/**
 * Uninstall - Called when plugin is removed
 */
function uninstall() {
  Zotero.debug("LitGap: Uninstalled");
}