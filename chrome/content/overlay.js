/**
 * LitGap - UI Overlay (Zotero 7/8)
 * Pure JavaScript UI integration with smart sampling
 *
 * @version 2.0.1
 *
 * CHANGELOG v2.0.1:
 *   - Fixed: Right-click menu unreliable on first Zotero launch (Problem B)
 *   - Changed: addMenuItem() now uses `popupshowing` event listener instead of
 *     setTimeout retry. Zotero 8's collection context menu is a dynamic popup
 *     that may not exist at plugin load time. Listening to `popupshowing` ensures
 *     menu items are always injected right before the menu is displayed.
 *   - Added: this._popupListener stored for cleanup in unload()
 *   - Added: _insertMenuItems() extracted as separate method
 *   - All other logic unchanged from v2.0.0.
 *
 * CHANGELOG v2.0.0:
 *   - Added: KGM separator + "Analyze Knowledge Gaps (KGM)" menu item
 *   - Added: cleanup of KGM menu items in unload()
 */

var LitGapOverlay = {
  menuItem: null,
  _popupListener: null,   // stored so we can removeEventListener in unload()
  _collectionMenu: null,  // reference to the menu element for cleanup

  /**
   * Initialize UI elements
   */
  init: function() {
    Zotero.debug("LitGap Overlay: Initializing UI...");

    try {
      this.addMenuItem();
      Zotero.debug("LitGap Overlay: UI initialized");
    } catch (e) {
      Zotero.debug(`LitGap Overlay: UI init failed - ${e.message}`);
      Zotero.logError(e);
    }
  },

  /**
   * Register the popupshowing listener on the collection context menu.
   *
   * Strategy (v2.0.1):
   *   Instead of trying to insert DOM elements at plugin load time (when the
   *   dynamic popup may not yet exist), we attach a `popupshowing` listener.
   *   Every time the user right-clicks a collection, the listener checks whether
   *   our items are already in the menu. If not, it calls _insertMenuItems().
   *   This is robust against Zotero 8's dynamic popup lifecycle.
   */
  addMenuItem: function() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) {
      Zotero.debug("LitGap Overlay: Zotero pane not ready, retrying...");
      setTimeout(() => this.addMenuItem(), 100);
      return;
    }

    try {
      const doc = zoteroPane.document;

      // Try multiple possible menu IDs (Zotero 7 vs 8)
      let collectionMenu = doc.getElementById('zotero-collectionmenu')
                        || doc.getElementById('collection-popup');

      if (!collectionMenu) {
        Zotero.debug("LitGap Overlay: Collection menu not found, retrying in 500ms...");
        setTimeout(() => this.addMenuItem(), 500);
        return;
      }

      Zotero.debug(`LitGap Overlay: Found collection menu: ${collectionMenu.id}`);

      // Store reference for cleanup in unload()
      this._collectionMenu = collectionMenu;

      // Build the listener closure (stored so we can remove it later)
      this._popupListener = () => {
        if (!doc.getElementById('litgap-kgm-menuitem')) {
          Zotero.debug("LitGap Overlay: popupshowing — inserting menu items");
          this._insertMenuItems(doc, collectionMenu);
        }
      };

      collectionMenu.addEventListener('popupshowing', this._popupListener);
      Zotero.debug("LitGap Overlay: popupshowing listener registered");

      // Also attempt an immediate insert in case the menu already exists
      // (e.g. after disable/enable without full restart). Guarded by sentinel check.
      this._insertMenuItems(doc, collectionMenu);

    } catch (e) {
      Zotero.debug(`LitGap Overlay: Failed to register listener - ${e.message}`);
      Zotero.logError(e);
    }
  },

  /**
   * Insert all LitGap menu items into the collection context menu.
   * Safe to call multiple times — guarded by sentinel ID check.
   *
   * Menu layout (top → bottom):
   *   menuseparator          #litgap-separator
   *   Find Hidden Papers     #litgap-analyze
   *   Analyze Knowledge Gaps #litgap-kgm-menuitem
   *   Reset LitGap Prefs     #litgap-reset-prefs   ← always last
   *
   * @param {Document} doc
   * @param {Element}  collectionMenu
   */
  _insertMenuItems: function(doc, collectionMenu) {

    // ── Sentinel check: abort if v2.0 items already present ─────────────────
    if (doc.getElementById('litgap-kgm-menuitem')) {
      Zotero.debug("LitGap Overlay: Menu items already present, skipping insert");
      return;
    }

    // ── Clean up any leftover v1.x items (wrong order or missing KGM) ───────
    ['litgap-separator', 'litgap-analyze', 'litgap-reset-prefs',
     'litgap-kgm-menuitem', 'litgap-reset-separator'].forEach(id => {
      const el = doc.getElementById(id);
      if (el) el.remove();
    });

    // ── 1. Top separator ─────────────────────────────────────────────────────
    const separator = doc.createXULElement('menuseparator');
    separator.id = 'litgap-separator';
    collectionMenu.appendChild(separator);

    // ── 2. Find Hidden Papers ────────────────────────────────────────────────
    this.menuItem = doc.createXULElement('menuitem');
    this.menuItem.id = 'litgap-analyze';
    this.menuItem.setAttribute('label', 'Find Hidden Papers');
    this.menuItem.addEventListener('command', () => this.onAnalyzeClick());
    collectionMenu.appendChild(this.menuItem);

    // ── 3. Analyze Knowledge Gaps (KGM) ─────────────────────────────────────
    const kgmMenuItem = doc.createXULElement('menuitem');
    kgmMenuItem.id = 'litgap-kgm-menuitem';
    kgmMenuItem.setAttribute('label', 'Analyze Knowledge Gaps (KGM)');
    kgmMenuItem.addEventListener('command', () => {
      const collection = Zotero.getActiveZoteroPane().getSelectedCollection();
      if (!collection) {
        Services.prompt.alert(null, "LitGap KGM", "Please select a collection first.");
        return;
      }
      if (typeof KGMMain === 'undefined') {
        Services.prompt.alert(
          null,
          "LitGap KGM",
          "KGM module is not loaded.\n\nPlease reload the plugin and try again."
        );
        return;
      }
      KGMMain.run(collection).catch(e => {
        Zotero.debug(`[LitGap KGM] Unhandled error: ${e.message}`);
        Zotero.logError(e);
      });
    });
    collectionMenu.appendChild(kgmMenuItem);

    // ── 4. Reset LitGap Preferences (always last) ────────────────────────────
    const resetItem = doc.createXULElement('menuitem');
    resetItem.id = 'litgap-reset-prefs';
    resetItem.setAttribute('label', 'Reset LitGap Preferences');
    resetItem.addEventListener('command', () => this.resetPreferences());
    collectionMenu.appendChild(resetItem);

    Zotero.debug("LitGap Overlay: Menu items inserted successfully");
  },

  /**
   * Handle "Find Hidden Papers" button click
   */
  onAnalyzeClick: async function() {
    Zotero.debug("[LitGap Overlay] Button clicked!");

    try {
      const zoteroPane = Zotero.getActiveZoteroPane();
      const collection = zoteroPane.getSelectedCollection();

      if (!collection) {
        const ps = Services.prompt;
        ps.alert(
          null,
          "LitGap",
          "Please select a collection first."
        );
        Zotero.debug("[LitGap Overlay] No collection selected");
        return;
      }

      Zotero.debug(`[LitGap Overlay] Selected collection: ${collection.name}`);

      await this.analyzeCollection(collection);

    } catch (e) {
      Zotero.debug(`[LitGap Overlay] Error: ${e.message}`);
      Zotero.logError(e);

      const ps = Services.prompt;
      ps.alert(
        null,
        "LitGap Error",
        `Error: ${e.message}\n\nCheck console for details.`
      );
    }
  },

  /**
   * Analyze collection with smart sampling strategy
   */
  analyzeCollection: async function(collection) {
    Zotero.debug("\n" + "=".repeat(60));
    Zotero.debug("[LitGap Overlay] Analyzing Collection");
    Zotero.debug("=".repeat(60) + "\n");

    try {
      if (typeof LitGap === 'undefined' || !LitGap.Parser) {
        throw new Error("Parser module not loaded");
      }

      if (typeof LitGapMain === 'undefined') {
        throw new Error("Main orchestrator not loaded");
      }

      // Count papers
      const allItems = collection.getChildItems();
      const validTypes = new Set([
        'journalArticle', 'book', 'bookSection',
        'conferencePaper', 'preprint'
      ]);
      const academicItems = allItems.filter(item =>
        validTypes.has(item.itemType)
      );

      const withDOI = academicItems.filter(item =>
        item.getField('DOI')
      ).length;

      Zotero.debug(`Total items: ${allItems.length}`);
      Zotero.debug(`Academic papers: ${academicItems.length}`);
      Zotero.debug(`Papers with DOI: ${withDOI}`);

      // Check if we have papers to analyze
      if (academicItems.length === 0) {
        const ps = Services.prompt;
        ps.alert(
          null,
          "LitGap",
          "No academic papers found in this collection.\n\n" +
          "Make sure your collection contains journal articles, conference papers, or books."
        );
        return;
      }

      if (withDOI === 0) {
        const ps = Services.prompt;
        ps.alert(
          null,
          "LitGap",
          "No papers with DOI found.\n\n" +
          "Gap analysis requires DOIs to fetch citation data.\n" +
          "Please add DOIs to your papers or use a different collection."
        );
        return;
      }

      // Determine strategy
      const strategy = LitGap.Parser.determineSamplingStrategy(withDOI);
      const toProcess = strategy.sampleSize || withDOI;

      Zotero.debug(`Strategy: ${strategy.message}`);
      Zotero.debug(`Will process: ${toProcess} papers`);

      // Build confirmation dialog
      let dialogMessage = `Collection: ${collection.name}\n\n`;
      dialogMessage += `Total papers: ${academicItems.length}\n`;
      dialogMessage += `Papers with DOI: ${withDOI}\n`;
      dialogMessage += `\n`;

      // Add status indicator based on warning level
      if (strategy.warningLevel === 'warning') {
        dialogMessage += `WARNING: ${strategy.message}\n\n`;
      } else if (strategy.warningLevel === 'info') {
        dialogMessage += `INFO: ${strategy.message}\n\n`;
      } else {
        dialogMessage += `OK: ${strategy.message}\n\n`;
      }

      dialogMessage += `Will process: ${toProcess} papers\n`;
      dialogMessage += `Estimated time: ~${strategy.estimatedTime} minute${strategy.estimatedTime > 1 ? 's' : ''}\n`;

      if (strategy.reason) {
        dialogMessage += `\nWhy: ${strategy.reason}\n`;
      }

      if (strategy.suggestion) {
        dialogMessage += `\nTip: ${strategy.suggestion}\n`;
      }

      dialogMessage += `\nContinue?`;

      // Check if user wants to skip confirmation for this collection
      const skipConfirmKey = `extensions.zotero.litgap.skipConfirm.${collection.id}`;
      const skipConfirm = Zotero.Prefs.get(skipConfirmKey, false);

      let confirmed = true;

      if (!skipConfirm) {
        // Show confirmation with checkbox
        const ps = Services.prompt;
        const check = {value: false};

        confirmed = ps.confirmCheck(
          null,
          "LitGap - Find Hidden Papers",
          dialogMessage,
          "Don't ask me again for this collection",
          check
        );

        // If user confirmed and checked the box, save preference
        if (confirmed && check.value) {
          Zotero.Prefs.set(skipConfirmKey, true);
          Zotero.debug(`[LitGap Overlay] User chose to skip confirmation for collection ${collection.id}`);
        }
      } else {
        Zotero.debug(`[LitGap Overlay] Skipping confirmation (user preference)`);
      }

      if (!confirmed) {
        Zotero.debug("[LitGap Overlay] User cancelled");
        return;
      }

      // Parse with determined strategy
      Zotero.debug("[LitGap Overlay] Parsing papers...");
      const papers = LitGap.Parser.parseZoteroLibrary(collection, {
        debug: false,
        sampleSize: strategy.sampleSize
      });

      Zotero.debug(`[LitGap Overlay] Parsed ${papers.length} papers`);

      // Call main orchestrator to handle the rest
      Zotero.debug("[LitGap Overlay] Calling main orchestrator...");
      await LitGapMain.run(collection, papers);

    } catch (e) {
      Zotero.debug(`[LitGap Overlay] Error: ${e.message}`);
      Zotero.debug(e.stack);
      Zotero.logError(e);

      const ps = Services.prompt;
      ps.alert(
        null,
        "Error",
        `${e.message}\n\nCheck console for details.`
      );
    }
  },

  /**
   * Reset all user preferences
   */
  resetPreferences: function() {
    try {
      const ps = Services.prompt;
      const confirmed = ps.confirm(
        null,
        "Reset LitGap Preferences",
        "This will reset all 'Don't ask me again' choices.\n\nContinue?"
      );

      if (!confirmed) {
        return;
      }

      // Get all preferences
      const allPrefs = Zotero.Prefs.getAll();
      let resetCount = 0;

      // Clear all extensions.zotero.litgap.skipConfirm.* preferences
      Object.keys(allPrefs).forEach(key => {
        if (key.startsWith('extensions.zotero.litgap.skipConfirm.')) {
          Zotero.Prefs.clear(key);
          resetCount++;
        }
      });

      Zotero.debug(`[LitGap Overlay] Reset ${resetCount} preferences`);

      ps.alert(
        null,
        "LitGap",
        `Preferences reset successfully!\n\n${resetCount} collection${resetCount !== 1 ? 's' : ''} will show confirmation again.`
      );

    } catch (e) {
      Zotero.debug(`[LitGap Overlay] Error resetting preferences: ${e.message}`);
      Zotero.logError(e);
    }
  },

  /**
   * Clean up UI elements and event listeners
   */
  unload: function() {
    Zotero.debug("LitGap Overlay: Cleaning up UI...");

    try {
      // v2.0.1: Remove the popupshowing listener first
      if (this._collectionMenu && this._popupListener) {
        this._collectionMenu.removeEventListener('popupshowing', this._popupListener);
        Zotero.debug("LitGap Overlay: popupshowing listener removed");
      }

      // Remove all injected menu items by ID
      const zoteroPane = Zotero.getActiveZoteroPane();
      if (zoteroPane) {
        const doc = zoteroPane.document;

        ['litgap-separator', 'litgap-analyze', 'litgap-kgm-menuitem',
         'litgap-reset-separator', 'litgap-reset-prefs'].forEach(id => {
          const el = doc.getElementById(id);
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      }

      // Clear stored references
      this.menuItem       = null;
      this._popupListener = null;
      this._collectionMenu = null;

      Zotero.debug("LitGap Overlay: UI cleaned up");

    } catch (e) {
      Zotero.debug(`LitGap Overlay: Cleanup failed - ${e.message}`);
    }
  }
};

LitGapOverlay.init();
