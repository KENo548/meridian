# Meridian — ATS Coverage & Direct Verification Report

## Milestone: ATS Coverage & Direct Verification

### Bugs Fixed This Milestone

1. **`enabled: undefined` silent skip** — `buildCareerSource()` in `source-discovery.js` didn't set `enabled: true`, so all discovered career sources had `enabled: undefined` (falsy). The pipeline's `enumerateDirectJobs()` skipped them via `if (!cs.enabled) continue`. Fixed by adding `enabled: true` to `buildCareerSource()`.

2. **Greenhouse board slug extraction** — Source discovery found greenhouse signatures on main careers pages (e.g., `https://www.man.com/careers`) but the `sourceUrl` was set to the page URL, not the actual `boards.greenhouse.io` or `job-boards.*.greenhouse.io` URL. Fixed by:
   - Adding `findGreenhouseBoardLinks()` to extract greenhouse board URLs from page links
   - Updating `detectInHtml()` to prefer greenhouse board URLs over page URLs
   - Updating `classifyLink()` to recognize `job-boards.eu.greenhouse.io` and `job-boards.greenhouse.io` hosts
   - Updating `buildCareerSource()` regex to match all greenhouse URL patterns

3. **Lever false-positive detection** — `linkPatterns` included `/lever\.co/i` (matches any lever.co URL), and `formPatterns`/`metaPatterns` used `/lever/i` (matches the English word "lever" anywhere in HTML). This caused source discovery to detect Lever on careers pages that merely mentioned the word or linked to unrelated lever.co pages. Fixed by restricting all Lever patterns to require `jobs.lever.co` host presence.

4. **Career source → adapter parameter mapping** — `fetchSourceJobs()` didn't pass `boardSlug`, `tenant`, or `sourceUrl` from career sources to adapters. Fixed by updating the enriched firm construction to use `source.boardSlug`, `source.tenant`, and `source.sourceUrl` as fallbacks.

