# LitGap - Find Hidden Papers in Your Zotero Library

**Version**: 1.2.3  
**Status**: Stable ✅


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zotero](https://img.shields.io/badge/Zotero-7.0+-red.svg)](https://www.zotero.org/)
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/sunyuting/litgap/releases)

> A Zotero plugin that finds important papers frequently cited by your library but not yet in your collection.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Best Practices](#best-practices) • [Limitations](#limitations) • [How It Works](#how-it-works) • [Support](#support)

---

## 📸 Preview

<div align="center">

**🎬 See LitGap in Action**

| Step | Description |
|------|-------------|
| 1️⃣ | Right-click any collection → Select "Find Hidden Papers" |
| 2️⃣ | Review collection stats and confirm analysis |
| 3️⃣ | Wait 1-3 minutes while LitGap analyzes citation networks |
| 4️⃣ | Save Markdown + HTML reports with your recommendations |
| 5️⃣ | Click DOI links to instantly access recommended papers |

📷 *Screenshots will be added soon. The plugin is fully functional.*

**Quick Demo**: [Watch a 2-minute walkthrough →](https://github.com/sunyuting/litgap/wiki/Demo) *(Coming soon)*

</div>

---

## 🎯 What is LitGap?

LitGap analyzes citation networks to identify **knowledge gaps** - important papers that are:
- ✅ Frequently cited by papers in your library
- ✅ High impact in your research field
- ❌ **Not yet in your collection**

**Think of it as**: "Papers that appear in multiple bibliographies of what you've already read, but you haven't read them yourself."

### Quick Example

You have 50 papers on DNA repair. LitGap finds:
- Paper A: Cited by 8 of your papers ⭐
- Paper B: Cited by 5 of your papers ⭐
- Paper C: Cited by 3 of your papers

→ **These are paper gaps!**

---

## ✨ Features

### 🔍 Smart Analysis
- Analyzes citation networks via Semantic Scholar API
- Identifies papers cited by multiple sources in your library
- Filters by publication year, citation count, and mention frequency

### 📊 Intelligent Scoring
- **Mention frequency** (highest weight): How many of your papers cite it
- **Academic impact**: Total citation count
- **Recency bonus**: Recent papers get priority

### 📝 Beautiful Reports
- **Markdown** (.md): Plain text, editable, version-control friendly
- **HTML** (.html): Interactive with clickable links

### 🔗 One-Click Access
- **DOI links**: Direct access to papers
- **Semantic Scholar**: View full citation context
- **Google Scholar**: Backup search option

### 🎨 Professional Output
- Responsive design (mobile/tablet/desktop)
- Print-friendly formatting
- Clear visual hierarchy

---

## 📦 Installation

### Prerequisites
- **Zotero 7.0 or later** ([Download](https://www.zotero.org/download/))
- Papers with DOIs in your library
- Internet connection

### Steps

1. **Download the plugin**
   - Go to [Releases](https://github.com/sunyuting/litgap/releases)
   - Download `LitGap.xpi`

2. **Install in Zotero**
   ```
   Tools → Add-ons → Install Add-on From File → Select LitGap.xpi
   ```

3. **Restart Zotero**
   - Close Zotero completely
   - Reopen and you're ready!

### Verification

Right-click any collection → Should see **"Find Hidden Papers"** option ✓

---

## 🚀 Usage

### Basic Workflow

1. **Select a Collection**
   - Right-click on any collection in Zotero
   - Choose **"Find Hidden Papers"**

2. **Confirm Analysis**
   ```
   Collection: Machine Learning Papers
   Total papers: 50
   Papers with DOI: 45
   
   Will process: 45 papers
   Estimated time: ~2 minutes
   
   Continue?
   ```

3. **Wait for Analysis**
   - Progress window shows real-time updates
   - ~1-2 minutes for 20-50 papers

4. **Save Report**
   - Two files automatically generated:
     - `litgap_collection_2026-01-22.md` (Markdown)
     - `litgap_collection_2026-01-22.html` (HTML)

5. **Review Recommendations**
   - Open HTML file in browser
   - Click DOI/Scholar links to access papers
   - Add interesting papers to Zotero

---

## 📖 Understanding the Report

### Report Structure

```
🔬 LitGap Analysis Report

📊 Your Library Overview
├─ Papers analyzed: 50
├─ With DOI: 45 (90%)
└─ Citations analyzed: 2,500 unique papers

🎯 Recommended Papers (Knowledge Gaps)

📌 Priority Reading (Top 3 + Early Influential)
├─ 1. Paper Title (Score: 58.0/100)
│   ├─ Cited by 5 of your papers
│   ├─ 1,000 total citations
│   └─ 📄 DOI | 🔍 Scholar | 🔎 Google
├─ 2. Another Paper (Score: 35.0/100)
└─ ...

📖 Recommended Reading (Remaining)
└─ 4. More Papers...

📘 About This Report
└─ Methodology and reading suggestions
```

### Score Breakdown

**Total Score** = Mention Score + Impact Score + Recency Score

| Component | Weight | Max Points | Example |
|-----------|--------|------------|---------|
| Mentions | Highest | Unlimited | 5 papers × 10 = 50 pts |
| Citations | Medium | 5 | 500 cites ÷ 100 = 5 pts |
| Recency | Bonus | 3 | 2023-2026 = 3 pts |

**Example**:
- Paper cited by 5 of your papers: **50 points**
- 500 total citations: **5 points**
- Published in 2024: **3 points**
- **Total: 58 points** ⭐

---

## 🎓 Use Cases

### For Researchers
- **Literature review**: Find papers you might have missed
- **Grant writing**: Identify foundational works
- **Paper writing**: Complete your bibliography

### For Students
- **Thesis preparation**: Build comprehensive references
- **Field overview**: Understand key papers
- **Reading list**: Prioritized recommendations

### For Librarians
- **Collection development**: Identify important acquisitions
- **Subject expertise**: Stay current in specific fields

---

## 🔧 How It Works

### 1. Parse Your Library
```javascript
Papers in collection
  → Filter: Academic papers only
  → Extract: DOI, title, authors, year
  → Result: List of papers to analyze
```

### 2. Fetch Citation Data
```javascript
For each paper with DOI:
  → Query: Semantic Scholar API
  → Collect: All papers that cite this work
  → Result: Complete citation network
```

### 3. Find Knowledge Gaps
```javascript
All citations
  → Remove: Papers you already have
  → Filter: Year ≥ 2010, Mentioned ≥ 2 times
  → Calculate: Scores (mention + impact + recency)
  → Sort: By total score (descending)
  → Result: Top 10 recommendations
```

### 4. Generate Reports
```javascript
Recommendations
  → Format: Markdown + HTML
  → Add: DOI/Scholar/Google links
  → Style: Professional, responsive design
  → Save: Two files for different uses
```

---

## 📊 Sample Results

### Input
- **50 papers** on DNA repair mechanisms
- **45 with DOI** (90% coverage)
- **2,500 citations** collected

### Output
- **15 recommendations** found
- **Top 3 papers**:
  1. "Structural mechanism of RecA" (58.0 pts) - cited by 5 papers
  2. "DNA calorimetry methods" (35.0 pts) - cited by 3 papers
  3. "Homologous recombination" (32.5 pts) - cited by 3 papers

### Time
- **2 minutes** for complete analysis
- **~10x faster** than manual search

---

## 💡 Best Practices

### ⚠️ Before You Start: Collection Requirements

LitGap works best with **well-curated, topic-focused collections**. Here's what you need to know:

#### ✅ Ideal Collection Profile

| Criteria | Recommendation | Why |
|----------|----------------|-----|
| **Topic Focus** | Single, well-defined topic | Papers should cite each other's references |
| **Paper Count** | 10-50 papers | Enough data, reasonable analysis time |
| **DOI Coverage** | ≥80% with DOIs | API requires DOIs to fetch citations |
| **Time Range** | Last 10-15 years | Better citation data, more relevant |
| **Paper Types** | Journal articles, conference papers | Reviews and books work too |

#### ❌ What Doesn't Work Well

| Problem | Why | Solution |
|---------|-----|----------|
| **Mixed Topics** | Unrelated citations | Create separate collections per topic |
| **<10 Papers** | Too few citation overlaps | Add more papers or combine related topics |
| **>50 Papers** | API limits, slow analysis | LitGap will sample 50 papers automatically |
| **Old Papers** | Fewer citations indexed | Focus on 2000+ if possible |
| **No DOIs** | Cannot fetch citation data | Use Zotero's "Retrieve Metadata" feature |

---

### 📏 Understanding the 50-Paper Limit

**Why the limit?**
- Semantic Scholar API has rate limits (~100 requests per 5 minutes)
- Each paper takes ~1.5 seconds to process
- 50 papers = ~2 minutes (reasonable wait time)
- More papers = diminishing returns (overlapping citations)

**What happens with >50 papers?**
```
Your collection: 100 papers with DOI

LitGap automatically:
  1. Randomly samples 50 papers
  2. Shows you which papers are included
  3. Analyzes those 50 papers
  4. Generates recommendations

Result: Still finds most important gaps!
```

**Best approach for large collections:**
```
Instead of: One 100-paper collection
Do this:    Two 50-paper sub-collections
  • "DNA Repair - Mechanisms" (50 papers)
  • "DNA Repair - Applications" (50 papers)

Benefit: 
  ✓ Better topic focus
  ✓ More targeted recommendations
  ✓ Faster analysis
```

---

### 🎯 Optimal Usage Scenarios

#### Scenario 1: Literature Review (Perfect Use Case ⭐)

```
Starting point:
  • 30 papers on "CRISPR gene editing"
  • All published 2015-2024
  • All have DOIs

LitGap finds:
  • 12 foundational papers you missed
  • 3 cited by ≥5 of your papers
  • Saves 2-3 hours of manual searching

Recommendation: Run LitGap after collecting 20-30 papers
```

#### Scenario 2: Grant Writing

```
Goal: Show comprehensive literature knowledge

Process:
  1. Collect 40-60 key papers in your field
  2. Run LitGap
  3. Add top 5-10 recommendations to your proposal
  4. Your bibliography now includes foundational works

Result: Reviewers see you know the field deeply
```

#### Scenario 3: PhD Thesis Preparation

```
Timeline:
  • Year 1: Collect papers as you read (20-30)
  • Year 2: Run LitGap quarterly, add recommendations
  • Year 3: Final LitGap run before writing
  
Result: 
  ✓ Comprehensive bibliography
  ✓ No major gaps
  ✓ Confident you've covered the field
```

#### Scenario 4: Field Overview (New Topic)

```
Situation: Starting research in new area

Strategy:
  1. Find 3-5 recent review papers
  2. Add their key references (~15-25 papers)
  3. Run LitGap
  4. Read top recommendations first
  5. Repeat process with expanded collection

Result: Fast entry into new research area
```

---

### 📚 Collection Organization Tips

#### Strategy A: Topic-Based Collections

```
My_Research/
├── CRISPR_Mechanisms (35 papers)
├── CRISPR_Applications (42 papers)
├── Gene_Therapy_Reviews (28 papers)
└── Ethics_CRISPR (18 papers)

Analysis approach:
  • Run LitGap on each collection separately
  • Get topic-specific recommendations
  • Merge important papers into main collection
```

#### Strategy B: Chronological Collections

```
Literature_Review_2024/
├── Phase1_SeedPapers (15 papers)
├── Phase2_Expanded (40 papers)
└── Phase3_Final (60 papers) → Sample to 50

Analysis approach:
  • Run LitGap after each phase
  • Incrementally improve coverage
  • Track which recommendations you add
```

#### Strategy C: Project-Based Collections

```
My_Projects/
├── Project_Alpha (25 papers)
├── Project_Beta (38 papers)
└── Background_Reading (50 papers)

Analysis approach:
  • Each project gets targeted recommendations
  • Background collection for general field knowledge
  • Cross-reference between projects
```

---

### 🔍 Maximizing DOI Coverage

**Problem**: Only 60% of your papers have DOIs  
**Impact**: LitGap can only analyze those 60%  
**Solution**: Batch-add DOIs before analysis

#### Method 1: Zotero's Built-in Tool
```
1. Select papers without DOI
2. Right-click → "Retrieve Metadata for PDF"
3. Zotero auto-fills DOI if available
```

#### Method 2: DOI Manager Plugin
```
1. Install "DOI Manager" plugin
2. Select collection
3. Tools → DOI Manager → "Update DOIs"
4. Batch processing in minutes
```

#### Method 3: Manual Addition (Last Resort)
```
For papers without DOI:
  1. Search paper on publisher website
  2. Copy DOI from paper page
  3. Paste into Zotero DOI field
  
Note: Not all papers have DOIs (especially pre-2000)
```

---

### ⏱️ Time Expectations

| Papers | With DOI | Analysis Time | Recommendations |
|--------|----------|---------------|-----------------|
| 10 | 8 | ~15 seconds | 2-5 |
| 20 | 18 | ~30 seconds | 5-10 |
| 30 | 25 | ~45 seconds | 8-15 |
| 50 | 45 | ~90 seconds | 10-20 |
| 100* | 50 (sampled) | ~90 seconds | 10-20 |

*Auto-sampled to 50 papers

**What affects time?**
- **API delay**: 1.5s per paper (rate limit protection)
- **Network speed**: Faster internet = slightly faster
- **Paper popularity**: More citations = longer processing

**Pro tip**: Start analysis before coffee break ☕

---

### 🎓 Advanced Tips

#### Tip 1: Iterative Analysis

```
Round 1: 20 papers → 8 recommendations → Add top 3
Round 2: 23 papers → 7 new recommendations → Add top 2
Round 3: 25 papers → 5 new recommendations → Done!

Result: Comprehensive coverage with targeted additions
```

#### Tip 2: Compare Sub-Collections

```
Analysis:
  • Run LitGap on "Methods" sub-collection
  • Run LitGap on "Applications" sub-collection
  • Compare recommendations
  
Find: Papers important in both = truly foundational
```

#### Tip 3: Track Recommendation Quality

```
Create "LitGap_Found" tag in Zotero:
  1. Run LitGap analysis
  2. Add recommended papers
  3. Tag them "LitGap_Found"
  4. Later: Review if they were actually useful
  
Result: Understand LitGap's accuracy for your field
```

#### Tip 4: Combine with Zotero Connector

```
Power workflow:
  1. LitGap generates HTML report
  2. Open HTML in browser
  3. Click DOI link → Opens publisher page
  4. Click Zotero Connector icon
  5. Paper auto-imported!
  
Result: Add 10 papers in 2 minutes instead of 20
```

---

### ✅ Quick Checklist Before Analysis

Before clicking "Find Hidden Papers", verify:

- [ ] Collection is topic-focused (not mixed subjects)
- [ ] At least 10-15 papers in collection
- [ ] ≥80% of papers have DOIs
- [ ] Most papers are from last 10-15 years
- [ ] Papers are academic (not news articles/blogs)
- [ ] You have 2-3 minutes to wait
- [ ] Internet connection is stable

**If all checked**: You'll get great results! 🎯  
**If some missing**: Consider improving collection first

---

## 🛠️ Configuration

### Default Settings

```javascript
{
  minYear: 2010,        // Only papers after 2010
  topN: 10,             // Return top 10 recommendations
  minMentions: 2,       // Cited by at least 2 of your papers
  delay: 3000           // 3 seconds between API requests
}
```

### Customization

Currently settings are hardcoded. Future versions will add:
- ⏳ User preferences dialog
- ⏳ Adjustable filters
- ⏳ Custom scoring weights

---

## ⚠️ Limitations & Known Issues

### Technical Limitations

#### 1. API Rate Limits & 50-Paper Cap
```
Semantic Scholar API (free tier):
  • ~100 requests per 5 minutes
  • LitGap uses 3-second delay between requests
  • Practical limit: 50 papers per analysis

What happens with >50 papers?
  → LitGap automatically samples 50 papers randomly
  → Shows you which papers are included
  → Analysis still effective (citation overlap)

Workaround for large collections:
  • Split into topic-specific sub-collections (recommended)
  • Or accept random sampling (still finds most gaps)
```

#### 2. DOI Requirement
```
Papers without DOI cannot be analyzed

Common cases:
  • Pre-2000 publications
  • Books and book chapters
  • Technical reports
  • Non-academic sources

Impact: Older/non-standard literature underrepresented
Workaround: Add DOIs manually via DOI Manager plugin
```

#### 3. Semantic Scholar Coverage
```
Excellent coverage:
  ✓ Computer Science
  ✓ Biomedical Sciences  
  ✓ Physics, Chemistry

Limited coverage:
  ⚠️ Humanities
  ⚠️ Some Social Sciences
  ⚠️ Non-English papers

Impact: Recommendations may miss field-specific works
Workaround: Combine with traditional search methods
```

---

### Analytical Limitations

#### What LitGap Can't Find

**LitGap excels at**: Papers cited by multiple sources in your collection  
**LitGap misses**:
- **Brand new papers** (2024-2025, not yet widely cited)
- **Niche papers** (important but rarely cited)
- **Alternative approaches** (outside your citation network)
- **Negative results** (rarely cited but valuable)

**Recommendation**: Use LitGap + traditional search together

#### When LitGap May Not Help

| Scenario | Why | Better Approach |
|----------|-----|-----------------|
| **Very narrow topic** (<15 papers) | Too few citation overlaps | Broaden to related topics |
| **Emerging field** (<2 years old) | Insufficient citations yet | Use preprint servers + alerts |
| **Comprehensive collection** | Already complete! | Celebrate thoroughness 🎉 |
| **Interdisciplinary mix** | Different citation cultures | Analyze each field separately |

---

### Known Issues (v1.1.1)

#### Issue 1: Blocking Progress Window 
⏳ *Fix coming in v1.2.0*
```
Current: Progress window blocks Zotero during analysis
Impact: Cannot work while LitGap runs

Planned fix: Background processing + notifications
```

#### Issue 2: No Preference Memory  
🔄 *Fix coming in v1.2.0*
```
Current: Asks for confirmation every time
Impact: Repetitive for familiar collections

Planned fix: "Don't ask me again" checkbox
```

#### Issue 3: No Analysis History  
📊 *Planned for v2.0*
```
Current: No record of past analyses
Impact: Can't track changes over time

Planned: History view + comparison features
```

---

### Privacy & Data Usage

#### What data is sent?
```
To Semantic Scholar API:
  ✓ Paper DOIs only (public identifiers)
  ✗ NO PDFs or paper content
  ✗ NO personal information
  ✗ NO Zotero username/email
```

#### What data is stored locally?
```
Zotero preferences (minimal):
  • Usage count (for donation prompt)
  • Collection-specific settings
  • "Already donated" flag

NOT stored:
  • Analysis results
  • Recommendation history
  • Paper content
```

#### Network usage per analysis (30 papers):
- API requests: 30
- Data downloaded: ~500KB
- Data uploaded: ~5KB
- Time: ~45 seconds

---

## 🤔 FAQ

<details>
<summary><strong>Why do I need DOIs?</strong></summary>

DOIs (Digital Object Identifiers) are used to query the Semantic Scholar API. Without DOIs, we can't fetch citation data. Most modern papers (post-2000) have DOIs.

**Solution**: Add DOIs using Zotero's "Retrieve Metadata" feature or DOI Manager plugin.
</details>

<details>
<summary><strong>How long does analysis take?</strong></summary>

- 3 papers: ~10 seconds
- 20 papers: ~1 minute
- 50 papers: ~2-3 minutes

**Rate limit**: ~1.5 seconds per paper (Semantic Scholar API limit)
</details>

<details>
<summary><strong>What if no recommendations are found?</strong></summary>

Possible reasons:
1. **Excellent coverage**: Your library is already comprehensive! 🎉
2. **Too few papers**: Try analyzing 20+ papers
3. **Strict filters**: Papers need to be cited by ≥2 of your papers

**Try**: Lower the `minMentions` to 1 (contact developer for help)
</details>

<details>
<summary><strong>Can I use it offline?</strong></summary>

No. LitGap requires internet connection to:
- Query Semantic Scholar API
- Fetch citation data

**Tip**: Run analysis when online, then review reports offline.
</details>

<details>
<summary><strong>What about non-English papers?</strong></summary>

Semantic Scholar has good coverage for English papers. Non-English papers may have:
- Fewer citations indexed
- Less complete data

**Result**: May not appear in recommendations even if relevant.
</details>

<details>
<summary><strong>Why is the API so slow?</strong></summary>

Semantic Scholar has rate limits (~100 requests per 5 minutes). We add delays (3 seconds) to avoid hitting the limit and getting blocked.

**Patience is key!** ⏳ The results are worth it.
</details>

---

## 🐛 Troubleshooting

### Plugin doesn't appear
```
Solution:
1. Tools → Add-ons → Check if "LitGap" is listed
2. If not: Reinstall from .xpi file
3. Restart Zotero completely (close all windows)
```

### "No papers with DOI found"
```
Solution:
1. Check papers have DOI field filled
2. Use Zotero's "Retrieve Metadata" feature
3. Or install "DOI Manager" plugin to batch-add DOIs
```

### Analysis fails or hangs
```
Solution:
1. Check internet connection
2. Check Debug Console (Help → Debug Output Logging)
3. Look for error messages
4. Report issue with console log
```

### HTML report doesn't open
```
Solution:
1. Right-click .html file → Open With → Browser
2. Or drag .html file into browser window
3. Chrome, Firefox, Safari all supported
```

### Links don't work
```
Solution:
1. Make sure papers have DOI
2. Some DOIs may be behind paywalls
3. Try Semantic Scholar or Google Scholar links instead
```

---

## 📚 Background & Motivation

### The Problem: Unknown Unknowns

As researchers, we face four types of knowledge:

```
┌─────────────────┬─────────────────┐
│  Known Knowns   │  Known Unknowns │
│ (what you know) │ (you know gaps) │
├─────────────────┼─────────────────┤
│Unknown Unknowns │ Unknown Knowns  │
│ ← LitGap helps! │ (hidden skills) │
└─────────────────┴─────────────────┘
```

**Unknown unknowns** are the hardest: Papers you don't know you're missing.

### The Solution: Citation Network Analysis

**Key insight**: If a paper is cited by multiple papers you've read, it's probably important.

**LitGap automates this discovery process.**

### Academic Context

This tool was developed during PhD research in biophysics to:
- Identify foundational papers in DNA mechanics
- Complete literature review efficiently
- Discover cross-disciplinary connections

**Result**: Found 15+ important papers I had missed, significantly improved my literature review.

---

## 🤝 Contributing

### Reporting Issues

Found a bug? Have a suggestion?

1. Check [existing issues](https://github.com/sunyuting/litgap/issues)
2. Open a new issue with:
   - Zotero version
   - LitGap version
   - Error message (from Debug Console)
   - Steps to reproduce

### Feature Requests

Ideas for improvements? Open an issue with tag `enhancement`.

**Planned features**:
- ⏳ User preferences dialog
- ⏳ Background analysis (non-blocking)
- ⏳ Export to BibTeX
- ⏳ Integration with other reference managers

### Code Contributions

Pull requests welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests if applicable
4. Submit PR with clear description

---

## 💖 Support This Project

LitGap is **free and open source**. If it helps your research:

### GitHub Sponsors
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-red?logo=github)](https://github.com/sponsors/sunyuting)

**Why sponsor?**
- Supports continued development
- Enables new features
- Helps maintain compatibility with Zotero updates

### Other Ways to Help
- ⭐ **Star this repository**
- 📢 **Share with colleagues**
- 📝 **Write about it** (blog, social media)
- 🐛 **Report bugs** to improve quality
- 💡 **Suggest features** for future versions

### Sponsorship Funds Usage
All sponsorship funds support:
- **Education**: Research tools development
- **Research platforms**: Open-source academic tools
- **Community**: Free resources for researchers

*Thank you for helping make research more efficient!* 🙏

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

**TL;DR**: Free to use, modify, and distribute. No warranties provided.

---

## 🔗 Links

- **GitHub**: [github.com/sunyuting/litgap](https://github.com/sunyuting/litgap)
- **Issues**: [Report bugs or request features](https://github.com/sunyuting/litgap/issues)
- **Releases**: [Download latest version](https://github.com/sunyuting/litgap/releases)
- **Developer**: [Sun Yuting](https://yutingsun.netlify.app/)

---

## 📮 Contact

**Developer**: Sun Yuting  
**Website**: [yutingsun.netlify.app](https://yutingsun.netlify.app/)  
**GitHub**: [@sunyuting](https://github.com/sunyuting)

**Questions or feedback?**  
Open an issue on GitHub or reach out via website contact form.

---

## 🙏 Acknowledgments

### Built With
- [Semantic Scholar API](https://www.semanticscholar.org/product/api) - Citation data
- [Zotero](https://www.zotero.org/) - Reference management platform

### Inspired By
- Research on knowledge organization and discovery
- Personal pain points during PhD literature review
- The "unknown unknowns" framework

### Thanks To
- Zotero development team for excellent documentation
- Semantic Scholar for free API access
- Early testers and feedback providers

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/sunyuting/litgap?style=social)
![GitHub forks](https://img.shields.io/github/forks/sunyuting/litgap?style=social)
![GitHub issues](https://img.shields.io/github/issues/sunyuting/litgap)
![GitHub license](https://img.shields.io/github/license/sunyuting/litgap)

---

<div align="center">

**Made with ❤️ for researchers by researchers**

[⬆ Back to Top](#litgap---find-hidden-papers-in-your-zotero-library)

</div>
