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

## 2026-07-01 - Enhance Match Reports

- Upgraded football and tennis match detail pages into richer analysis reports.
- Added report summary blocks with model recommendation, confidence context, separation/risk explanation, and risk flags.
- Added planning action panels so the recommended outcome can be marked Strong interest or Review later directly from the report.
- Added pre-match review checklists for football and tennis contexts.
- Updated detail-page market selections to carry kickoff time and competition/tournament metadata into Planner, Alerts, Lab, and History.
- Rebuilt and restarted the Next.js frontend on `http://127.0.0.1:3000`.
- Verified TypeScript, production build, football report HTTP response, and in-app browser rendering of the enhanced report controls.

## 2026-07-01 - Add Premium Access Mode

- Added local subscription state under `pitchiq_subscription` with Free Preview and Pro Analysis modes.
- Wrapped the app in a subscription provider so paid feature gates can be reused across pages.
- Added `/account` as an MVP access and billing page with plan cards, local plan switching, and commercial positioning notes.
- Added Account to the desktop sidebar and surfaced the current access mode in the sidebar footer.
- Added the first paid feature gate to `/insights`: Free Preview shows the top 3 filtered insights, while Pro Analysis unlocks the full ranked board.
- Kept the language focused on analysis, planning, confidence, and review workflows rather than positioning the app as a betting product.

## 2026-07-01 - Connect Existing Vercel Project

- Found the existing Vercel project `pitchiq` at `https://pitchiq-eta.vercel.app`.
- Connected the Vercel project to the GitHub repository `akshitolihan/pitchiq`.
- Production deployment should now be triggered by future pushes to the `main` branch.

## 2026-07-01 - Add Pro Export Center

- Added `/exports` as a Pro-oriented report export workspace for active plans and the latest saved analysis session.
- Added Markdown and CSV export formats with match context, status, model odds, risk context, and review notes.
- Added Free Preview export limits: free users can export the first 3 planned items, while Pro Analysis unlocks complete exports.
- Added Export Center links from Planner and the desktop sidebar.
- Kept export language focused on analysis reports, planning notes, and review workflows.

## 2026-07-01 - Add Daily Edge Brief

- Added `/daily` as a Daily Edge Brief section for daily or next-available analysis suggestions.
- Added user requirement controls for simulated target, unit size, and risk profile: Steady, Balanced, and Ambitious.
- Daily ideas are ranked from football and tennis market feeds using model confidence, separation, odds, and slate timing.
- Each daily idea includes market, model view, confidence, risk level, uniqueness note, rationale bullets, deep-analysis link, and add-to-plan action.
- Free Preview shows up to 2 ideas while Pro Analysis unlocks the full daily shortlist for the selected requirement profile.
- Added Daily to desktop sidebar and mobile bottom navigation.

## 2026-07-02 - Start Supabase Auth And Database Foundation

- Added `@supabase/supabase-js` as the client auth/database dependency.
- Added a guarded Supabase browser client that keeps the app in local MVP mode when Supabase env vars are blank.
- Added an Auth provider with sign in, sign up, sign out, profile loading, and subscription-plan sync helpers.
- Wrapped the app in the Auth provider and connected Subscription state to the Supabase profile plan when a user is signed in.
- Updated `/account` with an Account Identity panel for Supabase sign-in/sign-up and plan sync.
- Added `supabase/schema.sql` with profiles, planner items, analysis sessions, alert rules, RLS policies, and new-user profile creation trigger.
- Added Supabase env placeholders to `.env.example` and `.env.local.example`.

## 2026-07-02 - Connect Supabase Project To Vercel

- Created the Supabase project `pitchiq` inside the `hindu-marketplace` organization.
- Applied `supabase/schema.sql` to the hosted Supabase database and verified the `profiles`, `planner_items`, `analysis_sessions`, and `alert_rules` tables exist.
- Added the Supabase project URL and browser publishable key to the existing Vercel `pitchiq` project as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Kept secret database credentials out of the repository and used Vercel environment variables for deployment configuration.

## 2026-07-02 - Add Supabase Planner And History Sync

