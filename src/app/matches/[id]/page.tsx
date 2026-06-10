import { notFound } from "next/navigation";
import Link from "next/link";
import { WDLBar, MarketRow } from "@/components/ProbabilityBars";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import DriverBreakdown from "@/components/DriverBreakdown";
import type { MatchDetail } from "@/lib/api";

function getMatchFromStatic(id: string): MatchDetail | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require("@/data/fixtures.json");
    const fixture = (data.fixtures ?? []).find(
      (f: { id: number }) => String(f.id) === id
    );
    if (!fixture) return null;
    return {
      id: fixture.id,
      home_team: {
        id: 0,
        name: fixture.home_team,
        attack_strength: fixture.home_attack ?? null,
        defense_strength: null,
        current_elo: fixture.home_elo ?? null,
      },
      away_team: {
        id: 0,
        name: fixture.away_team,
        attack_strength: fixture.away_attack ?? null,
        defense_strength: null,
        current_elo: fixture.away_elo ?? null,
      },
      kickoff_utc: fixture.kickoff_utc,
      status: fixture.status,
      result: null,
      prediction: fixture.prediction,
      disclaimer:
        "These are model-derived probability estimates. Football is inherently uncertain — single matches are high variance. This is analysis only. You decide what to do with it.",
    };
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function generateStaticParams() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require("@/data/fixtures.json");
    return (data.fixtures ?? []).map((f: { id: number }) => ({ id: String(f.id) }));
  } catch {
    return [];
  }
}

export default function MatchPage({
  params,
}: {
  params: { id: string };
}) {
  const match = getMatchFromStatic(params.id);
  if (!match) notFound();

  const pred = match.prediction;
  const home = match.home_team;
  const away = match.away_team;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Back */}
      <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1">
        ← All fixtures
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            <p className="text-xl font-bold text-slate-100">{home.name}</p>
            {home.current_elo && (
              <p className="text-xs text-slate-400 mt-0.5">Elo {Math.round(home.current_elo)}</p>
            )}
          </div>
          <div className="text-slate-500 font-bold text-lg">vs</div>
          <div className="text-center flex-1">
            <p className="text-xl font-bold text-slate-100">{away.name}</p>
            {away.current_elo && (
              <p className="text-xs text-slate-400 mt-0.5">Elo {Math.round(away.current_elo)}</p>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-400 text-center">{formatDate(match.kickoff_utc)}</p>

        {match.result && (
          <div className="text-center py-2 bg-slate-700/50 rounded-lg">
            <span className="text-2xl font-bold text-slate-100">
              {match.result.home_goals} – {match.result.away_goals}
            </span>
            <p className="text-xs text-slate-400 mt-1">Final score</p>
          </div>
        )}
      </div>

      {/* No prediction */}
      {!pred && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-5 py-4 text-slate-400 text-sm">
          No model prediction available for this fixture yet. Run{" "}
          <code className="text-slate-300">POST /api/admin/fit</code> to generate predictions.
        </div>
      )}

      {pred && (
        <>
          {/* W / D / L */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-200">
                Match outcome probability
              </h2>
              {pred.confidence && <ConfidenceBadge level={pred.confidence} />}
            </div>
            <WDLBar
              home={home.name}
              away={away.name}
              pHome={pred.p_home_win}
              pDraw={pred.p_draw}
              pAway={pred.p_away_win}
            />
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-green-900/30 rounded-lg p-3">
                <p className="text-xl font-bold text-green-400">
                  {(pred.p_home_win * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{home.name} win</p>
              </div>
              <div className="bg-slate-700/40 rounded-lg p-3">
                <p className="text-xl font-bold text-slate-300">
                  {(pred.p_draw * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Draw</p>
              </div>
              <div className="bg-blue-900/30 rounded-lg p-3">
                <p className="text-xl font-bold text-blue-400">
                  {(pred.p_away_win * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{away.name} win</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Model expected goals — {home.name}: {pred.lambda_home.toFixed(2)} · {away.name}:{" "}
              {pred.lambda_away.toFixed(2)}
            </p>
          </section>

          {/* Over/Under + BTTS */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-200">Other markets</h2>
            <div className="space-y-3">
              <MarketRow
                label="Goals"
                left="Over 2.5"
                right="Under 2.5"
                pLeft={pred.p_over_2_5}
                pRight={pred.p_under_2_5}
              />
              <MarketRow
                label="Both teams to score"
                left="Yes"
                right="No"
                pLeft={pred.p_btts}
                pRight={1 - pred.p_btts}
              />
            </div>
          </section>

          {/* Top correct scores */}
          {pred.top_correct_scores && pred.top_correct_scores.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-200">
                Most likely scorelines
              </h2>
              <div className="grid grid-cols-5 gap-2">
                {pred.top_correct_scores.map(({ score, prob }) => (
                  <div
                    key={score}
                    className="bg-slate-700/60 rounded-lg p-2 text-center"
                  >
                    <p className="font-bold text-slate-100 text-sm">{score}</p>
                    <p className="text-xs text-slate-400">
                      {(prob * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                Individual scoreline probabilities from the Dixon-Coles matrix.
              </p>
            </section>
          )}

          {/* Elo cross-check */}
          {pred.elo_home_win_prob != null && (
            <section className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 flex items-center gap-3">
              <span className="text-slate-400 text-sm">Elo cross-check — home win:</span>
              <span className="font-semibold text-slate-200">
                {(pred.elo_home_win_prob * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 ml-1">
                (Dixon-Coles: {(pred.p_home_win * 100).toFixed(1)}%)
              </span>
            </section>
          )}

          {/* Driver breakdown */}
          {pred.drivers ? (
            <section className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
              <h2 className="text-lg font-semibold text-slate-200">
                Why the model says this
              </h2>
              <p className="text-xs text-slate-400">
                Each driver shows which factors are pushing the model towards one
                side. These are transparent model inputs, not a recommendation.
              </p>
              <DriverBreakdown
                drivers={pred.drivers}
                homeName={home.name}
                awayName={away.name}
              />
            </section>
          ) : pred.tier_gate ? (
            <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
              {pred.tier_gate}
            </div>
          ) : null}

          {/* Disclaimer */}
          <p className="text-xs text-slate-600 border-t border-slate-800 pt-4 leading-relaxed">
            {match.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
