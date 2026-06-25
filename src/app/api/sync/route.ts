import { NextResponse } from "next/server";
import { getWCMatches, getWCStandings } from "@/lib/football-api";
import { predict } from "@/lib/dixon-coles";
import { initDb, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    await initDb();
    const sql = getSql();
    const [matches, standings] = await Promise.all([getWCMatches(), getWCStandings()]);

    for (const m of matches) {
      // Skip matches where teams aren't assigned yet
      if (!m.homeTeam.id || !m.awayTeam.id) continue;
      await sql`
        INSERT INTO wc_matches (
          id, utc_date, status, stage, matchday, group_name,
          home_id, home_name, home_tla, home_crest,
          away_id, away_name, away_tla, away_crest,
          score_home, score_away, winner, updated_at
        ) VALUES (
          ${m.id}, ${m.utcDate}, ${m.status}, ${m.stage}, ${m.matchday}, ${m.group},
          ${m.homeTeam.id}, ${m.homeTeam.name}, ${m.homeTeam.tla}, ${m.homeTeam.crest},
          ${m.awayTeam.id}, ${m.awayTeam.name}, ${m.awayTeam.tla}, ${m.awayTeam.crest},
          ${m.score.fullTime.home}, ${m.score.fullTime.away}, ${m.score.winner}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          status     = EXCLUDED.status,
          score_home = EXCLUDED.score_home,
          score_away = EXCLUDED.score_away,
          winner     = EXCLUDED.winner,
          updated_at = NOW()
      `;

      if (m.status !== "FINISHED" && m.status !== "CANCELLED") {
        const pred = predict(m.homeTeam.name, m.awayTeam.name);
        await sql`
          INSERT INTO wc_predictions (
            match_id, p_home_win, p_draw, p_away_win,
            expected_home, expected_away, top_scores, updated_at
          ) VALUES (
            ${m.id}, ${pred.pHomeWin}, ${pred.pDraw}, ${pred.pAwayWin},
            ${pred.expectedHome}, ${pred.expectedAway},
            ${JSON.stringify(pred.topScores)}, NOW()
          )
          ON CONFLICT (match_id) DO UPDATE SET
            p_home_win    = EXCLUDED.p_home_win,
            p_draw        = EXCLUDED.p_draw,
            p_away_win    = EXCLUDED.p_away_win,
            expected_home = EXCLUDED.expected_home,
            expected_away = EXCLUDED.expected_away,
            top_scores    = EXCLUDED.top_scores,
            updated_at    = NOW()
        `;
      }
    }

    for (const group of standings) {
      if (!group.group) continue;
      for (const row of group.table) {
        await sql`
          INSERT INTO wc_standings (
            group_name, position, team_id, team_name, team_tla, team_crest,
            played, won, draw, lost, goals_for, goals_against, goal_diff, points, updated_at
          ) VALUES (
            ${group.group}, ${row.position}, ${row.team.id}, ${row.team.name},
            ${row.team.tla}, ${row.team.crest},
            ${row.playedGames}, ${row.won}, ${row.draw}, ${row.lost},
            ${row.goalsFor}, ${row.goalsAgainst}, ${row.goalDifference}, ${row.points}, NOW()
          )
          ON CONFLICT (group_name, team_id) DO UPDATE SET
            position      = EXCLUDED.position,
            played        = EXCLUDED.played,
            won           = EXCLUDED.won,
            draw          = EXCLUDED.draw,
            lost          = EXCLUDED.lost,
            goals_for     = EXCLUDED.goals_for,
            goals_against = EXCLUDED.goals_against,
            goal_diff     = EXCLUDED.goal_diff,
            points        = EXCLUDED.points,
            updated_at    = NOW()
        `;
      }
    }

    return NextResponse.json({
      ok: true,
      synced: { matches: matches.length, standingGroups: standings.length },
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("sync error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
