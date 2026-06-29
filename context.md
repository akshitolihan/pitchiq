# Pitch IQ Context Log

This file records development and recovery context so the project can be restored from GitHub if the local machine is lost, formatted, or reset.

## 2026-06-29 - Restore After System Format

- Restored repository from GitHub: `akshitolihan/pitchiq`.
- Local project path: `C:\Users\kumak\Documents\Codex\2026-06-29\we\pitchiq`.
- Normal system `git`, `python`, and Node tooling were missing after the format, so Codex bundled runtimes were used.
- Created local environment files from examples:
  - `.env`
  - `.env.local`
  - `frontend/.env.local`
- Installed root Next.js dependencies using bundled `pnpm`.
- Created a Python virtual environment at `.venv`.
- Installed backend dependencies from `requirements.txt`.
- Seeded the local SQLite database with:
  - `380` historical matches
  - `10` upcoming fixtures
  - `20` fitted teams
  - `10` generated predictions
- Started FastAPI backend on `http://127.0.0.1:8000`.
- Started Next.js frontend on `http://127.0.0.1:3000`.
- Verified backend health endpoint returned `200 OK`.
- Verified frontend home page returned `200 OK`.
- Ran backend tests: `23 passed`.
- Ran Next.js production build successfully.

## Standing Process

For future work, every meaningful app update should be recorded in this file and pushed to GitHub so the latest project state is recoverable.

## 2026-06-29 - Fix Missing Matches In App

- Investigated why the running Next.js app showed no matches on `http://127.0.0.1:3000`.
- Confirmed the FastAPI backend had seeded fixtures available at `http://127.0.0.1:8000/api/fixtures`.
- Found the visible app was reading `/api/odds/football`, which returned no matches when `ODDS_API_KEY` was not configured.
- Added a local fallback in `src/app/api/odds/football/route.ts` that maps seeded Pitch IQ fixtures into the match shape used by the UI.
- Converted local model probabilities into decimal odds for the existing prediction and betting-card components.
- Fixed `src/app/matches/page.tsx` so it reads `data.matches` from `/api/odds/football`.
- Added an immediate empty response in `src/app/api/odds/tennis/route.ts` when `ODDS_API_KEY` is missing so the home page does not stay stuck loading.
- Updated `src/app/page.tsx` to server-render the home dashboard and read seeded football fixtures directly from the FastAPI backend, so matches appear in the initial page render without waiting on browser-side market fetches.
- Restarted the FastAPI backend after finding port `8000` was held by a stale process; verified the home page renders Arsenal/Liverpool fixtures and `10 matches analysed`.
