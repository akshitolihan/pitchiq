export const dynamic = "force-dynamic";

export async function GET() {
  const oddsConfigured = Boolean(process.env.ODDS_API_KEY);
  const footballDataConfigured = Boolean(process.env.FOOTBALL_DATA_API_KEY);

  return Response.json({
    sources: [
      {
        id: "odds-api",
        name: "The Odds API",
        configured: oddsConfigured,
        usedFor: ["football odds", "tennis odds", "upcoming markets"],
        requiredEnv: "ODDS_API_KEY",
        optionalEnv: ["ODDS_API_REGIONS", "ODDS_API_FOOTBALL_SPORTS"],
        status: oddsConfigured ? "ready" : "missing-key",
      },
      {
        id: "football-data",
        name: "football-data.org",
        configured: footballDataConfigured,
        usedFor: ["football live scores"],
        requiredEnv: "FOOTBALL_DATA_API_KEY",
        status: footballDataConfigured ? "ready" : "missing-key",
      },
    ],
    updatedAt: new Date().toISOString(),
  });
}
