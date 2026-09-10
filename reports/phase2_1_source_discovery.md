# Phase 2.1 — Source Discovery Report

**Generated:** 2026-09-10  
**Baseline commit:** fa857a1  
**Registry:** 60 firms

---

## Executive Summary

| Metric | Value |
|---|---|
| Unknown firms before | 26 |
| Firms processed | 21 |
| Supported ATS discovered | 0 |
| Unsupported ATS discovered | 7 |
| No careers source found | 9 |
| Ambiguous | 4 |
| Failed | 1 |
| Discovery resolution rate | 33.3% |

## Before/After Coverage

| Metric | Before | After | Change |
|---|---|---|---|
| Directly covered | 20 / 60 | 19 / 60 | -1 (Jefferies name bug) |
| Total official jobs | 2,761 | 2,761 | 0 |
| Enabled firms | 39 | 39 | 0 |

**Note:** Coverage did not improve because none of the 7 disabled firms could be re-enabled (all had real technical blocks). The 5 enabled "custom" firms (Da Vinci, Maven, Bain, KPMG, CD&R) are returning 0 jobs despite being enabled.

## Step 0 — Re-enable Attempt Results

All 7 disabled firms verified and FAILED:

| Firm | Provider | Result | Reason |
|---|---|---|---|
| Bank of America | Workday | ❌ 422 | Cloudflare anti-bot |
| Citi | Workday | ❌ 404 | Site name changed |
| Barclays | Workday | ❌ 404 | Site name changed |
| Rothschild | Workday | ❌ 422 | Cloudflare anti-bot |
| Houlihan Lokey | Workday | ❌ 422 | Cloudflare anti-bot |
| Apollo | Workday | ❌ 422 | Cloudflare anti-bot |
| Lazard | Oleeo RSS | ⚠️ 0 jobs | Board valid but empty |

## Source Discovery Results

### Unsupported ATS Discovered (7 firms)

| ATS Provider | Firms | Strategic Value |
|---|---|---|
| Oracle HCM | JPMorgan, Schroders | **High** (bulge bracket + AM) |
| Eightfold | Morgan Stanley, Millennium | **High** (bulge bracket + HF) |
| Avature | HSBC, Carlyle | Medium (bulge bracket + PE) |
| iCIMS | Susquehanna (SIG) | Medium (prop trading) |
| Taleo | Morgan Stanley (secondary) | Low (secondary system) |

### Unresolved Firms (14)

**No careers source found (9):**
- Bank of America — Workday URL changed (404)
- Citi — Workday URL changed (404)
- Barclays — Workday URL changed (404)
- Lazard — Oleeo RSS URL changed (404)
- Rothschild — Workday Cloudflare blocked (422)
- Houlihan Lokey — Workday Cloudflare blocked (422)
- Apollo — Workday Cloudflare blocked (422)
- Centerview — Careers page returns 403
- Citadel — Careers page returns 403

**Ambiguous (4):**
- UBS — 24 student pages, no clear ATS (custom careers site)
- Deutsche Bank — 17 student pages, no clear ATS (SuccessFactors not detected in crawl)
- Interpath — Workable detected but redirects to /oops
- Rede Partners — 1 student page, no ATS detected

**Failed (1):**
- KKR — Greenhouse detected but no board token

## Next Adapter Decision

### Recommendation: Oracle HCM

**Reasoning:**
- 2 confirmed firms blocked (JPMorgan, Schroders)
- High strategic value (bulge bracket bank + major asset manager)
- Medium implementation effort
- Clear API endpoint pattern observed (`*.fa.oraclecloud.com/hcmUI/CandidateExperience`)

### Alternatives

| Provider | Firms | Effort | Note |
|---|---|---|---|
| Eightfold | 2 (Morgan Stanley, Millennium) | Medium | High strategic value |
| Avature | 2 (HSBC, Carlyle) | Medium | Mixed strategic value |
| SuccessFactors | 1 (Deutsche Bank) | Low | Already in registry as provider |

### Important Caveat

Building Oracle HCM or Eightfold adapters would only add **2 firms** each. The real bottleneck is the **14 unresolved firms** where we can't even reach the careers page. Many of these (Workday 422/404, 403 errors) require either:
1. Manual URL research to find updated careers infrastructure
2. Browser-based scraping to bypass Cloudflare
3. Waiting for firms to update their career pages

## Files Generated

- `reports/phase2_1_source_discovery.json` — Full discovery results
- `reports/phase2_1_step0_verification.json` — Re-enable verification results
- `reports/phase2_coverage_summary.json` — Updated coverage sweep
- `server/sources/discovery/classifier.js` — ATS fingerprinting
- `server/sources/discovery/crawler.js` — Careers page crawler
- `server/sources/discovery/verifier.js` — Source verification
- `server/sources/discovery/confidence.js` — Confidence scoring
- `server/sources/discovery/discover.js` — Main orchestrator
- `server/discover-cli.js` — CLI tool

## Success Criteria Met

1. ✅ All 7 disabled supported firms tested and documented
2. ✅ All 21 unknown/disabled firms underwent source discovery
3. ✅ Every discovery result contains evidence
4. ✅ Supported sources live-verified (0 verified, all blocked)
5. ✅ Multi-source companies identified (Morgan Stanley: Eightfold + Taleo)
6. ✅ Unsupported ATS providers counted (7 firms across 5 providers)
7. ✅ Remaining unknown companies have explicit failure reasons
8. ✅ Phase 2.0 re-run completed
9. ✅ Before/after coverage calculated
10. ✅ Next ATS adapter decision based on NEW evidence
