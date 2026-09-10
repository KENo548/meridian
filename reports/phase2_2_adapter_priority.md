# Phase 2.2 — Adapter Priority Ranking

## Executive Summary

Current adapter coverage: **26/60 firms** (43.3%) with **6,277 official jobs**.

Remaining 34 firms blocked by 5 unsupported ATS types + 14 custom systems.

## Provisional Adapter Priority (by student-job yield)

### Tier 1: Highest Impact (build first)

| Priority | Provider | Blocked Firms | Est. Student Jobs | Effort | ROI |
|----------|----------|---------------|-------------------|--------|-----|
| **1** | Eightfold | Morgan Stanley, Millennium | ~500+ | High | HIGH |
| **2** | Avature | HSBC, Carlyle, Macquarie | ~200+ | Medium | MEDIUM |
| **3** | SuccessFactors | Deutsche Bank, UBS, Nomura | ~300+ | Medium | MEDIUM |

### Tier 2: Medium Impact

| Priority | Provider | Blocked Firms | Est. Student Jobs | Effort | ROI |
|----------|----------|---------------|-------------------|--------|-----|
| 4 | iCIMS | Susquehanna | ~50+ | Medium | LOW |
| 5 | Taleo | (none currently) | 0 | High | NONE |

### Tier 3: Custom Scrapers (14 firms)

| Priority | Firm | Est. Student Jobs | Effort | Notes |
|----------|------|-------------------|--------|-------|
| 6 | KKR | ~20+ | High | Custom system, no ATS |
| 7 | Citadel | ~30+ | High | Custom system |
| 8 | Centerview | ~10+ | High | Small firm |
| 9 | D.E. Shaw | ~20+ | High | Many jobs, custom |
| 10 | Balyasny | ~15+ | High | Custom system |
| 11 | Squarepoint | ~10+ | High | Custom system |
| 12 | Brevan Howard | ~10+ | Medium | Custom system |
| 13 | Bain | ~10+ | Medium | Custom system |
| 14 | KPMG | ~5+ | Medium | Custom system |
| 15 | CD&R | ~5+ | Medium | Custom system |
| 16 | Temasek | ~5+ | Medium | Custom system |
| 17 | ABN AMRO | ~5+ | Medium | Custom system |
| 18 | Julius Baer | ~5+ | Medium | Custom system |
| 19 | Nuveen | ~5+ | Medium | Custom system |
| 20 | Dimensional | ~5+ | Medium | Custom system |

## Decision Point

**Option A: Build Eightfold adapter**
- Pros: Unlocks Morgan Stanley + Millennium (2 strategic firms, ~500+ student jobs)
- Cons: Eightfold has anti-bot protection; needs browser-based approach
- Estimated effort: 2-3 days

**Option B: Build Avature adapter**
- Pros: Unlocks HSBC, Carlyle, Macquarie (3 firms, ~200+ student jobs)
- Cons: Avature is less standardized than Eightfold
- Estimated effort: 1-2 days

**Option C: Build SuccessFactors adapter**
- Pros: Unlocks Deutsche Bank, UBS, Nomura (3 firms, ~300+ student jobs)
- Cons: SuccessFactors requires authentication for most APIs
- Estimated effort: 2-3 days

**Recommendation**: Build Avature first (Option B) — 3 firms unblocked with medium effort. Then Eightfold (Option A) with browser-based approach for strategic firms.
