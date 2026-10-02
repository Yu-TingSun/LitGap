# Changelog

## [3.2.0] - 2026-10-02

### Changed
- **Find Hidden Papers now uses OpenAlex instead of Semantic Scholar.** Semantic Scholar returned empty reference lists for many papers (e.g. some Blood and BMC articles) and its shared public pool was heavily rate-limited, which led to "no gaps found" even for well-connected libraries. OpenAlex provides more complete reference data, and single-record lookups are free, so no API key is needed.
- Find Hidden Papers now analyzes **references** (papers your library cites) instead of citations (papers citing your library), matching the original design: papers cited by several of your papers are the shared foundations of your topic.
- Removed the publication-year filter (previously 2010 and later). Older foundational papers are now included, and the "📚 Early influential work" label can mark them.
- Recommendation reports link to OpenAlex instead of Semantic Scholar. DOI links now appear for recommended papers.
- Removed the "Score: X/100" line from reports. The score has no fixed maximum, so "/100" was misleading. Ranking order is unchanged.
- Library overview shows "References analyzed", "Papers without reference data", and "Data source".

### Fixed
- **Find Hidden Papers was extremely slow on Zotero 10.** Zotero's HTTP client silently retried rate-limited (HTTP 429) requests for up to an hour per request, on top of LitGap's own retries. LitGap now disables Zotero's internal retries and uses its own bounded retry: it honors `Retry-After`, uses exponential backoff, and makes at most 4 attempts per lookup.
- Zotero 10 compatibility: replaced the removed `ZoteroPane.getSelectedCollection()` with `getSelectedCollections()`. If multiple collections are selected, LitGap asks you to select one.
- A paper listed twice in one reference list is no longer counted twice.
- Papers without a publication year are no longer dropped from recommendations.
- "Your library is well-covered!" is no longer shown when reference data is incomplete. LitGap now shows "Analysis Incomplete" with the reason.
- Papers that fail to fetch are recorded and reported, instead of being silently skipped.

### Technical
- `api.js` v2.0.0: OpenAlex client using singleton lookups (`/works/doi:{doi}` and `/works/{id}`). Shared references are counted locally, and metadata is fetched only for candidates mentioned by 2 or more papers. Also adds DOI normalization and a circuit breaker that stops after 3 consecutive rate-limited lookups. An optional API key is read from `extensions.zotero.litgap.openalexApiKey` (no UI yet). The output format is unchanged; `paperId` is now an OpenAlex ID.
- `analyzer.js` v2.0.1: `minYear` defaults to `null` (filter disabled; parameter kept).
- `reporter.js` v1.3.0: OpenAlex links, null-safe title and citation count, score line removed. The `#### N. Title` and `- Mentioned by:` lines are unchanged, so `kgmAnalyzer.parseLitGapReport` still works.
- `main.js` v3.2.0: a shared `MIN_MENTIONS` constant, the incomplete-data message, and the label "Map Your Research Field" in the continuation dialog.
- `overlay.js` v3.2.0: the `_getSingleSelectedCollection()` helper and label clean-up.

---

## [3.0.0] - 2026-03-17

### Fixed
- Fixed `ol`/`ul` close tag bug in Conceptual Map HTML renderer — numbered lists were incorrectly closed with `</ul>`, causing gap sections to render indented
- Fixed FM-B JSON parse failures caused by AI prepending explanation text or adding markdown fences — replaced simple fence stripping with a robust `_extractJsonString()` extractor that handles all known AI output patterns including preamble text, fences, and trailing explanations
- Fixed SVG node graph edge label overlap — removed inline text labels, replaced with SVG `<title>` tooltip (hover to read)
- Fixed SVG duplicate edges — added directed deduplication for downstream/upstream edges and bidirectional deduplication for tension edges

### Changed
- Choose Output dialog simplified: removed "Field Map only" option, now offers "Conceptual Map only" vs "Conceptual Map + Field Map (recommended)"
- Button order follows macOS convention: Cancel (left) → Conceptual Map only (centre) → Conceptual Map + Field Map (right, default blue)

### Added
- SVG node relationship graph in Field Map HTML report — layered layout using longest-path topological sort, nodes coloured by status, edges shown as bezier curves with hover tooltips
- Priority Reading section in Field Map reports — 2-3 top recommended papers based on largest library gaps, with rationale
- Foundational Papers section in Field Map node cards — 2-4 key papers per node with one-sentence explanation

