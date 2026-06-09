# Pitch IQ — Football Analysis Platform (Milestone 1)

> **Analysis only.** This product presents model-derived probabilities and statistics.
> It is not a betting operator. It never accepts bets, holds funds, or tells you what to do.

---

## One-command local run

```bash
# 1. Copy env file
cp .env.example .env

# 2. Install Python deps
pip install -r requirements.txt

# 3. Seed database + fit model (creates football_analysis.db)
python -m scripts.seed

# 4. Start API
uvicorn api.index:app --reload --port 8000

# 5. In a second terminal — start frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open **http://localhost:3000** — fixtures page with Dixon-Coles probabilities.

### Or with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

The backend seeds itself on first run; visit http://localhost:3000.

---

## Vercel deployment

### Prerequisites
- Vercel account with a **Neon (Postgres)** database created via the Vercel dashboard
- Vercel CLI: `npm i -g vercel`

### Steps

```bash
# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL        # paste your Neon postgres:// URL
vercel env add STUB_USER_TIER      # paid  (or free to see gating in action)
vercel env add ADMIN_SECRET        # pick a secret
vercel env add ALLOWED_ORIGINS     # your Vercel domain, e.g. https://pitchiq.vercel.app

# Deploy
vercel --prod

# After first deploy, seed the database (one-time):
curl -X POST https://your-app.vercel.app/api/admin/seed \
  -H "X-Admin-Secret: your-secret"
```

The seed endpoint is idempotent — safe to call again after redeployments.

---

## Tier testing

Pass the `X-User-Tier` header to see tier gating in action:

```bash
# Free tier — 3 fixtures, no prediction details
curl http://localhost:8000/api/fixtures -H "X-User-Tier: free"

# Paid tier — all fixtures, full prediction + drivers
curl http://localhost:8000/api/fixtures -H "X-User-Tier: paid"

# Single match detail (paid = confidence + driver breakdown)
curl http://localhost:8000/api/matches/1 -H "X-User-Tier: paid"
curl http://localhost:8000/api/matches/1 -H "X-User-Tier: free"
```

Gating is enforced **server-side** in `api/middleware/tier_gate.py` — the response
payload changes, not just the UI.

---

## Re-fitting the model

```bash
# Trigger a model refit + prediction regeneration
curl -X POST http://localhost:8000/api/admin/fit \
  -H "X-Admin-Secret: dev-secret"
```

On Vercel this can be set up as a daily Cron Job:
- Vercel Dashboard → Project → Settings → Cron Jobs
- Schedule: `0 3 * * *` (3 AM UTC daily)
- URL: `/api/admin/fit` with `X-Admin-Secret` header

---

## Running tests

```bash
pip install pytest
pytest tests/ -v
```

Tests cover:
- W/D/L + over/under probabilities sum to ~1
- Stronger team wins more often
- Home advantage increases home win probability
- Dixon-Coles τ correction (low-score cells)
- Elo convergence and win-probability ordering
- Confidence level assignment

---

## API reference

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/health` | — | Health check |
| `GET /api/fixtures` | X-User-Tier | Upcoming fixtures (Free: 3, Paid/Pro: all) |
| `GET /api/matches/{id}` | X-User-Tier | Match detail + prediction + drivers |
| `POST /api/admin/seed` | X-Admin-Secret | Ingest CSV + fit model (idempotent) |
| `POST /api/admin/fit` | X-Admin-Secret | Refit model + regenerate predictions |

Interactive docs: http://localhost:8000/docs

---

## Project structure

```
football-analysis/
├── api/                    Python FastAPI backend
│   ├── index.py            App entry point (Vercel + uvicorn)
│   ├── config.py           Settings (env vars)
│   ├── database.py         SQLAlchemy engine (SQLite local / Postgres prod)
│   ├── models/             ORM: Team, Match, MatchStats, Prediction, User
│   ├── ingestion/          Data adapters (football-data.co.uk CSV + abstract base)
│   ├── model/              Dixon-Coles MLE, Elo, predictor orchestrator
│   ├── routes/             /fixtures, /matches REST endpoints
│   ├── middleware/         Tier gate + geofence
│   └── jobs/               fit_and_predict job
├── frontend/               Next.js 14 + TypeScript + Tailwind
│   └── src/
│       ├── app/            Fixtures page + Match detail page
│       ├── components/     FixtureCard, ProbabilityBars, ConfidenceBadge, DriverBreakdown
│       └── lib/api.ts      Typed API client
├── data/seed/epl_2324.csv  Real EPL 2023-24 season data (football-data.co.uk)
├── scripts/seed.py         Idempotent seed + fit script
├── tests/test_model.py     Unit tests for the model
├── docker-compose.yml
└── requirements.txt
```

---

## What's in Milestone 1

- **Dixon-Coles goals model** — MLE with time decay, low-score correction, full scoreline matrix
- **Elo ratings** — parallel sanity cross-check (draw-adjusted, MoV-scaled)
- **Explainability** — every prediction has driver breakdown: team strength, defense edge, home advantage, Elo cross-check
- **Confidence badge** — High / Medium / Low from distribution entropy + data completeness
- **Tier gating** — server-side, Free / Paid / Pro enforced at API layer
- **Geofence hook** — configurable blocked-country list (off by default)
- **Real seed data** — full EPL 2023-24 season from football-data.co.uk
- **Pluggable ingestion** — `AbstractDataAdapter` interface; swap in API-Football without touching the model

## Recommended Milestone 2

1. **Lineup / injury adjustments** — scale λ by confirmed lineup quality; API-Football adapter for live lineups
2. **More leagues** — Championship, La Liga, Bundesliga via the same CSV adapter
3. **Live scores** — WebSocket or polling endpoint; `Match.status = "live"` with in-progress scores
4. **Alerts** — email/push on lineup confirmation or model update for watchlisted fixtures
5. **Real auth** — JWT / Supabase Auth replacing the `STUB_USER_TIER` env var
