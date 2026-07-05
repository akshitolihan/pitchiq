export interface FootballOddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export function normalizeFootballName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function priceForFootballOutcome(outcomes: FootballOddsOutcome[] | undefined, outcomeName: string) {
  const target = normalizeFootballName(outcomeName);
  return outcomes?.find(outcome => normalizeFootballName(outcome.name) === target)?.price ?? null;
}

export function pointForFootballOutcome(outcomes: FootballOddsOutcome[] | undefined, outcomeName: string, fallback: number) {
  const target = normalizeFootballName(outcomeName);
  return outcomes?.find(outcome => normalizeFootballName(outcome.name) === target)?.point ?? fallback;
}
