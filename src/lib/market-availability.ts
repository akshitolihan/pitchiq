export interface FootballMarketAvailability {
  odds: {
    home: number | null;
    draw: number | null;
    away: number | null;
  };
}

export interface TennisMarketAvailability {
  odds: {
    p1: number | null;
    p2: number | null;
  };
}

export function hasFootballBookmakerOdds(match: FootballMarketAvailability) {
  return match.odds.home !== null && match.odds.draw !== null && match.odds.away !== null;
}

export function hasTennisBookmakerOdds(match: TennisMarketAvailability) {
  return match.odds.p1 !== null && match.odds.p2 !== null;
}
