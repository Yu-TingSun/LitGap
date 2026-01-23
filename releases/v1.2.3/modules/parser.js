/**
 * LitGap - Parser Module
 * Extracts paper data from Zotero collection
 * 
 * @module parser
 * @version 1.2.0
 */

var Parser = {
  
  /**
   * Parse papers from a Zotero collection
   * 
   * @param {Zotero.Collection} collection - Zotero collection object
   * @param {Object} options - Optional settings
   * @param {number} options.sampleSize - Number of papers to sample (null = all)
   * @param {boolean} options.debug - Enable debug output
   * @param {number} options.randomSeed - Random seed for sampling
   * @returns {Array} Array of paper objects
   */
  parseZoteroLibrary: function(collection, options = {}) {
    const {
      sampleSize = null,
      debug = false,
      randomSeed = 42
    } = options;
    
    Zotero.debug("LitGap Parser: Starting library parse");
    
    let items = collection.getChildItems();
    Zotero.debug(`LitGap Parser: Found ${items.length} items in collection`);
    
    if (debug) {
      const typeCounts = {};
      items.forEach(item => {
        const type = item.itemType;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      
      Zotero.debug("=== Item Type Distribution ===");
      Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          Zotero.debug(`  ${type}: ${count}`);
        });
    }
    
    const validTypes = new Set([
      'journalArticle',
      'book',
      'bookSection',
      'conferencePaper',
      'preprint'
    ]);
    
    items = items.filter(item => validTypes.has(item.itemType));
    Zotero.debug(`LitGap Parser: ${items.length} academic items after filtering`);
    
    if (items.length === 0) {
      Zotero.debug("LitGap Parser: No valid academic items found");
      return [];
    }
    
    if (sampleSize && sampleSize < items.length) {
      items = this._randomSample(items, sampleSize, randomSeed);
      Zotero.debug(`LitGap Parser: Randomly sampled ${sampleSize} items`);
    }
    
    const papers = items.map(item => this._extractPaperInfo(item));
    
    if (debug) {
      this._debugPaperSummary(papers, 5);
    }
    
    Zotero.debug(`LitGap Parser: Successfully parsed ${papers.length} papers`);
    return papers;
  },
  
  /**
   * Extract information from a single Zotero item
   * 
   * @private
   * @param {Zotero.Item} item - Zotero item object
   * @returns {Object} Paper information object
   */
  _extractPaperInfo: function(item) {
    const creators = item.getCreators();
    const authors = creators
      .filter(c => c.creatorType === 'author')
      .slice(0, 3)
      .map(c => {
        const lastName = c.lastName || '';
        const firstName = c.firstName || '';
        return firstName ? `${lastName}, ${firstName}` : lastName;
      });
    
    let year = item.getField('year');
    if (!year) {
      const date = item.getField('date');
      if (date && date.length >= 4) {
        year = date.substring(0, 4);
      }
    }
    
    const doi = item.getField('DOI') || '';
    const title = item.getField('title') || '';
    
    let publication = '';
    try {
      publication = item.getField('publicationTitle') || 
                   item.getField('bookTitle') || 
                   item.getField('proceedingsTitle') || '';
    } catch (e) {
      publication = '';
    }
    
    const url = item.getField('url') || '';
    
    let abstract = '';
    try {
      const fullAbstract = item.getField('abstractNote') || '';
      abstract = fullAbstract.substring(0, 200);
    } catch (e) {
      abstract = '';
    }
    
    return {
      id: item.key,
      itemID: item.id,
      title: title.replace(/\n/g, ' ').trim(),
      authors: authors,
      year: year || null,
      doi: doi.trim(),
      type: item.itemType,
      publication: publication,
      url: url,
      abstract: abstract
    };
  },
  
  /**
   * Random sampling using Fisher-Yates shuffle
   * 
   * @private
   * @param {Array} array - Array to sample from
   * @param {number} sampleSize - Number of items to sample
   * @param {number} seed - Random seed for reproducibility
   * @returns {Array} Sampled array
   */
  _randomSample: function(array, sampleSize, seed) {
    let randomSeed = seed;
    const seededRandom = () => {
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };
    
    const result = [...array];
    for (let i = 0; i < sampleSize; i++) {
      const j = i + Math.floor(seededRandom() * (result.length - i));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result.slice(0, sampleSize);
  },
  
  /**
   * Print paper summary for debugging
   * 
   * @private
   * @param {Array} papers - Array of paper objects
   * @param {number} showCount - Number of papers to display
   */
  _debugPaperSummary: function(papers, showCount = 3) {
    Zotero.debug("\n" + "=".repeat(60));
    Zotero.debug("=== LitGap Parser: Paper Summary ===");
    Zotero.debug("=".repeat(60));
    
    Zotero.debug(`\nShowing first ${showCount} papers:\n`);
    papers.slice(0, showCount).forEach((paper, index) => {
      Zotero.debug(`Paper ${index + 1}:`);
      Zotero.debug(`  Title: ${paper.title.substring(0, 80)}${paper.title.length > 80 ? '...' : ''}`);
      
      if (paper.authors.length > 0) {
        const authorStr = paper.authors.join(', ');
        Zotero.debug(`  Authors: ${authorStr}${paper.authors.length > 3 ? ' et al.' : ''}`);
      }
      
      if (paper.year) {
        Zotero.debug(`  Year: ${paper.year}`);
      }
      
      Zotero.debug(`  DOI: ${paper.doi || 'NOT FOUND'}`);
      
      if (paper.publication) {
        const pubStr = paper.publication.substring(0, 60);
        Zotero.debug(`  Publication: ${pubStr}${paper.publication.length > 60 ? '...' : ''}`);
      }
      
      Zotero.debug('');
    });
    
    Zotero.debug("=".repeat(60));
    Zotero.debug("Statistics:");
    Zotero.debug(`  Total papers: ${papers.length}`);
    
    const withDOI = papers.filter(p => p.doi).length;
    const doiPercent = papers.length > 0 ? (withDOI / papers.length * 100).toFixed(1) : 0;
    Zotero.debug(`  Papers with DOI: ${withDOI} (${doiPercent}%)`);
    
    const years = papers
      .map(p => parseInt(p.year))
      .filter(y => !isNaN(y));
    
    if (years.length > 0) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      Zotero.debug(`  Year range: ${minYear} - ${maxYear}`);
    }
    
    const typeCounts = {};
    papers.forEach(p => {
      typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
    });
    
    Zotero.debug("  Type distribution:");
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        Zotero.debug(`    ${type}: ${count}`);
      });
    
    Zotero.debug("=".repeat(60) + "\n");
  },
  
  /**
   * Determine sampling strategy based on library size
   * 
   * @param {number} totalWithDOI - Papers with DOI
   * @returns {Object} Strategy object with sampleSize, warningLevel, message, etc.
   */
  determineSamplingStrategy: function(totalWithDOI) {
    if (totalWithDOI <= 30) {
      return {
        sampleSize: null,
        shouldSample: false,
        warningLevel: 'none',
        message: 'Will process all papers',
        estimatedTime: Math.ceil(totalWithDOI * 1.5 / 60) || 1,
        reason: null,
        suggestion: null
      };
    } else if (totalWithDOI <= 100) {
      return {
        sampleSize: 50,
        shouldSample: true,
        warningLevel: 'info',
        message: 'Large collection - will sample 50 papers (recommended)',
        estimatedTime: 2,
        reason: 'Faster processing with same quality results',
        suggestion: null
      };
    } else {
      return {
        sampleSize: 50,
        shouldSample: true,
        warningLevel: 'warning',
        message: 'Collection too large - will sample 50 papers (required)',
        estimatedTime: 2,
        reason: 'Gap analysis works best with focused collections (30-100 papers)',
        suggestion: 'Consider splitting into topic-specific sub-collections'
      };
    }
  },
  
  /**
   * Estimate processing time in minutes (deprecated - use determineSamplingStrategy)
   * 
   * @param {number} paperCount - Number of papers to process
   * @returns {number} Estimated time in minutes
   */
  estimateProcessingTime: function(paperCount) {
    const seconds = paperCount * 1.5;
    return Math.ceil(seconds / 60);
  }
};
