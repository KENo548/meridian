# Meridian

**A finance recruiting command centre.** Meridian discovers and verifies finance openings (Spring Weeks, internships, graduate roles in IB, PE, AM, S&T and quant) and gives you one place to track every application from discovery to offer.

**Live demo:** https://meridian-finance-six.vercel.app
The backend runs on a free tier and sleeps when idle, so the first request can take 20–30 seconds.

> Meridian is a standalone project. It is not part of [JARVIS / SAGE](https://github.com/KENo548/SAGE).

## Why I built it

Finance recruiting is scattered across bank career portals, aggregator sites and spreadsheets, and listings go stale without warning. I built Meridian to answer two questions in one place: *what is genuinely open right now?* and *where does each of my applications stand?*

## What it does

**Opportunity discovery**
- Pulls listings from bank applicant-tracking systems (ATS) directly, with 10 adapters: Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Oleeo, Oracle HCM, Avature, Eightfold and SuccessFactors.
- Falls back to finance job-tracker aggregators and RSS/search APIs only where no direct source exists.
- Matches tracker listings against direct ATS postings so each opening is verified against the firm's own system.
- Stores each real-world opening once (a *canonical job*), with a record of every source that reported it and every change to it.
- Marks listings stale and then closed when sources stop reporting them.

**Application tracker**
- Table, Kanban, Calendar and Timeline views
- Requirements checklist per application (CV, transcript, online assessment, HireVue, etc.)
- Documents, contacts, tasks and reminders
- Filters, saved views, bulk actions, CSV import/export
- Per-user data kept in your browser (IndexedDB)

## How the pipeline works

```
Tier 1  Direct ATS adapters      -> highest priority, structured data from career systems
Tier 2  Tracker discovery        -> used when no direct source exists
Tier 3  RSS + search APIs        -> last-resort fallback

discover sources -> enumerate jobs -> match tracker to direct -> staleness transitions
(runs on a schedule; cadence depends on adapter health)
```

Full detail, schema and deployment notes are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Zustand, Dexie (IndexedDB) |
| Backend | Node.js, Express, better-sqlite3, JWT auth in an httpOnly cookie, bcrypt |
| Hosting | Vercel (frontend), Render (backend) |

## Run it locally

Requires Node.js 18+.

```bash
# Frontend (http://localhost:5173)
npm install
npm run dev

# Backend (http://localhost:3001), in a second terminal
cd server
npm install
npm run dev
```

Copy `.env.example` (and `server/.env.example`) and fill in the values. Set `JWT_SECRET`; never commit real secrets. Sign up in the app, then use **Settings → Load demo sample data** to see sample rows.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

## Design decisions

| Decision | Reason |
| --- | --- |
| JWT instead of server sessions | Session lookups required opening the database on cold start and made login take 10–50 seconds; JWT verification needs no database call |
| SQLite instead of PostgreSQL | Single-file simplicity that fits a 512 MB free tier |
| Canonical job model | One record per real opening, with full provenance, instead of duplicates |
| Pipeline off at startup, run on a schedule | Keeps authentication responsive on a constrained host |
| Gold-set evaluation for matching | Lets me measure matcher changes instead of guessing |

**What went wrong first:** on the free tier, cold starts left login unusable. I added retry logic, stopped the ingestion pipeline from running at startup, and replaced sessions with JWT. The full history is in the commit log.

## Known limitations

- Eightfold is anti-bot protected and may fail from a server; some SuccessFactors URLs return 404.
- The free-tier backend sleeps when idle (a keep-alive ping reduces this).
- Tier 2 reads public aggregator sites; review each source's terms before running it at scale.
- So far it has been used mainly by me. Feedback from other applicants is welcome via Issues.
