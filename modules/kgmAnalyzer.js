/**
 * LitGap - KGM Analyzer Module
 * Core logic for Knowledge Gap Mapping analysis
 *
 * @module kgmAnalyzer
 * @version 2.0.0
 *
 * Depends on:
 *   - PromptBuilder  (modules/promptBuilder.js)
 *   - AIClient       (modules/aiClient.js)  — passed in as argument, not imported
 *
 * Public API:
 *   collectLibraryData(collection)
 *     → { collectionName, allTitles, topAbstracts }
 *
 *   parseLitGapReport(markdownContent)
 *     → [{ title, mentionCount }]  sorted by mentionCount desc, max 15
 *
 *   detectTopic(libraryData, aiClient)
 *     → Promise<string>  one-sentence domain description
 *
 *   runAnalysis(libraryData, missingPapers, confirmedDomain, aiClient)
 *     → Promise<{ framework, gapAnalysis }>
 */

var KGMAnalyzer = {

  // ─── Limits ────────────────────────────────────────────────────────────────

  MAX_MISSING_PAPERS:  15,   // max papers parsed from LitGap report
  MAX_ABSTRACT_PAPERS: 15,   // max papers whose abstracts are collected
  ABSTRACT_MAX_CHARS:  150,  // max chars per abstract (token budget)

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Collect library data from a Zotero collection.
   * Extracts all titles and top abstracts for use in AI prompts.
   *
   * @param {Zotero.Collection} collection - Zotero collection object
   * @returns {{
   *   collectionName: string,
   *   allTitles: string[],
   *   topAbstracts: Array<{title:string, abstract:string}>
   * }}
   */
  collectLibraryData: function(collection) {
    Zotero.debug('KGMAnalyzer: Collecting library data...');

    const collectionName = collection.name;
    const items = collection.getChildItems();

    // Filter to regular academic items only (exclude attachments, notes, etc.)
    const academicItems = items.filter(item =>
      item.isRegularItem() && !item.isAttachment()
    );

    Zotero.debug(`KGMAnalyzer: Found ${academicItems.length} academic items`);

    // Extract all titles (no limit — titles are short)
    const allTitles = academicItems
      .map(item => {
        const title = item.getField('title') || '';
        return title.replace(/\n/g, ' ').trim();
      })
      .filter(t => t.length > 0);

    // Extract abstracts for top papers (first MAX_ABSTRACT_PAPERS items)
    const topAbstracts = academicItems
      .slice(0, this.MAX_ABSTRACT_PAPERS)
      .map(item => {
        const title = (item.getField('title') || '').replace(/\n/g, ' ').trim();
        let abstract = '';
        try {
          const full = item.getField('abstractNote') || '';
          abstract = full.substring(0, this.ABSTRACT_MAX_CHARS).trim();
          if (full.length > this.ABSTRACT_MAX_CHARS) abstract += '...';
        } catch (e) {
          abstract = '';
        }
        return { title, abstract };
      })
      .filter(p => p.title.length > 0);

    Zotero.debug(`KGMAnalyzer: Collected ${allTitles.length} titles, ${topAbstracts.length} abstracts`);

    return { collectionName, allTitles, topAbstracts };
  },

  /**
   * Parse an existing LitGap Markdown report to extract missing papers.
   *
   * Regex targets blocks like:
   *   #### 1. Paper Title
   *   ...
   *   - Mentioned by: 5 of your papers
   *
   * @param {string} markdownContent - Full content of a litgap_*.md file
   * @returns {Array<{title:string, mentionCount:number}>}
   *          Sorted by mentionCount descending, max MAX_MISSING_PAPERS entries
   */
  parseLitGapReport: function(markdownContent) {
    Zotero.debug('KGMAnalyzer: Parsing LitGap report...');

    if (!markdownContent || markdownContent.trim().length === 0) {
      Zotero.debug('KGMAnalyzer: Empty report content');
      return [];
    }

    const results = [];

    // Primary pattern: matches "#### N. Title" followed (anywhere nearby) by
    // "Mentioned by: N of your papers"
    // Uses a section-by-section approach for reliability
    const sectionPattern = /####\s+\d+\.\s+(.+?)(?:\n[\s\S]*?)?[-*]\s*Mentioned by:\s*(\d+)/g;
    let match;

    while ((match = sectionPattern.exec(markdownContent)) !== null) {
      const title       = match[1].replace(/\n/g, ' ').trim();
      const mentionCount = parseInt(match[2], 10);

      if (title && !isNaN(mentionCount)) {
        results.push({ title, mentionCount });
      }
    }

    // Fallback pattern: if primary found nothing, try looser matching
    if (results.length === 0) {
      Zotero.debug('KGMAnalyzer: Primary pattern found nothing, trying fallback...');

      const titlePattern   = /####\s+\d+\.\s+(.+)/g;
      const mentionPattern = /Mentioned by:\s*(\d+)/g;

      const titles   = [];
      const mentions = [];

      let m;
      while ((m = titlePattern.exec(markdownContent))   !== null) titles.push(m[1].trim());
      while ((m = mentionPattern.exec(markdownContent))  !== null) mentions.push(parseInt(m[1], 10));

      const len = Math.min(titles.length, mentions.length);
      for (let i = 0; i < len; i++) {
        results.push({ title: titles[i], mentionCount: mentions[i] });
      }
    }

    // Sort by mentionCount descending, cap at limit
    results.sort((a, b) => b.mentionCount - a.mentionCount);
    const limited = results.slice(0, this.MAX_MISSING_PAPERS);

    Zotero.debug(`KGMAnalyzer: Parsed ${limited.length} missing papers from report`);
    limited.forEach((p, i) => {
      Zotero.debug(`  ${i + 1}. [${p.mentionCount}x] ${p.title.substring(0, 60)}`);
    });

    return limited;
  },

  /**
   * Ask AI to detect the research domain from library titles.
   *
   * @param {{ allTitles: string[] }} libraryData - From collectLibraryData()
   * @param {Object} aiClient - AIClient instance (has .complete() method)
   * @returns {Promise<string>} One-sentence domain description
   */
  detectTopic: async function(libraryData, aiClient) {
    Zotero.debug('KGMAnalyzer: Detecting research topic...');

    const prompt = PromptBuilder.buildTopicPrompt(libraryData.allTitles);

    const response = await aiClient.complete(prompt);

    // Clean up: remove quotes, trim whitespace, collapse newlines
    const topic = response
      .replace(/^["']|["']$/g, '')  // strip surrounding quotes if any
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    Zotero.debug(`KGMAnalyzer: Detected topic: "${topic}"`);
    return topic;
  },

  /**
   * Run the two-step KGM analysis (Step A: framework, Step B: gap analysis).
   *
   * @param {{ allTitles: string[] }} libraryData    - From collectLibraryData()
   * @param {Array<{title:string, mentionCount:number}>} missingPapers
   * @param {string} confirmedDomain                  - User-confirmed domain string
   * @param {Object} aiClient                         - AIClient instance
   * @param {Function} [onProgress]                   - Optional progress callback
   *        onProgress(step, totalSteps, message)
   * @returns {Promise<{ framework: string, gapAnalysis: string }>}
   */
  runAnalysis: async function(libraryData, missingPapers, confirmedDomain, aiClient, onProgress) {
    Zotero.debug('\n' + '='.repeat(60));
    Zotero.debug('KGMAnalyzer: Starting two-step analysis');
    Zotero.debug(`  Domain: ${confirmedDomain}`);
    Zotero.debug(`  Titles: ${libraryData.allTitles.length}`);
    Zotero.debug(`  Missing papers: ${missingPapers.length}`);
    Zotero.debug('='.repeat(60));

    // ── Step A: Domain Knowledge Framework ───────────────────────────────────
    if (onProgress) onProgress(1, 2, 'Generating domain knowledge framework...');

    Zotero.debug('KGMAnalyzer: Step A — building framework prompt');
    const frameworkPrompt = PromptBuilder.buildFrameworkPrompt(
      libraryData.allTitles,
      confirmedDomain
    );

    Zotero.debug('KGMAnalyzer: Step A — calling AI');
    const framework = await aiClient.complete(frameworkPrompt);

    Zotero.debug(`KGMAnalyzer: Step A complete (${framework.length} chars)`);

    // ── Step B: Conceptual Gap Analysis ──────────────────────────────────────
    if (onProgress) onProgress(2, 2, 'Identifying conceptual gaps...');

    Zotero.debug('KGMAnalyzer: Step B — building gap prompt');
    const gapPrompt = PromptBuilder.buildGapPrompt(
      framework,
      libraryData.allTitles,
      missingPapers,
      confirmedDomain
    );

    Zotero.debug('KGMAnalyzer: Step B — calling AI');
    const gapAnalysis = await aiClient.complete(gapPrompt);

    Zotero.debug(`KGMAnalyzer: Step B complete (${gapAnalysis.length} chars)`);
    Zotero.debug('='.repeat(60) + '\n');

    return { framework, gapAnalysis };
  }
};
