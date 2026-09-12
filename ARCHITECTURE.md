# Meridian — Architecture & How It Works

**Finance recruiting command centre** for Spring Weeks, summer internships, and graduate roles. Built for students targeting IB, PE, AM, S&T, and quant roles — especially Frankfurt School / Europe.

---

## Quick Start

```powershell
# Frontend (Vite dev server on :5173)
cd C:\Users\Admin\Documents\Meridian
npm install
npm run dev

# Backend (Express API on :3001) — separate terminal
cd C:\Users\Admin\Documents\Meridian\server
npm install
npm run dev
```

Open `http://localhost:5173` — sign up, then start tracking applications.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (SPA)                     │
│  React 19 + Vite 8 + TypeScript + Tailwind CSS 4    │
│  Zustand (state) + Dexie (IndexedDB per-user DB)     │
│                                                       │
│  Deployed: Vercel (Production: meridian-finance-six)  │
└──────────────────────┬──────────────────────────────┘
                       │ fetch() with credentials
                       ▼
┌─────────────────────────────────────────────────────┐
│                  BACKEND (Express)                    │
│  Node.js + Express + better-sqlite3 + bcrypt         │
│  Session auth (express-session + SQLite store)        │
│                                                       │
│  Deployed: Render (meridian-rcfu.onrender.com)        │
│  Port: 3001 (auto-assigned by Render)                 │
└──────────────────────┬──────────────────────────────┘
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
│   │   └── AuthContext.tsx        # Auth provider (login state, session)
│   ├── constants/
│   │   └── index.ts              # Application statuses, programme types
│   ├── data/
│   │   └── sampleData.ts         # Demo data for onboarding
│   ├── lib/
│   │   ├── auth.ts               # API auth calls (signup, login, logout)
│   │   ├── db.ts                 # IndexedDB (Dexie) — per-user client DB
│   │   ├── jobSources.ts         # Frontend API URL resolution
│   │   └── store.ts              # Zustand global state
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
│   ├── auth.js                   # Auth routes (signup, login, forgot password)
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
├── render.yaml                   # Render deployment config (2 services)
├── vercel.json                   # Vercel config
├── package.json                  # Frontend dependencies
├── tsconfig.json
├── tailwind.config.ts
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

## Authentication Flow

1. **Signup**: Username + email + password → bcrypt hash → stored in SQLite
2. **Login**: Credentials → bcrypt.compare → express-session cookie (`meridian.sid`)
3. **Session**: httpOnly cookie, 7-day expiry, SQLite-backed session store
4. **Auth check**: Frontend calls `GET /api/auth/me` on mount (8s timeout)
5. **Password reset**: Gmail SMTP sends reset link (requires `GMAIL_USER` + `GMAIL_APP_PASSWORD` env vars)

**Session lifecycle**: Sessions are invalidated on every server restart/deploy (`sessionStore.clearAll()`). Users must re-login after deploys. Application data (jobs, companies, discoveries) persists across restarts.

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

Runs on startup + cron (every 15min/1h/4h/8h depending on adapter health).

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

### Staging
- **Frontend**: Vercel Preview → `https://meridian-finance-f9bsi5yk3-keno548s-projects.vercel.app`
- **Backend**: Render Free Tier → `https://meridian-staging-oyfk.onrender.com`
- **Database**: Separate Render disk (isolated from production)

### Render Free Tier Constraints
- 512MB RAM, 0.1 CPU
- Spins down after 15 minutes idle
- Cold start: ~20-30s (container) + <1s (our code, thanks to lazy loading)
- Memory monitoring + forced GC at 400MB heap

---

## Environment Variables

### Backend (Render Dashboard)
```
NODE_ENV=production|staging
SESSION_SECRET=<auto-generated>
FRONTEND_URL=https://meridian-finance-six.vercel.app
GMAIL_USER=<your-gmail>
GMAIL_APP_PASSWORD=<your-app-password>
```

### Frontend (Vercel Dashboard)
```
VITE_API_BASE=https://meridian-rcfu.onrender.com  (production)
VITE_API_BASE=https://meridian-staging-oyfk.onrender.com  (staging/preview)
```

---

## Performance Optimizations

1. **Lazy database init**: SQLite opens on first query, not at import time
2. **Lazy module loading**: Heavy modules (ATS adapters, discovery pipeline) loaded via `await import()` on first route hit
3. **Batch sighting loading**: `getActiveSightingsForJobs()` eliminates N+1 queries on opportunities endpoint
4. **SQLite WAL mode**: Better concurrent read performance
5. **NodeCache with cap**: In-memory cache for API responses (maxKeys=50)
6. **8-second auth timeout**: Frontend auth check aborts after 8s, shows login page immediately
7. **Session invalidation on boot**: Clean ephemeral sessions, persistent application data
8. **Memory monitoring**: Logs every 5 min, forced GC at 400MB heap

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| SQLite over PostgreSQL | Single-file simplicity, no external deps, fits Render free tier |
| Express-session over JWT | Simpler, httpOnly cookies, server-controlled expiry |
| Dexie over raw IndexedDB | Type-safe, reactive queries, per-user DB isolation |
| Zustand over Redux | Minimal boilerplate, works great with Dexie |
| Lazy loading everything | Server starts in <1s despite 60MB DB + 20+ modules |
| Canonical job model | One record per real-world opening, no duplicates, full provenance |
| bcrypt 12 rounds | Industry standard password hashing |
| Free tier for both envs | User declined paid hosting; acceptable trade-offs |

---

## GitHub

- **Repo**: `https://github.com/KENo548/meridian` (private)
- **Branches**: `main` (production), `staging` (staging)
- **Latest commit**: `9d02407`
