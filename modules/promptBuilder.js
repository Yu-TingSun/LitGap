/**
 * LitGap - Prompt Builder Module
 * Builds AI prompts for Conceptual Map and Field Map analysis (pure functions, no side effects)
 *
 * @module promptBuilder
 * @version 3.1.0
 *
 * Prompt builders:
 *   buildTopicPrompt(allTitles)
 *   buildFrameworkPrompt(allTitles, confirmedDomain)
 *   buildGapPrompt(framework, allTitles, missingPapers, confirmedDomain)
 *   buildCoreQuestionsPrompt(framework, confirmedDomain)
 *   buildFieldMapPrompt(coreQuestions, stanceIndex, missingPapers, confirmedDomain)
 *     → JSON: { nodes, narrative, foundationalPapers, priorityReading }
 *
 * CHANGELOG v3.1.0:
 *   - buildFieldMapPrompt: added foundationalPapers and priorityReading to JSON schema
 *     foundationalPapers: per-node list of key papers with one-sentence explanation
 *     priorityReading:    top 2-3 papers to read based on largest gaps, with rationale
 *   - buildGapPrompt: added Stance Index block + stance annotation per gap
 *   - All output enforced in English
 *   - FM-A and FM-B kept as separate API calls for stability
 */

var PromptBuilder = {

  MAX_TITLES_FRAMEWORK: 9999,
  MAX_TITLES_GAP:       20,
  MAX_MISSING_PAPERS:   15,

  // ─── Public API ────────────────────────────────────────────────────────────

  buildTopicPrompt: function(allTitles) {
    const titleBlock = this._formatTitleList(allTitles, this.MAX_TITLES_FRAMEWORK);
    return [
      'Based on the following paper titles from a researcher\'s Zotero library,',
      'identify the research domain in ONE sentence (maximum 20 words).',
      'Do not explain or add context — output only the domain description sentence.',
      'Write in English.',
      '',
      'Paper titles:',
      titleBlock
    ].join('\n');
  },

  buildFrameworkPrompt: function(allTitles, confirmedDomain) {
    const titleBlock = this._formatTitleList(allTitles, this.MAX_TITLES_FRAMEWORK);
    return [
      'You are a research advisor helping a researcher understand their field.',
      'Write all output in English.',
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
   * Build the Conceptual Map Step B prompt: identify conceptual gaps.
   * Response ends with a machine-readable ## Stance Index block.
   *
   * Stance Index format: [paper title] | [stance label] [source tag] | [gap_id]
   * Source tags: [User Library] or [AI Inferred — verify]
   */
  buildGapPrompt: function(framework, allTitles, missingPapers, confirmedDomain) {
    const cappedTitles  = allTitles.slice(0, this.MAX_TITLES_GAP);
    const titleBlock    = this._formatTitleList(cappedTitles, this.MAX_TITLES_GAP);
    const cappedMissing = missingPapers.slice(0, this.MAX_MISSING_PAPERS);
    const missingBlock  = this._formatMissingPapers(cappedMissing);

    return [
      'You are a research advisor analyzing knowledge gaps in a researcher\'s library.',
      'Write all output in English.',
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
      'For each gap, use this exact structure:',
      '',
      '### Gap [N]: [Gap Name]',
      '**Gap type:** [Methodological / Theoretical / Empirical / Application / Interdisciplinary]',
      '',
      '**Why this gap matters:**',
      '[1-2 sentences explaining the significance of this gap in the research domain]',
      '',
      '**What the researcher likely does not know:**',
      '[2-3 specific knowledge items or concepts the researcher may be missing]',
      '',
      '**Stance annotation:**',
      '[For each missing paper relevant to this gap, write one line per paper:',
      ' "<paper title> — Supports [Model/Claim] / Challenges [Model/Claim] /',
      '  Establishes new framework / Methodological contribution"',
      ' Append source tag at end of each line:',
      '   [User Library]        if the paper appears in the library sample above',
      '   [AI Inferred — verify] if based on your training knowledge only]',
      '',
      '**Related missing papers:**',
      '[List 1-3 paper titles from the missing papers list relevant to this gap]',
      '',
      '**Suggested question for your AI assistant:**',
      '[Write a complete, self-contained, copy-pasteable prompt the researcher can use',
      'immediately in Claude, ChatGPT, or any AI assistant to explore this gap.',
      'Include enough context so it works without any other information.',
      'Make it specific and actionable — not a vague question.]',
      '',
      '---',
      '',
      'After all gap entries, append this machine-readable block.',
      'This block is parsed by the system — follow the format exactly.',
      '',
      '## Stance Index',
      'One entry per line. Format: [paper title] | [stance label] [source tag] | [gap_id]',
      '',
      'Rules:',
      '  - gap_id format: gap_1, gap_2, gap_3 ... matching the gap numbers above',
      '  - stance label is one of:',
      '      Supports [Model/Claim name]',
      '      Challenges [Model/Claim name]',
      '      Establishes new framework',
      '      Methodological contribution',
      '  - source tag is one of:',
      '      [User Library]',
      '      [AI Inferred — verify]',
      '  - paper title must match exactly as listed in the missing papers section',
      '  - include ALL papers that appeared in any stance annotation section above',
      '',
      'Example lines:',
      'Smith et al. 2020 — DNA loop extrusion by cohesin | Supports loop extrusion model [User Library] | gap_1',
      'Liu & Wang 1987 — Supercoiling during transcription | Establishes new framework [AI Inferred — verify] | gap_2',
      '',
      '---',
      '',
      'Format the gap entries in Markdown.',
      'Start directly with the heading: ## Conceptual Gap Analysis',
      'Do not add any preamble before that heading.',
      'End the entire response with the ## Stance Index block.'
    ].join('\n');
  },

  /**
   * Build the Field Map Step FM-A prompt: extract core research questions.
   * Returns JSON: { "coreQuestions": ["question 1", ...] }
   */
  buildCoreQuestionsPrompt: function(framework, confirmedDomain) {
    return [
      'You are a research advisor helping a researcher build a field map.',
      'Write all output in English.',
      '',
      `Research domain: ${confirmedDomain}`,
      '',
      '---',
      '## Domain Knowledge Framework',
      '',
      framework,
      '',
      '---',
      '## Your Task',
      '',
      'The framework above describes the technical dimensions of this research domain.',
      'Your task is to reframe these dimensions as the core scientific or biological',
      'problems they are trying to solve.',
      '',
      'For each technical dimension, ask:',
      '  "What scientific or biological problem is this technique or concept serving?"',
      '',
      'Then:',
      '1. Merge dimensions that serve the same underlying problem.',
      '2. Output 3-5 core research questions, each as one sentence.',
      '3. Each question should describe a problem, debate, or open challenge —',
      '   not a method or technique.',
      '',
      'Good example:  "How does chromatin compaction regulate gene expression during cell fate decisions?"',
      'Bad example:   "ChIP-seq and ATAC-seq methods for chromatin profiling."',
      '',
      '---',
      '## Output Format',
      '',
      'Return ONLY a valid JSON object. No markdown fences, no preamble, no explanation.',
      '',
      'Schema:',
      '{"coreQuestions": ["question 1", "question 2", "question 3"]}',
      '',
      'CRITICAL RULES:',
      '1. Output must be valid JSON — no trailing commas, no comments.',
      '2. All text must be in English.',
      '3. Minimum 3 questions, maximum 5.',
      '4. Each question is one sentence ending with a question mark.',
      '5. Do not use method names or technique names as the main subject of a question.'
    ].join('\n');
  },

  /**
   * Build the Field Map Step FM-B prompt: build problem node map.
   *
   * Returns JSON:
   * {
   *   nodes: [...],
   *   narrative: "...",
   *   foundationalPapers: [
   *     { nodeId: "node_1", papers: [{ title: "...", reason: "one sentence why important" }] }
   *   ],
   *   priorityReading: [
   *     { title: "...", gap: "node name or gap name", rationale: "2-3 sentences why read first" }
   *   ]
   * }
   *
   * mermaid is NOT requested — generated by kgmReporter from nodes data.
   * source "confirmed" is NOT set by AI — reserved for user action.
   */
  buildFieldMapPrompt: function(coreQuestions, stanceIndex, missingPapers, confirmedDomain) {
    const cappedMissing  = missingPapers.slice(0, this.MAX_MISSING_PAPERS);
    const missingBlock   = this._formatMissingPapers(cappedMissing);
    const questionsBlock = coreQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    const stanceBlock    = this._formatStanceIndex(stanceIndex);

    return [
      'You are a research advisor building a field map for a researcher entering a new sub-field.',
      'Write ALL text content in English.',
      '',
      `Research domain: ${confirmedDomain}`,
      '',
      '---',
      '## Core Research Questions',
      '(One node per question)',
      '',
      questionsBlock,
      '',
      '---',
      '## Stance Index',
      '(Paper stances from gap analysis — use to populate node positions)',
      '',
      stanceBlock,
      '',
      '---',
      '## Papers Recommended by LitGap (not yet read by researcher)',
      '',
      missingBlock,
      '',
      '---',
      '## Your Task',
      '',
      'Produce four outputs in a single JSON object:',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'OUTPUT 1 — nodes',
      'One node per core research question.',
      '',
      '  id          snake_case: node_1, node_2, ...',
      '  name        Concise label, 3-6 words.',
      '  status      Exactly one of: Open, Settled, Emerging, Gap',
      '              Open=actively debated, Settled=consensus exists,',
      '              Emerging=too new for debate, Gap=not covered by library',
      '  coreDispute One sentence: the central tension.',
      '  positionA / positionB',
      '              text: 2-3 sentences per position.',
      '              source: "user_library" if from Stance Index [User Library] entries,',
      '                      "ai_inferred"  if from training knowledge or [AI Inferred] entries.',
      '                      Never set "confirmed" — reserved for user.',
      '  links       Max 3 per node.',
      '              target: another node id.',
      '              type: "downstream" | "upstream" | "tension"',
      '              label: 5-8 word phrase.',
      '  gaps        type "library" = reading papers can fill this.',
      '              type "boundary" = current tech/theory cannot resolve.',
      '              text: one sentence.',
      '  suggestedReading  1-3 titles from LitGap recommended list above.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'OUTPUT 2 — narrative',
      'Exactly three paragraphs, plain text, separated by \\n\\n, no headings.',
      '  Para 1: Why this sub-field exists (classical failure + technical entry point).',
      '  Para 2: Biological/scientific causal chain across the nodes, conflict points.',
      '  Para 3: What the community is ultimately chasing, convergence vs divergence.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'OUTPUT 3 — foundationalPapers',
      'For each node, list 2-4 papers that are foundational to understanding that node.',
      'These can come from the researcher\'s library, the LitGap recommended list,',
      'or your training knowledge (mark source accordingly).',
      'For each paper give one sentence explaining why it matters for that node.',
      '',
      'Format per node:',
      '  nodeId: "node_1"',
      '  papers: [ { title: "...", reason: "one sentence", source: "user_library|ai_inferred" } ]',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'OUTPUT 4 — priorityReading',
      'Based on the nodes with status Gap or the largest library gaps,',
      'recommend 2-3 papers the researcher should read first.',
      'Prefer papers from the LitGap recommended list when available.',
      'For each paper give 2-3 sentences explaining:',
      '  - which node or gap it addresses',
      '  - what the researcher will gain by reading it',
      '  - why it should be read before other papers on the list',
      '',
      'Format:',
      '  { title: "...", gap: "node name or gap description", rationale: "2-3 sentences" }',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '## Output Format',
      '',
      'Return ONLY a valid JSON object. No markdown fences, no preamble, no explanation.',
      '',
      'Schema (field names must match exactly):',
      '{',
      '  "nodes": [',
      '    {',
      '      "id": "node_1",',
      '      "name": "Node Name Here",',
      '      "status": "Open",',
      '      "coreDispute": "One sentence.",',
      '      "positionA": { "text": "2-3 sentences.", "source": "user_library" },',
      '      "positionB": { "text": "2-3 sentences.", "source": "ai_inferred" },',
      '      "links": [ { "target": "node_2", "type": "downstream", "label": "brief label" } ],',
      '      "gaps": [ { "type": "library", "text": "One sentence." } ],',
      '      "suggestedReading": ["Paper title from LitGap list"]',
      '    }',
      '  ],',
      '  "narrative": "Para 1.\\n\\nPara 2.\\n\\nPara 3.",',
      '  "foundationalPapers": [',
      '    {',
      '      "nodeId": "node_1",',
      '      "papers": [',
      '        { "title": "...", "reason": "one sentence why important", "source": "user_library" }',
      '      ]',
      '    }',
      '  ],',
      '  "priorityReading": [',
      '    { "title": "...", "gap": "node name or gap description", "rationale": "2-3 sentences" }',
      '  ]',
      '}',
      '',
      'CRITICAL RULES:',
      '1.  Valid JSON only — no trailing commas, no comments.',
      '2.  All text in English.',
      '3.  "status": Open | Settled | Emerging | Gap (exact case).',
      '4.  "source": user_library | ai_inferred (never "confirmed").',
      '5.  link "type": downstream | upstream | tension.',
      '6.  gap "type": library | boundary.',
      '7.  Max 3 links per node.',
      '8.  suggestedReading titles from LitGap recommended list.',
      '9.  narrative: plain text, two literal \\n\\n between paragraphs.',
      '10. foundationalPapers: one entry per node, nodeId must match node id.',
      '11. priorityReading: 2-3 entries, prefer LitGap recommended list titles.',
      '12. Do not add fields not listed in the schema.'
    ].join('\n');
  },

  // ─── Internal helpers ──────────────────────────────────────────────────────

  _formatTitleList: function(titles, maxCount) {
    if (!titles || titles.length === 0) return '(no titles available)';
    return titles.slice(0, maxCount)
      .map((title, i) => `${i + 1}. ${this._sanitiseTitle(title)}`)
      .join('\n');
  },

  _formatMissingPapers: function(papers) {
    if (!papers || papers.length === 0) return '(no missing papers identified)';
    return papers
      .map((p, i) => {
        const count = p.mentionCount || p.mentioned_count || 0;
        return `${i + 1}. ${this._sanitiseTitle(p.title)} (cited by ${count} papers in library)`;
      })
      .join('\n');
  },

  _formatStanceIndex: function(stanceIndex) {
    if (!stanceIndex || stanceIndex.length === 0) {
      return '(no stance annotations available — positions will be based on AI training knowledge)';
    }
    return stanceIndex
      .map(entry => {
        const title     = this._sanitiseTitle(entry.title);
        const stance    = entry.stance || '(unknown stance)';
        const sourceTag = entry.source === 'user_library'
          ? '[User Library]'
          : '[AI Inferred — verify]';
        const gapId = entry.gapId || '';
        return `${title} | ${stance} ${sourceTag} | ${gapId}`;
      })
      .join('\n');
  },

  _sanitiseTitle: function(title) {
    if (!title) return '(untitled)';
    return title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

};
