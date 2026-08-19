/**
 * Memory Resurfacing Service ("On This Day")
 * Finds photos taken on today's month + day across previous years, with ±3 days fallback.
 */

class MemoryResurfaceService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get memories taken on this day in past years
   * @param {Array} allMedia
   * @param {Date} [referenceDate]
   * @returns {Object} { exactMatches: Array, fallbackMatches: Array, isFallback: boolean, targetDateStr: string }
   */
  getOnThisDayMemories(allMedia = [], referenceDate = new Date()) {
    if (!allMedia || allMedia.length === 0) {
      return { matches: [], isFallback: false, targetDateStr: referenceDate.toDateString() };
    }

    const ref = new Date(referenceDate);
    const targetMonth = ref.getMonth(); // 0-11
    const targetDay = ref.getDate(); // 1-31
    const targetYear = ref.getFullYear();
    const cacheKey = `${targetYear}-${targetMonth + 1}-${targetDay}_${allMedia.length}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const exactMatches = [];
    const fallbackCandidates = [];

    allMedia.forEach((item) => {
      if (!item.dateTaken) return;
      const d = new Date(item.dateTaken);
      if (isNaN(d.getTime())) return;

      const itemYear = d.getFullYear();
      const itemMonth = d.getMonth();
      const itemDay = d.getDate();

      // Only look at past years or distinct dates
      const yearsAgo = targetYear - itemYear;
      if (yearsAgo <= 0 && itemMonth === targetMonth && itemDay === targetDay) {
        // Taken earlier today in current year - still a memory!
        return;
      }

      if (itemMonth === targetMonth && itemDay === targetDay && yearsAgo > 0) {
        exactMatches.push({
          ...item,
          yearsAgo,
          badgeLabel: `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago (${itemYear})`,
          isExact: true
        });
      } else if (yearsAgo > 0) {
        // Compute day distance for ±3 days fallback
        const sameYearTarget = new Date(itemYear, targetMonth, targetDay);
        const diffMs = d.getTime() - sameYearTarget.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (Math.abs(diffDays) <= 3 && Math.abs(diffDays) > 0) {
          fallbackCandidates.push({
            ...item,
            yearsAgo,
            diffDays,
            badgeLabel: `Around this time • ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ${diffDays > 0 ? 'later' : 'prior'} in ${itemYear}`,
            isExact: false
          });
        }
      }
    });

    let result;
    if (exactMatches.length > 0) {
      // Sort exact matches by years ago descending
      exactMatches.sort((a, b) => b.yearsAgo - a.yearsAgo);
      result = {
        matches: exactMatches,
        isFallback: false,
        targetDateStr: ref.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      };
    } else if (fallbackCandidates.length > 0) {
      // Sort fallback by closest days distance
      fallbackCandidates.sort((a, b) => Math.abs(a.diffDays) - Math.abs(b.diffDays));
      result = {
        matches: fallbackCandidates.slice(0, 10),
        isFallback: true,
        targetDateStr: ref.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      };
    } else {
      result = {
        matches: [],
        isFallback: false,
        targetDateStr: ref.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      };
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Invalidate memoization cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const memoryResurfaceService = new MemoryResurfaceService();
