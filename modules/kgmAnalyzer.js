/**
 * LitGap - KGM Analyzer Module
 * Core logic for Conceptual Map and Field Map analysis
 *
 * @module kgmAnalyzer
 * @version 3.0.0
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
 *   runAnalysis(libraryData, missingPapers, confirmedDomain, aiClient, onProgress, options)
 *     → Promise<{ framework, gapAnalysis, fieldMap? }>
 *     options.includeFieldMap {boolean} — if true, runs FM-A + FM-B after Step B
 *
 *   parseStanceIndex(gapAnalysis)
 *     → Array<{ title, stance, source, gapId }>
 *
 *   buildFieldMap(framework, gapAnalysis, missingPapers, confirmedDomain, aiClient, onProgress)
 *     → Promise<{ coreQuestions, nodes, narrative }>
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
    const sectionPattern = /####\s+\d+\.\s+(.+?)(?:\n[\s\S]*?)?[-*]\s*Mentioned by:\s*(\d+)/g;
    let match;

    while ((match = sectionPattern.exec(markdownContent)) !== null) {
      const title        = match[1].replace(/\n/g, ' ').trim();
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
      while ((m = titlePattern.exec(markdownContent))  !== null) titles.push(m[1].trim());
      while ((m = mentionPattern.exec(markdownContent)) !== null) mentions.push(parseInt(m[1], 10));

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
      .replace(/^["']|["']$/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    Zotero.debug(`KGMAnalyzer: Detected topic: "${topic}"`);
    return topic;
  },

  /**
   * Parse the ## Stance Index block from a Step B gapAnalysis output.
   *
   * Expects lines in format:
   *   [paper title] | [stance label] [source tag] | [gap_id]
   *
   * Source tag "[User Library]" maps to source: "user_library"
   * Source tag "[AI Inferred — verify]" maps to source: "ai_inferred"
   * Missing source tag defaults to "ai_inferred"
   *
   * @param {string} gapAnalysis - Step B AI output (Markdown with ## Stance Index at end)
   * @returns {Array<{title:string, stance:string, source:string, gapId:string}>}
   */
  parseStanceIndex: function(gapAnalysis) {
    Zotero.debug('KGMAnalyzer: Parsing Stance Index...');

    if (!gapAnalysis || gapAnalysis.trim().length === 0) {
      Zotero.debug('KGMAnalyzer: Empty gapAnalysis, returning empty stance index');
      return [];
    }

    // Extract the ## Stance Index block
    const stanceBlockMatch = gapAnalysis.match(/##\s+Stance Index\s*\n([\s\S]*?)(?:\n##\s|\s*$)/);
    if (!stanceBlockMatch) {
      Zotero.debug('KGMAnalyzer: No ## Stance Index block found in gapAnalysis');
      return [];
    }

    const block = stanceBlockMatch[1];
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const results = [];

    for (const line of lines) {
      // Skip example lines or header lines (no pipe separator)
      if (!line.includes('|')) continue;

      const parts = line.split('|').map(p => p.trim());
      if (parts.length < 2) continue;

      const titleRaw  = parts[0] || '';
      const stanceRaw = parts[1] || '';
      const gapId     = (parts[2] || '').trim();

      if (!titleRaw) continue;

      // Extract source from stance string
      let source = 'ai_inferred';
      let stance = stanceRaw;

      if (stanceRaw.includes('[User Library]')) {
        source = 'user_library';
        stance = stanceRaw.replace('[User Library]', '').trim();
      } else if (stanceRaw.includes('[AI Inferred')) {
        source = 'ai_inferred';
        stance = stanceRaw.replace(/\[AI Inferred[^\]]*\]/, '').trim();
      }

      results.push({
        title:  titleRaw,
        stance: stance,
        source: source,
        gapId:  gapId
      });
    }

    Zotero.debug(`KGMAnalyzer: Parsed ${results.length} stance entries`);
    results.forEach((e, i) => {
      Zotero.debug(`  ${i + 1}. [${e.source}] ${e.title.substring(0, 50)} — ${e.stance.substring(0, 40)}`);
    });

    return results;
  },

  /**
   * Run Field Map analysis (FM-A + FM-B) using Conceptual Map outputs as input.
   *
   * Step FM-A: Extract 3-5 core research questions from the framework.
   *            Output: { coreQuestions: string[] }
   *
   * Step FM-B: Build problem node map using core questions + stance index.
   *            Output: { nodes, narrative }
   *
   * @param {string}   framework       - Step A output (Markdown)
   * @param {string}   gapAnalysis     - Step B output (Markdown with Stance Index)
   * @param {Array<{title:string, mentionCount:number}>} missingPapers
   * @param {string}   confirmedDomain - User-confirmed domain string
   * @param {Object}   aiClient        - AIClient instance
   * @param {Function} [onProgress]    - Optional progress callback
   *        onProgress(step, totalSteps, message)
   * @returns {Promise<{ coreQuestions: string[], nodes: Object[], narrative: string }>}
   */
  buildFieldMap: async function(framework, gapAnalysis, missingPapers, confirmedDomain, aiClient, onProgress) {
    Zotero.debug('KGMAnalyzer: Starting Field Map analysis...');

    // ── Parse Stance Index from Step B output ─────────────────────────────────
    const stanceIndex = this.parseStanceIndex(gapAnalysis);
    Zotero.debug(`KGMAnalyzer: Stance index has ${stanceIndex.length} entries`);

    // ── Step FM-A: Extract core research questions ────────────────────────────
    if (onProgress) onProgress(1, 2, 'Extracting core research questions...');

    Zotero.debug('KGMAnalyzer: FM-A — building core questions prompt');
    const coreQuestionsPrompt = PromptBuilder.buildCoreQuestionsPrompt(
      framework,
      confirmedDomain
    );

    Zotero.debug('KGMAnalyzer: FM-A — calling AI');
    const coreQuestionsRaw = await aiClient.complete(coreQuestionsPrompt);

    const coreQuestions = this._parseJsonResponse(coreQuestionsRaw, 'coreQuestions');
    if (!coreQuestions || !Array.isArray(coreQuestions) || coreQuestions.length === 0) {
      throw new Error('FM-A: Failed to parse core questions from AI response');
    }

    Zotero.debug(`KGMAnalyzer: FM-A complete — ${coreQuestions.length} core questions`);
    coreQuestions.forEach((q, i) => Zotero.debug(`  ${i + 1}. ${q.substring(0, 80)}`));

    // ── Step FM-B: Build problem node map ─────────────────────────────────────
    if (onProgress) onProgress(2, 2, 'Building field map nodes...');

    Zotero.debug('KGMAnalyzer: FM-B — building field map prompt');
    const fieldMapPrompt = PromptBuilder.buildFieldMapPrompt(
      coreQuestions,
      stanceIndex,
      missingPapers,
      confirmedDomain
    );

    Zotero.debug('KGMAnalyzer: FM-B — calling AI');
    const fieldMapRaw = await aiClient.complete(fieldMapPrompt);

    const fieldMapData = this._parseFullJsonResponse(fieldMapRaw);
    if (!fieldMapData || !Array.isArray(fieldMapData.nodes) || fieldMapData.nodes.length === 0) {
      throw new Error('FM-B: Failed to parse field map nodes from AI response');
    }

    Zotero.debug(`KGMAnalyzer: FM-B complete — ${fieldMapData.nodes.length} nodes`);
    fieldMapData.nodes.forEach((n, i) => {
      Zotero.debug(`  ${i + 1}. [${n.status}] ${n.name}`);
    });

    return {
      coreQuestions: coreQuestions,
      nodes:         fieldMapData.nodes,
      narrative:     fieldMapData.narrative || ''
    };
  },

  /**
   * Run the Conceptual Map analysis (Step A + Step B), optionally followed
   * by Field Map analysis (FM-A + FM-B).
   *
   * Progress steps when includeFieldMap is false (default):
   *   step 1/2 — Generating domain knowledge framework
   *   step 2/2 — Identifying conceptual gaps
   *
   * Progress steps when includeFieldMap is true:
   *   step 1/4 — Generating domain knowledge framework
   *   step 2/4 — Identifying conceptual gaps
   *   step 3/4 — Extracting core research questions
   *   step 4/4 — Building field map nodes
   *
   * @param {{ allTitles: string[] }} libraryData    - From collectLibraryData()
   * @param {Array<{title:string, mentionCount:number}>} missingPapers
   * @param {string}   confirmedDomain               - User-confirmed domain string
   * @param {Object}   aiClient                      - AIClient instance
   * @param {Function} [onProgress]                  - Optional progress callback
   *        onProgress(step, totalSteps, message)
   * @param {Object}   [options]
   * @param {boolean}  [options.includeFieldMap=false] - Also run FM-A + FM-B
   * @returns {Promise<{
   *   framework:    string,
   *   gapAnalysis:  string,
   *   fieldMap?:    { coreQuestions: string[], nodes: Object[], narrative: string }
   * }>}
   */
  runAnalysis: async function(libraryData, missingPapers, confirmedDomain, aiClient, onProgress, options) {
    const opts             = options || {};
    const includeFieldMap  = opts.includeFieldMap === true;
    const totalSteps       = includeFieldMap ? 4 : 2;

    Zotero.debug('\n' + '='.repeat(60));
    Zotero.debug('KGMAnalyzer: Starting analysis');
    Zotero.debug(`  Domain:           ${confirmedDomain}`);
    Zotero.debug(`  Titles:           ${libraryData.allTitles.length}`);
    Zotero.debug(`  Missing papers:   ${missingPapers.length}`);
    Zotero.debug(`  Include FieldMap: ${includeFieldMap}`);
    Zotero.debug('='.repeat(60));

    // ── Step A: Domain Knowledge Framework ───────────────────────────────────
    if (onProgress) onProgress(1, totalSteps, 'Generating domain knowledge framework...');

    Zotero.debug('KGMAnalyzer: Step A — building framework prompt');
    const frameworkPrompt = PromptBuilder.buildFrameworkPrompt(
      libraryData.allTitles,
      confirmedDomain
    );

    Zotero.debug('KGMAnalyzer: Step A — calling AI');
    const framework = await aiClient.complete(frameworkPrompt);
    Zotero.debug(`KGMAnalyzer: Step A complete (${framework.length} chars)`);

    // ── Step B: Conceptual Gap Analysis ──────────────────────────────────────
    if (onProgress) onProgress(2, totalSteps, 'Identifying conceptual gaps...');

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

    // ── Early return if Field Map not requested ───────────────────────────────
    if (!includeFieldMap) {
      Zotero.debug('='.repeat(60) + '\n');
      return { framework, gapAnalysis };
    }

    // ── Field Map Steps FM-A + FM-B ───────────────────────────────────────────
    const fieldMap = await this.buildFieldMap(
      framework,
      gapAnalysis,
      missingPapers,
      confirmedDomain,
      aiClient,
      (fmStep, fmTotal, fmMessage) => {
        // Map FM-A/FM-B steps onto the overall step counter (steps 3 and 4)
        if (onProgress) onProgress(2 + fmStep, totalSteps, fmMessage);
      }
    );

    Zotero.debug('='.repeat(60) + '\n');
    return { framework, gapAnalysis, fieldMap };
  },

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Robustly extract a clean JSON string from an AI response.
   *
   * Handles all known AI output patterns:
   *   1. Pure JSON                      → { ... }
   *   2. ```json fence                  → ```json\n{ ... }\n```
   *   3. ``` fence (no language tag)    → ```\n{ ... }\n```
   *   4. Preamble text + fence          → "Here is the JSON:\n```json\n{ ... }\n```"
   *   5. Preamble text + bare JSON      → "Here is the JSON:\n{ ... }"
   *   6. JSON + trailing explanation    → "{ ... }\n\nNote: ..."
   *
   * Strategy:
   *   Pass 1 — strip any ```json / ``` fences (greedy, handles preamble)
   *   Pass 2 — try JSON.parse on stripped result
   *   Pass 3 (fallback) — find the first '{' and last '}' and extract substring
   *
   * @private
   * @param {string} raw - Raw AI response string
   * @returns {string|null} Clean JSON string ready for JSON.parse, or null
   */
  _extractJsonString: function(raw) {
    if (!raw || !raw.trim()) return null;

    // Pass 1: strip markdown fences (handles preamble before fence)
    let cleaned = raw;

    // Remove everything before and including opening fence
    cleaned = cleaned.replace(/^[\s\S]*?```json\s*/i, '');
    // If no json fence found, try plain fence
    if (cleaned === raw) {
      cleaned = cleaned.replace(/^[\s\S]*?```\s*\n/, '');
    }
    // Remove closing fence and anything after
    cleaned = cleaned.replace(/```[\s\S]*$/, '').trim();

    // If result looks like JSON, return it
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      return cleaned;
    }

    // Pass 2: maybe original had no fence — try stripping preamble lines
    // Find first { or [ character
    const firstBrace  = raw.indexOf('{');
    const firstBracket = raw.indexOf('[');
    let startIdx = -1;
    if (firstBrace >= 0 && firstBracket >= 0) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace >= 0) {
      startIdx = firstBrace;
    } else if (firstBracket >= 0) {
      startIdx = firstBracket;
    }

    if (startIdx < 0) return null;

    // Find matching last } or ]
    const lastBrace   = raw.lastIndexOf('}');
    const lastBracket = raw.lastIndexOf(']');
    const endIdx = Math.max(lastBrace, lastBracket);

    if (endIdx <= startIdx) return null;

    return raw.substring(startIdx, endIdx + 1);
  },

  /**
   * Parse a JSON response from the AI and return a specific top-level field.
   * Uses _extractJsonString for robust fence/preamble handling.
   * Returns null on failure (never throws).
   *
   * @private
   * @param {string} raw       - Raw AI response string
   * @param {string} fieldName - Top-level key to extract from parsed JSON
   * @returns {*|null}
   */
  _parseJsonResponse: function(raw, fieldName) {
    const jsonStr = this._extractJsonString(raw);
    if (!jsonStr) {
      Zotero.debug(`KGMAnalyzer._parseJsonResponse: could not extract JSON from response`);
      Zotero.debug(`  Raw (first 400): ${(raw || '').substring(0, 400)}`);
      return null;
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const value  = parsed[fieldName];
      if (value === undefined) {
        Zotero.debug(`KGMAnalyzer._parseJsonResponse: field "${fieldName}" not found`);
        return null;
      }
      return value;
    } catch (e) {
      Zotero.debug(`KGMAnalyzer._parseJsonResponse: JSON.parse failed — ${e.message}`);
      Zotero.debug(`  Extracted string (first 400): ${jsonStr.substring(0, 400)}`);
      return null;
    }
  },

  /**
   * Parse a full JSON response from the AI and return the entire parsed object.
   * Uses _extractJsonString for robust fence/preamble handling.
   * Returns null on failure (never throws).
   *
   * @private
   * @param {string} raw - Raw AI response string
   * @returns {Object|null}
   */
  _parseFullJsonResponse: function(raw) {
    const jsonStr = this._extractJsonString(raw);
    if (!jsonStr) {
      Zotero.debug(`KGMAnalyzer._parseFullJsonResponse: could not extract JSON from response`);
      Zotero.debug(`  Raw (first 400): ${(raw || '').substring(0, 400)}`);
      return null;
    }

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      Zotero.debug(`KGMAnalyzer._parseFullJsonResponse: JSON.parse failed — ${e.message}`);
      Zotero.debug(`  Extracted string (first 400): ${jsonStr.substring(0, 400)}`);
      return null;
    }
  }

};
