"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { computeFootballMarkets, getFootballPrediction } from "@/lib/odds-utils";
import OddsButton from "@/components/OddsButton";

const FLAG_MAP: Record<string, string> = {
  "Netherlands": "🇳🇱", "Sweden": "🇸🇪", "Germany": "🇩🇪", "Ivory Coast": "🇨🇮",
  "Ecuador": "🇪🇨", "Colombia": "🇨🇴", "Mexico": "🇲🇽", "United States": "🇺🇸",
  "Argentina": "🇦🇷", "France": "🇫🇷", "Brazil": "🇧🇷", "England": "🇬🇧",
  "Portugal": "🇵🇹", "Spain": "🇪🇸", "Italy": "🇮🇹", "Japan": "🇯🇵",
  "Morocco": "🇲🇦", "Senegal": "🇸🇳", "Uruguay": "🇺🇾", "Canada": "🇨🇦",
  "Croatia": "🇭🇷", "Belgium": "🇧🇪", "Denmark": "🇩🇰", "Switzerland": "🇨🇭",
  "Austria": "🇦🇹", "Poland": "🇵🇱", "Ukraine": "🇺🇦", "Serbia": "🇷🇸",
  "Australia": "🇦🇺", "Turkey": "🇹🇷", "South Korea": "🇰🇷", "Saudi Arabia": "🇸🇦",
  "Iran": "🇮🇷", "Nigeria": "🇳🇬", "Cameroon": "🇨🇲", "Ghana": "🇬🇭",
  "Egypt": "🇪🇬", "Chile": "🇨🇱", "Paraguay": "🇵🇾", "Venezuela": "🇻🇪",
  "Honduras": "🇭🇳", "Jamaica": "🇯🇲", "Panama": "🇵🇦", "South Africa": "🇿🇦",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Indonesia": "🇮🇩", "New Zealand": "🇳🇿", "Iraq": "🇮🇶",
  "Curaçao": "🇨🇼", "Czechia": "🇨🇿",
};

interface MatchData {
  id: string;
  competition?: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmaker: string;
  odds: { home: number | null; draw: number | null; away: number | null; over: number | null; under: number | null; totalLine: number };
  prediction?: { pHomeWin: number; pDraw: number; pAwayWin: number; pBtts: number; pOver25: number };
}

interface MarketGroupProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function MarketGroup({ title, description, children }: MarketGroupProps) {
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

export default function FootballMatchPage({ params }: { params: { id: string } }) {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/odds/football")
      .then(r => r.json())
      .then(data => {
        const found = (data.matches as MatchData[]).find(m => m.id === params.id);
        setMatch(found ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
        <p className="text-3xl mb-2">⚽</p>
        <p className="font-semibold">Match not found</p>
        <Link href="/betting" className="mt-3 inline-block text-sm" style={{ color: "var(--green)" }}>← Back to odds</Link>
      </div>
    );
  }

  const inputProbs = match.prediction ?? {
    pHomeWin: match.odds.home ? 1 / match.odds.home : 0.4,
    pDraw: match.odds.draw ? 1 / match.odds.draw : 0.25,
    pAwayWin: match.odds.away ? 1 / match.odds.away : 0.35,
    pBtts: 0.52,
    pOver25: 0.55,
  };

  const pred = getFootballPrediction(match.homeTeam, match.awayTeam, match.odds.home, match.odds.draw, match.odds.away);
  const markets = computeFootballMarkets({
    pHomeWin: inputProbs.pHomeWin,
    pDraw: inputProbs.pDraw,
    pAwayWin: inputProbs.pAwayWin,
    pBtts: inputProbs.pBtts,
    pOver25: inputProbs.pOver25,
    realHome: match.odds.home,
    realDraw: match.odds.draw,
    realAway: match.odds.away,
    realOver: match.odds.over,
    realUnder: match.odds.under,
  });

  const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;
  const hf = FLAG_MAP[match.homeTeam] ?? "🏳️";
  const af = FLAG_MAP[match.awayTeam] ?? "🏳️";
  const kickoff = new Date(match.commenceTime).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
  const isDemo = match.bookmaker.toLowerCase().includes("demo");

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Back */}
      <Link href="/betting" className="inline-flex items-center gap-2 text-sm font-medium"
        style={{ color: "var(--secondary)" }}>
        ← Back to Odds
      </Link>

      {isDemo && (
        <div className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.35)", color: "var(--warning)" }}>
          MVP demo mode: this match uses seeded model probabilities and demo odds for product testing.
        </div>
      )}

