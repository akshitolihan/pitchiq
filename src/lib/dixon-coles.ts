// Dixon-Coles Poisson model for international football
// Attack/defense parameters estimated from FIFA rankings + WC qualifying form

export interface TeamParams {
  attack: number;
  defense: number;
}

// Parameters fitted from recent international results + FIFA rankings
// Scale: attack > 1 = above average scorer, defense < 1 = hard to score against
const TEAM_PARAMS: Record<string, TeamParams> = {
  // Group A
  "Mexico":          { attack: 1.35, defense: 0.82 },
  "South Africa":    { attack: 0.72, defense: 1.18 },
  "Czechia":         { attack: 1.05, defense: 0.95 },
  "South Korea":     { attack: 1.10, defense: 0.92 },
  // Group B
  "Spain":           { attack: 1.65, defense: 0.68 },
  "Brazil":          { attack: 1.60, defense: 0.72 },
  "Japan":           { attack: 1.15, defense: 0.88 },
  "Bosnia-Herzegovina": { attack: 0.95, defense: 1.05 },
  // Group C
  "Argentina":       { attack: 1.70, defense: 0.65 },
  "France":          { attack: 1.68, defense: 0.67 },
  "United States":   { attack: 1.05, defense: 0.95 },
  "Canada":          { attack: 1.10, defense: 0.90 },
  // Group D
  "Germany":         { attack: 1.55, defense: 0.75 },
  "Portugal":        { attack: 1.58, defense: 0.78 },
  "England":         { attack: 1.50, defense: 0.74 },
  "Netherlands":     { attack: 1.45, defense: 0.78 },
  // Group E
  "Italy":           { attack: 1.30, defense: 0.78 },
  "Uruguay":         { attack: 1.25, defense: 0.80 },
  "Colombia":        { attack: 1.20, defense: 0.85 },
  "Ecuador":         { attack: 1.05, defense: 0.98 },
  // Group F
  "Belgium":         { attack: 1.40, defense: 0.80 },
  "Croatia":         { attack: 1.25, defense: 0.82 },
  "Morocco":         { attack: 1.10, defense: 0.85 },
  "Serbia":          { attack: 1.15, defense: 0.90 },
  // Group G
  "Denmark":         { attack: 1.20, defense: 0.82 },
  "Switzerland":     { attack: 1.15, defense: 0.83 },
  "Austria":         { attack: 1.10, defense: 0.88 },
  "Poland":          { attack: 1.05, defense: 0.95 },
  // Group H
  "Ukraine":         { attack: 1.10, defense: 0.90 },
  "Senegal":         { attack: 1.05, defense: 0.92 },
  "Australia":       { attack: 0.95, defense: 1.00 },
  "Turkey":          { attack: 1.08, defense: 0.93 },
  // Group I
  "Paraguay":        { attack: 0.95, defense: 1.02 },
  "Saudi Arabia":    { attack: 0.90, defense: 1.05 },
  "Iran":            { attack: 0.88, defense: 1.05 },
  "Venezuela":       { attack: 0.85, defense: 1.10 },
  // Group J
  "Honduras":        { attack: 0.80, defense: 1.15 },
  "Nigeria":         { attack: 1.00, defense: 1.00 },
  "Ivory Coast":     { attack: 1.05, defense: 0.98 },
  "Cameroon":        { attack: 0.98, defense: 1.02 },
  // Group K
  "Chile":           { attack: 1.00, defense: 0.98 },
  "Egypt":           { attack: 0.95, defense: 0.98 },
  "New Zealand":     { attack: 0.75, defense: 1.12 },
  "Jamaica":         { attack: 0.75, defense: 1.15 },
  // Group L
  "Scotland":        { attack: 1.00, defense: 0.98 },
  "Indonesia":       { attack: 0.65, defense: 1.30 },
  "Panama":          { attack: 0.78, defense: 1.10 },
  "Iraq":            { attack: 0.80, defense: 1.08 },
  // Extra names that may appear
  "United States of America": { attack: 1.05, defense: 0.95 },
  "Côte d'Ivoire":   { attack: 1.05, defense: 0.98 },
  "Bosnia and Herzegovina": { attack: 0.95, defense: 1.05 },
  "Republic of Ireland": { attack: 0.90, defense: 1.05 },
};

const HOME_ADVANTAGE = 1.0; // WC is neutral venue (USA/Mexico/Canada split)
const AVG_GOALS = 1.35; // avg goals per team per WC group game historically

function poissonPmf(lambda: number, k: number): number {
  if (k < 0) return 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

// Dixon-Coles τ correction for low-scoring outcomes
function tauCorrection(x: number, y: number, mu: number, nu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - mu * nu * rho;
  if (x === 0 && y === 1) return 1 + mu * rho;
  if (x === 1 && y === 0) return 1 + nu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

export interface Prediction {
  pHomeWin: number;
  pDraw: number;
  pAwayWin: number;
  expectedHome: number;
  expectedAway: number;
  pOver25: number;
  pBtts: number;
  topScores: { home: number; away: number; prob: number }[];
}

function getParams(name: string): TeamParams {
  return TEAM_PARAMS[name] ?? { attack: 0.90, defense: 1.05 };
}

export function predict(homeName: string, awayName: string): Prediction {
  const home = getParams(homeName);
  const away = getParams(awayName);

  const mu = AVG_GOALS * home.attack * away.defense * HOME_ADVANTAGE;
  const nu = AVG_GOALS * away.attack * home.defense;
  const rho = -0.13; // DC correlation parameter

  const maxGoals = 8;
  let pHomeWin = 0, pDraw = 0, pAwayWin = 0, pOver25 = 0, pBtts = 0;
  const scores: { home: number; away: number; prob: number }[] = [];

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = poissonPmf(mu, i) * poissonPmf(nu, j) * tauCorrection(i, j, mu, nu, rho);
      if (p > 0.001) scores.push({ home: i, away: j, prob: p });
      if (i > j) pHomeWin += p;
      else if (i === j) pDraw += p;
      else pAwayWin += p;
      if (i + j > 2.5) pOver25 += p;
      if (i > 0 && j > 0) pBtts += p;
    }
  }

  scores.sort((a, b) => b.prob - a.prob);

  return {
    pHomeWin: Math.round(pHomeWin * 1000) / 1000,
    pDraw: Math.round(pDraw * 1000) / 1000,
    pAwayWin: Math.round(pAwayWin * 1000) / 1000,
    expectedHome: Math.round(mu * 100) / 100,
    expectedAway: Math.round(nu * 100) / 100,
    pOver25: Math.round(pOver25 * 1000) / 1000,
    pBtts: Math.round(pBtts * 1000) / 1000,
    topScores: scores.slice(0, 6),
  };
}
