# Meridian — Architecture & How It Works

**Finance recruiting command centre** for Spring Weeks, summer internships, and graduate roles. Built for students targeting IB, PE, AM, S&T, and quant roles — especially Frankfurt School / Europe.

---

## Quick Start

```bash
# Frontend (Vite dev server on :5173)
cd Meridian
npm install
npm run dev

# Backend (Express API on :3001) — separate terminal
cd Meridian/server
npm install
npm run dev
```

Open `http://localhost:5173` — sign up, then start tracking applications.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (SPA)                         │
│  React 19 + Vite 8 + TypeScript + Tailwind CSS 4        │
│  Zustand (state) + Dexie (IndexedDB per-user DB)         │
│                                                           │
│  Deployed: Vercel (Production: meridian-finance-six)      │
└──────────────────────────┬───────────────────────────────┘
                           │ fetch() with credentials (httpOnly cookie)
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  BACKEND (Express)                        │
│  Node.js + Express + better-sqlite3 + bcrypt + JWT       │
│  Auth: JWT in httpOnly cookie (stateless, no DB needed)  │
│                                                           │
│  Deployed: Render Free Tier (meridian-rcfu.onrender.com) │
│  Port: 3001 (auto-assigned by Render)                     │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────────┐
       │ SQLite   │ │ 10 ATS   │ │ 4 Tracker    │
       │ Database │ │ Adapters │ │ Discoveries  │
       │ (60MB)   │ │          │ │              │
       └──────────┘ └──────────┘ └──────────────┘
