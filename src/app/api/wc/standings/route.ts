import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT group_name, position, team_id, team_name, team_tla, team_crest,
             played, won, draw, lost, goals_for, goals_against, goal_diff, points
      FROM wc_standings
      ORDER BY group_name ASC, points DESC, goal_diff DESC, goals_for DESC
    `;
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      const g = row.group_name as string;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(row);
    }
    return NextResponse.json({ standings: grouped });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
