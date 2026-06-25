import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group");
  const stage = searchParams.get("stage");
  const status = searchParams.get("status");
  const sql = getSql();

  try {
    const rows = await sql`
      SELECT
        m.id, m.utc_date, m.status, m.stage, m.matchday, m.group_name,
        m.home_id, m.home_name, m.home_tla, m.home_crest,
        m.away_id, m.away_name, m.away_tla, m.away_crest,
        m.score_home, m.score_away, m.winner,
        p.p_home_win, p.p_draw, p.p_away_win,
        p.expected_home, p.expected_away, p.top_scores
      FROM wc_matches m
      LEFT JOIN wc_predictions p ON p.match_id = m.id
      WHERE 1=1
        ${group ? sql`AND m.group_name = ${group}` : sql``}
        ${stage ? sql`AND m.stage = ${stage}` : sql``}
        ${status ? sql`AND m.status = ${status}` : sql``}
      ORDER BY m.utc_date ASC
    `;
    return NextResponse.json({ matches: rows, count: rows.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