```

---

## Directory Structure

```
Meridian/
├── src/                          # Frontend (React SPA)
│   ├── components/
│   │   ├── applications/         # Application table, kanban, cards
│   │   ├── dashboard/            # Dashboard widgets, charts
│   │   ├── layout/               # AppShell (sidebar + header)
│   │   ├── sources/              # Source management UI
│   │   └── ui/                   # Reusable: ErrorBoundary, ConfirmDialog, etc.
│   ├── contexts/
│   │   └── AuthContext.tsx        # Auth provider (JWT + sessionStorage cache)
│   ├── constants/
│   │   └── index.ts              # Application statuses, programme types
│   ├── data/
│   │   └── demo.ts               # Demo data seed
│   ├── lib/
│   │   ├── auth.ts               # API auth calls (signup, login, logout, retry logic)
│   │   ├── db.ts                 # IndexedDB (Dexie) — per-user client DB
│   │   ├── jobSources.ts         # Frontend API URL resolution
│   │   └── store.ts              # Zustand global state (non-blocking hydration)
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── OpportunitiesPage.tsx  # Browse 6000+ finance jobs
│   │   ├── ApplicationsPage.tsx   # Track your applications
│   │   ├── CompaniesPage.tsx      # Company directory
│   │   ├── ContactsPage.tsx       # Networking contacts
│   │   ├── TasksPage.tsx          # Application tasks/reminders
│   │   ├── DocumentsPage.tsx      # CV, cover letters, transcripts
│   │   ├── CalendarPage.tsx       # Deadline calendar
│   │   ├── AnalyticsPage.tsx      # Stats and insights
│   │   ├── SourcesPage.tsx        # Job source management
│   │   ├── SettingsPage.tsx       # Account settings, data export
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   └── ResetPasswordPage.tsx
│   ├── App.tsx                   # Router + lazy loading + auth guards
│   └── main.tsx                  # Entry point
│
├── server/                       # Backend (Express API)
│   ├── index.js                  # Main server — routes, middleware, startup
│   ├── auth.js                   # JWT auth (signup, login, logout, /me)
│   ├── db.js                     # SQLite database (lazy-loaded, 60MB)
│   ├── email.js                  # Gmail SMTP for password resets
│   ├── sources/
│   │   ├── ats.js                # ATS adapter orchestrator
│   │   ├── scan.js               # Background scanning scheduler
│   │   ├── rss.js                # RSS feed parser
│   │   ├── registry.js           # 68 curated finance firms
│   │   ├── adzuna.js             # Adzuna API adapter
│   │   ├── jsearch.js            # JSearch/RapidAPI adapter
│   │   ├── adapter-health.js     # Adapter health tracking
│   │   ├── extractLanguages.js   # Language extraction from job text
│   │   ├── ats/                  # Individual ATS adapters
│   │   │   ├── greenhouse.js     # Greenhouse (Goldman, etc.)
│   │   │   ├── lever.js          # Lever
│   │   │   ├── ashby.js          # Ashby
│   │   │   ├── workday.js        # Workday (Deutsche Bank, etc.)
│   │   │   ├── smartrecruiters.js
│   │   │   ├── oleeo.js          # Oleeo/TalentCentral RSS
│   │   │   ├── oracle_hcm.js     # Oracle HCM (public API)
│   │   │   ├── avature.js        # Avature
│   │   │   ├── eightfold.js      # Eightfold (anti-bot protected)
│   │   │   └── successfactors.js # SuccessFactors
│   │   └── discovery/            # Source discovery pipeline
│   │       ├── store.js          # Discovery entry persistence
│   │       ├── index.js          # Discovery orchestrator
│   │       ├── discover.js       # Company source discovery
│   │       ├── resolve-ats.js    # ATS resolution for discoveries
│   │       ├── pipeline.js       # Full pipeline (discover → enumerate → match)
│   │       ├── matcher-v3.js     # Job matching (tracker ↔ direct)
│   │       ├── staleness.js      # Lifecycle tracking (open → stale → closed)
│   │       └── gold-set.js       # Evaluation gold standard
│   ├── data/                     # Server data (SQLite DB, RSS feeds)
│   └── package.json
│
├── .devcontainer/                # GitHub Codespaces config
│   └── devcontainer.json
├── render.yaml                   # Render deployment config (2 services)
├── vercel.json                   # Vercel config
├── ARCHITECTURE.md               # This file
├── package.json                  # Frontend dependencies
├── tsconfig.json
└── vite.config.ts
```

---

## How the Data Layer Works

### Per-User IndexedDB (Frontend)
- Each user gets their own IndexedDB database: `meridian-finance-tracker-{userId}`
- All data (applications, documents, contacts, tasks) stored locally in the browser
- Zustand store hydrates from IndexedDB on login
- No data leaves the browser except to call the backend API

### SQLite Database (Backend — 60MB)
- Single `meridian.db` file stores all job data
- **Lazy-loaded**: opens on first query, not at import time (server starts in <1s)
- **Schema fast-path**: skips CREATE TABLE + migrations if tables already exist
- Tables:
  - `canonical_jobs` — 6,299 unique finance job listings
  - `companies` — 370 companies with domains, career URLs
  - `company_sources` — ATS sources per company
  - `raw_job_observations` — Raw fetched job data
  - `job_source_observations` — Which source saw which job
  - `job_sightings` — Provenance tracking (which source reported a job)
  - `job_versions` — Change history for job listings
  - `source_health` — Adapter health metrics
  - `poll_schedule` — When to re-check each source
  - `discovery_queue` — Companies pending source discovery
  - `adapter_health` — Per-adapter health
  - `users` — User accounts (bcrypt hashed passwords)
  - `password_resets` — Password reset tokens
  - `kv_store` — Key-value store (RSS feeds, settings)
  - `pipeline_direct_jobs` — Cached direct job enumerations
  - `pipeline_source_discovery` — Cached source discoveries

---

## Authentication Flow (JWT)

### How It Works
1. **Signup**: Username + email + password → bcrypt hash → stored in SQLite → sign JWT → set httpOnly cookie
2. **Login**: Credentials → bcrypt.compare → sign JWT → set httpOnly cookie
3. **Auth check**: Frontend calls `GET /api/auth/me` → server verifies JWT signature (sub-millisecond, NO database lookup)
4. **Logout**: Clear httpOnly cookie → respond (no server call needed)
5. **Password reset**: Gmail SMTP sends reset link (requires `GMAIL_USER` + `GMAIL_APP_PASSWORD` env vars)

### JWT Details
- **Algorithm**: HS256
- **Expiry**: 7 days
- **Cookie**: `meridian_token`, httpOnly, secure (production), sameSite: none
- **Secret**: `JWT_SECRET` env var (falls back to `SESSION_SECRET`)
- **No server-side state**: JWT is self-contained. Server never stores sessions. Cold starts don't break auth.

### Why JWT Over Sessions
| Aspect | Sessions (old) | JWT (current) |
|--------|---------------|---------------|
| Auth check speed | 10-50s (open DB + query) | <1ms (verify signature) |
| Cold start impact | Auth broken until DB opens | Auth works instantly |
| Server state | SQLite session store | None (stateless) |
| Scalability | Single-server only | Multi-server ready |

### Frontend Auth Flow
```
Page load → sessionStorage cache? → YES → show app instantly
                                → NO  → show login form instantly
                                       ↳ background: getCurrentUser() checks server
