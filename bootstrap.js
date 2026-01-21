/**
 * LitGap - Bootstrap for Zotero 7.x
 */

// Import Services
const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');

function log(msg) {
  dump(`[LitGap Bootstrap] ${msg}\n`);
  if (typeof Zotero !== 'undefined') {
    Zotero.debug(`[LitGap Bootstrap] ${msg}`);
  }
}

async function startup({ id, version, rootURI }) {
  log(`===== STARTING v${version} =====`);
  log(`ID: ${id}`);
  log(`Root URI: ${rootURI}`);
  
  try {
    // 等待 Zotero 初始化
    if (typeof Zotero === 'undefined') {
      log('ERROR: Zotero not found!');
      return;
    }
    
    await Zotero.initializationPromise;
    log('Zotero initialized');
    
    // 載入 overlay 到主視窗
    const overlayPath = rootURI + 'chrome/content/overlay.js';
    log(`Loading overlay from: ${overlayPath}`);
    
    // 等待主視窗
    const mainWindow = Zotero.getMainWindow();
    if (mainWindow) {
      log('Main window found');
      Services.scriptloader.loadSubScript(overlayPath, mainWindow);
      log('✅ Overlay loaded');
    } else {
      log('ERROR: Main window not found');
    }
    
  } catch (error) {
    log(`ERROR during startup: ${error.message}`);
    log(error.stack);
  }
}

function shutdown() {
  log('Shutting down');
}

function install() {
  log('Installing');
}

function uninstall() {
  log('Uninstalling');
}