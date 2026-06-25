"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { computeTennisMarkets, getTennisPrediction } from "@/lib/odds-utils";
import OddsButton from "@/components/OddsButton";

interface TennisMatch {
  id: string;
  tournament: string;
  level: string;
  surface: string;
  player1: string;
  player2: string;
  commenceTime: string;
  bookmaker: string;
  odds: { p1: number | null; p2: number | null };
}

function MarketGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3 border-b" style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
        <h3 className="font-bold text-sm">{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--secondary)" }}>{description}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function TennisMatchPage({ params }: { params: { id: string } }) {
  const [match, setMatch] = useState<TennisMatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch both ATP and WTA
    Promise.all([
      fetch("/api/odds/tennis?tour=atp").then(r => r.json()),
      fetch("/api/odds/tennis?tour=wta").then(r => r.json()),
    ]).then(([atp, wta]) => {
      const all = [...(atp.matches ?? []), ...(wta.matches ?? [])];
      const found = all.find((m: TennisMatch) => m.id === params.id);
      setMatch(found ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-16">
        <p className="text-3xl mb-2">🎾</p>
        <p className="font-semibold">Match not found</p>
        <Link href="/betting" className="mt-3 inline-block text-sm" style={{ color: "var(--green)" }}>← Back to odds</Link>
      </div>
    );
  }

  const markets = computeTennisMarkets(match.odds.p1, match.odds.p2);
  const pred = getTennisPrediction(match.player1, match.player2, match.odds.p1, match.odds.p2);
  const matchTitle = `${match.player1} vs ${match.player2}`;
  const kickoff = new Date(match.commenceTime).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";

  const surfaceIcon = match.surface === "Grass" ? "🌿" : match.surface === "Clay" ? "🟤" : "💙";
  const levelColor = match.level === "Grand Slam" ? "#F59E0B" :
    match.level.includes("500") || match.level.includes("1000") ? "var(--cyan)" : "var(--secondary)";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      <Link href="/betting" className="inline-flex items-center gap-2 text-sm font-medium"
        style={{ color: "var(--secondary)" }}>
        ← Back to Odds
      </Link>

      {/* Match header */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs px-2 py-0.5 rounded" style={{ color: levelColor, background: "rgba(0,0,0,0.3)" }}>
              {match.level}
            </span>
            <span className="text-xs font-semibold" style={{ color: "var(--secondary)" }}>{match.tournament}</span>
            <span className="text-xs">{surfaceIcon} {match.surface}</span>
          </div>
          <span className="text-xs" style={{ color: "var(--secondary)" }}>{kickoff}</span>
        </div>
        <div className="flex items-center justify-between px-8 py-6">
          <div className="text-center flex-1">
            <p className="font-black text-lg">{match.player1}</p>
            <p className="text-2xl font-black mt-2 tabular-nums" style={{ color: "var(--green)" }}>
              {match.odds.p1?.toFixed(2) ?? "—"}
            </p>
          </div>
          <div className="text-center px-4">
            <p className="text-xl font-black" style={{ color: "var(--secondary)" }}>VS</p>
            <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>{match.bookmaker}</p>
          </div>
          <div className="text-center flex-1">
            <p className="font-black text-lg">{match.player2}</p>
            <p className="text-2xl font-black mt-2 tabular-nums" style={{ color: "var(--cyan)" }}>
              {match.odds.p2?.toFixed(2) ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Prediction Summary */}
      {(() => {
        const tierColor = pred.tier === "Strong" ? "var(--green)" : pred.tier === "Moderate" ? "#F59E0B" : "var(--secondary)";
        const tierBg = pred.tier === "Strong" ? "rgba(22,199,132,0.08)" : pred.tier === "Moderate" ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.03)";
        return (
          <div className="rounded-2xl border p-5 space-y-3" style={{ background: tierBg, borderColor: tierColor + "44" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: tierColor }}>
                  {pred.tier === "Strong" ? "🎯 Strong Pick" : pred.tier === "Moderate" ? "📊 Moderate Pick" : "⚖️ Competitive Match"}
                </p>
                <p className="text-xl font-black">{pred.winnerLabel} to Win</p>
                <p className="text-sm mt-0.5" style={{ color: "var(--secondary)" }}>
                  {pred.tier === "Strong" ? "Clear favourite based on market consensus" :
                   pred.tier === "Moderate" ? "Bookmakers lean this way — not a certainty" :
                   "Very close — either player could win"}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-4xl font-black tabular-nums" style={{ color: tierColor }}>{pred.confidence.toFixed(0)}%</p>
                <p className="text-xs" style={{ color: "var(--secondary)" }}>confidence</p>
              </div>
            </div>
            <div>
              <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden mb-2">
                <div style={{ width: `${pred.p1P}%`, background: "var(--green)", opacity: 0.85 }} />
                <div style={{ width: `${pred.p2P}%`, background: "#EF4444", opacity: 0.75 }} />
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--secondary)" }}>{match.player1} <strong style={{ color: "var(--white)" }}>{pred.p1P.toFixed(0)}%</strong></span>
                <span style={{ color: "var(--secondary)" }}>{match.player2} <strong style={{ color: "var(--white)" }}>{pred.p2P.toFixed(0)}%</strong></span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Market 1: Match Winner */}
      <MarketGroup title="Match Winner" description="Who wins the match outright?">
        <div className="flex gap-3">
          <OddsButton size="lg"
            selection={{ id: `${match.id}||MW||p1`, matchId: match.id, matchTitle, sport: "tennis", market: "Match Winner", outcome: match.player1, odds: markets.p1Win }}
            label={match.player1} />
          <OddsButton size="lg"
            selection={{ id: `${match.id}||MW||p2`, matchId: match.id, matchTitle, sport: "tennis", market: "Match Winner", outcome: match.player2, odds: markets.p2Win }}
            label={match.player2} />
        </div>
      </MarketGroup>

      {/* Market 2: Correct Score (best of 3) */}
      <MarketGroup title="Correct Score (Sets)" description="Predict the exact set score of the match">
        <div className="space-y-2">
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--secondary)" }}>{match.player1} wins</p>
          <div className="flex gap-2 mb-3">
            <OddsButton size="md"
              selection={{ id: `${match.id}||CS||20`, matchId: match.id, matchTitle, sport: "tennis", market: "Correct Score", outcome: `${match.player1} 2-0`, odds: markets.cs20 }}
              label="2–0" sublabel={match.player1} />
            <OddsButton size="md"
              selection={{ id: `${match.id}||CS||21`, matchId: match.id, matchTitle, sport: "tennis", market: "Correct Score", outcome: `${match.player1} 2-1`, odds: markets.cs21 }}
              label="2–1" sublabel={match.player1} />
          </div>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--secondary)" }}>{match.player2} wins</p>
          <div className="flex gap-2">
            <OddsButton size="md"
              selection={{ id: `${match.id}||CS||02`, matchId: match.id, matchTitle, sport: "tennis", market: "Correct Score", outcome: `${match.player2} 0-2`, odds: markets.cs02 }}
              label="0–2" sublabel={match.player2} />
            <OddsButton size="md"
              selection={{ id: `${match.id}||CS||12`, matchId: match.id, matchTitle, sport: "tennis", market: "Correct Score", outcome: `${match.player2} 1-2`, odds: markets.cs12 }}
              label="1–2" sublabel={match.player2} />
          </div>
        </div>
      </MarketGroup>

      {/* Market 3: Win at Least 1 Set */}
      <MarketGroup title="To Win a Set" description="Will the player win at least one set? Stakes returned if player wins match 2-0.">
        <div className="flex gap-2">
          <OddsButton size="lg"
            selection={{ id: `${match.id}||W1S||p1`, matchId: match.id, matchTitle, sport: "tennis", market: "To Win a Set", outcome: `${match.player1} to win at least 1 set`, odds: markets.p1WinSet }}
            label={match.player1} sublabel="Win ≥1 Set" />
          <OddsButton size="lg"
            selection={{ id: `${match.id}||W1S||p2`, matchId: match.id, matchTitle, sport: "tennis", market: "To Win a Set", outcome: `${match.player2} to win at least 1 set`, odds: markets.p2WinSet }}
            label={match.player2} sublabel="Win ≥1 Set" />
        </div>
      </MarketGroup>

      {/* Market 4: Total Sets */}
      <MarketGroup title="Total Sets" description="Will the match go to a deciding set?">
        <div className="flex gap-2">
          <OddsButton size="lg"
            selection={{ id: `${match.id}||TS||under`, matchId: match.id, matchTitle, sport: "tennis", market: "Total Sets", outcome: "Under 2.5 Sets (Straight sets)", odds: markets.under25Sets }}
            label="Under 2.5" sublabel="Straight sets" />
          <OddsButton size="lg"
            selection={{ id: `${match.id}||TS||over`, matchId: match.id, matchTitle, sport: "tennis", market: "Total Sets", outcome: "Over 2.5 Sets (3 sets)", odds: markets.over25Sets }}
            label="Over 2.5" sublabel="3 sets" />
        </div>
      </MarketGroup>

      <p className="text-xs" style={{ color: "var(--secondary)" }}>
        Match winner: {match.bookmaker} · Correct score & total sets derived from match win probability using ATP set model. For analysis purposes only.
      </p>
    </div>
  );
}
