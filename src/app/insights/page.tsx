"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BetSelection, useBetSlip } from "@/contexts/BetSlipContext";
import { computeFootballMarkets, getFootballPrediction, getTennisPrediction } from "@/lib/odds-utils";

interface FootballMatch {
  id: string;
  competition?: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmaker: string;
  odds: { home: number | null; draw: number | null; away: number | null; over: number | null; under: number | null; totalLine: number };
  prediction?: { pHomeWin: number; pDraw: number; pAwayWin: number; pBtts: number; pOver25: number };
}

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

type SportFilter = "all" | "football" | "tennis";
type TierFilter = "all" | "Strong" | "Moderate" | "Competitive";

interface InsightItem {
  id: string;
  sport: "football" | "tennis";
  title: string;
  competition: string;
  commenceTime: string;
  pick: string;
  market: string;
  modelOdds: number;
  confidence: number;
  tier: "Strong" | "Moderate" | "Competitive";
  tags: string[];
  detailHref: string;
  selection: BetSelection;
}

async function fetchMarket<T>(url: string, fallback: T): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

function formatKickoff(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kickoff pending";
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

function tierTone(tier: InsightItem["tier"]) {
  if (tier === "Strong") return "var(--green)";
  if (tier === "Moderate") return "var(--warning)";
  return "var(--secondary)";
}

function tierBg(tier: InsightItem["tier"]) {
  if (tier === "Strong") return "rgba(22,199,132,0.12)";
  if (tier === "Moderate") return "rgba(245,166,35,0.12)";
  return "rgba(255,255,255,0.05)";
}

function footballInsight(match: FootballMatch): InsightItem {
  const prediction = getFootballPrediction(match.homeTeam, match.awayTeam, match.odds.home, match.odds.draw, match.odds.away);
  const input = match.prediction ?? {
    pHomeWin: match.odds.home ? 1 / match.odds.home : 0.4,
    pDraw: match.odds.draw ? 1 / match.odds.draw : 0.25,
    pAwayWin: match.odds.away ? 1 / match.odds.away : 0.35,
    pBtts: 0.52,
    pOver25: 0.55,
  };
  const markets = computeFootballMarkets({
    ...input,
    realHome: match.odds.home,
    realDraw: match.odds.draw,
    realAway: match.odds.away,
    realOver: match.odds.over,
    realUnder: match.odds.under,
  });
  const title = `${match.homeTeam} vs ${match.awayTeam}`;
  const pick = prediction.outcome === "Home Win" ? match.homeTeam : prediction.outcome === "Away Win" ? match.awayTeam : "Draw";
  const selectionKey = prediction.outcome === "Home Win" ? "home" : prediction.outcome === "Away Win" ? "away" : "draw";
  const odds = prediction.outcome === "Home Win" ? markets.homeWin : prediction.outcome === "Away Win" ? markets.awayWin : markets.draw;
  const favoriteGap = Math.max(prediction.homeP, prediction.drawP, prediction.awayP) - [...[prediction.homeP, prediction.drawP, prediction.awayP].sort((a, b) => b - a)][1];
  const tags = [
    prediction.confidence >= 60 ? "High conviction" : prediction.confidence >= 48 ? "Model lean" : "Close match",
    favoriteGap >= 15 ? "Clear separation" : "Thin edge",
    match.bookmaker.toLowerCase().includes("demo") ? "Demo data" : "Live feed",
  ];

  return {
    id: `football-${match.id}`,
    sport: "football",
    title,
    competition: match.competition ?? "Football",
    commenceTime: match.commenceTime,
    pick,
    market: "1X2",
    modelOdds: odds,
    confidence: prediction.confidence,
    tier: prediction.tier,
    tags,
    detailHref: `/betting/football/${match.id}`,
    selection: {
      id: `${match.id}||1X2||${selectionKey}`,
      matchId: match.id,
      matchTitle: title,
      sport: "football",
      commenceTime: match.commenceTime,
      competition: match.competition ?? "Football",
      market: "1X2",
      outcome: pick,
      odds,
    },
  };
}

function tennisInsight(match: TennisMatch): InsightItem {
  const prediction = getTennisPrediction(match.player1, match.player2, match.odds.p1, match.odds.p2);
  const p1Selected = prediction.winnerLabel === match.player1;
  const title = `${match.player1} vs ${match.player2}`;
  const confidenceGap = Math.abs(prediction.p1P - prediction.p2P);
  const tags = [
    prediction.confidence >= 70 ? "High conviction" : prediction.confidence >= 58 ? "Model lean" : "Close match",
    confidenceGap >= 20 ? "Clear separation" : "Thin edge",
    match.surface,
  ];

  return {
    id: `tennis-${match.id}`,
    sport: "tennis",
    title,
    competition: match.tournament,
    commenceTime: match.commenceTime,
    pick: prediction.winnerLabel,
    market: "Match Winner",
    modelOdds: p1Selected ? match.odds.p1 ?? 1.01 : match.odds.p2 ?? 1.01,
    confidence: prediction.confidence,
    tier: prediction.tier,
    tags,
    detailHref: `/betting/tennis/${match.id}`,
    selection: {
      id: `${match.id}||MW||${p1Selected ? "p1" : "p2"}`,
      matchId: match.id,
      matchTitle: title,
      sport: "tennis",
      commenceTime: match.commenceTime,
      competition: match.tournament,
      market: "Match Winner",
      outcome: prediction.winnerLabel,
      odds: p1Selected ? match.odds.p1 ?? 1.01 : match.odds.p2 ?? 1.01,
    },
  };
}

export default function InsightsPage() {
  const [football, setFootball] = useState<FootballMatch[]>([]);
  const [tennisAtp, setTennisAtp] = useState<TennisMatch[]>([]);
  const [tennisWta, setTennisWta] = useState<TennisMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const { toggleSelection, isSelected, state } = useBetSlip();

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchMarket<{ matches?: FootballMatch[] }>("/api/odds/football", { matches: [] }),
      fetchMarket<{ matches?: TennisMatch[] }>("/api/odds/tennis?tour=atp", { matches: [] }),
      fetchMarket<{ matches?: TennisMatch[] }>("/api/odds/tennis?tour=wta", { matches: [] }),
    ]).then(([footballData, atpData, wtaData]) => {
      if (!mounted) return;
      setFootball(footballData.matches ?? []);
      setTennisAtp(atpData.matches ?? []);
      setTennisWta(wtaData.matches ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const insights = useMemo(() => {
    return [
      ...football.map(footballInsight),
      ...[...tennisAtp, ...tennisWta].map(tennisInsight),
    ].sort((a, b) => {
      const tierRank = { Strong: 0, Moderate: 1, Competitive: 2 };
      return tierRank[a.tier] - tierRank[b.tier] || b.confidence - a.confidence;
    });
  }, [football, tennisAtp, tennisWta]);

  const filtered = insights.filter(item => {
    const sportMatch = sportFilter === "all" || item.sport === sportFilter;
    const tierMatch = tierFilter === "all" || item.tier === tierFilter;
    return sportMatch && tierMatch;
  });

  const strongCount = insights.filter(item => item.tier === "Strong").length;
  const moderateCount = insights.filter(item => item.tier === "Moderate").length;
  const avgConfidence = insights.length
    ? insights.reduce((total, item) => total + item.confidence, 0) / insights.length
    : 0;

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Premium analysis workspace
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Insights
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Ranked model recommendations with confidence, risk tags, and one-click planning.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/planner"
            className="px-4 py-2 rounded-xl text-sm font-bold border"
            style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}
          >
            Open planner ({state.selections.length})
          </Link>
          <Link
            href="/betting"
            className="px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Markets
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Analysed</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{insights.length}</p>
        </div>
        <button
          onClick={() => setTierFilter("Strong")}
          className="rounded-xl border p-4 text-left"
          style={{ background: "rgba(22,199,132,0.08)", borderColor: "rgba(22,199,132,0.35)" }}
        >
          <p className="text-xs font-bold uppercase" style={{ color: "var(--green)" }}>Strong</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{strongCount}</p>
        </button>
        <button
          onClick={() => setTierFilter("Moderate")}
          className="rounded-xl border p-4 text-left"
          style={{ background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.35)" }}
        >
          <p className="text-xs font-bold uppercase" style={{ color: "var(--warning)" }}>Moderate</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{moderateCount}</p>
        </button>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Avg confidence</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{avgConfidence.toFixed(0)}%</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "football", "tennis"] as SportFilter[]).map(value => (
            <button
              key={value}
              onClick={() => setSportFilter(value)}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border capitalize"
              style={{
                background: sportFilter === value ? "var(--green)" : "var(--surface)",
                color: sportFilter === value ? "#000" : "var(--secondary)",
                borderColor: sportFilter === value ? "var(--green)" : "var(--border)",
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "Strong", "Moderate", "Competitive"] as TierFilter[]).map(value => (
            <button
              key={value}
              onClick={() => setTierFilter(value)}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border"
              style={{
                background: tierFilter === value ? "var(--green)" : "var(--surface)",
                color: tierFilter === value ? "#000" : "var(--secondary)",
                borderColor: tierFilter === value ? "var(--green)" : "var(--border)",
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[1, 2, 3, 4].map(item => (
            <div key={item} className="h-56 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No insights match this filter</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>Try a broader sport or confidence filter.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map(item => {
            const selected = isSelected(item.selection.id);
            return (
              <article
                key={item.id}
                className="rounded-xl border p-4 space-y-4"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className="text-xs font-black px-2 py-1 rounded-lg"
                        style={{ color: tierTone(item.tier), background: tierBg(item.tier) }}
                      >
                        {item.tier}
                      </span>
                      <span className="text-xs font-semibold capitalize" style={{ color: "var(--secondary)" }}>
                        {item.sport}
                      </span>
                      <span className="text-xs truncate" style={{ color: "var(--secondary)" }}>
                        {item.competition}
                      </span>
                    </div>
                    <h2 className="font-black text-lg leading-snug">{item.title}</h2>
                    <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>{formatKickoff(item.commenceTime)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-3xl font-black tabular-nums" style={{ color: tierTone(item.tier) }}>
                      {item.confidence.toFixed(0)}%
                    </p>
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>confidence</p>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl p-3" style={{ background: "var(--bg)" }}>
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>{item.market}</p>
                    <p className="font-black mt-0.5 truncate">{item.pick}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>Model odds</p>
                    <p className="font-black tabular-nums" style={{ color: "var(--cyan, #06b6d4)" }}>
                      {item.modelOdds.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ background: "var(--bg)", color: "var(--secondary)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={item.detailHref}
                    className="text-center rounded-xl px-4 py-2.5 text-sm font-bold border"
                    style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--bg)" }}
                  >
                    Open report
                  </Link>
                  <button
                    onClick={() => toggleSelection(item.selection)}
                    className="rounded-xl px-4 py-2.5 text-sm font-black"
                    style={{
                      background: selected ? "rgba(22,199,132,0.16)" : "var(--green)",
                      color: selected ? "var(--green)" : "#000",
                      border: selected ? "1px solid var(--green)" : "1px solid var(--green)",
                    }}
                  >
                    {selected ? "Planned" : "Add to plan"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
