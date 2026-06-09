import Link from "next/link";
import type { FixtureSummary } from "@/lib/api";
import { WDLBar } from "./ProbabilityBars";
import ConfidenceBadge from "./ConfidenceBadge";

function formatKickoff(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default function FixtureCard({ fixture }: { fixture: FixtureSummary }) {
  const pred = fixture.prediction;

  return (
    <Link
      href={`/matches/${fixture.id}`}
      className="block rounded-xl border border-slate-700 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800 transition-colors p-4 space-y-3"
    >
      {/* Teams */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-100 flex-1">{fixture.home_team}</span>
        <span className="text-xs text-slate-500 font-medium bg-slate-700 px-2 py-0.5 rounded">vs</span>
        <span className="font-semibold text-slate-100 flex-1 text-right">{fixture.away_team}</span>
      </div>

      {/* Kickoff */}
      <p className="text-xs text-slate-400">{formatKickoff(fixture.kickoff_utc)}</p>

      {/* Prediction */}
      {pred ? (
        <div className="space-y-2">
          <WDLBar
            home={fixture.home_team}
            away={fixture.away_team}
            pHome={pred.p_home_win}
            pDraw={pred.p_draw}
            pAway={pred.p_away_win}
          />
          <div className="flex items-center justify-between">
            {pred.confidence && <ConfidenceBadge level={pred.confidence} />}
            <span className="text-xs text-slate-500 ml-auto">View full analysis →</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          Full model analysis available on Paid plan.
        </p>
      )}
    </Link>
  );
}
