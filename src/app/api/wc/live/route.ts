import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT m.id, m.utc_date, m.status, m.group_name, m.stage,
             m.home_name, m.home_tla, m.home_crest,
             m.away_name, m.away_tla, m.away_crest,
             m.score_home, m.score_away, m.winner,
             p.p_home_win, p.p_draw, p.p_away_win
      FROM wc_matches m
      LEFT JOIN wc_predictions p ON p.match_id = m.id
      WHERE m.status IN ('IN_PLAY', 'PAUSED')
      ORDER BY m.utc_date ASC
    `;
    return NextResponse.json({ live: rows, count: rows.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
