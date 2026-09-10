# Phase 2.2 — Supported Source Failure Analysis

Generated: 2026-09-10

---

## Blocked Supported Firms

### Bank of America

| Field | Value |
|-------|-------|
| Provider | workday |
| Configured URL | https://ghr.wd1.myworkdayjobs.com/Bank_of_America_Careers |
| Current Response | 422 Cloudflare anti-bot |
| Failure Type | CLOUDFLARE |
| Official Careers URL | https://careers.bankofamerica.com |
| Current ATS Destination | Workday (blocked by Cloudflare) |
| Browser-Accessible Public Jobs? | No — Cloudflare blocks server-side requests |
| Source Changed? | No |
| Tenant Changed? | No |
| Site Changed? | No |
| Endpoint Changed? | No |
| Access Restriction | Cloudflare anti-bot protection |
| Recommended Repair | ACCESS_RESTRICTED — no permitted stable retrieval mechanism exists |

---

### Citi

| Field | Value |
|-------|-------|
| Provider | workday |
| Configured URL | https://citi.wd5.myworkdayjobs.com/citi |
| Current Response | 404 (site changed) |
| Failure Type | STALE_SITE |
| Last Known Working URL | https://citi.wd5.myworkdayjobs.com/citi |
| Official Careers URL | https://jobs.citi.com |
| Current ATS Destination | Workday (site ID changed) |
| Browser-Accessible Public Jobs? | Unknown — needs manual verification |
| Source Changed? | Yes — Workday site ID changed |
| Tenant Changed? | No |
| Site Changed? | Yes |
| Endpoint Changed? | Yes |
| Access Restriction | None |
| Recommended Repair | Run targeted rediscovery to find new Workday site ID |

---

### Barclays

| Field | Value |
|-------|-------|
| Provider | workday |
| Configured URL | https://barclays.wd3.myworkdayjobs.com/barclays |
| Current Response | 404 (site changed) |
| Failure Type | STALE_SITE |
| Last Known Working URL | https://barclays.wd3.myworkdayjobs.com/barclays |
| Official Careers URL | https://search.jobs.barclays |
| Current ATS Destination | Workday (site ID changed) |
| Browser-Accessible Public Jobs? | Unknown — needs manual verification |
| Source Changed? | Yes — Workday site ID changed |
| Tenant Changed? | No |
| Site Changed? | Yes |
| Endpoint Changed? | Yes |
| Access Restriction | None |
| Recommended Repair | Run targeted rediscovery to find new Workday site ID |

---

### Lazard

| Field | Value |
|-------|-------|
| Provider | oleeo_rss |
| Configured URL | https://lazard-careers.tal.net/vx/mobile-0/appcentre-ext/brand-3/candidate/jobboard/vacancy/2/feed |
| Current Response | 200 OK but 0 jobs in RSS feed |
| Failure Type | EMPTY_FEED |
| Last Known Working URL | Same URL (feed valid but empty) |
| Official Careers URL | https://www.lazard.com/careers/ |
| Current ATS Destination | Oleeo/TalentCentral (valid board, no listings) |
| Browser-Accessible Public Jobs? | Yes — Oleeo board is accessible |
| Source Changed? | No |
| Tenant Changed? | No |
| Site Changed? | No |
| Endpoint Changed? | No |
| Access Restriction | None — board is valid but has no current listings |
| Recommended Repair | LEAVE_AS_IS — board is valid, may populate when Lazard has open positions |

---

### Rothschild & Co

| Field | Value |
|-------|-------|
| Provider | workday |
| Configured URL | https://rothschild.wd3.myworkdayjobs.com/rothschildandco |
| Current Response | 422 Cloudflare anti-bot |
| Failure Type | CLOUDFLARE |
| Official Careers URL | https://www.rothschildandco.com/careers |
| Current ATS Destination | Workday (blocked by Cloudflare) |
| Browser-Accessible Public Jobs? | No |
| Source Changed? | No |
| Tenant Changed? | No |
| Site Changed? | No |
| Endpoint Changed? | No |
| Access Restriction | Cloudflare anti-bot protection |
| Recommended Repair | ACCESS_RESTRICTED |

---

### Houlihan Lokey

| Field | Value |
|-------|-------|
| Provider | workday |
| Configured URL | https://houlihanlokey.wd1.myworkdayjobs.com/houlihanlokey |
| Current Response | 422 Cloudflare anti-bot |
| Failure Type | CLOUDFLARE |
| Official Careers URL | https://careers.houlihanlokey.com |
| Current ATS Destination | Workday (blocked by Cloudflare) |
| Browser-Accessible Public Jobs? | No |
| Source Changed? | No |
| Tenant Changed? | No |
| Site Changed? | No |
| Endpoint Changed? | No |
| Access Restriction | Cloudflare anti-bot protection |
| Recommended Repair | ACCESS_RESTRICTED |

---

### Apollo Global Management

| Field | Value |
|-------|-------|
| Provider | workday |
| Configured URL | https://apollo.wd1.myworkdayjobs.com/apollo |
| Current Response | 422 Cloudflare anti-bot |
| Failure Type | CLOUDFLARE |
| Official Careers URL | https://www.apollo.com/careers |
| Current ATS Destination | Workday (blocked by Cloudflare) |
| Browser-Accessible Public Jobs? | No |
| Source Changed? | No |
| Tenant Changed? | No |
| Site Changed? | No |
| Endpoint Changed? | No |
| Access Restriction | Cloudflare anti-bot protection |
| Recommended Repair | ACCESS_RESTRICTED |

---

## Classification Summary

| Failure Type | Count | Firms |
|-------------|-------|-------|
| CLOUDFLARE | 5 | Bank of America, Rothschild & Co, Houlihan Lokey, Apollo Global Management |
| STALE_SITE | 2 | Citi, Barclays |
| EMPTY_FEED | 1 | Lazard |
| **Total Blocked Supported** | **7** | |

### Breakdown by Recommended Repair

| Repair Action | Count | Firms |
|--------------|-------|-------|
| ACCESS_RESTRICTED | 5 | Bank of America, Rothschild & Co, Houlihan Lokey, Apollo Global Management |
| Targeted Rediscovery | 2 | Citi, Barclays |
| LEAVE_AS_IS | 1 | Lazard |
