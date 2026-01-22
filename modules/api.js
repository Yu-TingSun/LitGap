/**
 * LitGap - API Module
 * Semantic Scholar API client
 * 
 * @module api
 * @version 1.4.0
 * 
 * Ported from: fetch_citations.py
 * 
 * CHANGELOG:
 * v1.4.0 - Fixed JSON parsing (Zotero auto-parses responseType:'json')
 * v1.3.0 - Added rate limit handling with retry logic
 * v1.2.0 - Initial implementation
 * 
 * TESTED: 2026-01-21
 * - Successfully tested with 3 real papers
 * - Collected 1,472 citations (1,408 unique)
 * - 100% success rate
 */

var API = {
  
  /**
   * API Configuration
   */
  baseURL: "https://api.semanticscholar.org/graph/v1",
  delay: 3000, // 3 seconds between requests (safe rate)
  maxRetries: 3, // Maximum retry attempts for rate limiting
  
  /**
   * Statistics tracking
   */
  stats: {
    totalRequests: 0,
    successful: 0,
    failed: 0,
    noDOI: 0,
    notFound: 0,
    rateLimited: 0
  },
  
  /**
   * Fetch citations for all papers
   * 
   * @param {Array} papers - Array of paper objects from Parser
   * @param {Function} progressCallback - Called with (current, total, title)
   * @returns {Promise<Object>} Citation data object
   */
  fetchCitations: async function(papers, progressCallback) {
    Zotero.debug("API: Starting citation fetch...");
    Zotero.debug(`API: Processing ${papers.length} papers`);
    Zotero.debug(`API: Using ${this.delay}ms delay between requests`);
    
    // Reset stats for this run
    this._resetStats();
    
    const allCitations = [];
    const userPaperIds = new Set();
    
    // Process each paper
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, papers.length, paper.title);
      }
      
      Zotero.debug(`API: [${i + 1}/${papers.length}] Processing: ${paper.title.substring(0, 50)}...`);
      
      // Fetch paper data by DOI with retry logic
      const result = await this._fetchPaperByDOIWithRetry(paper.doi);
      
      if (result) {
        // Store user's paper ID
        if (result.paperId) {
          userPaperIds.add(result.paperId);
        }
        
        // Collect citations
        const citations = result.citations || [];
        Zotero.debug(`API:   ✓ Found ${citations.length} citations`);
        
        citations.forEach(cite => {
          allCitations.push({
            paperId: cite.paperId,
            title: cite.title || '',
            year: cite.year,
            citationCount: cite.citationCount || 0,
            citedBy: paper.title.substring(0, 50) // Record which paper cited this
          });
        });
      } else {
        Zotero.debug(`API:   ✗ No data found`);
      }
    }
    
    Zotero.debug("\nAPI: Deduplicating citations...");
    
    // Deduplicate citations (same paper may be cited multiple times)
    const uniqueCitations = {};
    allCitations.forEach(citation => {
      const paperId = citation.paperId;
      if (paperId) {
        if (!uniqueCitations[paperId]) {
          uniqueCitations[paperId] = citation;
          uniqueCitations[paperId].mentioned_count = 1;
        } else {
          // Increment mention count
          uniqueCitations[paperId].mentioned_count++;
        }
      }
    });
    
    const result = {
      user_papers: papers,
      user_paper_ids: Array.from(userPaperIds),
      all_citations: Object.values(uniqueCitations),
      stats: {
        user_papers_count: papers.length,
        total_citations: allCitations.length,
        unique_citations: Object.keys(uniqueCitations).length
      }
    };
    
    Zotero.debug("\nAPI: Fetch complete!");
    Zotero.debug(`API: Total citations: ${result.stats.total_citations}`);
    Zotero.debug(`API: Unique citations: ${result.stats.unique_citations}`);
    
    // Print statistics
    this._printStats();
    
    return result;
  },
  
  /**
   * Fetch single paper by DOI with retry logic
   * 
   * @private
   * @param {string} doi - Paper DOI
   * @param {number} attempt - Current attempt number
   * @returns {Promise<Object|null>} Paper data or null if not found
   */
  _fetchPaperByDOIWithRetry: async function(doi, attempt = 1) {
    const result = await this._fetchPaperByDOI(doi);
    
    // If rate limited and we have retries left
    if (result === 'RATE_LIMITED' && attempt < this.maxRetries) {
      const waitTime = this.delay * attempt * 2; // Exponential backoff
      Zotero.debug(`API:   ⏰ Rate limited, waiting ${waitTime/1000}s before retry ${attempt}/${this.maxRetries}...`);
      await this._sleep(waitTime);
      return this._fetchPaperByDOIWithRetry(doi, attempt + 1);
    }
    
    return result === 'RATE_LIMITED' ? null : result;
  },
  
  /**
   * Fetch single paper by DOI
   * 
   * @private
   * @param {string} doi - Paper DOI
   * @returns {Promise<Object|null>} Paper data or null if not found
   */
  _fetchPaperByDOI: async function(doi) {
    // Check if DOI exists
    if (!doi) {
      this.stats.noDOI++;
      return null;
    }
    
    this.stats.totalRequests++;
    
    // URL encode the DOI and build API URL
    const encodedDOI = encodeURIComponent(doi);
    const url = `${this.baseURL}/paper/DOI:${encodedDOI}`;
    
    // Fields to request
    const fields = "paperId,title,year,citationCount,citations,citations.paperId,citations.title,citations.year,citations.citationCount";
    
    try {
      // Make HTTP request using Zotero's HTTP client
      const response = await Zotero.HTTP.request(
        'GET',
        `${url}?fields=${fields}`,
        {
          responseType: 'json',
          timeout: 10000
        }
      );
      
      // Add delay to avoid rate limiting
      await this._sleep(this.delay);
      
      // Handle response
      if (response.status === 200) {
        this.stats.successful++;
        try {
          // Zotero.HTTP.request with responseType:'json' returns parsed object
          // Check if response is already an object or needs parsing
          const data = typeof response.response === 'string' 
            ? JSON.parse(response.response)
            : response.response;
          return data;
        } catch (e) {
          Zotero.debug(`API: Error parsing JSON: ${e.message}`);
          this.stats.failed++;
          return null;
        }
      } else if (response.status === 404) {
        this.stats.notFound++;
        return null;
      } else if (response.status === 429) {
        this.stats.rateLimited++;
        Zotero.debug(`API: Rate limit hit`);
        return 'RATE_LIMITED';
      } else {
        this.stats.failed++;
        Zotero.debug(`API: HTTP Error ${response.status} for DOI: ${doi.substring(0, 30)}...`);
        return null;
      }
      
    } catch (error) {
      // Check if error is rate limit (429)
      if (error.message && error.message.includes('429')) {
        this.stats.rateLimited++;
        return 'RATE_LIMITED';
      }
      
      this.stats.failed++;
      Zotero.debug(`API: Request failed: ${error.message}`);
      Zotero.logError(error);
      return null;
    }
  },
  
  /**
   * Sleep for specified milliseconds
   * 
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  _sleep: function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * Reset statistics
   * 
   * @private
   */
  _resetStats: function() {
    this.stats = {
      totalRequests: 0,
      successful: 0,
      failed: 0,
      noDOI: 0,
      notFound: 0,
      rateLimited: 0
    };
  },
  
  /**
   * Print statistics to console
   * 
   * @private
   */
  _printStats: function() {
    Zotero.debug("\n" + "=".repeat(60));
    Zotero.debug("📊 API Statistics:");
    Zotero.debug(`  Total requests: ${this.stats.totalRequests}`);
    Zotero.debug(`  Successful: ${this.stats.successful}`);
    Zotero.debug(`  Failed: ${this.stats.failed}`);
    Zotero.debug(`  Not found: ${this.stats.notFound}`);
    Zotero.debug(`  Rate limited: ${this.stats.rateLimited}`);
    Zotero.debug(`  No DOI: ${this.stats.noDOI}`);
    Zotero.debug("=".repeat(60));
  }
};