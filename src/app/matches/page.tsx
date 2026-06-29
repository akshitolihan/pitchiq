"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getFootballPrediction } from "@/lib/odds-utils";

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  commenceTime: string;
  odds: { home: number; draw: number; away: number };
}

interface GroupedMatches {
  [competition: string]: Match[];
}

function TierBadge({ tier }: { tier: "Strong" | "Moderate" | "Competitive" }) {
  const cfg = {
    Strong:      { color: "var(--green)",   bg: "rgba(22,199,132,0.12)" },
    Moderate:    { color: "var(--warning)", bg: "rgba(245,166,35,0.12)" },
    Competitive: { color: "var(--secondary)", bg: "var(--elevated)" },
  }[tier];
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}>
      {tier}
    </span>
  );
}

function MatchRow({ match }: { match: Match }) {
  const pred = getFootballPrediction(
    match.homeTeam, match.awayTeam,
    match.odds.home, match.odds.draw, match.odds.away
  );
  const kickoff = new Date(match.commenceTime);
  const timeStr = kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = kickoff.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
  const isToday = kickoff.toDateString() === new Date().toDateString();

  return (
    <Link href={`/betting/football/${match.id}`}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors group"
      style={{ borderBottom: "1px solid var(--border)" }}>

      {/* Date/Time */}
      <div className="w-14 shrink-0 text-center">
        <p className="text-xs font-bold" style={{
          color: isToday ? "var(--green)" : "var(--secondary)",
          fontFamily: "var(--font-body)",
        }}>
          {isToday ? "Today" : dateStr.split(" ")[0]}
        </p>
        <p className="text-xs tabular-nums" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
          {timeStr}
        </p>
      </div>

      {/* Teams + Prediction */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-body)" }}>
            {match.homeTeam}
          </span>
          <span className="text-xs shrink-0" style={{ color: "var(--secondary)" }}>vs</span>
          <span className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-body)" }}>
            {match.awayTeam}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--secondary)" }}>
            Pick: <span style={{ color: "var(--white)" }}>{pred.teamLabel}</span>
          </span>
          <span className="text-xs tabular-nums" style={{ color: "var(--secondary)" }}>
            {pred.confidence}%
          </span>
        </div>
      </div>

      {/* Probability bar */}
      <div className="w-20 shrink-0 hidden sm:block">
        <div className="flex h-1 rounded-full overflow-hidden gap-px mb-1">
          <div style={{ width: `${pred.homeP * 100}%`, background: "var(--green)", borderRadius: 2 }} />
          <div style={{ width: `${pred.drawP * 100}%`, background: "var(--secondary)", borderRadius: 2 }} />
          <div style={{ width: `${pred.awayP * 100}%`, background: "var(--cyan, #06b6d4)", borderRadius: 2 }} />
        </div>
        <div className="flex justify-between text-xs tabular-nums" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)", fontSize: 10 }}>
          <span>{Math.round(pred.homeP * 100)}%</span>
          <span>{Math.round(pred.drawP * 100)}%</span>
          <span>{Math.round(pred.awayP * 100)}%</span>
        </div>
      </div>

      {/* Tier */}
      <div className="shrink-0">
        <TierBadge tier={pred.tier} />
      </div>

      <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--secondary)" }}>→</span>
    </Link>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "strong">("all");

  useEffect(() => {
    fetch("/api/odds/football")
      .then(r => r.json())
      .then((data: { matches?: Match[] }) => { setMatches(data.matches ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const displayed = filter === "strong"
    ? matches.filter(m => {
        const p = getFootballPrediction(m.homeTeam, m.awayTeam, m.odds.home, m.odds.draw, m.odds.away);
        return p.tier === "Strong";
      })
    : matches;

  const grouped: GroupedMatches = displayed.reduce((acc, m) => {
    (acc[m.competition] ??= []).push(m);
    return acc;
  }, {} as GroupedMatches);

  const strongCount = matches.filter(m => {
    const p = getFootballPrediction(m.homeTeam, m.awayTeam, m.odds.home, m.odds.draw, m.odds.away);
    return p.tier === "Strong";
  }).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ fontFamily: "var(--font-heading)" }}>Matches</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
          Football fixtures with AI predictions
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {(["all", "strong"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              background: filter === f ? "var(--green)" : "var(--surface)",
              color: filter === f ? "#0B0E13" : "var(--secondary)",
              border: `1px solid ${filter === f ? "var(--green)" : "var(--border)"}`,
              fontFamily: "var(--font-heading)",
            }}>
            {f === "all" ? `All (${matches.length})` : `Strong Picks (${strongCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border p-12 text-center"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-bold" style={{ fontFamily: "var(--font-heading)" }}>No matches available</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>Check back soon for upcoming fixtures</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([comp, compMatches]) => (
            <div key={comp} className="rounded-2xl overflow-hidden border"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              {/* Competition header */}
              <div className="px-4 py-2.5 border-b flex items-center justify-between"
                style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
                <span className="text-xs font-black uppercase tracking-wider"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--secondary)" }}>
                  ⚽ {comp}
                </span>
                <span className="text-xs" style={{ color: "var(--secondary)" }}>
                  {compMatches.length} match{compMatches.length !== 1 ? "es" : ""}
                </span>
              </div>
              {/* Match rows */}
              {compMatches.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
