export const dynamic = "force-dynamic";

const API_KEY = process.env.ODDS_API_KEY ?? "";
const BASE = "https://api.the-odds-api.com/v4";
const PREFERRED_BOOKS = ["pinnacle", "betfair_ex_eu", "williamhill", "bet365", "unibet", "nordicbet", "betsson"];

// Human-readable metadata for each tennis sport key
const SPORT_META: Record<string, { name: string; level: string; surface: string; tour: "atp" | "wta" }> = {
  // ATP
  tennis_atp_aus_open_singles:    { name: "Australian Open", level: "Grand Slam", surface: "Hard", tour: "atp" },
  tennis_atp_french_open:         { name: "French Open", level: "Grand Slam", surface: "Clay", tour: "atp" },
  tennis_atp_wimbledon:           { name: "Wimbledon", level: "Grand Slam", surface: "Grass", tour: "atp" },
  tennis_atp_us_open:             { name: "US Open", level: "Grand Slam", surface: "Hard", tour: "atp" },
  tennis_atp_indian_wells:        { name: "Indian Wells Masters", level: "ATP1000", surface: "Hard", tour: "atp" },
  tennis_atp_miami_open:          { name: "Miami Open", level: "ATP1000", surface: "Hard", tour: "atp" },
  tennis_atp_monte_carlo_masters: { name: "Monte-Carlo Masters", level: "ATP1000", surface: "Clay", tour: "atp" },
  tennis_atp_madrid_open:         { name: "Madrid Open", level: "ATP1000", surface: "Clay", tour: "atp" },
  tennis_atp_italian_open:        { name: "Italian Open", level: "ATP1000", surface: "Clay", tour: "atp" },
  tennis_atp_canadian_open:       { name: "Canadian Open", level: "ATP1000", surface: "Hard", tour: "atp" },
  tennis_atp_cincinnati_open:     { name: "Cincinnati Open", level: "ATP1000", surface: "Hard", tour: "atp" },
  tennis_atp_shanghai_masters:    { name: "Shanghai Masters", level: "ATP1000", surface: "Hard", tour: "atp" },
  tennis_atp_paris_masters:       { name: "Paris Masters", level: "ATP1000", surface: "Hard", tour: "atp" },
  tennis_atp_barcelona_open:      { name: "Barcelona Open", level: "ATP500", surface: "Clay", tour: "atp" },
  tennis_atp_dubai:               { name: "Dubai Duty Free Tennis", level: "ATP500", surface: "Hard", tour: "atp" },
  tennis_atp_queens_club_champ:   { name: "Queen's Club Championships", level: "ATP500", surface: "Grass", tour: "atp" },
  tennis_atp_halle_open:          { name: "Halle Open", level: "ATP500", surface: "Grass", tour: "atp" },
  tennis_atp_hamburg_open:        { name: "Hamburg Open", level: "ATP500", surface: "Clay", tour: "atp" },
  tennis_atp_china_open:          { name: "China Open", level: "ATP500", surface: "Hard", tour: "atp" },
  tennis_atp_munich:              { name: "BMW Open Munich", level: "ATP250", surface: "Clay", tour: "atp" },
  tennis_atp_qatar_open:          { name: "Qatar Open", level: "ATP250", surface: "Hard", tour: "atp" },
  // WTA
  tennis_wta_aus_open_singles:    { name: "Australian Open", level: "Grand Slam", surface: "Hard", tour: "wta" },
  tennis_wta_french_open:         { name: "French Open", level: "Grand Slam", surface: "Clay", tour: "wta" },
  tennis_wta_wimbledon:           { name: "Wimbledon", level: "Grand Slam", surface: "Grass", tour: "wta" },
  tennis_wta_us_open:             { name: "US Open", level: "Grand Slam", surface: "Hard", tour: "wta" },
  tennis_wta_indian_wells:        { name: "Indian Wells Open", level: "WTA1000", surface: "Hard", tour: "wta" },
  tennis_wta_miami_open:          { name: "Miami Open", level: "WTA1000", surface: "Hard", tour: "wta" },
  tennis_wta_madrid_open:         { name: "Madrid Open", level: "WTA1000", surface: "Clay", tour: "wta" },
  tennis_wta_italian_open:        { name: "Italian Open", level: "WTA1000", surface: "Clay", tour: "wta" },
  tennis_wta_canadian_open:       { name: "Canadian Open", level: "WTA1000", surface: "Hard", tour: "wta" },
  tennis_wta_cincinnati_open:     { name: "Cincinnati Open", level: "WTA1000", surface: "Hard", tour: "wta" },
  tennis_wta_china_open:          { name: "China Open", level: "WTA1000", surface: "Hard", tour: "wta" },
  tennis_wta_wuhan_open:          { name: "Wuhan Open", level: "WTA1000", surface: "Hard", tour: "wta" },
  tennis_wta_qatar_open:          { name: "Qatar TotalEnergies Open", level: "WTA500", surface: "Hard", tour: "wta" },
  tennis_wta_dubai:               { name: "Dubai Duty Free Tennis", level: "WTA500", surface: "Hard", tour: "wta" },
  tennis_wta_charleston_open:     { name: "Charleston Open", level: "WTA500", surface: "Clay", tour: "wta" },
  tennis_wta_stuttgart_open:      { name: "Porsche Tennis Grand Prix", level: "WTA500", surface: "Clay", tour: "wta" },
  tennis_wta_strasbourg:          { name: "Internationaux de Strasbourg", level: "WTA250", surface: "Clay", tour: "wta" },
  tennis_wta_german_open:         { name: "German Open (Hamburg)", level: "WTA250", surface: "Clay", tour: "wta" },
  tennis_wta_queens_club_champ:   { name: "Queen's Club Open", level: "WTA250", surface: "Grass", tour: "wta" },
};

