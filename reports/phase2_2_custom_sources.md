# Phase 2.2 — Custom Sources Report

## Overview

14 firms classified as **REAL_CUSTOM** — using proprietary career systems with no known ATS.

## Per-Firm Classification

| Firm | Classification | ATS Detected | Notes |
|------|---------------|--------------|-------|
| Bain & Company | REAL_CUSTOM | None | JS-rendered, no known ATS |
| KPMG | REAL_CUSTOM | None | Updated careers URL |
| Clayton, Dubilier & Rice | REAL_CUSTOM | None | Updated careers URL |
| Temasek | REAL_CUSTOM | None | No known ATS |
| D. E. Shaw | REAL_CUSTOM | None | 3027 job keywords found |
| Squarepoint Capital | REAL_CUSTOM | None | No known ATS |
| Balyasny Asset Management | REAL_CUSTOM | None | No known ATS |
| Brevan Howard | REAL_CUSTOM | None | 136 job keywords found |
| Capula Investment Management | REAL_CUSTOM | None | No known ATS |
| ABN AMRO | REAL_CUSTOM | None | No known ATS |
| Julius Baer | REAL_CUSTOM | None | No known ATS |
| Nuveen | REAL_CUSTOM | None | No known ATS |
| Dimensional Fund Advisors | REAL_CUSTOM | None | No known ATS |
| Rede Partners | REAL_CUSTOM | None | Very small firm, no public jobs |

## ACCESS_RESTRICTED Firms (5)

| Firm | Provider | Restriction | Status |
|------|----------|-------------|--------|
| Bank of America | Workday | Cloudflare anti-bot | DISABLED |
| Rothschild & Co | Workday | Cloudflare anti-bot | DISABLED |
| Houlihan Lokey | Workday | Cloudflare anti-bot | DISABLED |
| Apollo Global Management | Workday | Cloudflare anti-bot | DISABLED |
| Centerview Partners | Custom | No public job board | DISABLED |

## BAD_CONFIGURATION Firms (2)

| Firm | Provider | Issue | Fix |
|------|----------|-------|-----|
| Citi | Workday | Site ID changed (404) | Rediscover new site ID |
| Barclays | Workday | Site ID changed (404) | Rediscover new site ID |

## NO_PUBLIC_JOBS Firms (1)

| Firm | Provider | Notes |
|------|----------|-------|
| Rede Partners | Custom | Very small advisory firm, no public job board |

## Recommended Actions

1. **Build custom scrapers** for high-value firms: KKR, Citadel, D.E. Shaw, Balyasny
2. **Disable** Rede Partners (no public jobs)
3. **Rediscover** Citi and Barclays (new Workday site IDs)
4. **Leave as-is** for low-priority custom firms (Bain, KPMG, CD&R, etc.)
