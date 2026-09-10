# Phase 2.0 — Coverage Measurement Report

**Generated:** 2026-09-10T21:22:44.409Z
**Baseline commit:** fa857a1
**Registry firms:** 60
**Enabled firms:** 40
**Sweep duration:** 138.6s

---

## Executive Summary

Registry firms: 60

| Metric | Value |
|---|---|
| Directly covered | 26 / 60 |
| Coverage % | 43.3% |
| Weighted coverage | 42.4% |
| Covered active | 26 |
| Covered zero | 0 |
| Partial | 0 |
| Unsupported ATS | 34 |
| Unknown source | 0 |
| Broken/config | 0 |
| Needs review | 0 |
| **Total official jobs** | **6277** |

### Provider Performance

| Provider | Firms | Success | Fail | Jobs | Success Rate | Median Latency |
|---|---|---|---|---|---|---|
| oracle_hcm | 3 | 3 | 0 | 3414 | 100.0% | 14273ms |
| eightfold | 2 | 0 | 2 | 0 | 0.0% | 0ms |
| workday | 16 | 10 | 6 | 1763 | 62.5% | 4089ms |
| custom | 20 | 0 | 20 | 0 | 0.0% | 0ms |
| successfactors | 2 | 0 | 2 | 0 | 0.0% | 0ms |
| oleeo_rss | 4 | 3 | 1 | 100 | 75.0% | 360ms |
| greenhouse | 10 | 10 | 0 | 1000 | 100.0% | 353ms |
| avature | 2 | 0 | 2 | 0 | 0.0% | 0ms |
| workable | 1 | 0 | 1 | 0 | 0.0% | 0ms |

### Top Coverage Blockers

| # | Provider | Firms Blocked |
|---|---|---|
| 1 | custom | 40 |
| 2 | workday | 6 |
| 3 | eightfold | 2 |
| 4 | successfactors | 2 |
| 5 | avature | 2 |
| 6 | oleeo_rss | 1 |
| 7 | workable | 1 |

### Adapter ROI

| Provider | Firms | Effort | Strategic | Score |
|---|---|---|---|---|
| custom | 40 | 2 | undefined | 20.00 |
| workday | 6 | 3 | undefined | 2.00 |
| successfactors | 2 | 3 | undefined | 0.67 |
| eightfold | 2 | 4 | undefined | 0.50 |
| avature | 2 | 4 | undefined | 0.50 |
| workable | 1 | 2 | undefined | 0.50 |
| oleeo_rss | 1 | 3 | undefined | 0.33 |

### Coverage by Category

| Category | Covered | Total | Jobs |
|---|---|---|---|
| bulge_bracket | 2 | 10 | 3313 |
| elite_boutique | 3 | 6 | 68 |
| middle_market | 3 | 4 | 139 |
| private_equity | 2 | 7 | 466 |
| hedge_fund | 3 | 10 | 291 |
| prop_trading | 3 | 4 | 564 |
| bank | 0 | 3 | 0 |
| asset_management | 7 | 9 | 1332 |
| broker_dealer | 1 | 1 | 46 |
| consulting | 0 | 2 | 0 |
| quant_hedge_fund | 1 | 1 | 9 |
| exchanges | 1 | 1 | 49 |
| advisory | 0 | 2 | 0 |

### Uncovered Firms

| Company | Provider | Status | Reason |
|---|---|---|---|
| Morgan Stanley | eightfold | SOURCE_FOUND_UNSUPPORTED | Provider eightfold is unsupported |
| Bank of America | workday | SOURCE_FOUND_UNSUPPORTED | Firm disabled with no enabled sources |
| Citi | workday | SOURCE_FOUND_UNSUPPORTED | Firm disabled with no enabled sources |
| Barclays | workday | SOURCE_FOUND_UNSUPPORTED | Firm disabled with no enabled sources |
| UBS | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Deutsche Bank | successfactors | SOURCE_FOUND_UNSUPPORTED | Provider successfactors is unsupported |
| HSBC | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Lazard | oleeo_rss | SOURCE_FOUND_UNSUPPORTED | Firm disabled with no enabled sources |
| Rothschild & Co | workday | SOURCE_FOUND_UNSUPPORTED | Firm disabled with no enabled sources |
| Centerview Partners | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Houlihan Lokey | workday | SOURCE_FOUND_UNSUPPORTED | Firm disabled with no enabled sources |
| KKR | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Apollo Global Management | workday | SOURCE_FOUND_UNSUPPORTED | Firm disabled with no enabled sources |
| The Carlyle Group | avature | SOURCE_FOUND_UNSUPPORTED | Provider avature is unsupported |
| Citadel | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Millennium Management | eightfold | SOURCE_FOUND_UNSUPPORTED | Provider eightfold is unsupported |
| Susquehanna (SIG) | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| D. E. Shaw | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Macquarie Group | avature | SOURCE_FOUND_UNSUPPORTED | Provider avature is unsupported |
| Nomura | successfactors | SOURCE_FOUND_UNSUPPORTED | Provider successfactors is unsupported |
| Squarepoint Capital | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Balyasny Asset Management | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Brevan Howard | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Capula Investment Management | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| ABN AMRO | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Julius Baer | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Nuveen | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Dimensional Fund Advisors | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Bain & Company | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| KPMG | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Clayton, Dubilier & Rice | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Temasek | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |
| Interpath Advisory | workable | SOURCE_FOUND_UNSUPPORTED | Provider workable is unsupported |
| Rede Partners | custom | SOURCE_FOUND_UNSUPPORTED | Provider custom is unsupported |

---

## Recommended Next Action

**PATH A — NEW ATS ADAPTER: custom**

- Expected companies unlocked: 40
- Estimated effort: 2/5
- Weighted coverage improvement: +66.7%

**Also consider:**

- PATH D — COMPANY UNIVERSE EXPANSION: If existing 6 adapters cover many unlisted firms
- PATH C — SOURCE DISCOVERY: If many firms have unknown/missed ATS configurations
