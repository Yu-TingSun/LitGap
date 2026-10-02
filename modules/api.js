/**
 * LitGap - API Module
 * OpenAlex API client (reference network for Find Hidden Papers)
 *
 * @module api
 * @version 2.0.0
 *
 * CHANGELOG:
 * v2.0.0 - Data source switched from Semantic Scholar to OpenAlex (2026-10-02)
 *   Why:
 *   - Semantic Scholar returned 0 references (HTTP 200) for many papers
 *     (e.g. Blood 2010, BMC 2013) while OpenAlex had 33–48 for the same DOIs,
 *     so shared-reference analysis found no gaps.
 *   - S2's public pool was ~80% rate-limited (429).
 *   How:
 *   - Phase 1: one singleton lookup per user paper
 *       GET /works/doi:{doi}?select=id,doi,display_name,referenced_works
 *     Singleton lookups are free on OpenAlex (no daily budget cost).
 *   - Phase 2: count shared references locally (each source paper counts a
 *     reference once; user's own papers excluded via the same ID space).
 *   - Phase 3: fetch metadata only for candidates with
 *     mentioned_count >= minMentions (singleton lookups, capped).
 *   - Optional API key from pref extensions.zotero.litgap.openalexApiKey
 *     (sent as api_key=…; Zotero masks key= in debug output).
 *   - DOI normalization (strips https://doi.org/, doi:, lowercases).
 *   - Circuit breaker: after 3 consecutive rate-limited papers, remaining
 *     lookups are skipped and reported (daily keyless budget exhausted).
 *   - Retry / throttle logic from v1.5.0 kept (no Zotero internal retries,
 *     Retry-After honored, exponential backoff + jitter, max 4 attempts).
 *   Compatibility:
 *   - fetchCitations(papers, progressCallback, options) signature kept
 *     (options is new and optional).
 *   - Output keys unchanged: user_papers, user_paper_ids, all_citations[]
 *     { paperId, title, year, citationCount, doi, citedBy, citedByList,
 *     mentioned_count }, stats.{user_papers_count, total_citations,
 *     unique_citations, papers_succeeded, papers_failed, papers_not_found,
 *     failed_papers}. paperId is now an OpenAlex ID (e.g. "W2741809807").
 *   - all_citations now contains only candidates (mentioned_count >=
 *     minMentions) with full metadata; stats.unique_citations still counts
 *     all unique references.
 *
 * v1.5.0 - Retry/throttle rewrite; citations → references (Semantic Scholar)
 * v1.4.0 - Fixed JSON parsing (Zotero auto-parses responseType:'json')
 * v1.3.0 - Added rate limit handling with retry logic
 * v1.2.0 - Initial implementation
 */