      {/* Match header */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--secondary)" }}>⚽ {match.competition ?? "Football"}</span>
          <span className="text-xs" style={{ color: "var(--secondary)" }}>{kickoff}</span>
        </div>
        <div className="flex items-center justify-between px-8 py-6">
          <div className="text-center">
            <span className="text-5xl">{hf}</span>
            <p className="font-bold text-sm mt-2">{match.homeTeam}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black" style={{ color: "var(--secondary)" }}>VS</p>
            <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>{match.bookmaker}</p>
          </div>
          <div className="text-center">
            <span className="text-5xl">{af}</span>
            <p className="font-bold text-sm mt-2">{match.awayTeam}</p>
          </div>
        </div>
      </div>

      {/* Prediction Summary */}
      {(() => {
        const tierColor = pred.tier === "Strong" ? "var(--green)" : pred.tier === "Moderate" ? "#F59E0B" : "var(--secondary)";
        const tierBg = pred.tier === "Strong" ? "rgba(22,199,132,0.08)" : pred.tier === "Moderate" ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.03)";
        const predLabel = pred.outcome === "Home Win" ? `${match.homeTeam} to Win` : pred.outcome === "Away Win" ? `${match.awayTeam} to Win` : "Draw";
        return (
          <div className="rounded-2xl border p-5 space-y-3" style={{ background: tierBg, borderColor: tierColor + "44" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: tierColor }}>
                  {pred.tier === "Strong" ? "🎯 Strong Pick" : pred.tier === "Moderate" ? "📊 Moderate Pick" : "⚖️ Competitive Match"}
                </p>
                <p className="text-xl font-black">{predLabel}</p>
                <p className="text-sm mt-0.5" style={{ color: "var(--secondary)" }}>
                  {pred.tier === "Strong" ? "Market consensus clearly favours this outcome" :
                   pred.tier === "Moderate" ? "Bookmakers lean this way — not a certainty" :
                   "Very close — either side could win"}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-4xl font-black tabular-nums" style={{ color: tierColor }}>{pred.confidence.toFixed(0)}%</p>
                <p className="text-xs" style={{ color: "var(--secondary)" }}>confidence</p>
              </div>
            </div>
            {/* Probability bar */}
            <div>
              <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden mb-2">
                <div style={{ width: `${pred.homeP}%`, background: "var(--green)", opacity: 0.85 }} />
                <div style={{ width: `${pred.drawP}%`, background: "var(--secondary)", opacity: 0.6 }} />
                <div style={{ width: `${pred.awayP}%`, background: "#EF4444", opacity: 0.75 }} />
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--secondary)" }}>{match.homeTeam} <strong style={{ color: "var(--white)" }}>{pred.homeP.toFixed(0)}%</strong></span>
                <span style={{ color: "var(--secondary)" }}>Draw <strong style={{ color: "var(--white)" }}>{pred.drawP.toFixed(0)}%</strong></span>
                <span style={{ color: "var(--secondary)" }}>{match.awayTeam} <strong style={{ color: "var(--white)" }}>{pred.awayP.toFixed(0)}%</strong></span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Market 1: 1X2 */}
      <MarketGroup title="1X2 — Match Result" description="Pick the result at full time (90 minutes)">
        <div className="flex gap-2">
          <OddsButton size="lg" selection={{ id: `${match.id}||1X2||home`, matchId: match.id, matchTitle, sport: "football", market: "1X2", outcome: match.homeTeam, odds: markets.homeWin }} label={`${hf} Home`} />
          <OddsButton size="lg" selection={{ id: `${match.id}||1X2||draw`, matchId: match.id, matchTitle, sport: "football", market: "1X2", outcome: "Draw", odds: markets.draw }} label="X Draw" />
          <OddsButton size="lg" selection={{ id: `${match.id}||1X2||away`, matchId: match.id, matchTitle, sport: "football", market: "1X2", outcome: match.awayTeam, odds: markets.awayWin }} label={`${af} Away`} />
        </div>
      </MarketGroup>

      {/* Market 2: Double Chance */}
      <MarketGroup title="Double Chance" description="Cover two outcomes — if one of your two selected results occurs, you win">
        <div className="flex gap-2">
          <OddsButton size="md" selection={{ id: `${match.id}||DC||1X`, matchId: match.id, matchTitle, sport: "football", market: "Double Chance", outcome: "1X (Home or Draw)", odds: markets.dc1X }} label="1X" sublabel="Home or Draw" />
          <OddsButton size="md" selection={{ id: `${match.id}||DC||X2`, matchId: match.id, matchTitle, sport: "football", market: "Double Chance", outcome: "X2 (Draw or Away)", odds: markets.dcX2 }} label="X2" sublabel="Draw or Away" />
          <OddsButton size="md" selection={{ id: `${match.id}||DC||12`, matchId: match.id, matchTitle, sport: "football", market: "Double Chance", outcome: "12 (Home or Away)", odds: markets.dc12 }} label="12" sublabel="Home or Away" />
        </div>
      </MarketGroup>

      {/* Market 3: Draw No Bet */}
      <MarketGroup title="Draw No Bet" description="If the match ends in a draw, your stake is returned. Otherwise win or lose.">
        <div className="flex gap-2">
          <OddsButton size="lg" selection={{ id: `${match.id}||DNB||home`, matchId: match.id, matchTitle, sport: "football", market: "Draw No Bet", outcome: `${match.homeTeam} DNB`, odds: markets.dnbHome }} label={`${hf} ${match.homeTeam}`} sublabel="DNB" />
          <OddsButton size="lg" selection={{ id: `${match.id}||DNB||away`, matchId: match.id, matchTitle, sport: "football", market: "Draw No Bet", outcome: `${match.awayTeam} DNB`, odds: markets.dnbAway }} label={`${af} ${match.awayTeam}`} sublabel="DNB" />
        </div>
      </MarketGroup>

      {/* Market 4: BTTS */}
      <MarketGroup title="Both Teams to Score (BTTS)" description="Will both teams score at least one goal?">
        <div className="flex gap-2">
          <OddsButton size="lg" selection={{ id: `${match.id}||BTTS||yes`, matchId: match.id, matchTitle, sport: "football", market: "BTTS", outcome: "Both Teams to Score — Yes", odds: markets.bttsYes }} label="Yes — BTTS" />
          <OddsButton size="lg" selection={{ id: `${match.id}||BTTS||no`, matchId: match.id, matchTitle, sport: "football", market: "BTTS", outcome: "Both Teams to Score — No", odds: markets.bttsNo }} label="No — BTTS" />
        </div>
      </MarketGroup>

      {/* Market 5: Over/Under */}
      <MarketGroup title={`Total Goals — Over/Under ${match.odds.totalLine}`} description="Total goals in the match at full time">
        <div className="flex gap-2">
          <OddsButton size="lg" selection={{ id: `${match.id}||OU||over`, matchId: match.id, matchTitle, sport: "football", market: `Over/Under ${match.odds.totalLine}`, outcome: `Over ${match.odds.totalLine} Goals`, odds: markets.over25 }} label={`Over ${match.odds.totalLine}`} />
          <OddsButton size="lg" selection={{ id: `${match.id}||OU||under`, matchId: match.id, matchTitle, sport: "football", market: `Over/Under ${match.odds.totalLine}`, outcome: `Under ${match.odds.totalLine} Goals`, odds: markets.under25 }} label={`Under ${match.odds.totalLine}`} />
        </div>
      </MarketGroup>

      <p className="text-xs" style={{ color: "var(--secondary)" }}>
        1X2 odds: {match.bookmaker} · DC / DNB / BTTS derived from Dixon-Coles model. For analysis purposes only.
      </p>
    </div>
  );
}
