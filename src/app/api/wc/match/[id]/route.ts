import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { predict } from "@/lib/dixon-coles";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const sql = getSql();

  try {
    const rows = await sql`
      SELECT m.*, p.p_home_win, p.p_draw, p.p_away_win,
             p.expected_home, p.expected_away, p.top_scores,
             p.updated_at AS pred_updated_at
      FROM wc_matches m
      LEFT JOIN wc_predictions p ON p.match_id = m.id
      WHERE m.id = ${id}
    `;
    if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

    const match = rows[0];
    if (!match.p_home_win) {
      const pred = predict(match.home_name as string, match.away_name as string);
      Object.assign(match, {
        p_home_win: pred.pHomeWin, p_draw: pred.pDraw, p_away_win: pred.pAwayWin,
        expected_home: pred.expectedHome, expected_away: pred.expectedAway,
        top_scores: pred.topScores,
      });
    }
    return NextResponse.json({ match });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