Login → POST /api/auth/login → set cookie + cache user → navigate to /app
```

---

## Job Ingestion Pipeline

### Three-Tier Architecture

```
Tier 1: Direct ATS Adapters (highest priority)
  → Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Oleeo, Oracle HCM
  → Fetches directly from company career pages
  → Returns structured job data

Tier 2: Tracker Discovery
  → AnalystClass, Fyntraq, Trackr, LandTheOffer
  → Scrapes finance job tracker aggregators
  → Used when no direct ATS source exists

Tier 3: Fallback (RSS + search APIs)
  → RSS feeds, Adzuna, JSearch
  → Used for companies without ATS adapters
```

### Canonical Job Model

Every unique job listing is stored ONCE in `canonical_jobs`, regardless of how many sources report it. Each source report is a "sighting" in `job_sightings`. This prevents duplicates and tracks provenance.

```
canonical_job (1) ←── sightings (N)
                  ←── observations (N)
                  ←── versions (N)
```

### Background Pipeline

1. **Tracker discovery** (`runDiscovery`) — Scrape tracker sites for new listings
2. **Firm source discovery** (`discoverFirmSources`) — Find ATS endpoints for each firm
3. **Job enumeration** (`enumerateDirectJobs`) — Fetch jobs from discovered ATS sources
4. **Matching** (`matchTrackerToDirect`) — Match tracker entries to direct ATS listings
5. **Staleness** (`applyStalenessTransitions`) — Mark jobs as stale/closed if not seen

Runs on cron (every 4h/8h depending on adapter health). **NOT on startup** — to avoid starving auth endpoints on Render free tier.

---

## Supported ATS Adapters (10)

| Adapter | Auth Required | Example Firms |
|---------|:------------:|---------------|
| Greenhouse | No | Goldman Sachs, Point72, Bridgewater |
| Lever | No | Various mid-market |
| Ashby | No | Modern tech firms |
| Workday | No | Deutsche Bank, UBS |
| SmartRecruiters | No | Various |
| Oleeo RSS | No | UK banks (Barclays, HSBC, Citi) |
| Oracle HCM | No | Public API (dynamic site numbers) |
| Avature | No | Some European banks |
| Eightfold | Anti-bot | May fail on server |
| SuccessFactors | Partial | Some firms (URLs may 404) |

---

## 68 Curated Finance Firms

Bulge brackets: Goldman Sachs, JPMorgan, Morgan Stanley, Bank of America, Citi, Barclays, HSBC, Deutsche Bank, UBS, Credit Suisse, Nomura

Elite boutiques: Evercore, Lazard, Rothschild, Moelis, Perella Weinberg, Centerview, PJT Partners, Greenhill

Private equity: Blackstone, KKR, Apollo, Carlyle, Bridgepoint, EQT, CVC, Advent, Warburg Pincus

Asset management: BlackRock, Fidelity, Vanguard, PIMCO, Man Group, Baillie Gifford

DACH boutiques: Wyser, ACXIT, Goetzpartners, Rust & Partners, SPP, Lang & Partner, Gürzenich, Bock Halm

---

## Deployment

### Production
- **Frontend**: Vercel → `https://meridian-finance-six.vercel.app`
- **Backend**: Render Free Tier → `https://meridian-rcfu.onrender.com`
- **Database**: Render disk mount at `/opt/render/project/src/server/data` (1GB, persistent)

### Cloud Development (Oracle Cloud Free VM)
- **OpenCode Server** (`/`): served via Tailscale Serve at `https://meridian-vnic.taild0a901.ts.net` (tailnet-only) - proxies to `127.0.0.1:4096` on the VM
- **JARVIS OpenCode** (`/jarvis`): same Tailscale host - proxies to `127.0.0.1:4097`
- **Backend API**: runs on the Oracle VM at `:3001`, reachable over Tailscale
- **Mobile app**: connect via Tailscale (OpenCode apps reach the host above); access is enforced by Tailscale identity - no static server password
- **Services**: systemd (`opencode.service`, `jarvis-opencode.service`) — survive reboots

### Staging
- **Frontend**: Vercel Preview
- **Backend**: Render Free Tier → `https://meridian-staging-oyfk.onrender.com`
- **Database**: Separate Render disk (isolated from production)

