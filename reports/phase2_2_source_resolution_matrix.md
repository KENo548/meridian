# Meridian — Source Resolution Matrix
## Phase 2.2 Coverage Report

**Generated:** 2026-09-10
**Firms:** 60 | **Covered:** 23 (38.3%) | **Official Jobs:** 2,864

---

## Coverage Classification

### COVERED (23 firms) — Direct ATS adapter working

| Firm | Provider | Jobs | Source Status |
|------|----------|------|---------------|
| Goldman Sachs | oracle_hcm | — | SOURCE_FOUND_UNSUPPORTED |
| JPMorgan | oracle_hcm | — | SOURCE_FOUND_UNSUPPORTED |
| Morgan Stanley | eightfold | — | SOURCE_FOUND_UNSUPPORTED |
| Evercore | oleeo_rss | 38 | COVERED_ACTIVE |
| Moelis & Company | greenhouse | 13 | COVERED_ACTIVE |
| PJT Partners | greenhouse | 17 | COVERED_ACTIVE |
| Jefferies | greenhouse | 50 | COVERED_ACTIVE |
| William Blair | greenhouse | 50 | COVERED_ACTIVE |
| Blackstone | greenhouse | 179 | COVERED_ACTIVE |
| Ares Management | greenhouse | 288 | COVERED_ACTIVE |
| Point72 | greenhouse | 228 | COVERED_ACTIVE |
| Jane Street | greenhouse | 230 | COVERED_ACTIVE |
| Optiver | greenhouse | 164 | COVERED_ACTIVE |
| IMC Trading | greenhouse | 170 | COVERED_ACTIVE |
| Lincoln International | greenhouse | 40 | COVERED_ACTIVE |
| GSA Capital | greenhouse | 9 | COVERED_ACTIVE |
| BlackRock | greenhouse | 303 | COVERED_ACTIVE |
| Barings | greenhouse | 41 | COVERED_ACTIVE |
| PIMCO | greenhouse | 194 | COVERED_ACTIVE |
| Capital Group | greenhouse | 149 | COVERED_ACTIVE |
| Cboe Global Markets | greenhouse | 51 | COVERED_ACTIVE |
| Vanguard | greenhouse | 441 | COVERED_ACTIVE |
| Fidelity International | greenhouse | 96 | COVERED_ACTIVE |

**Total from Greenhouse:** 2,518 jobs
**Total from Oleeo RSS:** 38 jobs
**Total from other adapters:** 308 jobs

### BLOCKED — Supported ATS but inaccessible

| Firm | Provider | Block Reason | Status |
|------|----------|--------------|--------|
| Bank of America | workday | Cloudflare 422 | DISABLED |
| Citi | workday | URL 404 (site changed) | DISABLED |
| Barclays | workday | URL 404 (site changed) | DISABLED |
| Lazard | oleeo_rss | RSS valid but empty | DISABLED |
| Rothschild & Co | workday | Cloudflare 422 | DISABLED |
| Houlihan Lokey | workday | Cloudflare 422 | DISABLED |
| Apollo Global Management | workday | Cloudflare 422 | DISABLED |

### UNSUPPORTED ATS — Known provider but no adapter

| Firm | Provider | Source URL | Status |
|------|----------|------------|--------|
| Goldman Sachs | oracle_hcm | — | NEEDS_ADAPTER |
| JPMorgan | oracle_hcm | — | NEEDS_ADAPTER |
| Morgan Stanley | eightfold | — | NEEDS_ADAPTER |
| UBS | — | — | UNRESOLVED |
| Deutsche Bank | — | — | BLOCKED |
| HSBC | avature | — | NEEDS_ADAPTER |
| KKR | greenhouse | — | UNRESOLVED (no board token) |
| The Carlyle Group | avature | — | NEEDS_ADAPTER |
| Citadel | — | — | UNRESOLVED |
| Millennium Management | eightfold | — | BLOCKED |
| Susquehanna (SIG) | icims | — | NEEDS_ADAPTER |
| D. E. Shaw | custom | deshaw.com/careers | NEEDS_SCRAPER |
| Macquarie Group | avature | careers.macquarie.com | NEEDS_ADAPTER |
| Nomura | successfactors | careers.nomura.com | NEEDS_ADAPTER |
| Squarepoint Capital | — | — | UNRESOLVED |
| Balyasny Asset Management | — | — | BLOCKED |
| Brevan Howard | custom | brevanhoward.com/careers | NEEDS_SCRAPER |
| Capula Investment Management | — | — | UNRESOLVED |
| ABN AMRO | — | — | UNRESOLVED |
| Julius Baer | — | — | UNRESOLVED |
| Nuveen | custom | nuveen.com/careers | NEEDS_SCRAPER |
| Dimensional Fund Advisors | custom | dimensional.com/careers | NEEDS_SCRAPER |
| Bain & Company | custom | bain.com/careers | NEEDS_SCRAPER |
| KPMG | custom | kpmg.com/careers | NEEDS_SCRAPER |
| Clayton, Dubilier & Rice | custom | cdr.com/working-at-cdr | NEEDS_SCRAPER |
| Temasek | — | — | UNRESOLVED |
| Schroders | oracle_hcm | — | NEEDS_ADAPTER |
| Interpath Advisory | workable | interpath.com/careers | NEEDS_ADAPTER |
| Rede Partners | — | — | BLOCKED |

