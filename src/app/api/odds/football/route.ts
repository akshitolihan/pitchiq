export const dynamic = "force-dynamic";

import { pointForFootballOutcome, priceForFootballOutcome } from "@/lib/football-odds-mapping";

const API_KEY = process.env.ODDS_API_KEY ?? "";
const BASE = "https://api.the-odds-api.com/v4";
const REGIONS = process.env.ODDS_API_REGIONS ?? "eu";
const PREFERRED_BOOKS = ["pinnacle", "betfair_ex_eu", "williamhill", "bet365", "unibet"];
const LOCAL_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const DEFAULT_SPORTS = [
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

const SPORTS = (process.env.ODDS_API_FOOTBALL_SPORTS ?? "")
  .split(",")
  .map(key => key.trim())
  .filter(Boolean)
  .map(key => DEFAULT_SPORTS.find(sport => sport.key === key) ?? { key, label: key.replace(/^soccer_/, "").replace(/_/g, " ") });

if (SPORTS.length === 0) SPORTS.push(...DEFAULT_SPORTS);

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

interface LocalFixture {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_utc: string;
  prediction?: {
    p_home_win?: number;
    p_draw?: number;
    p_away_win?: number;
    p_over_2_5?: number;
    p_under_2_5?: number;
  } | null;
}

interface LocalFixturesResponse {
  items?: LocalFixture[];
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  stage?: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
}

function probabilityToOdds(probability?: number | null) {
  if (!probability || probability <= 0) return null;
  return Number((1 / probability).toFixed(2));
}

async function footballDataFixtureFallback(reason: string) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  if (!apiKey) {
    return Response.json({
      matches: [],
      source: "live-odds-empty",
      demo: false,
      provider: {
        name: "The Odds API",
        configured: true,
        live: false,
        regions: REGIONS,
        reason,
      },
      error: "The Odds API returned no football markets and FOOTBALL_DATA_API_KEY is not configured for fixture fallback",
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    const [liveRes, finishedRes, scheduledRes] = await Promise.all([
      fetch("https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY&season=2026", {
        headers: { "X-Auth-Token": apiKey },
        cache: "no-store",
      }),
      fetch("https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED&season=2026", {
        headers: { "X-Auth-Token": apiKey },
        cache: "no-store",
      }),
      fetch("https://api.football-data.org/v4/competitions/WC/matches?status=TIMED,SCHEDULED&season=2026", {
        headers: { "X-Auth-Token": apiKey },
        cache: "no-store",
      }),
    ]);

    const parse = async (res: Response): Promise<FootballDataMatch[]> => {
      if (!res.ok) return [];
      const data = await res.json();
      return data.matches ?? [];
    };

    const [live, finished, scheduled] = await Promise.all([parse(liveRes), parse(finishedRes), parse(scheduledRes)]);
    const todayUTC = new Date().toISOString().slice(0, 10);
    const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const isToday = (match: FootballDataMatch) => new Date(match.utcDate).toISOString().slice(0, 10) === todayUTC;
    const isUpcomingSoon = (match: FootballDataMatch) => {
      const kickoff = new Date(match.utcDate).getTime();
      return kickoff >= Date.now() - 3 * 60 * 60 * 1000 && kickoff <= cutoff;
    };

    const matches = [...live, ...finished.filter(isToday), ...scheduled.filter(isUpcomingSoon)]
      .map(match => ({
        id: `football-data-${match.id}`,
        competition: "FIFA World Cup 2026",
        commenceTime: match.utcDate,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        bookmaker: "Fixture schedule - market odds unavailable",
        status: match.status,
        stage: match.stage ?? null,
        odds: {
          home: null,
          draw: null,
          away: null,
          over: null,
          under: null,
          totalLine: 2.5,
        },
      }))
      .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

    return Response.json({
      matches,
      source: "fixture-schedule",
      demo: false,
      provider: {
        name: "football-data.org fixture fallback",
        configured: true,
        live: matches.length > 0,
        reason,
      },
      warning: "Bookmaker odds are currently unavailable from The Odds API. Showing schedule fixtures with model-derived analysis only.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      matches: [],
      source: "fixture-schedule-error",
      demo: false,
      provider: {
        name: "football-data.org fixture fallback",
        configured: true,
        live: false,
        reason,
      },
      error: String(error),
      updatedAt: new Date().toISOString(),
    });
  }
}

async function demoFixtureFallback() {
  let data: LocalFixturesResponse = { items: [] };

  try {
    const res = await fetch(`${LOCAL_API_BASE}/api/fixtures`, {
      cache: "no-store",
      headers: { "X-User-Tier": "paid" },
    });
    if (res.ok) {
      data = await res.json();
    }
  } catch {
    data = { items: [] };
  }

  const matches = (data.items ?? []).map((fixture) => ({
    id: String(fixture.id),
    competition: "Premier League Demo",
    commenceTime: fixture.kickoff_utc,
    homeTeam: fixture.home_team,
    awayTeam: fixture.away_team,
    bookmaker: "Demo model data",
    odds: {
      home: probabilityToOdds(fixture.prediction?.p_home_win),
      draw: probabilityToOdds(fixture.prediction?.p_draw),
      away: probabilityToOdds(fixture.prediction?.p_away_win),
      over: probabilityToOdds(fixture.prediction?.p_over_2_5),
      under: probabilityToOdds(fixture.prediction?.p_under_2_5),
      totalLine: 2.5,
    },
  }));

  return Response.json({
    matches,
    source: "demo-fixtures",
    demo: true,
    provider: {
      name: "Demo fixtures",
      configured: false,
      live: false,
      reason: API_KEY ? "The Odds API returned no usable football data" : "ODDS_API_KEY is not configured",
    },
    error: matches.length === 0 ? "Demo fixtures API unavailable or empty" : undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function GET() {
  if (!API_KEY) {
    return demoFixtureFallback();
  }

  try {
    const now = Date.now();
    const cutoff = now + 7 * 24 * 60 * 60 * 1000; // 7 days ahead

    // Fetch all sports in parallel, ignore failures
    const results = await Promise.allSettled(
      SPORTS.map(async ({ key, label }) => {
        const url = `${BASE}/sports/${key}/odds?apiKey=${API_KEY}&regions=${REGIONS}&markets=h2h,totals&oddsFormat=decimal`;
        const res = await fetch(url, { next: { revalidate: 120 } });
        if (!res.ok) return [];
        const events: OddsEvent[] = await res.json();
        return events.map(e => ({
          ...e,
          _label: label,
          _quotaRemaining: res.headers.get("x-requests-remaining"),
          _quotaUsed: res.headers.get("x-requests-used"),
        }));
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

      const home = priceForFootballOutcome(h2h?.outcomes, e.home_team);
      const away = priceForFootballOutcome(h2h?.outcomes, e.away_team);
      const draw = priceForFootballOutcome(h2h?.outcomes, "Draw");
      const over = priceForFootballOutcome(totals?.outcomes, "Over");
      const under = priceForFootballOutcome(totals?.outcomes, "Under");
      const totalLine = pointForFootballOutcome(totals?.outcomes, "Over", 2.5);

      return {
        id: e.id,
        competition: (e as OddsEvent & { _label: string })._label,
        commenceTime: e.commence_time,
        homeTeam: e.home_team,
        awayTeam: e.away_team,
        bookmaker: h2h?.bookmaker ?? "Unavailable",
        odds: { home, draw, away, over, under, totalLine },
      };
    }).sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

    if (matches.length === 0) {
      return footballDataFixtureFallback("The Odds API returned no football markets for the configured sports and region");
    }

    const quota = allEvents
      .map(e => e as OddsEvent & { _quotaRemaining?: string | null; _quotaUsed?: string | null })
      .find(e => e._quotaRemaining || e._quotaUsed);

    return Response.json({
      matches,
      source: "live-odds",
      demo: false,
      provider: {
        name: "The Odds API",
        configured: true,
        live: true,
        regions: REGIONS,
        sports: SPORTS.map(sport => sport.key),
        requestsRemaining: quota?._quotaRemaining ?? null,
        requestsUsed: quota?._quotaUsed ?? null,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return demoFixtureFallback();
  }
}
