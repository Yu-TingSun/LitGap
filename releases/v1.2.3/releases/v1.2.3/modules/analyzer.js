/**
 * LitGap - Analyzer Module
 * Find knowledge gaps by analyzing citation patterns
 * 
 * @module analyzer
 * @version 2.0.0
 * 
 * Ported from: find_gaps.py
 * 
 * Scoring Formula:
 * totalScore = mentionedScore + impactScore + recencyScore
 * - mentionedScore: mentioned_count × 10 (highest weight)
 * - impactScore: min(citationCount / 100, 5) (capped at 5)
 * - recencyScore: 3/2/1/0 based on publication age
 */

var Analyzer = {
  
  /**
   * Find knowledge gaps in citation data
   * 
   * @param {Object} citationData - Citation data from API module
   * @param {Object} options - Analysis options
   * @param {number} options.minYear - Minimum publication year (default: 2010)
   * @param {number} options.topN - Number of recommendations to return (default: 10)
   * @param {number} options.minMentions - Minimum mention count (default: 2)
   * @returns {Array} Sorted array of recommendations with scores
   */
  findGaps: function(citationData, options = {}) {
    const {
      minYear = 2010,
      topN = 10,
      minMentions = 2
    } = options;
    
    Zotero.debug("\n" + "=".repeat(60));
    Zotero.debug("Analyzer: Finding knowledge gaps...");
    Zotero.debug("=".repeat(60));
    
    const allCitations = citationData.all_citations || [];
    const userPaperIds = new Set(citationData.user_paper_ids || []);
    
    Zotero.debug(`Total citations: ${allCitations.length}`);
    
    // Filter 1: Remove user's existing papers
    let candidates = allCitations.filter(c => 
      !userPaperIds.has(c.paperId)
    );
    Zotero.debug(`After removing existing papers: ${candidates.length}`);
    
    // Filter 2: Year threshold
    candidates = candidates.filter(c => {
      if (!c.year) return false;
      const year = parseInt(c.year);
      return !isNaN(year) && year >= minYear;
    });
    Zotero.debug(`After year filter (>=${minYear}): ${candidates.length}`);
    
    // Filter 3: Minimum mentions
    candidates = candidates.filter(c => 
      (c.mentioned_count || 0) >= minMentions
    );
    Zotero.debug(`After mention filter (>=${minMentions}): ${candidates.length}`);
    
    if (candidates.length === 0) {
      Zotero.debug("Analyzer: No candidates found after filtering");
      return [];
    }
    
    // Calculate scores for all candidates
    const recommendations = candidates.map(citation => {
      const scores = this._calculateScore(citation);
      return {
        ...citation,
        totalScore: scores.totalScore,
        mentionedScore: scores.mentionedScore,
        impactScore: scores.impactScore,
        recencyScore: scores.recencyScore
      };
    });
    
    // Sort by total score (descending)
    recommendations.sort((a, b) => b.totalScore - a.totalScore);
    
    // Mark early influential papers (oldest with high citations in top results)
    this._markEarlyInfluential(recommendations, topN);
    
    // Return top N
    const topRecommendations = recommendations.slice(0, topN);
    
    Zotero.debug(`\nAnalyzer: Found ${recommendations.length} candidates`);
    Zotero.debug(`Returning top ${topRecommendations.length} recommendations`);
    
    // Debug: Show top 3
    if (topRecommendations.length > 0) {
      Zotero.debug("\nTop 3 recommendations:");
      topRecommendations.slice(0, 3).forEach((rec, i) => {
        Zotero.debug(`${i+1}. ${rec.title.substring(0, 50)}...`);
        Zotero.debug(`   Score: ${rec.totalScore.toFixed(1)} (M:${rec.mentionedScore} + I:${rec.impactScore} + R:${rec.recencyScore})`);
      });
    }
    
    Zotero.debug("=".repeat(60) + "\n");
    
    return topRecommendations;
  },
  
  /**
   * Calculate recommendation score for a citation
   * 
   * @private
   * @param {Object} citation - Citation object
   * @param {number} currentYear - Current year (default: current year)
   * @returns {Object} Score breakdown
   */
  _calculateScore: function(citation, currentYear = null) {
    if (!currentYear) {
      currentYear = new Date().getFullYear();
    }
    
    // Component 1: Mentioned score (highest weight)
    // How many user papers cite this paper
    const mentionedCount = citation.mentioned_count || 0;
    const mentionedScore = mentionedCount * 10;
    
    // Component 2: Impact score (citation count)
    // Normalized to max 5 points
    const citationCount = citation.citationCount || 0;
    const impactScore = Math.min(citationCount / 100, 5);
    
    // Component 3: Recency score
    // Bonus for recent publications
    let recencyScore = 0;
    if (citation.year) {
      const year = parseInt(citation.year);
      if (!isNaN(year)) {
        const age = currentYear - year;
        if (age <= 3) {
          recencyScore = 3;       // 2023-2026
        } else if (age <= 5) {
          recencyScore = 2;       // 2021-2022
        } else if (age <= 10) {
          recencyScore = 1;       // 2016-2020
        }
        // else: recencyScore = 0  // Before 2016
      }
    }
    
    const totalScore = mentionedScore + impactScore + recencyScore;
    
    return {
      totalScore: totalScore,
      mentionedScore: mentionedScore,
      impactScore: parseFloat(impactScore.toFixed(2)),
      recencyScore: recencyScore
    };
  },
  
  /**
   * Mark early influential papers in recommendations
   * Identifies 1-2 oldest papers with significant citations
   * 
   * @private
   * @param {Array} recommendations - Sorted recommendations
   * @param {number} topN - Number of top recommendations to consider
   */
  _markEarlyInfluential: function(recommendations, topN) {
    if (recommendations.length === 0) return;
    
    // Only consider papers in top results
    const topPapers = recommendations.slice(0, Math.min(topN * 2, recommendations.length));
    
    // Find papers with high citations (>= 200) and published before 2016
    const earlyPapers = topPapers.filter(paper => {
      const year = parseInt(paper.year);
      const citations = paper.citationCount || 0;
      return !isNaN(year) && year < 2016 && citations >= 200;
    });
    
    if (earlyPapers.length === 0) return;
    
    // Sort by year (oldest first)
    earlyPapers.sort((a, b) => parseInt(a.year) - parseInt(b.year));
    
    // Mark the earliest 1-2 papers
    const numToMark = Math.min(2, earlyPapers.length);
    for (let i = 0; i < numToMark; i++) {
      earlyPapers[i].isEarlyInfluential = true;
      Zotero.debug(`Marked as early influential: ${earlyPapers[i].title.substring(0, 40)}... (${earlyPapers[i].year})`);
    }
  }
};