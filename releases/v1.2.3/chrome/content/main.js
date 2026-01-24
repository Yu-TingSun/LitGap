/**
 * LitGap - Main Orchestrator
 * Coordinates Parser Ã¢â€ â€™ API Ã¢â€ â€™ Analyzer Ã¢â€ â€™ Reporter workflow
 * 
 * @module main
 * @version 1.2.3
 */

var LitGapMain = {
  
  /**
   * Main workflow: Analyze collection and generate report
   * 
   * @param {Zotero.Collection} collection - Zotero collection object
   * @param {Object} papers - Pre-parsed papers from Parser (optional)
   * @returns {Promise<boolean>} Success status
   */
  run: async function(collection, papers = null) {
    Zotero.debug("\n" + "=".repeat(60));
    Zotero.debug("LitGap Main: Starting full analysis workflow");
    Zotero.debug("=".repeat(60) + "\n");
    
    try {
      // Verify all modules loaded
      if (!this._verifyModules()) {
        throw new Error("Required modules not loaded");
      }
      
      // Step 1: Parse papers (if not already provided)
      if (!papers) {
        Zotero.debug("LitGap Main: Step 1 - Parsing collection");
        papers = LitGap.Parser.parseZoteroLibrary(collection, {
          debug: false
        });
      }
      
      if (!papers || papers.length === 0) {
        this._showError("No papers found in collection");
        return false;
      }
      
      // Check DOI coverage
      const papersWithDOI = papers.filter(p => p.doi && p.doi.trim());
      if (papersWithDOI.length === 0) {
        this._showError(
          "No papers with DOI found.\n\n" +
          "Gap analysis requires DOIs to fetch citation data.\n" +
          "Please add DOIs to your papers or use a different collection."
        );
        return false;
      }
      
      Zotero.debug(`LitGap Main: Found ${papers.length} papers (${papersWithDOI.length} with DOI)`);
      
      // Step 2: Fetch citations from Semantic Scholar (background)
      // Note: No notification here - user already confirmed in overlay.js
      Zotero.debug("\nLitGap Main: Step 2 - Fetching citations from Semantic Scholar");
      
      const citationData = await LitGap.API.fetchCitations(
        papersWithDOI,
        (current, total, title) => {
          // Log progress to console only (no UI blocking)
          if (current % 5 === 0 || current === total) {
            Zotero.debug(`LitGap: Progress [${current}/${total}] ${title.substring(0, 30)}...`);
          }
        }
      );
      
      if (!citationData || !citationData.all_citations) {
        throw new Error("Failed to fetch citation data");
      }
      
      Zotero.debug(`LitGap Main: Collected ${citationData.stats.unique_citations} unique citations`);
      
      // Step 4: Analyze knowledge gaps
      Zotero.debug("\nLitGap Main: Step 3 - Analyzing knowledge gaps");
      
      const recommendations = LitGap.Analyzer.findGaps(citationData, {
        minYear: 2010,
        topN: 10,
        minMentions: 2
      });
      
      // Check if we have recommendations
      if (!recommendations || recommendations.length === 0) {
        this._showNotification(
          "Analysis Complete",
          "No knowledge gaps found.\n\nYour library is well-covered!",
          "info"
        );
        return false;
      }
      
      Zotero.debug(`LitGap Main: Found ${recommendations.length} recommendations`);
      
      // Step 5: Generate reports (Markdown + HTML)
      Zotero.debug("\nLitGap Main: Step 4 - Generating reports");
      
      const reportMarkdown = LitGap.Reporter.generateReport(
        papers,
        recommendations,
        citationData.stats
      );
      
      const reportHTML = LitGap.Reporter.generateHTMLReport(
        papers,
        recommendations,
        citationData.stats
      );
      
      if (!reportMarkdown || reportMarkdown.length === 0) {
        throw new Error("Failed to generate Markdown report");
      }
      
      if (!reportHTML || reportHTML.length === 0) {
        throw new Error("Failed to generate HTML report");
      }
      
      Zotero.debug(`LitGap Main: Generated Markdown report (${reportMarkdown.length} characters)`);
      Zotero.debug(`LitGap Main: Generated HTML report (${reportHTML.length} characters)`);
      
      // Step 6: Show completion summary and confirm save
      const ps = Services.prompt;
      const confirmed = ps.confirm(
        null,
        "LitGap - Analysis Complete! ðŸŽ‰",
        `Found ${recommendations.length} recommended papers.\n\n` +
        `Ready to save reports:\n` +
        `â€¢ Markdown (.md) - for editing\n` +
        `â€¢ HTML (.html) - for viewing with clickable links\n\n` +
        `Click OK to choose save location.`
      );
      
      if (!confirmed) {
        Zotero.debug("LitGap Main: User cancelled save");
        this._showInfo(
          `Analysis complete!\n\n` +
          `Found ${recommendations.length} recommended papers.\n\n` +
          `Reports not saved (user cancelled).`
        );
        return false;
      }
      
      // Step 7: Save reports (user confirmed)
      const saved = await this._saveReports(reportMarkdown, reportHTML, collection.name);
      
      if (saved) {
        // Increment usage count
        this._incrementUsageCount();
        
        // No additional notification - save dialog is enough confirmation
        
        // Check if we should show donation prompt
        this._checkDonationPrompt();
        
        Zotero.debug("\nLitGap Main: Workflow completed successfully\n");
        return true;
      } else {
        this._showInfo(
          `Reports not saved (user cancelled file selection).`
        );
        return false;
      }
      
    } catch (error) {
      Zotero.debug(`LitGap Main: Error - ${error.message}`);
      Zotero.debug(error.stack);
      Zotero.logError(error);
      
      this._showNotification(
        "Analysis Failed",
        `Error: ${error.message}\n\nCheck console (Help > Debug Output Logging) for details.`,
        "error"
      );
      
      return false;
    }
  },
  
  /**
   * Verify all required modules are loaded
   * 
   * @private
   * @returns {boolean} True if all modules loaded
   */
  _verifyModules: function() {
    const required = ['Parser', 'API', 'Analyzer', 'Reporter'];
    const missing = [];
    
    for (const module of required) {
      if (!LitGap[module]) {
        missing.push(module);
      }
    }
    
    if (missing.length > 0) {
      Zotero.debug(`LitGap Main: Missing modules: ${missing.join(', ')}`);
      this._showError(
        `Missing required modules: ${missing.join(', ')}\n\n` +
        `Please check bootstrap.js configuration.`
      );
      return false;
    }
    
    return true;
  },
  
  /**
   * Show notification to user (non-blocking)
   * 
   * @private
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} type - Notification type: "info", "success", "error"
   */
  _showNotification: function(title, message, type = "info") {
    const ps = Services.prompt;
    ps.alert(null, title, message);
  },
  
  /**
   * Increment usage count
   * 
   * @private
   */
  _incrementUsageCount: function() {
    try {
      const count = Zotero.Prefs.get('extensions.zotero.litgap.usageCount', 0);
      const newCount = (isNaN(count) ? 0 : count) + 1;
      Zotero.Prefs.set('extensions.zotero.litgap.usageCount', newCount);
      Zotero.debug(`LitGap: Usage count incremented to ${newCount}`);
    } catch (e) {
      Zotero.debug(`LitGap: Error incrementing usage count - ${e.message}`);
      // Non-critical error, don't throw
    }
  },
  
  /**
   * Check if we should show donation prompt
   * 
   * @private
   */
  _checkDonationPrompt: function() {
    try {
      const count = Zotero.Prefs.get('extensions.zotero.litgap.usageCount', 0);
      const donated = Zotero.Prefs.get('extensions.zotero.litgap.donated', false);
      const remindLater = Zotero.Prefs.get('extensions.zotero.litgap.donationRemindLater', 0);
      const now = Date.now();
      
      // If already marked as donated, don't prompt
      if (donated) {
        return;
      }
      
      // If "remind later" was clicked, check if 30 days have passed
      if (remindLater > 0) {
        const daysSince = (now - remindLater) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) {
          return; // Not yet 30 days
        }
      }
      
      // Trigger conditions:
      // 1. 10th use
      // 2. Every 10 uses after that
      // 3. Or 30 days after "remind later"
      if (count === 10 || (count > 10 && count % 10 === 0) || (remindLater > 0 && !donated)) {
        this._showDonationPrompt();
      }
    } catch (e) {
      Zotero.debug(`LitGap: Error checking donation prompt - ${e.message}`);
      // Non-critical error, don't throw
    }
  },
  
  /**
   * Show donation prompt
   * 
   * @private
   */
  _showDonationPrompt: function() {
    const ps = Services.prompt;
    
    // Create dialog with multiple buttons
    const buttonFlags = 
      ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING +
      ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING +
      ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
    
    const result = ps.confirmEx(
      null,
      "ðŸ’– Support LitGap",
      "ðŸŽ‰ You've used LitGap 10+ times!\n\n" +
      "Finding it useful? LitGap is free and open source.\n\n" +
      "Your support helps:\n" +
      "  â€¢ Continued development\n" +
      "  â€¢ Educational resources\n" +
      "  â€¢ Research platforms\n\n" +
      "I will use every donation wisely for education and scientific research. Thank you! ðŸ™",
      buttonFlags,
      "â¤ï¸ Support Now",
      "â° Remind Later",
      "âœ“ Already Donated",
      null,
      {}
    );
    
    switch (result) {
      case 0:  // Support Now
        this._openDonationPage();
        break;
      
      case 1:  // Remind Later
        Zotero.Prefs.set('extensions.zotero.litgap.donationRemindLater', Date.now());
        Zotero.debug("LitGap: Donation reminder set for 30 days");
        break;
      
      case 2:  // Already Donated
        Zotero.Prefs.set('extensions.zotero.litgap.donated', true);
        ps.alert(
          null,
          "Thank You! ðŸ™",
          "Thank you for your support!\n\n" +
          "Your contribution helps make research more efficient for everyone."
        );
        Zotero.debug("LitGap: User marked as donated");
        break;
    }
  },
  
  /**
   * Open donation page in browser
   * 
   * @private
   */
  _openDonationPage: function() {
    try {
      const url = "https://github.com/sponsors/Yu-TingSun";
      
      const io = Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);
      const uri = io.newURI(url, null, null);
      
      const extProtocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
        .getService(Components.interfaces.nsIExternalProtocolService);
      extProtocolSvc.loadURI(uri);
      
      Zotero.debug("LitGap: Opened donation page");
    } catch (e) {
      Zotero.debug(`LitGap: Failed to open donation page - ${e.message}`);
    }
  },
  
  /**
   * Save both Markdown and HTML reports
   * 
   * @private
   * @param {string} reportMarkdown - Markdown report content
   * @param {string} reportHTML - HTML report content
   * @param {string} collectionName - Collection name for default filename
   * @returns {Promise<boolean>} True if saved successfully
   */
  _saveReports: async function(reportMarkdown, reportHTML, collectionName) {
    try {
      // Get the correct window object for Zotero 8
      const win = Services.ww.activeWindow || Zotero.getMainWindow();
      if (!win) {
        throw new Error("Cannot get Zotero main window");
      }
      
      // Create file picker for Markdown file
      const fp = Components.classes["@mozilla.org/filepicker;1"]
        .createInstance(Components.interfaces.nsIFilePicker);
      
      // Zotero 8 compatible init (windowGlobalChild, title, mode)
      fp.init(win.browsingContext, "Save LitGap Report (Markdown)", fp.modeSave);
      fp.appendFilter("Markdown Files", "*.md");
      fp.appendFilters(fp.filterAll);
      
      // Generate default filename
      const safeName = collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      fp.defaultString = `litgap_${safeName}_${dateStr}.md`;
      fp.defaultExtension = "md";
      
      // Show dialog
      const rv = await new Promise(resolve => {
        fp.open(result => resolve(result));
      });
      
      if (rv == fp.returnOK || rv == fp.returnReplace) {
        // Get the selected path (without extension)
        const mdPath = fp.file.path;
        const basePath = mdPath.replace(/\.md$/, '');
        
        // Save Markdown file
        await Zotero.File.putContentsAsync(fp.file, reportMarkdown);
        Zotero.debug(`LitGap Main: Markdown report saved to ${mdPath}`);
        
        // Save HTML file with same base name
        const htmlPath = basePath + '.html';
        const htmlFile = Components.classes["@mozilla.org/file/local;1"]
          .createInstance(Components.interfaces.nsIFile);
        htmlFile.initWithPath(htmlPath);
        
        await Zotero.File.putContentsAsync(htmlFile, reportHTML);
        Zotero.debug(`LitGap Main: HTML report saved to ${htmlPath}`);
        
        return true;
      } else {
        Zotero.debug("LitGap Main: User cancelled file save");
        return false;
      }
      
    } catch (error) {
      Zotero.debug(`LitGap Main: Error saving reports - ${error.message}`);
      Zotero.logError(error);
      
      this._showError(
        `Failed to save reports: ${error.message}\n\n` +
        `You can try again or check console for details.`
      );
      
      return false;
    }
  },
  
  /**
   * Show error dialog
   * 
   * @private
   * @param {string} message - Error message
   */
  _showError: function(message) {
    const ps = Services.prompt;
    ps.alert(null, "LitGap Error", message);
  },
  
  /**
   * Show info dialog
   * 
   * @private
   * @param {string} message - Info message
   */
  _showInfo: function(message) {
    const ps = Services.prompt;
    ps.alert(null, "LitGap", message);
  },
  
  /**
   * Show success dialog
   * 
   * @private
   * @param {string} message - Success message
   */
  _showSuccess: function(message) {
    const ps = Services.prompt;
    ps.alert(null, "LitGap Success", message);
  }
};
