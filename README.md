# LitGap - Find Hidden Papers in Your Zotero Library

**Version**: 3.0.0  
**Status**: Stable ✅

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zotero](https://img.shields.io/badge/Zotero-7.0+-red.svg)](https://www.zotero.org/)
[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/Yu-TingSun/litgap/releases)

> A Zotero plugin with two complementary features: find hidden papers through citation network analysis, and map your research field with AI-powered conceptual and problem-oriented analysis.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Example Output](#example-output) • [Best Practices](#best-practices) • [Limitations](#limitations) • [How It Works](#how-it-works) • [Support](#support)

---

## 🎯 What is LitGap?

LitGap provides two features accessible from the right-click menu on any Zotero collection:

### 🔍 Find Hidden Papers
Analyzes citation networks to identify **papers you haven't read** that are frequently cited by papers already in your library.

**Think of it as**: "Papers that appear in multiple bibliographies of what you've already read, but you haven't read yourself."

### 🗺️ Map Your Research Field
Uses AI to generate two complementary outputs from your library:

**Conceptual Map** — answers "what does this field cover?"
- Technical dimensions of the field with key concepts
- Knowledge gaps relative to your library
- Stance annotations showing which missing papers support which positions
- Copy-pasteable prompts for further AI-assisted exploration

**Field Map** — answers "what is this field debating?"
- Core research questions reframed as biological/scientific problems
- For each question: debate structure (Position A vs B), gap classification, foundational papers, suggested reading
- Priority reading list based on your largest knowledge gaps
- Node relationship graph with layered layout
- Mermaid diagram for Obsidian export

---

## ✨ Features

### 🔍 Find Hidden Papers
- Analyzes citation networks via Semantic Scholar API (free, no key required)
- Identifies papers cited by multiple sources in your library
- Filters by publication year, citation count, and mention frequency
- Outputs `litgap_*.md` and `.html`

### 🗺️ Map Your Research Field
- AI-powered analysis using your choice of provider (Anthropic Claude, OpenAI GPT, Google Gemini, or custom endpoint)
- Generates Conceptual Map and/or Field Map in a single run
- Conceptual Map includes stance annotations and copy-pasteable AI prompts
- Field Map includes interactive node cards, SVG relationship graph, foundational papers, and priority reading list
- Mermaid diagram in markdown for Obsidian export
- All outputs in English

### 📝 Report Formats
- **Markdown** (.md): Plain text, editable, Obsidian-compatible
- **HTML** (.html): Interactive, opens in any browser, no internet required after generation

---

## 📦 Installation

### Prerequisites
- **Zotero 7.0 or later** ([Download](https://www.zotero.org/download/))
- Papers with DOIs in your library (for Find Hidden Papers)
- Internet connection
- An AI API key (for Map Your Research Field): Anthropic, OpenAI, Google, or a compatible custom endpoint

### Steps

1. **Download the plugin**
   - Go to [Releases](https://github.com/Yu-TingSun/litgap/releases)
   - Download `LitGap.xpi`

2. **Install in Zotero**
   ```
   Tools → Add-ons → Install Add-on From File → Select LitGap.xpi
   ```

3. **Restart Zotero**

### Verification

Right-click any collection → Should see:
- **"Find Hidden Papers"**
- **"Map Your Research Field"**
- **"Reset LitGap Preferences..."**

---

## 🚀 Usage

### Feature 1: Find Hidden Papers

1. Right-click a collection → **"Find Hidden Papers"**
2. Wait ~1-3 minutes while LitGap queries Semantic Scholar
3. Save the report — two files generated:
   - `litgap_collection_date.md`
   - `litgap_collection_date.html`
4. Open the HTML file in your browser, click DOI links to access papers

### Feature 2: Map Your Research Field

1. Right-click a collection → **"Map Your Research Field"**

2. **Load or run Find Hidden Papers** — the map analysis needs the hidden papers list as input. You can load an existing `litgap_*.md` report or run Find Hidden Papers now.

3. **Set up AI provider** (first time only) — enter your API key and choose a provider. LitGap saves your settings for future runs.
   ```
   Providers:
     anthropic  → Claude  (claude-haiku-4-5-20251001)
     openai     → GPT     (gpt-4o-mini)
     google     → Gemini  (gemini-1.5-flash)
     custom     → DeepSeek / Qwen / Kimi / Ollama / others
   ```

4. **Confirm your research area** — LitGap detects it automatically, you can edit if needed.

5. **Choose output**:
   - **Conceptual Map only** — 2 API calls (~$0.002 with default model)
   - **Conceptual Map + Field Map** (recommended) — 4 API calls (~$0.004 with default model)

6. **Save reports** — all files go to the same directory:
   - `conceptual-map_collection_date.md` + `.html`
   - `field-map_collection_date.md` + `.html` (if Field Map selected)

---

## 📖 Understanding the Reports

### Source Annotations

All AI-generated content is annotated by evidence source:

| Tag | Meaning |
|-----|---------|
| `[User Library]` | Supported by papers in your Zotero collection |
| `[AI Inferred — verify]` | Based on AI training knowledge, not verified against your library |
| `[Confirmed]` | Manually confirmed by you (edit the md file to upgrade) |

### Conceptual Map

Generated in two AI steps:

**Domain Knowledge Framework**: 5-8 technical dimensions of your field, each with description and key concepts.

**Conceptual Gap Analysis**: 3-5 gaps relative to the framework and your library. Each gap includes why it matters, what you likely don't know, stance annotation for missing papers, and a copy-pasteable prompt for further AI exploration.

### Field Map

**Core Research Questions**: 3-5 problems extracted from the technical dimensions.

**Field Narrative**: Three-paragraph narrative — why the sub-field exists, the causal chain, and what the community is chasing.

**Node Relationship Graph**: SVG diagram with layered layout. Nodes coloured by status (🟡 Open / 🟢 Settled / 🔵 Emerging / 🔴 Gap). Hover over edges to read relationship labels. Click a node to jump to its card.

**Problem Node Map**: Expandable cards, one per core question. Each card contains debate structure (Position A vs B with source annotation), knowledge gaps (📚 library gap vs 🔴 field boundary), node links, suggested reading, and foundational papers.

**Priority Reading**: Top 2-3 papers to read first, with rationale explaining which gap they address.

**Mermaid Diagram**: Copy into Obsidian or any Mermaid-compatible tool.

---

## 🔬 Example Output

The following example is from a real Chromatin biophysics library (43 papers, 10 hidden papers identified by Find Hidden Papers, powered by Anthropic Claude Haiku).

### Conceptual Map — Domain Knowledge Framework (excerpt)

From a 43-paper chromatin biophysics library, LitGap identified 8 technical dimensions including:

1. **Single-Molecule Characterization Techniques** — AFM, optical tweezers, single-molecule FRET, super-resolution microscopy
2. **Nucleosome Assembly and Stability** — DNA-histone interactions, octamer-DNA binding affinity, nucleosome positioning
3. **Chromatin Dynamics and Remodeling** — ATP-dependent remodeling complexes, nucleosome sliding, histone exchange
4. **Histone Modifications and Epigenetic Regulation** — PTM patterns, reader protein recruitment, epigenetic inheritance
5. **Higher-Order Chromatin Organization** — phase separation, polymer physics, loop extrusion, TADs

### Field Map — Core Research Questions

The same library produced 4 core research questions:

1. *How do nucleosomes dynamically unwrap, slide, and reposition in response to cellular signals, and what are the complete kinetic pathways and rate-limiting steps governing these structural transitions across biologically relevant timescales?*

2. *What is the mechanistic relationship between histone chemical modifications, nucleosome stability, and chromatin accessibility in controlling transcriptional regulation, and how do these regulatory layers integrate to establish and maintain cell-type-specific gene expression programs?*

3. *How do nucleosomes and chromatin fibers self-organize into higher-order structures and phase-separated domains, and what physical principles govern the transition between different chromatin states?*

4. *How do the mechanical properties of chromatin—revealed through single-molecule force measurements—relate to the physical manipulation of chromatin during DNA replication, transcription, mitosis, and DNA damage repair?*

### Field Map — Sample Node (Nucleosome unwrapping kinetics)

```
Status: Open

Core dispute: Are nucleosome unwrapping pathways dominated by single
rate-limiting steps or do multiple competing kinetic routes operate
in parallel depending on cellular context?

Position A [AI Inferred — verify]
  Single or dual-pathway model with identifiable rate-limiting steps
  (DNA peeling from histone octamer edges, linker extrusion).

Position B [AI Inferred — verify]
  Heterogeneous ensemble process with context-dependent pathway
  selection influenced by PTMs, linker histones, and nuclear crowding.

Library gap: Limited direct measurement of unwrapping kinetics in
  crowded nuclear-like environments.
Field boundary: Cannot simultaneously resolve DNA peeling dynamics
  with atomic-scale histone–DNA contact breaking in living cells.
```

### Field Map — Priority Reading (excerpt)

```
1. Nanoscale Characterization of Interaction of Nucleosomes with H1 Linker Histone
   Addresses: Nucleosome unwrapping kinetics and higher-order organization
   Rationale: Directly measures H1-nucleosome interactions at single-molecule
   resolution, bridging the gap between structural data and dynamic behavior.

2. Explicit Ion Modeling Predicts Physicochemical Interactions for Chromatin Organization
   Addresses: Histone modifications and phase separation nodes
   Rationale: Provides quantitative framework for predicting how ionic conditions
   and modifications alter chromatin compaction, connecting in vitro and in vivo.
```

---

## 💡 Best Practices

### For Find Hidden Papers

| Criteria | Recommendation |
|----------|----------------|
| Topic Focus | Single, well-defined topic |
| Paper Count | 10-50 papers |
| DOI Coverage | ≥80% with DOIs |
| Time Range | Last 10-15 years |

### For Map Your Research Field

- Works best with 15-60 papers on a focused topic
- Run Find Hidden Papers first — the hidden papers list significantly improves Field Map quality
- If the detected research area is too broad, edit it to be more specific
- The Conceptual Map is a good starting point; run it alone first to check quality before adding Field Map
- To improve output quality, use a stronger model (e.g. `claude-sonnet-4-6` instead of Haiku) by entering the model name during AI setup
- The Field Map markdown is designed to be pasted into a Claude Project or AI assistant for interactive exploration

### Using Field Map with Claude

1. Run LitGap to generate `field-map_*.md`
2. Paste the contents into a Claude conversation or Project
3. Ask Claude to explain specific nodes, suggest reading order, or locate your own research question on the map

---

## 🔧 How It Works

### Find Hidden Papers

```
Papers in collection
  → Filter: Academic papers only, extract DOIs
  → Query: Semantic Scholar API for each DOI
  → Collect: Papers cited by your collection
  → Remove: Papers already in your library
  → Score: mention frequency + citation count + recency
  → Output: Top recommendations as MD + HTML
```

### Map Your Research Field

```
Find Hidden Papers report (missing papers list)
  ↓
Step A — Domain Knowledge Framework  (API call 1)
  AI identifies 5-8 technical dimensions from your paper titles
  ↓
Step B — Conceptual Gap Analysis  (API call 2)
  AI identifies 3-5 gaps + Stance Index for each missing paper
  ↓
  [if Field Map selected]
Step FM-A — Core Questions Extraction  (API call 3)
  AI reframes technical dimensions as research problems
  ↓
Step FM-B — Node Map Construction  (API call 4)
  AI builds debate nodes, narrative, foundational papers, priority reading
  ↓
Reporter generates MD + HTML for each selected output
```

---

## 🌐 API Costs

### Find Hidden Papers
Free — uses Semantic Scholar API (no key required).

### Map Your Research Field

Approximate costs using default models:

| Output | API Calls | Approx. Cost |
|--------|-----------|--------------|
| Conceptual Map only | 2 | ~$0.002 |
| Conceptual Map + Field Map | 4 | ~$0.004 |

Costs vary by provider and library size. Using a more powerful model (e.g. Claude Sonnet instead of Haiku) increases cost ~5-10×.

---

## ⚠️ Limitations

### Find Hidden Papers
- Requires internet connection and Semantic Scholar API access
- Papers need DOIs for citation lookup
- Citation data quality depends on Semantic Scholar coverage (better for English papers, post-2000)
- Maximum ~50 papers per analysis (API rate limits)

### Map Your Research Field
- Requires an AI API key and internet connection
- AI output quality depends on model and library size — smaller, more focused libraries produce better maps
- `[AI Inferred — verify]` positions should be verified against actual papers before treating as ground truth
- Field Map node structure varies between runs — re-running on the same library may produce different node names or link structures
- SVG graph layout depends on link direction in AI output; if the AI generates ambiguous links, layout may not perfectly reflect upstream/downstream relationships

---

## 🤔 FAQ

<details>
<summary><strong>Which AI provider should I use?</strong></summary>

For most users: **Anthropic Claude Haiku** (fast, cheap, good quality) or **OpenAI GPT-4o-mini** (similar). For better Field Map quality, use Claude Sonnet or GPT-4o — enter the model name during setup.

Users in mainland China: use **DeepSeek** (`custom` provider, base URL `https://api.deepseek.com/v1`, model `deepseek-chat`).
</details>

<details>
<summary><strong>Why do I need a litgap report to run Map Your Research Field?</strong></summary>

The missing papers list from Find Hidden Papers populates the suggested reading, foundational papers, and priority reading sections of the maps. Without it, the AI has to infer gaps from titles alone. You can load an existing `litgap_*.md` from a previous run — you don't need to re-run Find Hidden Papers every time.
</details>

<details>
<summary><strong>How do I use the Field Map with Obsidian?</strong></summary>

Copy the Mermaid block at the bottom of `field-map_*.md` into an Obsidian note. Obsidian renders Mermaid diagrams natively. You can also paste the entire field map markdown as a reference note for interactive AI conversations.
</details>

<details>
<summary><strong>What does [AI Inferred — verify] mean?</strong></summary>

The AI assigned a position to a paper based on its training knowledge, not by reading your actual library. These assignments are suggestions — verify them against the papers. You can manually change the annotation to `[Confirmed]` in the markdown file after verifying.
</details>

<details>
<summary><strong>Why do I need DOIs for Find Hidden Papers?</strong></summary>

DOIs are used to query the Semantic Scholar API. Without DOIs, citation data cannot be fetched. Most modern papers (post-2000) have DOIs. Use Zotero's "Retrieve Metadata" feature or the DOI Manager plugin to batch-add DOIs.
</details>

<details>
<summary><strong>How long does analysis take?</strong></summary>

**Find Hidden Papers**: ~1-3 minutes for 20-50 papers.

**Map Your Research Field**: ~30-90 seconds total. Each of the 2-4 AI calls takes ~5-30 seconds depending on provider.
</details>

---

## 🐛 Troubleshooting

### "Map Your Research Field" fails with parse error
The AI returned a response that could not be parsed. Try running again — this is usually transient. If it fails repeatedly, try a different AI provider or check your API key.

### Plugin doesn't appear in right-click menu
```
1. Tools → Add-ons → Check if "LitGap" is listed and enabled
2. If not listed: Reinstall from .xpi file
3. Restart Zotero completely (close all windows)
```

### "No papers with DOI found"
```
1. Check papers have DOI field filled
2. Use Zotero's "Retrieve Metadata" feature
3. Or install "DOI Manager" plugin to batch-add DOIs
```

### Analysis fails or hangs
```
1. Check internet connection
2. Help → Debug Output Logging → look for [KGMMain] error messages
3. Report issue with console log on GitHub
```

### HTML report doesn't open
```
Right-click .html file → Open With → Browser
The file is self-contained — no internet required after generation
```

---

## 📚 Background & Motivation

LitGap was developed during PhD research in biophysics to solve two problems:

**Unknown unknowns** — papers you don't know you're missing. Citation network analysis finds them automatically.

**No map of the field** — entering a new sub-field means reading many papers before understanding what is contested and what is settled. The Field Map provides this orientation before deep reading, identifying the core debates and which papers take which positions.

---

## 🤝 Contributing

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/Yu-TingSun/litgap/issues) with:
- Zotero version
- LitGap version
- Error message (from Help → Debug Output Logging)
- Steps to reproduce

---

## 💖 Support This Project

LitGap is **free and open source**.

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/yutingsun)

- ⭐ **Star this repository**
- 📢 **Share with colleagues**
- 🐛 **Report bugs**
- 💡 **Suggest features**

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **GitHub**: [github.com/Yu-TingSun/litgap](https://github.com/Yu-TingSun/litgap)
- **Issues**: [Report bugs or request features](https://github.com/Yu-TingSun/litgap/issues)
- **Releases**: [Download latest version](https://github.com/Yu-TingSun/litgap/releases)
- **Developer**: [Sun Yuting](https://yutingsun.netlify.app/)

---

## 🙏 Acknowledgments

- [Semantic Scholar API](https://www.semanticscholar.org/product/api) — citation data
- [Zotero](https://www.zotero.org/) — reference management platform
- Anthropic, OpenAI, Google — AI providers

---

<div align="center">

**Made with ❤️ for researchers by researchers**

[⬆ Back to Top](#litgap---find-hidden-papers-in-your-zotero-library)

</div>
