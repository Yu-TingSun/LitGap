/**
 * LitGap - Main Orchestrator
 * Coordinates Parser → API → Analyzer → Reporter workflow
 * 
 * @module main
 * @version 1.0.0
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
    
    let progressWindow = null;
    
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
      
      // Step 2: Create progress window
      progressWindow = this._createProgressWindow();
      progressWindow.show();
      progressWindow.addLines([
        `Analyzing ${papersWithDOI.length} papers...`,
        "This may take a few minutes."
      ]);
      
      // Step 3: Fetch citations from Semantic Scholar
      Zotero.debug("\nLitGap Main: Step 2 - Fetching citations from Semantic Scholar");
      progressWindow.addLines(["\nFetching citation data..."]);
      
      const citationData = await LitGap.API.fetchCitations(
        papersWithDOI,
        (current, total, title) => {
          const shortTitle = title.substring(0, 50);
          progressWindow.addLines([`[${current}/${total}] ${shortTitle}...`]);
        }
      );
      
      if (!citationData || !citationData.all_citations) {
        throw new Error("Failed to fetch citation data");
      }
      
      Zotero.debug(`LitGap Main: Collected ${citationData.stats.unique_citations} unique citations`);
      
      // Step 4: Analyze knowledge gaps
      Zotero.debug("\nLitGap Main: Step 3 - Analyzing knowledge gaps");
      progressWindow.addLines(["\nAnalyzing knowledge gaps..."]);
      
      const recommendations = LitGap.Analyzer.findGaps(citationData, {
        minYear: 2010,
        topN: 10,
        minMentions: 2
      });
      
      // Check if Analyzer is implemented
      if (!recommendations || recommendations.length === 0) {
        progressWindow.close();
        
        // Check if it's because Analyzer is not implemented
        if (citationData.all_citations.length > 0) {
          this._showInfo(
            "Analysis complete!\n\n" +
            `Found ${citationData.stats.unique_citations} citations, ` +
            "but Analyzer module needs implementation.\n\n" +
            "Next step: Implement Analyzer.findGaps() to find knowledge gaps."
          );
        } else {
          this._showInfo(
            "No knowledge gaps found.\n\n" +
            "Your library appears to be well-covered!"
          );
        }
        return false;
      }
      
      Zotero.debug(`LitGap Main: Found ${recommendations.length} recommendations`);
      
      // Step 5: Generate reports (Markdown + HTML)
      Zotero.debug("\nLitGap Main: Step 4 - Generating reports");
      progressWindow.addLines(["\nGenerating reports..."]);
      
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
      
      // Step 6: Close progress and save reports
      progressWindow.close();
      progressWindow = null;
      
      const saved = await this._saveReports(reportMarkdown, reportHTML, collection.name);
      
      if (saved) {
        this._showSuccess(
          `Analysis complete! 🎉\n\n` +
          `Found ${recommendations.length} recommended papers.\n\n` +
          `Reports saved:\n` +
          `• Markdown (.md) - for editing\n` +
          `• HTML (.html) - for viewing with clickable links`
        );
        Zotero.debug("\nLitGap Main: Workflow completed successfully\n");
        return true;
      } else {
        this._showInfo(
          `Analysis complete! 🎉\n\n` +
          `Found ${recommendations.length} recommended papers.\n\n` +
          `Reports not saved (user cancelled).`
        );
        return false;
      }
      
    } catch (error) {
      Zotero.debug(`LitGap Main: Error - ${error.message}`);
      Zotero.debug(error.stack);
      Zotero.logError(error);
      
      if (progressWindow) {
        progressWindow.close();
      }
      
      this._showError(
        `Analysis failed: ${error.message}\n\n` +
        `Check console (Help > Debug Output Logging) for details.`
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
   * Create progress window
   * 
   * @private
   * @returns {Zotero.ProgressWindow} Progress window object
   */
  _createProgressWindow: function() {
    const pw = new Zotero.ProgressWindow();
    pw.changeHeadline("LitGap - Finding Hidden Papers");
    pw.addDescription("Analyzing your library...");
    return pw;
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
      // Get the correct window object
      const win = Zotero.getMainWindow();
      if (!win) {
        throw new Error("Cannot get Zotero main window");
      }
      
      // Create file picker for Markdown file
      const fp = Components.classes["@mozilla.org/filepicker;1"]
        .createInstance(Components.interfaces.nsIFilePicker);
      
      fp.init(win, "Save LitGap Report (Markdown)", fp.modeSave);
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
