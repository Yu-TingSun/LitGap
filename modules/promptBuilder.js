/**
 * LitGap - Prompt Builder Module
 * Builds AI prompts for KGM analysis (pure functions, no side effects)
 *
 * @module promptBuilder
 * @version 2.0.0
 *
 * Three prompt builders:
 *   buildTopicPrompt(allTitles)
 *     → Used in Step 2: detect research domain from paper titles
 *
 *   buildFrameworkPrompt(allTitles, confirmedDomain)
 *     → Used in KGM Step A: generate domain knowledge framework
 *
 *   buildGapPrompt(framework, allTitles, missingPapers, confirmedDomain)
 *     → Used in KGM Step B: identify conceptual gaps
 *
 * Design notes:
 *   - All functions are pure (no Zotero API calls, no async)
 *   - Title lists are truncated internally to keep token count reasonable
 *   - Missing papers capped at 15 (mentionCount sorted, highest first)
 *   - allTitles for Step B capped at 20 per spec
 */

var PromptBuilder = {

  // ─── Limits ────────────────────────────────────────────────────────────────

  MAX_TITLES_FRAMEWORK: 9999, // no limit — titles are short tokens
  MAX_TITLES_GAP:       20,   // spec: "最多 20 篇（截取前 20）"
  MAX_MISSING_PAPERS:   15,   // spec: "最多 15 篇"

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Build a prompt to detect the research domain from paper titles.
   * Response should be a single sentence (≤ 20 words).
   *
   * @param {string[]} allTitles - All paper titles in the collection
   * @returns {string} Prompt string
   */
  buildTopicPrompt: function(allTitles) {
    const titleBlock = this._formatTitleList(allTitles, this.MAX_TITLES_FRAMEWORK);

    return [
      'Based on the following paper titles from a researcher\'s Zotero library,',
      'identify the research domain in ONE sentence (maximum 20 words).',
      'Do not explain or add context — output only the domain description sentence.',
      '',
      'Paper titles:',
      titleBlock
    ].join('\n');
  },

  /**
   * Build the Step A prompt: generate a domain knowledge framework.
   * AI response should start with "## Domain Knowledge Framework".
   *
   * @param {string[]} allTitles      - All paper titles in the collection
   * @param {string}   confirmedDomain - Research domain confirmed by user
   * @returns {string} Prompt string
   */
  buildFrameworkPrompt: function(allTitles, confirmedDomain) {
    const titleBlock = this._formatTitleList(allTitles, this.MAX_TITLES_FRAMEWORK);

    return [
      'You are a research advisor helping a researcher understand their field.',
      '',
      `Research domain: ${confirmedDomain}`,
      '',
      'Based on the research domain above and the following paper titles from the',
      'researcher\'s library, generate a domain knowledge framework.',
      '',
      'Requirements:',
      '1. Identify 5-8 core dimensions of this research domain.',
      '2. For each dimension provide:',
      '   - Name (concise, 2-5 words)',
      '   - Description (1-2 sentences explaining what this dimension covers)',
      '   - Key concepts (3-5 terms or sub-topics)',
      '3. After the dimensions, add a section "## Commonly Overlooked Areas" that',
      '   lists 2-3 topics researchers in this field often miss.',
      '',
      'Format your entire response in Markdown.',
      'Start directly with the heading: ## Domain Knowledge Framework',
      'Do not add any preamble or explanation before that heading.',
      '',
      'Paper titles from researcher\'s library:',
      titleBlock
    ].join('\n');
  },

  /**
   * Build the Step B prompt: identify conceptual gaps.
   * AI response should start with "## Conceptual Gap Analysis".
   *
   * @param {string}   framework      - Step A output (full Markdown string)
   * @param {string[]} allTitles      - All paper titles (capped to MAX_TITLES_GAP)
   * @param {Array<{title:string, mentionCount:number}>} missingPapers
   *                                  - Papers from LitGap report not yet in library
   * @param {string}   confirmedDomain - Research domain confirmed by user
   * @returns {string} Prompt string
   */
  buildGapPrompt: function(framework, allTitles, missingPapers, confirmedDomain) {
    // Cap and format titles
    const cappedTitles  = allTitles.slice(0, this.MAX_TITLES_GAP);
    const titleBlock    = this._formatTitleList(cappedTitles, this.MAX_TITLES_GAP);

    // Cap and format missing papers (sorted by mentionCount desc, already done by kgmAnalyzer)
    const cappedMissing = missingPapers.slice(0, this.MAX_MISSING_PAPERS);
    const missingBlock  = this._formatMissingPapers(cappedMissing);

    return [
      'You are a research advisor analyzing knowledge gaps in a researcher\'s library.',
      '',
      `Research domain: ${confirmedDomain}`,
      '',
      '---',
      '## Domain Knowledge Framework (generated in previous step)',
      '',
      framework,
      '',
      '---',
      '## Researcher\'s Library Sample (up to 20 papers)',
      '',
      titleBlock,
      '',
      '---',
      '## Papers Frequently Cited in This Field But Missing from Library',
      '(These are papers cited by multiple sources in the researcher\'s collection',
      'but not yet read by the researcher.)',
      '',
      missingBlock,
      '',
      '---',
      'Task: Identify 3-5 conceptual gaps based on the framework, library sample,',
      'and missing papers above.',
      '',
      'For each gap provide ALL of the following sections:',
      '',
      '### Gap [N]: [Gap Name]',
      '**Gap type:** [Methodological / Theoretical / Empirical / Application / Interdisciplinary]',
      '',
      '**Why this gap matters:**',
      '[1-2 sentences explaining the significance of this gap in the research domain]',
      '',
      '**What the researcher likely doesn\'t know:**',
      '[2-3 specific knowledge items or concepts the researcher may be missing]',
      '',
      '**Related missing papers:**',
      '[List 1-3 paper titles from the missing papers list that are relevant to this gap]',
      '',
      '**Suggested question for your AI assistant:**',
      '[Write a complete, self-contained, copy-pasteable prompt the researcher can use',
      'immediately in Claude, ChatGPT, or any AI assistant to explore this gap.',
      'The prompt should include enough context so it works without any other information.',
      'Make it specific and actionable — not a vague question.]',
      '',
      '---',
      '',
      'Format your entire response in Markdown.',
      'Start directly with the heading: ## Conceptual Gap Analysis',
      'Do not add any preamble or explanation before that heading.',
      'Use the exact section structure shown above for each gap.'
    ].join('\n');
  },

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Format an array of title strings into a numbered Markdown list.
   * Applies a maximum count and sanitises each title.
   *
   * @private
   * @param {string[]} titles
   * @param {number}   maxCount
   * @returns {string}
   */
  _formatTitleList: function(titles, maxCount) {
    if (!titles || titles.length === 0) {
      return '(no titles available)';
    }

    const limited = titles.slice(0, maxCount);
    return limited
      .map((title, i) => `${i + 1}. ${this._sanitiseTitle(title)}`)
      .join('\n');
  },

  /**
   * Format missing papers as a numbered list with mention counts.
   *
   * @private
   * @param {Array<{title:string, mentionCount:number}>} papers
   * @returns {string}
   */
  _formatMissingPapers: function(papers) {
    if (!papers || papers.length === 0) {
      return '(no missing papers identified)';
    }

    return papers
      .map((p, i) => {
        const count = p.mentionCount || p.mentioned_count || 0;
        return `${i + 1}. ${this._sanitiseTitle(p.title)} (cited by ${count} papers in library)`;
      })
      .join('\n');
  },

  /**
   * Remove newlines and trim whitespace from a title string.
   *
   * @private
   * @param {string} title
   * @returns {string}
   */
  _sanitiseTitle: function(title) {
    if (!title) return '(untitled)';
    return title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }
};
