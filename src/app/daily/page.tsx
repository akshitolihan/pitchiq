"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BetSelection, useBetSlip } from "@/contexts/BetSlipContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getFootballPrediction, getTennisPrediction } from "@/lib/odds-utils";

interface FootballMatch {
  id: string;
  competition?: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmaker: string;
  odds: { home: number | null; draw: number | null; away: number | null };
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

interface DailyIdea {
  id: string;
  sport: "football" | "tennis";
  title: string;
  competition: string;
  commenceTime: string;
  pick: string;
  market: string;
  odds: number;
  confidence: number;
  separation: number;
  rationale: string[];
  uniqueness: string;
  risk: "Low" | "Medium" | "High";
  detailHref: string;
  selection: BetSelection;
}

type RiskProfile = "steady" | "balanced" | "ambitious";

const PROFILE_COPY: Record<RiskProfile, { label: string; description: string; maxIdeas: number; minConfidence: number }> = {
  steady: {
    label: "Steady",
    description: "Prioritizes the highest confidence ideas, even if simulated upside is smaller.",
    maxIdeas: 2,
    minConfidence: 58,
  },
  balanced: {
    label: "Balanced",
    description: "Mixes confidence and reasonable upside for a practical daily review.",
    maxIdeas: 3,
    minConfidence: 52,
  },
  ambitious: {
    label: "Ambitious",
    description: "Allows more variance when the user wants a higher simulated target.",
    maxIdeas: 4,
    minConfidence: 46,
  },
};

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

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unscheduled";
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function riskFrom(confidence: number, separation: number): DailyIdea["risk"] {
  if (confidence >= 65 && separation >= 15) return "Low";
  if (confidence >= 54 && separation >= 8) return "Medium";
  return "High";
}

function footballIdea(match: FootballMatch): DailyIdea {
  const prediction = getFootballPrediction(match.homeTeam, match.awayTeam, match.odds.home, match.odds.draw, match.odds.away);
  const title = `${match.homeTeam} vs ${match.awayTeam}`;
  const pick = prediction.teamLabel;
  const odds = prediction.outcome === "Home Win"
    ? match.odds.home ?? 1.01
    : prediction.outcome === "Away Win"
      ? match.odds.away ?? 1.01
      : match.odds.draw ?? 1.01;
  const selectionKey = prediction.outcome === "Home Win" ? "home" : prediction.outcome === "Away Win" ? "away" : "draw";
  const sorted = [prediction.homeP, prediction.drawP, prediction.awayP].sort((a, b) => b - a);
  const separation = sorted[0] - sorted[1];

  return {
    id: `football-${match.id}`,
    sport: "football",
    title,
    competition: match.competition ?? "Football",
    commenceTime: match.commenceTime,
    pick,
    market: "1X2",
    odds,
    confidence: prediction.confidence,
    separation,
    rationale: [
      `${prediction.confidence.toFixed(0)}% model confidence on the leading outcome.`,
      `${separation.toFixed(0)} point separation from the next closest result.`,
      match.bookmaker.toLowerCase().includes("demo") ? "Demo-model slate, useful for MVP planning checks." : `Market source: ${match.bookmaker}.`,
    ],
    uniqueness: separation >= 18 ? "Clear favorite profile" : separation >= 10 ? "Useful separation, still needs lineup review" : "Thin-edge idea for watchlist only",
    risk: riskFrom(prediction.confidence, separation),
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

function tennisIdea(match: TennisMatch): DailyIdea {
  const prediction = getTennisPrediction(match.player1, match.player2, match.odds.p1, match.odds.p2);
  const p1Selected = prediction.winnerLabel === match.player1;
  const title = `${match.player1} vs ${match.player2}`;
  const separation = Math.abs(prediction.p1P - prediction.p2P);

  return {
    id: `tennis-${match.id}`,
    sport: "tennis",
    title,
    competition: match.tournament,
    commenceTime: match.commenceTime,
    pick: prediction.winnerLabel,
    market: "Match Winner",
    odds: p1Selected ? match.odds.p1 ?? 1.01 : match.odds.p2 ?? 1.01,
    confidence: prediction.confidence,
    separation,
    rationale: [
      `${prediction.confidence.toFixed(0)}% model confidence on the stronger side.`,
      `${separation.toFixed(0)} point player separation in the match-winner market.`,
      `${match.level} context on ${match.surface.toLowerCase()} surface.`,
    ],
    uniqueness: match.level.includes("1000") || match.level === "Grand Slam"
      ? "Higher-profile tournament context"
      : separation >= 18 ? "Strong favorite profile" : "Needs form and surface review",
    risk: riskFrom(prediction.confidence, separation),
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

function simulatedOutcome(ideas: DailyIdea[], stake: number) {
  return ideas.reduce((total, idea) => total + stake * idea.odds, 0);
}

export default function DailyPage() {
  const [football, setFootball] = useState<FootballMatch[]>([]);
  const [tennisAtp, setTennisAtp] = useState<TennisMatch[]>([]);
  const [tennisWta, setTennisWta] = useState<TennisMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RiskProfile>("balanced");
  const [target, setTarget] = useState(150);
  const [unit, setUnit] = useState(25);
  const { toggleSelection, isSelected } = useBetSlip();
  const { isPro } = useSubscription();

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

  const allIdeas = useMemo(() => {
    return [
      ...football.map(footballIdea),
      ...[...tennisAtp, ...tennisWta].map(tennisIdea),
    ].sort((a, b) => b.confidence - a.confidence || b.separation - a.separation);
  }, [football, tennisAtp, tennisWta]);

  const slateKey = useMemo(() => {
    const today = todayKey();
    if (allIdeas.some(idea => dayKey(idea.commenceTime) === today)) return today;
    return allIdeas
      .map(idea => dayKey(idea.commenceTime))
      .filter(key => key !== "unscheduled")
      .sort()[0] ?? "unscheduled";
  }, [allIdeas]);

  const slateIdeas = allIdeas.filter(idea => dayKey(idea.commenceTime) === slateKey);
  const profileConfig = PROFILE_COPY[profile];
  const candidates = slateIdeas
    .filter(idea => idea.confidence >= profileConfig.minConfidence || profile === "ambitious")
    .sort((a, b) => {
      const aScore = a.confidence + a.separation * 0.7 + (profile === "ambitious" ? a.odds * 4 : 0);
      const bScore = b.confidence + b.separation * 0.7 + (profile === "ambitious" ? b.odds * 4 : 0);
      return bScore - aScore;
    });
  const visibleCount = isPro ? profileConfig.maxIdeas : Math.min(2, profileConfig.maxIdeas);
  const dailyIdeas = candidates.slice(0, visibleCount);
  const lockedCount = Math.max(0, candidates.length - dailyIdeas.length);
  const projected = simulatedOutcome(dailyIdeas, unit);
  const gap = target - projected;
  const slateLabel = slateKey === todayKey() ? "Today's slate" : slateKey === "unscheduled" ? "Available slate" : "Next available slate";

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Daily confidence brief
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Daily Edge Brief
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            A daily analysis shortlist shaped around confidence, risk tolerance, and the user's simulated target.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/planner" className="px-4 py-2 rounded-xl text-sm font-bold border" style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}>
            Planner
          </Link>
          <Link href="/account" className="px-4 py-2 rounded-xl text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            {isPro ? "Manage Pro" : "Unlock Pro"}
          </Link>
        </div>
      </div>

      <section className="rounded-xl border p-4 md:p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>User target</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="rounded-xl px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <span className="text-xs" style={{ color: "var(--secondary)" }}>Simulated target</span>
                <input
                  value={target}
                  onChange={event => setTarget(Math.max(0, Number(event.target.value) || 0))}
                  type="number"
                  min="0"
                  className="mt-1 w-full bg-transparent outline-none text-lg font-black tabular-nums"
                />
              </label>
              <label className="rounded-xl px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <span className="text-xs" style={{ color: "var(--secondary)" }}>Unit size</span>
                <input
                  value={unit}
                  onChange={event => setUnit(Math.max(1, Number(event.target.value) || 1))}
                  type="number"
                  min="1"
                  className="mt-1 w-full bg-transparent outline-none text-lg font-black tabular-nums"
                />
              </label>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Requirement</p>
            <div className="mt-2 flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
              {(["steady", "balanced", "ambitious"] as RiskProfile[]).map(value => (
                <button
                  key={value}
                  onClick={() => setProfile(value)}
                  className="px-3 py-3 text-xs font-black"
                  style={{
                    background: profile === value ? "var(--green)" : "transparent",
                    color: profile === value ? "#000" : "var(--secondary)",
                  }}
                >
                  {PROFILE_COPY[value].label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => dailyIdeas.forEach(idea => toggleSelection(idea.selection))}
            disabled={dailyIdeas.length === 0}
            className="rounded-xl px-5 py-3 text-sm font-black"
            style={{
              background: dailyIdeas.length > 0 ? "var(--green)" : "var(--bg)",
              color: dailyIdeas.length > 0 ? "#000" : "rgba(255,255,255,0.24)",
              cursor: dailyIdeas.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Add brief to plan
          </button>
        </div>
        <p className="text-sm" style={{ color: "var(--secondary)" }}>{profileConfig.description}</p>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Slate", slateLabel],
          ["Ideas", dailyIdeas.length],
          ["Simulated outcome", `PQ$ ${projected.toFixed(2)}`],
          ["Target gap", gap <= 0 ? "Covered" : `PQ$ ${gap.toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>{label}</p>
            <p className="text-xl font-black mt-1 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        style={{
          background: isPro ? "rgba(22,199,132,0.08)" : "rgba(245,166,35,0.08)",
          borderColor: isPro ? "rgba(22,199,132,0.35)" : "rgba(245,166,35,0.35)",
        }}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: isPro ? "var(--green)" : "var(--warning)" }}>
            {isPro ? "Pro daily brief" : "Free daily preview"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            {isPro
              ? "Pro includes the full daily shortlist for the selected requirement profile."
              : "Free preview shows up to 2 daily ideas. Pro unlocks the complete daily shortlist."}
          </p>
        </div>
        {lockedCount > 0 && (
          <Link href="/account" className="shrink-0 text-center rounded-xl px-4 py-2.5 text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            Unlock {lockedCount} more
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {[1, 2, 3, 4].map(item => (
            <div key={item} className="h-64 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : dailyIdeas.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-lg font-black">No daily ideas available</p>
          <p className="text-sm mt-2" style={{ color: "var(--secondary)" }}>
            Try the Ambitious requirement or check Markets for more upcoming analysis data.
          </p>
          <Link href="/betting" className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            Open markets
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {dailyIdeas.map((idea, index) => {
            const selected = isSelected(idea.selection.id);
            return (
              <article key={idea.id} className="rounded-xl border p-4 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: index === 0 ? "var(--green)" : "var(--secondary)" }}>
                      {index === 0 ? "Primary idea" : `Idea ${index + 1}`} · {idea.risk} risk
                    </p>
                    <h2 className="font-black text-lg mt-1">{idea.title}</h2>
                    <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
                      {idea.competition} · {formatKickoff(idea.commenceTime)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-3xl font-black tabular-nums" style={{ color: "var(--green)" }}>{idea.confidence.toFixed(0)}%</p>
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>confidence</p>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl p-3" style={{ background: "var(--bg)" }}>
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>{idea.market}</p>
                    <p className="font-black truncate">{idea.pick}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>Model odds</p>
                    <p className="font-black tabular-nums" style={{ color: "var(--cyan, #06b6d4)" }}>{idea.odds.toFixed(2)}</p>
                  </div>
                </div>

                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--secondary)" }}>Why this is unique</p>
                  <p className="text-sm mt-1">{idea.uniqueness}</p>
                  <ul className="mt-3 space-y-2">
                    {idea.rationale.map(line => (
                      <li key={line} className="text-sm flex gap-2" style={{ color: "var(--secondary)" }}>
                        <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--green)" }} />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link href={idea.detailHref} className="text-center rounded-xl px-4 py-2.5 text-sm font-bold border" style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--bg)" }}>
                    Deep analysis
                  </Link>
                  <button
                    onClick={() => toggleSelection(idea.selection)}
                    className="rounded-xl px-4 py-2.5 text-sm font-black"
                    style={{
                      background: selected ? "rgba(22,199,132,0.16)" : "var(--green)",
                      color: selected ? "var(--green)" : "#000",
                      border: "1px solid var(--green)",
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
