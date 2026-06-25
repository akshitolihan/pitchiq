// Converts Dixon-Coles probabilities into derived market odds
// Using 8% bookmaker margin (0.92 factor)
const MARGIN = 0.92;

function toOdds(p: number): number {
  if (p <= 0) return 99;
  return Math.round((MARGIN / p) * 100) / 100;
}

export interface FootballMarkets {
  // 1X2
  homeWin: number;
  draw: number;
  awayWin: number;
  // Double Chance
  dc1X: number;   // Home or Draw
  dcX2: number;   // Draw or Away
  dc12: number;   // Home or Away (no draw)
  // Draw No Bet
  dnbHome: number;
  dnbAway: number;
  // BTTS
  bttsYes: number;
  bttsNo: number;
  // Over/Under 2.5 (from Dixon-Coles)
  over25: number;
  under25: number;
}

export interface FootballOddsInput {
  pHomeWin: number;
  pDraw: number;
  pAwayWin: number;
  pBtts: number;
  pOver25: number;
  // Optionally override 1X2 with real bookmaker odds
  realHome?: number | null;
  realDraw?: number | null;
  realAway?: number | null;
  realOver?: number | null;
  realUnder?: number | null;
}

export function computeFootballMarkets(input: FootballOddsInput): FootballMarkets {
  const { pHomeWin, pDraw, pAwayWin, pBtts, pOver25 } = input;

  // Use real bookmaker 1X2 where available, else Dixon-Coles derived
  const homeWin = input.realHome ?? toOdds(pHomeWin);
  const draw = input.realDraw ?? toOdds(pDraw);
  const awayWin = input.realAway ?? toOdds(pAwayWin);

  return {
    homeWin,
    draw,
    awayWin,
    // Double Chance
    dc1X: toOdds(pHomeWin + pDraw),
    dcX2: toOdds(pDraw + pAwayWin),
    dc12: toOdds(pHomeWin + pAwayWin),
    // Draw No Bet — normalise excluding draw
    dnbHome: toOdds(pHomeWin / (pHomeWin + pAwayWin)),
    dnbAway: toOdds(pAwayWin / (pHomeWin + pAwayWin)),
    // BTTS
    bttsYes: toOdds(pBtts),
    bttsNo: toOdds(1 - pBtts),
    // Totals
    over25: input.realOver ?? toOdds(pOver25),
    under25: input.realUnder ?? toOdds(1 - pOver25),
  };
}

// ─── Prediction helpers ───────────────────────────────────────────────────────

export interface FootballPrediction {
  outcome: "Home Win" | "Draw" | "Away Win";
  teamLabel: string;       // e.g. "Brazil" or "Draw"
  confidence: number;      // 0–100
  tier: "Strong" | "Moderate" | "Competitive";
  homeP: number;           // 0–100 de-vigged
  drawP: number;
  awayP: number;
}

export function getFootballPrediction(
  homeTeam: string,
  awayTeam: string,
  homeOdds: number | null,
  drawOdds: number | null,
  awayOdds: number | null,
): FootballPrediction {
  const rh = homeOdds ? 1 / homeOdds : 0.38;
  const rd = drawOdds ? 1 / drawOdds : 0.27;
  const ra = awayOdds ? 1 / awayOdds : 0.35;
  const sum = rh + rd + ra;
  const ph = (rh / sum) * 100;
  const pd = (rd / sum) * 100;
  const pa = (ra / sum) * 100;

  let outcome: FootballPrediction["outcome"];
  let teamLabel: string;
  let confidence: number;
  if (ph >= pd && ph >= pa) { outcome = "Home Win"; teamLabel = homeTeam; confidence = ph; }
  else if (pa >= pd)        { outcome = "Away Win"; teamLabel = awayTeam; confidence = pa; }
  else                      { outcome = "Draw";     teamLabel = "Draw";   confidence = pd; }

  const tier: FootballPrediction["tier"] =
    confidence >= 60 ? "Strong" : confidence >= 48 ? "Moderate" : "Competitive";

  return { outcome, teamLabel, confidence, tier, homeP: ph, drawP: pd, awayP: pa };
}

export interface TennisPrediction {
  winnerLabel: string;
  confidence: number;      // 0–100
  tier: "Strong" | "Moderate" | "Competitive";
  p1P: number;             // 0–100
  p2P: number;
}

export function getTennisPrediction(
  player1: string,
  player2: string,
  p1Odds: number | null,
  p2Odds: number | null,
): TennisPrediction {
  const r1 = p1Odds ? 1 / p1Odds : 0.5;
  const r2 = p2Odds ? 1 / p2Odds : 0.5;
  const sum = r1 + r2;
  const p1P = (r1 / sum) * 100;
  const p2P = (r2 / sum) * 100;

  const favorite = p1P >= p2P ? player1 : player2;
  const confidence = Math.max(p1P, p2P);
  const tier: TennisPrediction["tier"] =
    confidence >= 70 ? "Strong" : confidence >= 58 ? "Moderate" : "Competitive";

  return { winnerLabel: favorite, confidence, tier, p1P, p2P };
}

// Tennis: derive implied set betting from match win probability
// Using simplified ATP model: p(win set) ≈ p(win match)^(1/1.7) for best-of-3
export interface TennisMarkets {
  p1Win: number;
  p2Win: number;
  // Correct score (best of 3)
  cs20: number;   // 2-0 p1
  cs21: number;   // 2-1 p1
  cs02: number;   // 0-2 p2
  cs12: number;   // 1-2 p2
  // Total sets
  under25Sets: number;  // straight sets (2-0 either way)
  over25Sets: number;   // 3 sets
  // Win at least 1 set
  p1WinSet: number;     // player 1 wins at least 1 set = 1 - P(0-2)
  p2WinSet: number;     // player 2 wins at least 1 set = 1 - P(2-0)
}

export function computeTennisMarkets(p1OddsReal: number | null, p2OddsReal: number | null): TennisMarkets {
  // Convert real odds to probabilities (remove margin)
  const raw1 = p1OddsReal ? 1 / p1OddsReal : 0.5;
  const raw2 = p2OddsReal ? 1 / p2OddsReal : 0.5;
  const total = raw1 + raw2;
  const p1 = raw1 / total;  // de-vigged probability
  const p2 = raw2 / total;

  // P(win a set) ≈ match win prob ^ (1/1.7) for best-of-3
  const sp1 = Math.pow(p1, 1 / 1.7);
  const sp2 = 1 - sp1;

  // Score probabilities (best of 3)
  const p20 = sp1 * sp1;
  const p21 = 2 * sp1 * sp2 * sp1;  // win 2nd and 3rd
  const p02 = sp2 * sp2;
  const p12 = 2 * sp2 * sp1 * sp2;

  const p2Sets = p20 + p02;  // straight sets (under 2.5)
  const p3Sets = p21 + p12;  // 3 sets (over 2.5)

  return {
    p1Win: p1OddsReal ?? toOdds(p1),
    p2Win: p2OddsReal ?? toOdds(p2),
    cs20: toOdds(p20),
    cs21: toOdds(p21),
    cs02: toOdds(p02),
    cs12: toOdds(p12),
    under25Sets: toOdds(p2Sets),
    over25Sets: toOdds(p3Sets),
    // P(win ≥1 set): player loses 0-2 only if opponent wins straight sets
    p1WinSet: toOdds(1 - p02),
    p2WinSet: toOdds(1 - p20),
  };
}
