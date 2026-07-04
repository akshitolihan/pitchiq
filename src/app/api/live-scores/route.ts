export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  if (!apiKey) {
    return Response.json({
      matches: [],
      provider: {
        name: "football-data.org",
        configured: false,
        live: false,
        reason: "FOOTBALL_DATA_API_KEY is not configured",
      },
      error: "FOOTBALL_DATA_API_KEY not configured",
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    // Fetch live, today's finished, and today's upcoming in parallel
    const [liveRes, finishedRes, scheduledRes] = await Promise.all([
      fetch(
        "https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY&season=2026",
        { headers: { "X-Auth-Token": apiKey }, cache: "no-store" }
      ),
      fetch(
        "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED&season=2026",
        { headers: { "X-Auth-Token": apiKey }, cache: "no-store" }
      ),
      fetch(
        "https://api.football-data.org/v4/competitions/WC/matches?status=TIMED,SCHEDULED&season=2026",
        { headers: { "X-Auth-Token": apiKey }, cache: "no-store" }
      ),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parse = async (res: Response): Promise<any[]> => {
      if (!res.ok) return [];
      const d = await res.json();
      return d.matches ?? [];
    };

    const [live, finished, scheduled] = await Promise.all([
      parse(liveRes), parse(finishedRes), parse(scheduledRes),
    ]);

    // Only keep matches from today (UTC)
    const todayUTC = new Date().toISOString().slice(0, 10);
    const isToday = (m: any) => new Date(m.utcDate).toISOString().slice(0, 10) === todayUTC;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const format = (m: any, status: string) => ({
      homeTeam: m.homeTeam.name as string,
      awayTeam: m.awayTeam.name as string,
      homeScore: (m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null) as number | null,
      awayScore: (m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null) as number | null,
      minute: (m.minute ?? null) as number | null,
      utcDate: m.utcDate as string,
      stage: (m.stage ?? "") as string,
      group: (m.group ?? null) as string | null,
      status,
    });

    const matches = [
      ...live.map((m: any) => format(m, "LIVE")),
      ...finished.filter(isToday).map((m: any) => format(m, "FT")),
      ...scheduled.filter(isToday).map((m: any) => format(m, "UPCOMING")),
    ];

    // Sort: LIVE first, then by kickoff time
    matches.sort((a, b) => {
      if (a.status === "LIVE" && b.status !== "LIVE") return -1;
      if (b.status === "LIVE" && a.status !== "LIVE") return 1;
      return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    });

    return Response.json({
      matches,
      provider: {
        name: "football-data.org",
        configured: true,
        live: true,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({
      matches: [],
      provider: {
        name: "football-data.org",
        configured: true,
        live: false,
      },
      error: String(e),
      updatedAt: new Date().toISOString(),
    });
  }
}