- Added cloud load/save support for the active Planner using the Supabase `planner_items` table while keeping local storage as an offline fallback.
- Added Planner sync status messaging for local, loading, saving, synced, and error states.
- Added cloud save support for saved analysis sessions from Planner using the Supabase `analysis_sessions` table.
- Updated History to merge cloud sessions with local sessions for signed-in users and delete sessions from Supabase when possible.
- Verified the Next.js production build after the Supabase sync changes.

## 2026-07-02 - Verify Supabase Signed-In Sync Flow

- Disabled required Supabase email confirmation for the MVP so new users can sign in immediately after account creation.
- Created temporary Supabase Auth smoke-test users from the dashboard and verified the Pitch IQ account page showed `Synced account`.
- Seeded temporary Planner and History records through a signed-in Supabase session and verified live `/planner` loaded `Cloud planner sync` with the cloud item.
- Verified live `/history` loaded `Cloud history synced` with the cloud session.
- Edited a Planner note in the live UI and confirmed the change saved back to the Supabase `planner_items` table.
- Removed the temporary Planner/History smoke records and deleted the temporary Supabase Auth users after verification.

## 2026-07-02 - Add Supabase Review Reminder Rules

- Added saved review reminders to `/alerts` so each planned item can store no reminder, kickoff, 30m, 1h, 3h, or 24h before kickoff.
- Added local reminder storage as the offline fallback and Supabase `alert_rules` load/save support for signed-in users.
- Added Alerts sync status messaging for local reminders, cloud loading, saving, synced, and sync failure states.
- Added active-reminder counts scoped to the current Planner items.
- Verified the Next.js production build after the Alerts reminder changes.

## 2026-07-02 - Add Cloud Account Dashboard

- Added a workspace summary section to `/account` with planned items, saved sessions, active reminders, access mode, sync health, and last activity.
- Added quick links from Account to Planner, History, Alerts, and Exports so signed-in users can move through the synced workflow faster.
- Added a reusable account stats helper that reads Supabase counts and latest update timestamps for `planner_items`, `analysis_sessions`, and `alert_rules`.
- Kept local browser storage as the fallback summary when the user is signed out or cloud stats are unavailable.
- Verified the Next.js production build after the Account dashboard changes.

## 2026-07-02 - Add Match Journal Research Notes

- Added `/journal` as a structured research-note workspace for planned matches.
- Added journal fields for model view, team news/context, risk flags, final review, and a confidence score.
- Added local journal storage for signed-out users and Supabase sync for signed-in users using `alert_rules` records with `rule_type = 'journal'`.
- Added Journal to the desktop sidebar, Account quick links, and each Planner item card.
- Verified the Next.js production build after the Journal changes.

## 2026-07-02 - Add Journal Report Exports

- Added reusable journal export builders for Markdown and CSV reports.
- Added Journal report controls to `/journal` with current-match and all-planned-journals scopes.
- Added Free Preview limits for journal exports and Pro Analysis full-detail exports.
- Added a Journal Reports section to `/exports` that links users into the research-note export workflow.
- Verified the Next.js production build after the journal export changes.

## 2026-07-04 - Add Journal Research Templates

- Added guided research templates inside `/journal` for repeatable match analysis.
- Added Free Preview starter templates for football pre-match review and risk audit.
- Added Pro Analysis templates for tennis pre-match review, high-confidence shortlist, and final review.
- Added one-click template application that fills model view, team news/context, risk flags, final review, and confidence score for the selected planned match.
- Verified the Next.js production build after the Journal template changes.

## 2026-07-04 - Add Saved Research Library

- Added `/library` as a searchable archive for saved Match Journal records.
- Added filters for sport, completion status, and confidence band so users can review stronger or unfinished research faster.
- Added journal cards with completion score, confidence score, match metadata, updated time, research snippets, and quick links back to Journal and Exports.
- Added Free Preview library limits while Pro Analysis unlocks the full saved research archive.
- Loaded local journals for signed-out users and merged Supabase journal records for signed-in users through existing `alert_rules` journal storage.
- Added Library links to the desktop sidebar, Journal page, and Account dashboard.
- Verified the Next.js production build after the Library changes.

