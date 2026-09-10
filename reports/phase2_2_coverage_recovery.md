# Phase 2.2 — Coverage Recovery Report

## Executive Summary

| Metric | Value | Gate Target | Status |
|--------|-------|-------------|--------|
| **Source Resolution** | 26/60 (43.3%) | ≥85% | BELOW |
| **Live Coverage** | 40 enabled firms (66.7%) | ≥70% | BELOW |
| **Official Jobs** | 6,277 | maximize | GOOD |
| **Student-Relevant Jobs** | 3,118 (unknown) + 429 (intern+apprentice) | maximize | IMPROVED |

**Gate verdict: NOT READY** — Source resolution 43.3% < 85% threshold. Live coverage 66.7% < 70% threshold.

## Coverage Breakdown by Provider

| Provider | Firms | Jobs | Success Rate | Notes |
|----------|-------|------|--------------|-------|
| Oracle HCM | 3 | 3,414 | 100% | NEW — Goldman, JPMorgan, Schroders |
| Workday | 10 | 1,763 | 62.5% | 6 blocked (Cloudflare/404) |
| Greenhouse | 10 | 1,000 | 100% | 3 new firms added |
| Oleeo RSS | 3 | 100 | 75% | Lazard empty feed |
| **Total** | **26** | **6,277** | — | — |

## Firms NOT Yet Covered (34 total)

### Blocked by ATS (20 firms)
- **Cloudflare anti-bot** (5): Bank of America, Rothschild, Houlihan Lokey, Apollo, Lazard (empty feed)
- **Workday site changed** (2): Citi, Barclays
- **Unsupported ATS** (13): Morgan Stanley (Eightfold), Millennium (Eightfold), Deutsche Bank (SuccessFactors), UBS (SuccessFactors), HSBC (custom), Citadel (custom), Susquehanna (custom), KKR (custom), Centerview (custom), Carlyle (Avature), Macquarie (Avature), Nomura (SuccessFactors), Interpath (Workable)

### Custom Careers Systems (14 firms)
Bain, KPMG, CD&R, Temasek, D.E. Shaw, Squarepoint, Balyasny, Brevan Howard, Capula, ABN AMRO, Julius Baer, Nuveen, Dimensional, Rede Partners

## Phase 2.2 Improvements

### New Sources Added (6 firms)
| Firm | Provider | Status | Jobs |
|------|----------|--------|------|
| Jefferies | Oleeo RSS | FIXED (name field) | 50 |
| Da Vinci Trading | Greenhouse | FIXED (adapter) | 12 |
| Maven Securities | Greenhouse | FIXED (adapter) | 47 |
| Man Group | Greenhouse | NEW | 51 |
| Interpath Advisory | Workable | NEW | 0 (unsupported) |
| Nomura | SuccessFactors | NEW | 0 (unsupported) |
| Macquarie Group | Avature | NEW | 0 (unsupported) |
| D.E. Shaw | Custom | NEW | 0 (unsupported) |
| Brevan Howard | Custom | NEW | 0 (unsupported) |

### Company Identity Normalization
- Added `name` field to Jefferies (was missing, causing silent failures)
- Added aliases to 9 firms (Moelis, PJT, Houlihan, Lazard, Rothschild, Citi, Barclays, BofA, Apollo)
- Implemented `normalizeCompanyName()` with legal suffix removal, punctuation normalization
- Implemented `buildAliasList()` combining name, aliases, domains, normalized forms

## Remaining Coverage Gaps

| Gap Type | Firms | Impact |
|----------|-------|--------|
| Eightfold adapter | Morgan Stanley, Millennium | ~500+ student jobs |
| Avature adapter | HSBC, Carlyle, Macquarie | ~200+ student jobs |
| SuccessFactors adapter | Deutsche Bank, UBS, Nomura | ~300+ student jobs |
| Custom scrapers | 14 firms | ~100+ student jobs |
| **Total gap** | **34 firms** | **~1,100+ student jobs** |

## Recommendation

**Do not expand to 250+ firms** until:
1. Source resolution ≥85% (currently 43.3%)
2. Live coverage ≥70% (currently 66.7%)

**Next priority adapters** (by student-job yield):
1. Eightfold — Morgan Stanley, Millennium (high strategic value)
2. Avature — HSBC, Carlyle, Macquarie (3 firms blocked)
3. SuccessFactors — Deutsche Bank, UBS, Nomura (3 firms blocked)
