const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api`
  : "/api";

export interface Team {
  id: number;
  name: string;
  attack_strength: number | null;
  defense_strength: number | null;
  current_elo: number | null;
}

export interface Prediction {
  p_home_win: number;
  p_draw: number;
  p_away_win: number;
  p_over_2_5: number;
  p_under_2_5: number;
  p_btts: number;
  lambda_home: number;
  lambda_away: number;
  confidence: "High" | "Medium" | "Low" | null;
  top_correct_scores: { score: string; prob: number }[] | null;
  drivers: Record<string, Driver> | null;
  elo_home_win_prob: number | null;
  tier_gate: string | null;
  model_version: string;
  generated_at: string | null;
}

export interface Driver {
  label: string;
  value: number;
  description: string;
  positive_favours: "home" | "away" | "neutral";
}

export interface FixtureSummary {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_utc: string;
  status: string;
  prediction: {
    p_home_win: number;
    p_draw: number;
    p_away_win: number;
    p_over_2_5: number;
    p_under_2_5: number;
    p_btts: number;
    confidence: "High" | "Medium" | "Low" | null;
  } | null;
}

export interface FixturesResponse {
  tier: string;
  total_available: number;
  shown: number;
  gated_message: string | null;
  items: FixtureSummary[];
  disclaimer: string;
}

export interface MatchDetail {
  id: number;
  home_team: Team;
  away_team: Team;
  kickoff_utc: string;
  status: string;
  result: { home_goals: number; away_goals: number } | null;
  prediction: Prediction | null;
  disclaimer: string;
}

async function apiFetch<T>(path: string, tier = "free"): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-User-Tier": tier },
    next: { revalidate: 300 }, // 5-minute ISR cache
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail.detail || res.statusText);
  }
  return res.json();
}

export const fetchFixtures = (tier = "free") =>
  apiFetch<FixturesResponse>("/fixtures", tier);

export const fetchMatch = (id: number | string, tier = "free") =>
  apiFetch<MatchDetail>(`/matches/${id}`, tier);