### Render Free Tier Constraints
- 512MB RAM, 0.1 CPU
- Spins down after 15 minutes idle
- Cold start: ~20-30s (container spin-up only — our code responds in <1s)
- Startup pipeline DISABLED to avoid starving auth endpoints
- Memory monitoring + forced GC at 400MB heap

### Keep-Alive (cron-job.org)
- Pings `https://meridian-rcfu.onrender.com/api/health` every 10 minutes
- Prevents Render from sleeping
- Uses ~745 hours/month of 750 free hours

---

## Environment Variables

Secret values are never committed to this repository. They live only in the platform dashboards and in a root-protected environment file on the Oracle VM. Templates in `.env.example` and `server/.env.example` contain placeholders only.

### Backend (Render Dashboard) - production
- `NODE_ENV=production` (declared in `render.yaml`)
- `SESSION_SECRET` - generated by Render at service creation (`generateValue: true` in `render.yaml`)
- `JWT_SECRET` - optional override; signing falls back to `SESSION_SECRET` when unset
- `FRONTEND_URL` - set in the Render dashboard
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` - sender credentials for password-reset email; set in the Render dashboard

### Backend (Oracle Cloud VM) - secondary
- Secrets are read from a root-owned environment file (e.g. `/etc/meridian/backend.env`, mode 0600) via `EnvironmentFile=` on the backend service.
- `JWT_SECRET` - required; the server refuses to start without it
- `SESSION_SECRET` - legacy fallback for `JWT_SECRET`
- `FRONTEND_URL` - set as needed
- `PORT` - defaults to `3001`

### Frontend (Vercel Dashboard)
- `VITE_API_BASE` - backend base URL (the Render service URL in production)

---

## Performance Optimizations

### Backend
1. **JWT auth**: `/api/auth/me` responds in <1ms (no DB lookup)
2. **Lazy database init**: SQLite opens on first query, not at import time
3. **Schema fast-path**: Skips CREATE TABLE + migrations if tables exist
4. **Lazy module loading**: Heavy modules loaded via `await import()` on first route hit
5. **Startup pipeline disabled**: Cron handles data ingestion (avoids starving auth on cold start)
6. **Batch sighting loading**: `getActiveSightingsForJobs()` eliminates N+1 queries
7. **SQLite WAL mode**: Better concurrent read performance
8. **NodeCache with cap**: In-memory cache for API responses (maxKeys=50)
9. **Memory monitoring**: Logs every 5 min, forced GC at 400MB heap

### Frontend
10. **sessionStorage auth cache**: Instant user restore on page reload
11. **Non-blocking hydration**: Tags load instantly, full data loads in background
12. **AppShell renders immediately**: No `hydrated` gate
13. **Lazy page imports**: React.lazy() for all routes except Dashboard
14. **Login/signup auto-retry**: 3 attempts with backoff for cold starts
15. **Instant signout**: Clear local state immediately, fire server call in background

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| JWT over sessions | Auth check <1ms, no DB dependency, survives cold starts |
| SQLite over PostgreSQL | Single-file simplicity, no external deps, fits Render free tier |
| Dexie over raw IndexedDB | Type-safe, reactive queries, per-user DB isolation |
| Zustand over Redux | Minimal boilerplate, works great with Dexie |
| Lazy loading everything | Server starts in <1s despite 60MB DB + 20+ modules |
| Canonical job model | One record per real-world opening, no duplicates, full provenance |
| bcrypt 12 rounds | Industry standard password hashing |
| Oracle Cloud free VM | Always-on opencode server, no laptop dependency |
| cron-job.org keep-alive | Prevents Render free tier from sleeping |
| Free tier for both envs | User declined paid hosting; acceptable trade-offs |

---

## GitHub

- **Repo**: `https://github.com/KENo548/meridian` (private)
- **Branches**: `main` (production), `staging` (staging)
- **Codespaces**: `.devcontainer/devcontainer.json` configured
- **Auto-deploy**: Push to `main` → Vercel (frontend) + Render (backend) auto-deploy

---

## Git Commits (Recent)

| Commit | Description |
|--------|-------------|
| `a3a4e3f` | chore: add GitHub Codespaces config for mobile dev |
| `e2ea6d1` | feat: JWT auth replaces server sessions |
| `15856cd` | fix: instant login + instant signout |
| `1a5b7c9` | perf: disable startup pipeline + skip schema re-init |
| `6dead11` | fix: cold-start login retry with warming-up UX |
| `1b7ad26` | perf: non-blocking auth, instant login, background hydration |
| `9d02407` | perf: cold-start lazy loading optimization |
