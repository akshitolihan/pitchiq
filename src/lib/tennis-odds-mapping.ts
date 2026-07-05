export interface TennisOddsOutcome {
  name: string;
  price: number;
}

export function normalizeTennisName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function priceForTennisPlayer(outcomes: TennisOddsOutcome[] | undefined, playerName: string) {
  const target = normalizeTennisName(playerName);
  return outcomes?.find(outcome => normalizeTennisName(outcome.name) === target)?.price ?? null;
}