## 2026-07-04 - Prepare Real Live Data Provider Integration

- Standardized football and tennis odds routes around The Odds API as the first real live market-data provider.
- Added provider metadata to `/api/odds/football` and `/api/odds/tennis` so the app can distinguish live odds, missing API keys, quota status, and demo fallback.
- Added configurable odds regions through `ODDS_API_REGIONS` and optional football sport-key overrides through `ODDS_API_FOOTBALL_SPORTS`.
- Hardened `/api/live-scores` so football-data.org live scores report missing `FOOTBALL_DATA_API_KEY` clearly instead of silently failing.
- Added `/api/data-sources` as a safe diagnostics endpoint that reports configured/missing live data providers without exposing secrets.
- Updated env examples with `ODDS_API_KEY`, `ODDS_API_REGIONS`, `ODDS_API_FOOTBALL_SPORTS`, and `FOOTBALL_DATA_API_KEY`.
- Verified the Next.js production build after the live data provider changes.

## 2026-07-05 - Configure Live Data Provider Secrets In Vercel

- Added The Odds API key to the existing Vercel `pitchiq` project for Production, Preview, and Development environments.
- Added football-data.org API key to the existing Vercel `pitchiq` project for Production, Preview, and Development environments.
- Added `ODDS_API_REGIONS=eu` in Vercel so football and tennis odds requests use the EU bookmaker region by default.
- Kept provider secrets out of git and documented only the configuration action in this recovery file.
- Linked the local workspace to the existing Vercel `akshit-kumars-projects-54e51a6c/pitchiq` project for future deployments and env checks.

## 2026-07-05 - Fix Tennis Odds Player Mapping

- Fixed a live tennis odds parsing bug where player odds were assigned from The Odds API outcome array order.
- Updated `/api/odds/tennis` to map odds by matching each outcome name to `home_team` and `away_team`, preventing reversed player prices.
- Added `src/lib/tennis-odds-mapping.ts` as the shared name-normalized mapping helper for tennis outcomes.
- Added `npm run test:odds` with a regression fixture where the API outcome order is intentionally reversed.
- Verified `npm run test:odds` and the full Next.js production build after the fix.

## 2026-07-05 - Harden Live Odds Mapping Regression Tests

- Added `src/lib/football-odds-mapping.ts` so football home, draw, away, over, and under odds are mapped through explicit normalized outcome-name helpers.
- Updated `/api/odds/football` to use the shared football mapping helper instead of inline outcome lookups.
- Replaced the tennis-only odds test with a combined `npm run test:odds` regression suite covering reversed tennis outcome order, shuffled football 1X2 order, total-goals order, missing names, and accent-normalized player names.
- Kept the tests focused on provider mapping rules so future API ordering changes fail locally before they can affect production.
- Verified `npm run test:odds` and the full Next.js production build after the mapping hardening.

## 2026-07-06 - Add Football Fixture Fallback When Odds Markets Are Empty

- Diagnosed that The Odds API was connected but returning zero football and tennis odds markets while football-data.org still had today's World Cup fixtures.
- Added a football-data.org fixture fallback inside `/api/odds/football` when The Odds API returns no football markets.
- The fallback returns today/live and next-seven-day World Cup fixtures with `source = fixture-schedule` and market odds set to unavailable.
- Added a betting-page warning banner when schedule fixtures are shown without bookmaker odds so users understand the cards are model-derived analysis only.
- Verified `npm run test:odds` and the full Next.js production build after the fallback change.

## 2026-07-07 - Hide Generated Odds For Fixture-Only Football Matches

- Verified Argentina vs Egypt was coming from `source = fixture-schedule` with no bookmaker odds from The Odds API.
- Updated football match cards so 1X2 buttons are disabled when home, draw, and away bookmaker odds are unavailable.
- Updated football detail pages so planner actions and market groups are hidden for fixture-only matches.
- Added a fixture-only warning on football detail pages explaining that the report is model-derived analysis only until live odds return.
- Verified `npm run test:odds` and the full Next.js production build after the UI correction.
