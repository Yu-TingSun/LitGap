/**
 * LitGap - UI Overlay (Zotero 7)
 * Pure JavaScript UI integration with smart sampling
 * 
 * @version 1.2.0
 */

var LitGapOverlay = {
  menuItem: null,
  
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
   * Add menu item to collection context menu
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
      const collectionMenu = doc.getElementById('zotero-collectionmenu');
      
      if (!collectionMenu) {
        Zotero.debug("LitGap Overlay: Collection menu not found");
        return;
      }
      
      const separator = doc.createXULElement('menuseparator');
      separator.id = 'litgap-separator';
      collectionMenu.appendChild(separator);
      
      this.menuItem = doc.createXULElement('menuitem');
      this.menuItem.id = 'litgap-analyze';
      this.menuItem.setAttribute('label', 'Find Hidden Papers');
      this.menuItem.addEventListener('command', () => this.onAnalyzeClick());
      
      collectionMenu.appendChild(this.menuItem);
      
      Zotero.debug("LitGap Overlay: Menu item added");
      
    } catch (e) {
      Zotero.debug(`LitGap Overlay: Failed to add menu item - ${e.message}`);
      Zotero.logError(e);
    }
  },
  
  /**
   * Handle "Find Missing Papers" button click
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
      
      // Show confirmation
      const ps = Services.prompt;
      const confirmed = ps.confirm(
        null,
        "LitGap - Find Hidden Papers",
        dialogMessage
      );
      
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
   * Clean up UI elements
   */
  unload: function() {
    Zotero.debug("LitGap Overlay: Cleaning up UI...");
    
    try {
      if (this.menuItem && this.menuItem.parentNode) {
        this.menuItem.parentNode.removeChild(this.menuItem);
      }
      
      const zoteroPane = Zotero.getActiveZoteroPane();
      if (zoteroPane) {
        const doc = zoteroPane.document;
        const separator = doc.getElementById('litgap-separator');
        if (separator && separator.parentNode) {
          separator.parentNode.removeChild(separator);
        }
      }
      
      Zotero.debug("LitGap Overlay: UI cleaned up");
      
    } catch (e) {
      Zotero.debug(`LitGap Overlay: Cleanup failed - ${e.message}`);
    }
  }
};

LitGapOverlay.init();