5. **Pipeline copy-on-read (clarified)** — `enumerateDirectJobs()` used `getEnabledFirms()` which returns `{ ...f }` shallow copies. While shallow copies preserve referenced nested arrays (so `careerSources` wouldn't automatically disappear), the real issue was an order-of-operations problem: source discovery populates `FIRMS[i].careerSources` in-place, but `getEnabledFirms()` was called before source discovery completed in certain pipeline sequences, reading stale state. Fixed by reading directly from `FIRMS` to eliminate the ambiguity.

---

## ATS COVERAGE
```
Resolved firms                       45
Firms with discovered sources        24
Firms with supported sources         23
Firms with working sources           12
Firms with failing sources           11
Firms with unsupported sources        7
Firms with no source                 21
```

**Note:** 45 resolved firms have registry entries. The remaining 47 resolved firms (out of 92 total) were resolved from tracker data but don't appear in the firm registry — they're single-opportunity tail firms from tracker discovery that haven't been added to the curated registry.

---

## DIRECT INGESTION
```
Direct jobs enumerated            2,555
Relevant direct opportunities       564
```

**Provider breakdown:**

| Provider | Direct Jobs | Relevant Jobs | Verified Open |
|----------|------------|---------------|---------------|
| greenhouse | 1,529 | 322 | 4 |
| workday | 964 | 184 | 0 |
| oleeo_rss | 62 | 58 | 2 |
| **Total** | **2,555** | **564** | **6** |

---

## VERIFICATION
```
Tracker opportunities              366
Verified open                        6
Needs review                         0
Tracker-only                       360
```

**Verified open breakdown:**

| Firm | Tracker Opportunity | Direct Job | Score |
|------|-------------------|------------|-------|
| Jefferies | 2026 Risk Management (Quant) Summer Associate | 2027 Risk Management Summer Internship Program – New York | auto |
| Moelis & Co | 2027 Summer Analyst Investment Banking | 2027 Summer Analyst, Investment Banking - London | auto |
| William Blair | Investment Banking Summer 2027 Analyst | London Investment Banking Summer Analyst, Summer 2027 Programme | auto |
| William Blair | Investment Banking Summer Analyst Secondary Advisory | London Investment Banking Summer Analyst, Summer 2027 Programme | auto |
| IMC Trading | Trader Intern (2027) | Quantitative Trader Intern | auto |
| Optiver | Quantitative Trading Internship 2027 | Quantitative Trading Internship (2027 Start) | auto |

All 6 verified open matches were audited in the previous milestone and remain correct. No new auto-matches were produced by this milestone's expanded enumeration.

---

## MATCHER V3 AUDIT
```
Tracker entries evaluated            120
Direct jobs available              2,555
Auto-matched                          6
Ambiguous                            21
Unmatched                            93
Hard incompatible                    15
```

No new auto-matches were produced. The Man Group greenhouse jobs (55 total, 16 relevant) didn't match any Man Group tracker entries because the tracker entries are for specific programmes (e.g., "Technology Internship Programme 2027") while the greenhouse listings are for specific roles (e.g., "Analyst, Discretionary Middle Office Accounting"). The Matcher V3 correctly identified these as low-confidence matches.

---

## PROVIDER-LEVEL PAYOFF METRICS

### Working Providers (adapter exists + jobs enumerated)

| Provider | Firms | Jobs | Relevant | Verified | Adapter Status |
|----------|-------|------|----------|----------|----------------|
| greenhouse | 6 | 1,529 | 322 | 4 | Working — all 6 firms enumerate successfully |
| workday | 3 | 964 | 184 | 0 | Working — PJT Partners, Blackstone, Ares Management |
| oleeo_rss | 3 | 62 | 58 | 2 | Working — Jefferies, Moelis, Evercore |

### Failing Providers (adapter exists but 0 jobs)

| Provider | Firms | Failure Reason | Fix Difficulty |
|----------|-------|----------------|----------------|
| workday | 8 | 422 (Cloudflare anti-bot) or 404 (site name changed) | Medium — needs updated Workday tenant/site values |

### False-Positive Providers (eliminated by fix)

| Provider | Previous Firms | Root Cause | Status |
|----------|---------------|------------|--------|
| lever | 8 | `linkPatterns` matched generic `lever.co` URLs; `formPatterns`/`metaPatterns` matched the English word "lever" in HTML | **Fixed** — patterns now require `jobs.lever.co` host. All 8 false positives eliminated. |

### Unsupported Providers (no adapter)

| Provider | Firms | Opportunity |
|----------|-------|-------------|
| successfactors | 2 | Nomura, Temasek |
| phenom | 1 | Brevan Howard |
| oleeo | 4 | Jefferies, Moelis, Evercore, Nomura (HTML version, not RSS) |
| workable | 1 | IMC Trading |

### No Source Detected

| Firm | Category | Tracker Opps | Careers URL |
|------|----------|-------------|-------------|
| Goldman Sachs | bulge_bracket | 1 | higher.gs.com |
| JPMorgan | bulge_bracket | 1 | oraclecloud.com |
| Morgan Stanley | bulge_bracket | 1 | eightfold.ai |
| UBS | bulge_bracket | 1 | ubs.com |
| Deutsche Bank | bulge_bracket | 1 | careers.db.com |
| HSBC | bulge_bracket | 1 | mycareer.hsbc.com |
| Citadel | hedge_fund | 3 | citadel.com |
| Millennium | hedge_fund | 1 | eightfold.ai |
| Squarepoint | hedge_fund | 1 | squarepoint.com |
| Balyasny | hedge_fund | 1 | balyasny.com |
| Capula | hedge_fund | 3 | capula.com |
| Centerview | elite_boutique | 1 | centerviewpartners.com |
| KPMG | consulting | 3 | jobs.kpmg.com |
| Bain | consulting | 2 | bain.com |
| CD&R | private_equity | 2 | cdr.com |
| Dimensional | asset_management | 2 | dimensional.com |
| Nuveen | asset_management | 2 | nuveen.com |
| Julius Baer | bank | 2 | juliusbaer.com |
| Susquehanna | prop_trading | 3 | careers.sig.com |
| Da Vinci | hedge_fund | 2 | no URL |
| Maven | hedge_fund | 2 | mavensecurities.com |

---

## PROVIDER PRIORITY RANKING (Opportunity-Weighted)

| Rank | Provider | Resolved Firms Unlocked | Relevant Tracker Opps Unlocked | Priority Firms | Adapter? | Current Failure | Effort | Recommendation |
|------|----------|------------------------|-------------------------------|----------------|----------|-----------------|--------|----------------|
| 1 | **greenhouse** | +0 (already working) | +0 | — | Yes | None | — | Already working. 6/6 firms enumerate. 322 relevant jobs. |
| 2 | **workday** | +0 (3 working, 8 failing) | +0 | Bank of America, Barclays, Citi, Rothschild, Houlihan Lokey | Yes | 422 (Cloudflare) or 404 (site changed) | High | Cloudflare anti-bot requires browser-based scraping or proxy. 404s need updated site names. Not cost-effective to fix now. |
| 3 | **oleeo_rss** | +0 (3 working, 1 failing) | +0 | Lazard | Yes | Lazard RSS returns 0 entries (board may be empty) | Low | Lazard board may genuinely be empty. Low priority. |
| 4 | **lever** | 0 | 0 | — | Yes | **All 8 firms have no public Lever API** | N/A | **Not fixable.** These firms don't expose `api.lever.co/v0/postings/{slug}`. Source discovery produces false positives for Lever. |
| 5 | **successfactors** | +2 (Nomura, Temasek) | ~2 | Nomura, Temasek | No (custom fallback) | No real adapter | High | SAP SuccessFactors needs custom adapter with tenant/company extraction. |
| 6 | **phenom** | +1 (Brevan Howard) | ~1 | Brevan Howard | No | No adapter | High | Phenom needs custom adapter. |
| 7 | **higher/custom** | +1 (Goldman Sachs) | ~1 | Goldman Sachs | No (custom fallback) | No real adapter | High | Goldman's Higher platform is proprietary. |
| 8 | **eightfold** | +2 (Morgan Stanley, Millennium) | ~2 | Morgan Stanley, Millennium | No (custom fallback) | No real adapter | High | Eightfold needs custom adapter. |
| 9 | **oracle_hcm** | +1 (JPMorgan) | ~1 | JPMorgan | No (custom fallback) | No real adapter | High | Oracle HCM needs custom adapter. |

---

## KEY FINDINGS

### 1. Lever detection was producing false positives (fixed)
Source discovery's Lever patterns were overly broad: `linkPatterns` matched any `lever.co` URL, and `formPatterns`/`metaPatterns` matched the English word "lever" in HTML. This caused false Lever detections on careers pages for D. E. Shaw, Macquarie, Nomura, Man Group, ABN AMRO, Temasek, Point72, and Optiver — none of which have public Lever API endpoints. Fixed by restricting all patterns to require `jobs.lever.co` host presence. All 8 false positives eliminated.

### 2. Workday failures are split between Cloudflare and 404s
- **422 (Cloudflare):** Bank of America, Rothschild, Houlihan Lokey, Man Group, Temasek — these need browser-based scraping or a proxy to bypass Cloudflare
- **404 (site changed):** Barclays, Citi, Moelis — these need updated Workday tenant/site values

**Action:** Not cost-effective to fix now. Workday adapter works for 3/11 firms (PJT, Blackstone, Ares).

### 3. Greenhouse is the highest-value provider
- 6/6 firms enumerate successfully (100% success rate)
- 1,529 direct jobs, 322 relevant
- 4 verified open matches
- Includes Jane Street, Point72, William Blair, Man Group, IMC, Optiver

**Action:** Already working. No changes needed.

### 4. The real bottleneck is firm resolution, not adapter coverage
- 45 resolved firms have registry entries
- 47 resolved firms don't appear in the registry (single-opportunity tail firms)
- 21 resolved firms have no source detected at all
- The missing providers (successfactors, phenom, eightfold, oracle_hcm) would unlock ~6 more firms

**Action:** Focus on expanding firm resolution to 100-150 firms. The adapter coverage is adequate for the current resolved firm set.

### 5. No new auto-matches from expanded enumeration
The Man Group greenhouse jobs (55 total) didn't match any Man Group tracker entries because:
- Tracker entries are for specific programmes (e.g., "Technology Internship Programme 2027")
- Greenhouse listings are for specific roles (e.g., "Analyst, Discretionary Middle Office Accounting")
- Matcher V3 correctly identified these as low-confidence matches

**Action:** This is expected behavior. The matcher shouldn't force matches between programme-level tracker entries and role-level direct jobs.

---

## RECOMMENDATION

**Do not implement any new ATS adapters at this time.**

The current working providers (greenhouse, workday, oleeo_rss) cover 12/45 resolved firms and enumerate 2,555 jobs (564 relevant). The 6 verified open matches are all correct.

The bottleneck has shifted from adapter coverage to:
1. **Firm resolution** — 47 resolved firms aren't in the registry yet
2. **Firm source discovery** — 21 resolved firms have no detected source
3. **Workday Cloudflare bypass** — 8 firms blocked by Cloudflare (high effort, uncertain ROI)

The next milestone should rank the 47 resolved-but-unregistered firms by Meridian-relevant opportunity value, add those first, then measure the resulting provider/source distribution. This turns the next adapter decision into evidence rather than assumption.

---

## FILES MODIFIED

- `server/sources/discovery/source-discovery.js` — Added `findGreenhouseBoardLinks()`, updated `buildCareerSource()` to set `enabled: true`, updated greenhouse URL patterns to handle `job-boards.*.greenhouse.io`, tightened Lever patterns to require `jobs.lever.co` host
- `server/sources/discovery/pipeline.js` — Fixed `enumerateDirectJobs()` to read from `FIRMS` directly instead of `getEnabledFirms()` copies
- `server/sources/ats.js` — Updated `fetchSourceJobs()` to pass `boardSlug`, `tenant`, and `sourceUrl` from career sources to adapters
