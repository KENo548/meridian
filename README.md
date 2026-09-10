# Meridian

**Finance recruiting command centre** for Spring Weeks, summer internships, and graduate roles.

Built for students tracking Investment Banking, PE, Markets, and related applications — especially useful if you are at **Frankfurt School of Finance** and targeting London / Frankfurt / Europe.

This project is **standalone**. It is not part of JARVIS.

## What it does

- Track every application from discovery → apply → interviews → offer/rejection
- Requirements checklist (CV, transcript, OA, HireVue, etc.)
- Documents, contacts, tasks, and reminders
- Dashboard stats that update instantly (no refresh)
- Table, Kanban, Calendar, and Timeline views
- Filters, saved views, bulk actions, CSV import/export
- Data stored locally in your browser (IndexedDB) — private to this computer

## How to open it (Windows, step by step)

### 1. Open a terminal in the Meridian folder

1. Press `Windows` key, type **PowerShell**, open **Windows PowerShell**.
2. Copy and paste this, then press Enter:

```powershell
cd $env:USERPROFILE\Documents\Meridian
```

You should see the prompt end with `...\Documents\Meridian`.

### 2. Install dependencies (first time only)

```powershell
npm install
```

Success looks like: it finishes without red errors, and a `node_modules` folder exists.

### 3. Start the app

```powershell
npm run dev
```

Success looks like: a message such as `Local: http://localhost:5173/`

### 4. Open it in your browser

1. Hold `Ctrl` and click the `http://localhost:5173/` link, **or**
2. Open Chrome/Edge and go to: `http://localhost:5173`

You should see the Meridian dashboard with a gold “M” logo and the empty-state message, or your applications if you already added some.

### 5. Optional: load sample data

1. Click **Settings** in the left sidebar.
2. Click **Load demo sample data**.
3. Sample Goldman Sachs / Deutsche Bank / Rothschild / JPM rows appear, clearly marked as DEMO.

## Project location

```
C:\Users\Admin\Documents\Meridian
```

## Tech notes

- Vite + React + TypeScript
- Tailwind CSS
- Zustand + Dexie (IndexedDB)
- No account required for the local MVP

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Start local development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