const LEVEL_ORDER: Record<string, number> = {
  "Grand Slam": 0, "ATP1000": 1, "WTA1000": 1, "ATP500": 2, "WTA500": 2, "ATP250": 3, "WTA250": 3,
};

interface SportEntry { key: string; active: boolean; }
interface OddsOutcome { name: string; price: number; }
interface OddsMarket { key: string; outcomes: OddsOutcome[]; }
interface OddsBookmaker { key: string; title: string; markets: OddsMarket[]; }
interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

function getBestH2H(bookmakers: OddsBookmaker[]) {
  for (const key of PREFERRED_BOOKS) {
    const bk = bookmakers.find(b => b.key === key);
    if (!bk) continue;
    const mkt = bk.markets.find(m => m.key === "h2h");
    if (mkt && mkt.outcomes && mkt.outcomes.length >= 2) return { outcomes: mkt.outcomes, bookmaker: bk.title };
  }
  for (const bk of bookmakers) {
    const mkt = bk.markets.find(m => m.key === "h2h");
    if (mkt && mkt.outcomes && mkt.outcomes.length >= 2) return { outcomes: mkt.outcomes, bookmaker: bk.title };
  }
  return null;
}

async function fetchActiveTennisSports(tour: "atp" | "wta"): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/sports?apiKey=${API_KEY}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const sports: SportEntry[] = await res.json();
    return sports
      .filter(s => s.active && s.key.startsWith(`tennis_${tour}_`))
      .map(s => s.key);
  } catch { return []; }
}

async function fetchTennisSport(sportKey: string): Promise<OddsEvent[]> {
  try {
    const url = `${BASE}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tour = (searchParams.get("tour") ?? "atp") as "atp" | "wta";

  try {
    // Dynamically discover all active tennis sports for this tour
    const sportKeys = await fetchActiveTennisSports(tour);

    const allEvents = (await Promise.all(sportKeys.map(fetchTennisSport))).flat();

    const matches = allEvents.map(e => {
      const h2h = getBestH2H(e.bookmakers);
      const info = SPORT_META[e.sport_key] ?? {
        name: e.sport_key.replace(`tennis_${tour}_`, "").replace(/_/g, " "),
        level: tour === "atp" ? "ATP" : "WTA",
        surface: "Hard",
        tour,
      };

      return {
        id: e.id,
        sportKey: e.sport_key,
        tournament: info.name,
        level: info.level,
        surface: info.surface,
        player1: e.home_team,
        player2: e.away_team,
        commenceTime: e.commence_time,
        bookmaker: h2h?.bookmaker ?? "—",
        odds: {
          p1: h2h?.outcomes[0]?.price ?? null,
          p2: h2h?.outcomes[1]?.price ?? null,
        },
      };
    }).sort((a, b) => {
      // Sort by level first, then by time
      const la = LEVEL_ORDER[a.level] ?? 9;
      const lb = LEVEL_ORDER[b.level] ?? 9;
      if (la !== lb) return la - lb;
      return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
    });

    return Response.json({
      tour,
      activeSports: sportKeys,
      matches,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
