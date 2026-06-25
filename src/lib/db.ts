import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql() {
  if (!_sql) {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new Error("DATABASE_URL env var not set");
    const url = raw.trim(); // trim() strips BOM (U+FEFF) which PowerShell adds via stdin
    _sql = neon(url);
  }
  return _sql;
}

// Convenience default export — same lazy instance
export default getSql;

export async function initDb() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS wc_matches (
      id            INTEGER PRIMARY KEY,
      utc_date      TIMESTAMPTZ NOT NULL,
      status        TEXT NOT NULL,
      stage         TEXT NOT NULL,
      matchday      INTEGER,
      group_name    TEXT,
      home_id       INTEGER NOT NULL,
      home_name     TEXT NOT NULL,
      home_tla      TEXT NOT NULL,
      home_crest    TEXT,
      away_id       INTEGER NOT NULL,
      away_name     TEXT NOT NULL,
      away_tla      TEXT NOT NULL,
      away_crest    TEXT,
      score_home    INTEGER,
      score_away    INTEGER,
      winner        TEXT,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS wc_standings (
      id            SERIAL PRIMARY KEY,
      group_name    TEXT NOT NULL,
      position      INTEGER NOT NULL,
      team_id       INTEGER NOT NULL,
      team_name     TEXT NOT NULL,
      team_tla      TEXT NOT NULL,
      team_crest    TEXT,
      played        INTEGER DEFAULT 0,
      won           INTEGER DEFAULT 0,
      draw          INTEGER DEFAULT 0,
      lost          INTEGER DEFAULT 0,
      goals_for     INTEGER DEFAULT 0,
      goals_against INTEGER DEFAULT 0,
      goal_diff     INTEGER DEFAULT 0,
      points        INTEGER DEFAULT 0,
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (group_name, team_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS wc_predictions (
      match_id      INTEGER PRIMARY KEY REFERENCES wc_matches(id),
      p_home_win    NUMERIC(5,4) NOT NULL,
      p_draw        NUMERIC(5,4) NOT NULL,
      p_away_win    NUMERIC(5,4) NOT NULL,
      expected_home NUMERIC(4,2),
      expected_away NUMERIC(4,2),
      top_scores    JSONB,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}
