const BASE = "https://api.football-data.org/v4";
const KEY = process.env.FOOTBALL_DATA_API_KEY!;

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Auth-Token": KEY },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`football-data API ${res.status}: ${path}`);
  return res.json();
}

export interface FDMatch {
  id: number;
  utcDate: string;
  status: "TIMED" | "SCHEDULED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "SUSPENDED" | "CANCELLED";
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  referees: { name: string }[];
}

export interface FDStandingRow {
  position: number;
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface FDStandingGroup {
  stage: string;
  type: string;
  group: string | null;
  table: FDStandingRow[];
}

export async function getWCMatches(): Promise<FDMatch[]> {
  const data = await apiFetch<{ matches: FDMatch[] }>("/competitions/WC/matches?season=2026");
  return data.matches;
}

export async function getWCStandings(): Promise<FDStandingGroup[]> {
  const data = await apiFetch<{ standings: FDStandingGroup[] }>("/competitions/WC/standings?season=2026");
  return data.standings;
}

export async function getMatch(id: number): Promise<FDMatch> {
  return apiFetch<FDMatch>(`/matches/${id}`);
}
