# Changelog

## [2.0.0] - 2026-02-28

### Added
- **Feature 2: Knowledge Gap Mapping (KGM)** — AI-powered conceptual gap analysis
  - Right-click collection → "Analyze Knowledge Gaps (KGM)"
  - Step A: AI generates a Domain Knowledge Framework for your research area
  - Step B: AI identifies conceptual gaps and suggests targeted reading questions
  - Supports Anthropic Claude, OpenAI GPT, Google Gemini, and custom endpoints (DeepSeek, Qwen, Kimi, Ollama)
  - Saves `kgm_*.md` + `kgm_*.html` reports with Copy-to-clipboard question blocks
- **Real-time progress bar** for Feature 1 (Find Hidden Papers)
  - Floating panel in bottom-right corner showing `[N/total]` citation fetch progress
  - Non-blocking: Zotero remains usable during analysis
- **KGM continuation prompt**: After Find Hidden Papers completes, offers to continue directly to KGM analysis
- **Three-option dialog** when running Feature 1 from within KGM flow:
  - Continue to KGM Analysis
  - Save Report Only
  - Cancel

### Changed
- Right-click menu now shows both "Find Hidden Papers" and "Analyze Knowledge Gaps (KGM)"
- Menu registration switched from `setTimeout` retry to `popupshowing` event listener for reliable display on first launch (Zotero 8)

### Fixed
- `kgmMain.js`: All bare `ProgressUI` references replaced with `LitGap.ProgressUI` to fix Zotero 8 `loadSubScript` scope isolation issue — progress bar now updates correctly during KGM flow
- `overlay.js`: Right-click menu no longer requires disable/enable cycle to appear after fresh install

### Technical
- New modules: `aiClient.js`, `promptBuilder.js`, `kgmAnalyzer.js`, `kgmReporter.js`
- New UI scripts: `progressUI.js`, `kgmMain.js`
- AI provider settings stored in `extensions.litgap.*` preferences (separate from existing `extensions.zotero.litgap.*`)
- `main.js` v2.0.2: Added KGMMain continuation hook after successful Feature 1 save
- `overlay.js` v2.0.1: `_insertMenuItems()` extracted; `popupshowing` listener with stored reference for clean `unload()`

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

