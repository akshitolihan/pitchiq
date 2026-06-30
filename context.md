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

## 2026-06-29 - Remove Demo Fixtures From Live App

- User flagged that the matches shown in the app were dummy/demo data.
- Removed the seeded FastAPI fixture fallback from `src/app/api/odds/football/route.ts`.
- Updated `src/app/page.tsx` so the dashboard reads only the live odds route, not seeded local fixtures.
- Added `ODDS_API_KEY` to `.env.example`; without this key, the app now shows an empty real-data state instead of sample fixtures.
- Kept the seeded backend data available only for local model/backend testing.

## 2026-06-29 - Pivot To MVP Demo Mode

- User decided to continue with dummy data for now and build a working MVP around it.
- Restored the seeded fixture fallback in `src/app/api/odds/football/route.ts`, but made it explicit with `source: demo-fixtures`, `demo: true`, competition label `Premier League Demo`, and bookmaker label `Demo model data`.
- Kept `ODDS_API_KEY` support for future live market data; when configured, the app still uses live odds first.
- Added demo-mode banners/labels to the dashboard, Matches page, Betting page, and football match detail page.
- MVP target now: seeded football fixtures, model-derived odds, prediction cards, match detail markets, virtual wallet, and bet slip should work end-to-end.
- Switched the dashboard back to client-side loading from `/api/odds/football` to avoid a Next server-render runtime issue during local MVP testing.
- Verified `next build`, TypeScript, `/api/odds/football`, `/`, and `/betting/football/381` all respond successfully.

## 2026-06-30 - Prevent Mutually Exclusive Betslip Picks

- Added betslip compatibility checks in `src/contexts/BetSlipContext.tsx`.
- Selecting a mutually exclusive pick for the same match now replaces the conflicting existing pick instead of allowing both in the slip.
- Covered MVP football/tennis markets including 1X2, Match Winner, Draw No Bet, BTTS, Over/Under, Correct Score, Total Sets, and result-set conflicts between 1X2/Double Chance/DNB.
- Existing saved betslip selections are cleaned when loaded from local storage.

## 2026-06-30 - Start Match Plan Repositioning

- Repositioned the core betslip workflow into a Match Plan workflow for analysis and planning.
- Added persisted per-selection planning metadata in `src/contexts/BetSlipContext.tsx`: status and notes.
- Added Match Plan statuses: Watching, Strong interest, Avoid, and Review later.
- Added note fields to Match Plan items on the main Plan page so users can document lineup dependencies, risk, and model disagreement.
- Changed the main Plan panel save action to persist locally instead of placing/clearing a virtual bet.
- Updated global drawer, mobile nav, sidebar labels, and metadata language toward analysis/planning/simulation terminology.

## 2026-06-30 - Add Dedicated Planner Page

- Added `/planner` as a dedicated future match planning dashboard.
- Planner reads the saved Match Plan selections from local storage and shows totals by status: Watching, Strong interest, Review later, and Avoid.
- Planner supports filtering by status, grouping saved selections by kickoff date when available, editing per-match notes, changing status, removing individual selections, and clearing the plan.
- Extended `BetSelection` with optional `commenceTime` and `competition` fields so newly saved selections can appear with planning context.
- Updated main football and tennis market cards to attach kickoff time and competition/tournament to saved selections.
- Updated desktop sidebar and mobile bottom navigation so `/planner` is reachable as the planning surface, while `/betting` is labeled as Markets.
- Verified TypeScript, production build, backend health, frontend `/planner`, and in-app browser rendering on `http://127.0.0.1:3000/planner`.

## 2026-06-30 - Improve Planner Workspace

- Added planner intelligence cards for next review, priority watchlist, review-needed count, and due-soon count.
- Added search across match title, market, outcome, competition, note, and status.
- Added sort controls for kickoff, status, and model odds.
- Added a review-needed filter that highlights planned items missing notes.
- Added CSV export for saved Match Plan selections, including kickoff, market, outcome, model odds, status, and notes.
- Rebuilt and restarted the Next.js frontend on `http://127.0.0.1:3000`.
- Verified TypeScript, production build, `/planner` HTTP response, and in-app browser rendering of the new planner controls.

## 2026-06-30 - Add Insights Workspace

- Added `/insights` as a premium-style analysis workspace for ranked model recommendations.
- Insights aggregates football and tennis market feeds, computes confidence tiers, risk/context tags, model odds, and recommended outcomes.
- Added sport filters and confidence-tier filters for Strong, Moderate, and Competitive insights.
- Added summary metrics for analysed matches, strong insights, moderate insights, and average confidence.
- Added one-click `Add to plan` actions that reuse the existing Match Plan state and mutual-exclusion protection.
- Added `Open report` links to the existing match detail analysis pages.
- Added Insights to the desktop sidebar and mobile bottom navigation.
- Rebuilt and restarted the Next.js frontend on `http://127.0.0.1:3000`.
- Verified TypeScript, production build, `/insights` HTTP response, and in-app browser rendering of the new Insights controls.

## 2026-07-01 - Add Strategy Lab

- Added `/lab` as a Strategy Lab workspace for turning saved Match Plan items into review scenarios.
- Added scenario presets: Focused, Balanced, Exploratory, and Custom.
- Added scenario readiness scoring based on model probability, note coverage, plan status weighting, and review-time budget.
- Added review workload controls, selected-item counts, average model probability, note coverage, missing-note count, high-variance count, and due-within-24-hours count.
- Added saved-plan item cards with custom scenario inclusion controls.
- Added a review checklist that highlights missing notes and high-variance analysis items.
- Added quick links from Lab to Insights and Planner.
- Added Lab to the desktop sidebar and mobile bottom navigation.
- Rebuilt and restarted the Next.js frontend on `http://127.0.0.1:3000`.
- Verified TypeScript, production build, `/lab` HTTP response, and in-app browser rendering of the new Lab controls.

## 2026-07-01 - Add Saved Analysis History

- Added local saved analysis session storage under `pitchiq_analysis_sessions`.
- Added reusable session helpers in `src/lib/analysis-sessions.ts`.
- Added a full-plan restore action in `src/contexts/BetSlipContext.tsx` so saved sessions can replace the active Match Plan.
- Added Save Analysis Session controls to `/planner` with session name, label, and save confirmation.
- Added `/history` as a saved analysis page with session search, label filtering, summary metrics, session cards, delete, and restore-to-planner.
- Added History to the desktop sidebar and linked it from Planner.
- Rebuilt and restarted the Next.js frontend on `http://127.0.0.1:3000`.
- Verified TypeScript, production build, `/planner` and `/history` HTTP responses, and in-app browser rendering of History and Planner save controls.

## 2026-07-01 - Add Review Alerts

- Added `/alerts` as a review queue for planned analysis items.
- Alerts classifies active Match Plan items as urgent, due today, missing note, past kickoff, or scheduled.
- Added summary metrics for active plan items, urgent reviews, due-today items, missing notes, and past-kickoff items.
- Added alert filters and per-item note editing, status changes, and removal from the active plan.
- Added quick links from Alerts to Planner and History.
- Added Alerts to the desktop sidebar.
- Rebuilt and restarted the Next.js frontend on `http://127.0.0.1:3000`.
- Verified TypeScript, production build, `/alerts` HTTP response, and in-app browser rendering of the Alerts queue.