var API = {

  /**
   * API Configuration
   */
  baseURL: "https://api.openalex.org",
  apiKeyPref: "extensions.zotero.litgap.openalexApiKey",
  minInterval: 150,        // Minimum ms between request starts (OpenAlex allows far more)
  maxAttempts: 4,          // Total attempts per lookup (1 initial + 3 retries)
  backoffBase: 2000,       // First backoff wait (ms); doubles each retry
  backoffMax: 16000,       // Upper bound for a single backoff wait (ms)
  retryAfterCap: 60000,    // Upper bound for honoring a Retry-After header (ms)
  requestTimeout: 30000,   // Per-request timeout (ms)
  maxCandidates: 200,      // Max candidates to fetch metadata for (by mentions desc)
  circuitBreakerLimit: 3,  // Consecutive rate-limited lookups before giving up

  userFields: "id,doi,display_name,referenced_works",
  candidateFields: "id,doi,display_name,publication_year,cited_by_count",

  /**
   * Internal state
   */
  _lastRequestTime: 0,
  _consecutiveRateLimited: 0,
  _rateLimitTripped: false,

  /**
   * Statistics tracking
   */
  stats: {
    totalRequests: 0,
    successful: 0,
    failed: 0,
    noDOI: 0,
    notFound: 0,
    rateLimited: 0,
    retries: 0,
    skipped: 0
  },

  /**
   * Fetch the reference network for all papers.
   * (Name kept as fetchCitations for compatibility with main.js.)
   *
   * @param {Array} papers - Array of paper objects from Parser
   * @param {Function} progressCallback - Called with (current, total, title)
   * @param {Object} [options]
   * @param {number} [options.minMentions=2] - Min shared mentions to fetch metadata
   * @returns {Promise<Object>} Citation data object
   */
  fetchCitations: async function(papers, progressCallback, options = {}) {
    const minMentions = options.minMentions || 2;

    Zotero.debug("API: Starting reference fetch (OpenAlex)...");
    Zotero.debug(`API: Processing ${papers.length} papers, API key: ${this._getApiKey() ? 'yes' : 'no'}`);

    this._resetStats();
    this._consecutiveRateLimited = 0;
    this._rateLimitTripped = false;

    const userPaperIds = new Set();
    const failedPapers = [];
    const refCounts = {};       // W-id -> { count, citedByList }
    let totalRefs = 0;
    let succeededCount = 0;

    // ── Phase 1: user papers ───────────────────────────────────────────────
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      const title = paper.title || '(untitled)';

      if (progressCallback) {
        progressCallback(i + 1, papers.length, title);
      }

      const doi = this._normalizeDOI(paper.doi);
      if (!doi) {
        this.stats.noDOI++;
        failedPapers.push({ title, doi: paper.doi || '', reason: 'no_doi' });
        continue;
      }

      if (this._rateLimitTripped) {
        this.stats.skipped++;
        failedPapers.push({ title, doi, reason: 'skipped_rate_limit' });
        continue;
      }

      Zotero.debug(`API: [${i + 1}/${papers.length}] ${title.substring(0, 50)}...`);

      const result = await this._lookup(`/works/doi:${this._encodeDOI(doi)}`, this.userFields);

      if (result.status === 'not_found') {
        Zotero.debug("API:   ✗ Not found on OpenAlex");
        failedPapers.push({ title, doi, reason: 'not_found' });
        continue;
      }
      if (result.status !== 'ok') {
        Zotero.debug(`API:   ✗ Failed (${result.reason})`);
        failedPapers.push({ title, doi, reason: result.reason });
        continue;
      }

      succeededCount++;
      const data = result.data;
      const userId = this._shortId(data.id);
      if (userId) userPaperIds.add(userId);

      const refs = Array.isArray(data.referenced_works) ? data.referenced_works : [];
      const seen = new Set();
      const sourceLabel = title.substring(0, 50);

      refs.forEach(ref => {
        const id = this._shortId(ref);
        if (!id || seen.has(id)) return;
        seen.add(id);
        totalRefs++;
        if (!refCounts[id]) {
          refCounts[id] = { count: 1, citedByList: [sourceLabel] };
        } else {
          refCounts[id].count++;
          refCounts[id].citedByList.push(sourceLabel);
        }
      });

      Zotero.debug(`API:   ✓ Found ${seen.size} references`);
    }

    // ── Phase 2: select candidates ─────────────────────────────────────────
    const uniqueCount = Object.keys(refCounts).length;
    let candidateIds = Object.keys(refCounts)
      .filter(id => !userPaperIds.has(id) && refCounts[id].count >= minMentions)
      .sort((a, b) => refCounts[b].count - refCounts[a].count);

    Zotero.debug(`API: ${uniqueCount} unique references, ${candidateIds.length} shared by >= ${minMentions} papers`);

    if (candidateIds.length > this.maxCandidates) {
      Zotero.debug(`API: Capping candidates at ${this.maxCandidates}`);
      candidateIds = candidateIds.slice(0, this.maxCandidates);
    }

    // ── Phase 3: candidate metadata ────────────────────────────────────────
    const candidates = [];
    let metadataFailed = 0;

    for (let j = 0; j < candidateIds.length; j++) {
      const id = candidateIds[j];
      const info = refCounts[id];

      if (progressCallback) {
        progressCallback(j + 1, candidateIds.length, `Fetching details for shared references...`);
      }

      let meta = null;
      if (!this._rateLimitTripped) {
        const result = await this._lookup(`/works/${id}`, this.candidateFields);
        if (result.status === 'ok') {
          meta = result.data;
        } else {
          metadataFailed++;
        }
      } else {
        metadataFailed++;
      }

      // Keep the candidate even without metadata; title fallback keeps reports valid
      candidates.push({
        paperId: id,
        title: (meta && meta.display_name) || `[OpenAlex ${id}]`,
        year: (meta && meta.publication_year) || null,
        citationCount: (meta && meta.cited_by_count) || 0,
        doi: meta ? this._normalizeDOI(meta.doi) : '',
        citedBy: info.citedByList[0],
        citedByList: info.citedByList,
        mentioned_count: info.count
      });
    }

    if (metadataFailed > 0) {
      Zotero.debug(`API: Metadata unavailable for ${metadataFailed} candidate(s)`);
    }

    const result = {
      user_papers: papers,
      user_paper_ids: Array.from(userPaperIds),
      all_citations: candidates,
      stats: {
        data_source: 'OpenAlex',
        user_papers_count: papers.length,
        total_citations: totalRefs,           // total reference entries
        unique_citations: uniqueCount,        // unique referenced works
        papers_succeeded: succeededCount,
        papers_failed: failedPapers.filter(f => f.reason !== 'not_found').length,
        papers_not_found: failedPapers.filter(f => f.reason === 'not_found').length,
        failed_papers: failedPapers,
        rate_limit_tripped: this._rateLimitTripped,
        metadata_failed: metadataFailed
      }
    };

    Zotero.debug("\nAPI: Fetch complete!");
    Zotero.debug(`API: Papers succeeded: ${succeededCount}/${papers.length}`);
    Zotero.debug(`API: Total references: ${totalRefs}, unique: ${uniqueCount}`);
    if (failedPapers.length > 0) {
      Zotero.debug(`API: ${failedPapers.length} paper(s) without data:`);
      failedPapers.forEach(f => {
        Zotero.debug(`API:   - [${f.reason}] ${f.title.substring(0, 60)} (${f.doi})`);
      });
    }
    if (this._rateLimitTripped) {
      Zotero.debug("API: ⚠ OpenAlex rate limit reached — remaining lookups were skipped");
    }

    this._printStats();
    return result;
  },

  /**
   * Singleton lookup with retry on 429 / 5xx / timeout / network error.
   *
   * @private
   * @param {string} path - e.g. "/works/doi:10.1000/xyz" or "/works/W123"
   * @param {string} select - Comma-separated field list
   * @returns {Promise<Object>} { status: 'ok', data } | { status: 'not_found' } |
   *                            { status: 'failed', reason }
   */
  _lookup: async function(path, select) {
    let last = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      last = await this._request(path, select);

      if (last.status !== 'retry') {
        if (last.status === 'ok' || last.status === 'not_found') {
          this._consecutiveRateLimited = 0;
        } else {
          this.stats.failed++;
        }
        return last;
      }

      if (attempt === this.maxAttempts) break;

      let waitMs;
      if (last.retryAfterMs !== null) {
        waitMs = Math.min(last.retryAfterMs, this.retryAfterCap);
      } else {
        const backoff = Math.min(this.backoffBase * Math.pow(2, attempt - 1), this.backoffMax);
        waitMs = backoff + Math.floor(Math.random() * 1000);
      }

      this.stats.retries++;
      Zotero.debug(`API:   ⏰ ${last.reason}, waiting ${(waitMs / 1000).toFixed(1)}s ` +
                   `before attempt ${attempt + 1}/${this.maxAttempts}...`);
      await this._sleep(waitMs);
    }

    this.stats.failed++;

    if (last && last.reason === 'rate_limited') {
      this._consecutiveRateLimited++;
      if (this._consecutiveRateLimited >= this.circuitBreakerLimit) {
        this._rateLimitTripped = true;
      }
    }

    return { status: 'failed', reason: last ? last.reason : 'unknown' };
  },

  /**
   * One HTTP attempt, no Zotero-internal retries.
   *
   * @private
   * @returns {Promise<Object>} { status: 'ok', data } | { status: 'not_found' } |
   *   { status: 'retry', reason, retryAfterMs } | { status: 'failed', reason }
   */
  _request: async function(path, select) {
    await this._throttle();
    this.stats.totalRequests++;

    let url = `${this.baseURL}${path}?select=${select}`;
    const apiKey = this._getApiKey();
    if (apiKey) {
      url += `&api_key=${encodeURIComponent(apiKey)}`;
    }

    try {
      const response = await Zotero.HTTP.request('GET', url, {
        responseType: 'json',
        timeout: this.requestTimeout,
        successCodes: [200, 404],
        noRetryOnThrottle: true,
        errorDelayMax: 0
      });

      if (response.status === 404) {
        this.stats.notFound++;
        return { status: 'not_found' };
      }

      let data;
      try {
        data = typeof response.response === 'string'
          ? JSON.parse(response.response)
          : response.response;
      } catch (e) {
        Zotero.debug(`API: Error parsing JSON: ${e.message}`);
        return { status: 'failed', reason: 'bad_json' };
      }

      if (!data || !data.id) {
        return { status: 'failed', reason: 'empty_response' };
      }

      this.stats.successful++;
      return { status: 'ok', data };

    } catch (error) {
      if (Zotero.HTTP.BrowserOfflineException
          && error instanceof Zotero.HTTP.BrowserOfflineException) {
        return { status: 'failed', reason: 'offline' };
      }

      if (Zotero.HTTP.TimeoutException
          && error instanceof Zotero.HTTP.TimeoutException) {
        return { status: 'retry', reason: 'timeout', retryAfterMs: null };
      }

      const status = error && typeof error.status === 'number' ? error.status : null;

      if (status === 429) {
        this.stats.rateLimited++;
        return { status: 'retry', reason: 'rate_limited', retryAfterMs: this._getRetryAfterMs(error) };
      }
      if (status !== null && status >= 500 && status < 600) {
        return { status: 'retry', reason: `http_${status}`, retryAfterMs: this._getRetryAfterMs(error) };
      }
      if (status === 0) {
        return { status: 'retry', reason: 'network_error', retryAfterMs: null };
      }

      // 401/403 with a key usually means an invalid key
      if ((status === 401 || status === 403) && apiKey) {
        Zotero.debug("API: OpenAlex rejected the API key (HTTP " + status + ")");
        return { status: 'failed', reason: 'invalid_api_key' };
      }

      Zotero.debug(`API: Request failed (${status !== null ? 'HTTP ' + status : 'exception'}): ${error && error.message}`);
      if (status === null) Zotero.logError(error);
      return { status: 'failed', reason: status !== null ? `http_${status}` : 'exception' };
    }
  },

  /**
   * Normalize a DOI: strip URL / "doi:" prefixes, trim, lowercase.
   *
   * @private
   * @param {string} doi
   * @returns {string} Normalized DOI or ''
   */
  _normalizeDOI: function(doi) {
    if (!doi || typeof doi !== 'string') return '';
    let d = doi.trim();
    d = d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    d = d.replace(/^doi:\s*/i, '');
    d = d.trim().toLowerCase();
    return d.startsWith('10.') ? d : '';
  },

  /**
   * Encode a DOI for use in a URL path, keeping "/" readable.
   *
   * @private
   */
  _encodeDOI: function(doi) {
    return encodeURIComponent(doi).replace(/%2F/gi, '/');
  },

  /**
   * "https://openalex.org/W123" → "W123"
   *
   * @private
   */
  _shortId: function(id) {
    if (!id || typeof id !== 'string') return '';
    const m = id.match(/(W\d+)$/i);
    return m ? m[1].toUpperCase() : '';
  },

  /**
   * Read the optional OpenAlex API key from preferences.
   *
   * @private
   */
  _getApiKey: function() {
    try {
      const key = Zotero.Prefs.get(this.apiKeyPref, true);
      return (typeof key === 'string' && key.trim()) ? key.trim() : '';
    } catch (_) {
      return '';
    }
  },

  /**
   * Wait until at least minInterval ms have passed since the last request start.
   *
   * @private
   */
  _throttle: async function() {
    const wait = this._lastRequestTime + this.minInterval - Date.now();
    if (wait > 0) {
      await this._sleep(wait);
    }
    this._lastRequestTime = Date.now();
  },

  /**
   * Read Retry-After (seconds) from a failed request, in ms.
   *
   * @private
   */
  _getRetryAfterMs: function(error) {
    try {
      const xhr = error && error.xmlhttp;
      if (!xhr || typeof xhr.getResponseHeader !== 'function') return null;
      const value = xhr.getResponseHeader('Retry-After');
      if (!value) return null;
      const seconds = parseInt(value, 10);
      if (isNaN(seconds) || seconds < 0) return null;
      return seconds * 1000;
    } catch (_) {
      return null;
    }
  },

  _sleep: function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  _resetStats: function() {
    this.stats = {
      totalRequests: 0,
      successful: 0,
      failed: 0,
      noDOI: 0,
      notFound: 0,
      rateLimited: 0,
      retries: 0,
      skipped: 0
    };
  },

  _printStats: function() {
    Zotero.debug("\n" + "=".repeat(60));
    Zotero.debug("📊 API Statistics (OpenAlex):");
    Zotero.debug(`  Total requests: ${this.stats.totalRequests}`);
    Zotero.debug(`  Successful: ${this.stats.successful}`);
    Zotero.debug(`  Failed: ${this.stats.failed}`);
    Zotero.debug(`  Not found: ${this.stats.notFound}`);
    Zotero.debug(`  Rate limited (429 responses): ${this.stats.rateLimited}`);
    Zotero.debug(`  Retries: ${this.stats.retries}`);
    Zotero.debug(`  Skipped (rate limit): ${this.stats.skipped}`);
    Zotero.debug(`  No DOI: ${this.stats.noDOI}`);
    Zotero.debug("=".repeat(60));
  }
};
