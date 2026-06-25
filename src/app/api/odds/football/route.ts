export const dynamic = "force-dynamic";

const API_KEY = process.env.ODDS_API_KEY ?? "";
const BASE = "https://api.the-odds-api.com/v4";
const PREFERRED_BOOKS = ["pinnacle", "betfair_ex_eu", "williamhill", "bet365", "unibet"];

const SPORTS = [
  { key: "soccer_fifa_world_cup",         label: "FIFA World Cup 2026" },
  { key: "soccer_uefa_champs_league",     label: "UEFA Champions League" },
  { key: "soccer_epl",                    label: "Premier League" },
  { key: "soccer_spain_la_liga",          label: "La Liga" },
  { key: "soccer_germany_bundesliga",     label: "Bundesliga" },
  { key: "soccer_italy_serie_a",          label: "Serie A" },
  { key: "soccer_france_ligue_one",       label: "Ligue 1" },
  { key: "soccer_uefa_europa_league",     label: "UEFA Europa League" },
  { key: "soccer_conmebol_copa_libertadores", label: "Copa Libertadores" },
];

function bestOdds(bookmakers: OddsBookmaker[], market: "h2h" | "totals") {
  for (const key of PREFERRED_BOOKS) {
    const bk = bookmakers.find(b => b.key === key);
    if (!bk) continue;
    const mkt = bk.markets.find(m => m.key === market);
    if (mkt?.outcomes?.length) return { outcomes: mkt.outcomes, bookmaker: bk.title };
  }
  for (const bk of bookmakers) {
    const mkt = bk.markets.find(m => m.key === market);
    if (mkt?.outcomes?.length) return { outcomes: mkt.outcomes, bookmaker: bk.title };
  }
  return null;
}

interface OddsOutcome { name: string; price: number; point?: number; }
interface OddsMarket { key: string; outcomes: OddsOutcome[]; }
interface OddsBookmaker { key: string; title: string; markets: OddsMarket[]; }
interface OddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  sport_key: string;
  bookmakers: OddsBookmaker[];
}

export async function GET() {
  if (!API_KEY) {
    return Response.json({ matches: [], error: "ODDS_API_KEY not configured" });
  }

  try {
    const now = Date.now();
    const cutoff = now + 7 * 24 * 60 * 60 * 1000; // 7 days ahead

    // Fetch all sports in parallel, ignore failures
    const results = await Promise.allSettled(
      SPORTS.map(async ({ key, label }) => {
        const url = `${BASE}/sports/${key}/odds?apiKey=${API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
        const res = await fetch(url, { next: { revalidate: 120 } });
        if (!res.ok) return [];
        const events: OddsEvent[] = await res.json();
        return events.map(e => ({ ...e, _label: label }));
      })
    );

    const allEvents = results
      .flatMap(r => r.status === "fulfilled" ? r.value : [])
      .filter(e => {
        const t = new Date(e.commence_time).getTime();
        return t > now - 3 * 60 * 60 * 1000 && t < cutoff; // past 3h and next 7 days
      });

    const matches = allEvents.map(e => {
      const h2h    = bestOdds(e.bookmakers, "h2h");
      const totals = bestOdds(e.bookmakers, "totals");

      const home = h2h?.outcomes.find(o => o.name === e.home_team)?.price ?? null;
      const away = h2h?.outcomes.find(o => o.name === e.away_team)?.price ?? null;
      const draw = h2h?.outcomes.find(o => o.name === "Draw")?.price ?? null;
      const over = totals?.outcomes.find(o => o.name === "Over")?.price ?? null;
      const under= totals?.outcomes.find(o => o.name === "Under")?.price ?? null;
      const totalLine = totals?.outcomes.find(o => o.name === "Over")?.point ?? 2.5;

      return {
        id: e.id,
        competition: (e as OddsEvent & { _label: string })._label,
        commenceTime: e.commence_time,
        homeTeam: e.home_team,
        awayTeam: e.away_team,
        bookmaker: h2h?.bookmaker ?? "—",
        odds: { home, draw, away, over, under, totalLine },
      };
    }).sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

    return Response.json({ matches, updatedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