---

## [3.0.0-beta] - 2026-03-17

### Added
- **Map Your Research Field** — new unified entry point replacing "Analyze Knowledge Gaps (KGM)"
- **Conceptual Map** — AI-generated domain knowledge framework + conceptual gap analysis with stance annotation and suggested AI assistant questions. Outputs `conceptual-map_*.md` and `.html`
- **Field Map** — problem-oriented node map built from core research questions extracted from the Conceptual Map. Each node contains debate structure (Position A/B), node links, gap classification (library vs field boundary), and suggested reading. Outputs `field-map_*.md` and `.html`
- **Mermaid diagram** in Field Map markdown for Obsidian export
- **Stance Index** — machine-readable block appended to Conceptual Map Step B output, used by Field Map step to classify paper positions
- Multi-provider AI support carried over from v2.x (Anthropic, OpenAI, Google, Custom)

### Changed
- Menu label changed from "Analyze Knowledge Gaps (KGM)" to "Map Your Research Field"
- API cost notice updated in setup dialog: 2 calls for Conceptual Map, 4 calls for Both
- All AI output enforced in English regardless of system language
- `kgmReporter.generate()` now labelled "Conceptual Map" in output headers

### Technical
- `promptBuilder.js` v3.0: added `buildCoreQuestionsPrompt()`, `buildFieldMapPrompt()`, `buildCoreQuestionsPrompt()`; updated `buildGapPrompt()` with Stance Index and stance annotation
- `kgmAnalyzer.js` v3.0: added `parseStanceIndex()`, `buildFieldMap()`, `_parseJsonResponse()`, `_parseFullJsonResponse()`; extended `runAnalysis()` with `options.includeFieldMap`
- `kgmReporter.js` v3.0: added `generateFieldMap()`, `_buildFieldMapMarkdown()`, `_buildFieldMapHTML()`, `_generateMermaid()`
- `kgmMain.js` v3.0: added `_chooseOutputs()` step; refactored `_saveReports()` for dual-output

---

## [2.0.1] - 2026-02-xx

### Fixed
- All bare `ProgressUI` references replaced with `LitGap.ProgressUI` for Zotero 8 scope isolation
- Right-click menu unreliable on first launch: switched from `setTimeout` to `popupshowing` event listener
- Reset preferences dialog now shows checkbox list for selective reset

---

## [2.0.0] - 2026-02-xx

### Added
- Knowledge Gap Mapping (KGM) feature: AI-powered domain framework + conceptual gap analysis
- "Analyze Knowledge Gaps (KGM)" menu item
- Multi-provider AI support: Anthropic Claude, OpenAI GPT, Google Gemini, custom OpenAI-compatible endpoints
- AI settings dialog with connection test and retry loop
- Two-step analysis: Step A (domain framework) + Step B (gap analysis)

---

## [1.2.4] - 2026-02-02

### Changed
- Updated donation link from GitHub Sponsors to Ko-fi
- GitHub Sponsors not yet available in Taiwan

### Technical
- Modified `main.js` line 344: donation URL updated
- No functional changes to core features

## [1.2.3] - 2026-01-23

### Changed
- Simplified save dialog flow (removed redundant notification)
- User now sees only 2 dialogs instead of 3
- Combined completion and save success messages

### Fixed
- More streamlined user experience

## [1.2.2] - 2026-01-23

### Fixed
- Fixed preference API for Zotero 8 (added full prefix)
- Fixed NaN error in usage count
- Fixed emoji encoding in reports (removed damaged emoji)

## [1.2.1] - 2026-01-22

### Fixed
- Fixed FilePicker API for Zotero 8 (browsingContext)
- Removed duplicate notification
- Fixed menu ID for Zotero 8

## [1.2.0] - 2026-01-22

### Added
- "Don't ask me again" checkbox for collection confirmation
- Reset preferences menu option
- Background analysis (non-blocking UI)
- Donation prompt system (after 10 uses)
- Donation links in reports (Markdown + HTML)

### Fixed
- Zotero 8 compatibility improvements

## [1.1.0] - 2026-01-21

### Added
- HTML report generation
- DOI links in reports
- Semantic Scholar links
- Google Scholar search links

## [1.0.0] - 2026-01-20

### Added
- Initial release
- Parse Zotero library
- Fetch citations from Semantic Scholar
- Analyze knowledge gaps
- Generate Markdown reports