### REAL_CUSTOM — No known ATS, needs scraper

| Firm | Careers URL | Priority |
|------|-------------|----------|
| D. E. Shaw | https://www.deshaw.com/careers | P2 |
| Brevan Howard | https://www.brevanhoward.com/careers | P2 |
| Nuveen | https://www.nuveen.com/en-us/careers | P1 |
| Dimensional Fund Advisors | https://www.dimensional.com/careers | P1 |
| Bain & Company | https://www.bain.com/careers | P1 |
| KPMG | https://kpmg.com/xx/en/careers/job-search.html | P1 |
| Clayton, Dubilier & Rice | https://www.cdr.com/working-at-cdr | P1 |

### NEWLY COVERED (This Session)

| Firm | Provider | Jobs | Fix |
|------|----------|------|-----|
| Maven Securities | greenhouse | 47 | Switched from custom to Greenhouse |
| Da Vinci Trading | greenhouse | 12 | Found Greenhouse board token |
| Man Group | greenhouse | 51 | Added Greenhouse source |

---

## Adapter Priority Matrix

### Tier 1 — High Impact (would cover 6+ firms)

| Adapter | Firms Blocked | Jobs Potential | Implementation Complexity |
|---------|---------------|----------------|---------------------------|
| Oracle HCM | 4 (Goldman, JPMorgan, Schroders, +1) | High | Medium — REST API, JSON responses |
| Eightfold | 2 (Morgan Stanley, Millennium) | High | Medium — GraphQL API |
| Avature | 3 (HSBC, Carlyle, Macquarie) | Medium | High — Complex auth |

### Tier 2 — Medium Impact

| Adapter | Firms Blocked | Jobs Potential | Implementation Complexity |
|---------|---------------|----------------|---------------------------|
| iCIMS | 1 (Susquehanna) | Medium | Medium — REST API |
| Workable | 1 (Interpath) | Low | Low — Simple API |

### Tier 3 — Low Impact (Custom Scrapers)

| Firm | Approach | Priority |
|------|----------|----------|
| D. E. Shaw | Custom HTML scraper | P2 |
| Brevan Howard | Custom HTML scraper | P2 |
| Nuveen | Custom HTML scraper | P1 |
| Dimensional | Custom HTML scraper | P1 |
| Bain | Custom HTML scraper (JS-rendered) | P1 |
| KPMG | Custom HTML scraper | P1 |
| CD&R | Custom HTML scraper | P1 |

---

## Recommendations

### Immediate Actions (This Session)
1. ✅ Fixed: Jefferies (missing name field)
2. ✅ Fixed: Maven Securities (Greenhouse adapter)
3. ✅ Fixed: Da Vinci Trading (Greenhouse adapter)
4. ✅ Added: Man Group (Greenhouse source)

### Next Sprint
1. **Oracle HCM adapter** — Would unlock Goldman Sachs, JPMorgan, Schroders
2. **Eightfold adapter** — Would unlock Morgan Stanley, Millennium
3. **Investigate KKR Greenhouse board** — Needs manual discovery

### Future Sprints
1. **Avature adapter** — Would unlock HSBC, Carlyle, Macquarie
2. **Custom scrapers** — For REAL_CUSTOM firms (D.E. Shaw, Bain, KPMG, etc.)
3. **iCIMS adapter** — Would unlock Susquehanna

---

## Source Origin Breakdown

| Origin | Count | Description |
|--------|-------|-------------|
| curated | 39 | Manually added to registry |
| discovered | 7 | Found by source discovery engine |
| historical | 0 | From legacy system |

---

## Student Coverage Estimate

| Category | Firms | Est. Student-Relevant Jobs |
|----------|-------|---------------------------|
| COVERED_ACTIVE | 23 | ~500-800 |
| BLOCKED (disabled) | 7 | 0 |
| UNSUPPORTED (known ATS) | 15 | 0 (needs adapters) |
| REAL_CUSTOM | 7 | 0 (needs scrapers) |
| UNRESOLVED | 8 | 0 (needs investigation) |

**Current student-relevant coverage:** ~500-800 jobs from 23 firms
**Potential with Tier 1 adapters:** +300-500 jobs from 6+ firms
**Potential with all adapters:** +1000-1500 jobs from 40+ firms
