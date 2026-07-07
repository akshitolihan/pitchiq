"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFootballPrediction, getTennisPrediction } from "@/lib/odds-utils";
import { hasFootballBookmakerOdds, hasTennisBookmakerOdds } from "@/lib/market-availability";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FootballMatch {
  id: string;
  competition?: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmaker: string;
  odds: { home: number | null; draw: number | null; away: number | null; over: number | null; under: number | null; totalLine: number };
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

const FLAG: Record<string, string> = {
  "Netherlands":"🇳🇱","Sweden":"🇸🇪","Germany":"🇩🇪","Ivory Coast":"🇨🇮","Ecuador":"🇪🇨",
  "Colombia":"🇨🇴","Mexico":"🇲🇽","United States":"🇺🇸","Argentina":"🇦🇷","France":"🇫🇷",
  "Brazil":"🇧🇷","England":"🇬🇧","Portugal":"🇵🇹","Spain":"🇪🇸","Italy":"🇮🇹","Japan":"🇯🇵",
  "Morocco":"🇲🇦","Senegal":"🇸🇳","Uruguay":"🇺🇾","Canada":"🇨🇦","Croatia":"🇭🇷",
  "Belgium":"🇧🇪","Denmark":"🇩🇰","Switzerland":"🇨🇭","Austria":"🇦🇹","Poland":"🇵🇱",
  "Ukraine":"🇺🇦","Serbia":"🇷🇸","Australia":"🇦🇺","Turkey":"🇹🇷","South Korea":"🇰🇷",
  "Saudi Arabia":"🇸🇦","Iran":"🇮🇷","Nigeria":"🇳🇬","Cameroon":"🇨🇲","Ghana":"🇬🇭",
  "Egypt":"🇪🇬","Chile":"🇨🇱","Paraguay":"🇵🇾","Venezuela":"🇻🇪","Honduras":"🇭🇳",
  "Jamaica":"🇯🇲","Panama":"🇵🇦","South Africa":"🇿🇦","Indonesia":"🇮🇩","New Zealand":"🇳🇿",
  "Iraq":"🇮🇶","Tunisia":"🇹🇳","Cape Verde":"🇨🇻","Curaçao":"🇨🇼","Haiti":"🇭🇹","Qatar":"🇶🇦",
  "Costa Rica":"🇨🇷","Bolivia":"🇧🇴","Peru":"🇵🇪","Czechia":"🇨🇿",
};
const f = (t: string) => FLAG[t] ?? "🏳";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
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

// ─── Football Prediction Card (horizontal scroll) ─────────────────────────────

function FootballPredCard({ m }: { m: FootballMatch }) {
  const pred = getFootballPrediction(m.homeTeam, m.awayTeam, m.odds.home, m.odds.draw, m.odds.away);
  const tierColor = pred.tier === "Strong" ? "var(--green)" : pred.tier === "Moderate" ? "var(--warning)" : "var(--secondary)";
  const pickLabel = pred.outcome === "Home Win" ? m.homeTeam : pred.outcome === "Away Win" ? m.awayTeam : "Draw";
  const isDemo = m.bookmaker.toLowerCase().includes("demo");

  return (
    <Link href={`/betting/football/${m.id}`}
      className="card-hover shrink-0 w-56 rounded-2xl border overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Comp + time */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b"
        style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
        <span className="text-xs font-semibold truncate" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
          ⚽ {m.competition ?? "Football"}
        </span>
        <span className="text-xs shrink-0 ml-2" style={{ color: isDemo ? "var(--warning)" : "var(--secondary)" }}>
          {isDemo ? "Demo data" : fmtTime(m.commenceTime)}
        </span>
      </div>

      {/* Teams */}
      <div className="px-4 py-3 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xl">{f(m.homeTeam)}</span>
          <span className="text-sm font-semibold truncate">{m.homeTeam}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">{f(m.awayTeam)}</span>
          <span className="text-sm font-semibold truncate">{m.awayTeam}</span>
        </div>
      </div>

      {/* Prediction */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs" style={{ color: "var(--secondary)" }}>Prediction</p>
            <p className="text-sm font-black mt-0.5" style={{ color: tierColor, fontFamily: "var(--font-heading)" }}>
              {pickLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums" style={{ color: tierColor, fontFamily: "var(--font-heading)" }}>
              {pred.confidence.toFixed(0)}%
            </p>
            <p className="text-xs" style={{ color: "var(--secondary)" }}>{pred.tier}</p>
          </div>
        </div>
        {/* Prob bar */}
        <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
          <div style={{ width: `${pred.homeP}%`, background: "var(--green)", opacity: 0.8 }} />
          <div style={{ width: `${pred.drawP}%`, background: "var(--secondary)", opacity: 0.5 }} />
          <div style={{ width: `${pred.awayP}%`, background: "var(--danger)", opacity: 0.7 }} />
        </div>
      </div>
    </Link>
  );
}

// ─── Tennis Prediction Card ────────────────────────────────────────────────────

function TennisPredCard({ m }: { m: TennisMatch }) {
  const pred = getTennisPrediction(m.player1, m.player2, m.odds.p1, m.odds.p2);
  const tierColor = pred.tier === "Strong" ? "var(--green)" : pred.tier === "Moderate" ? "var(--warning)" : "var(--secondary)";
  const surfIcon = m.surface === "Grass" ? "🌿" : m.surface === "Clay" ? "🟤" : "💙";
  const levelColor = m.level === "Grand Slam" ? "#F59E0B" : m.level.includes("1000") ? "var(--cyan)" : "var(--secondary)";

  return (
    <Link href={`/betting/tennis/${m.id}`}
      className="card-hover shrink-0 w-56 rounded-2xl border overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b"
        style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
        <span className="text-xs font-bold truncate" style={{ color: levelColor, fontFamily: "var(--font-body)" }}>
          {surfIcon} {m.tournament}
        </span>
        <span className="text-xs shrink-0 ml-2" style={{ color: "var(--secondary)" }}>{fmtTime(m.commenceTime)}</span>
      </div>

      <div className="px-4 py-3 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-lg">🎾</span>
          <span className="text-sm font-semibold truncate">{m.player1}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">🎾</span>
          <span className="text-sm font-semibold truncate">{m.player2}</span>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs" style={{ color: "var(--secondary)" }}>Prediction</p>
            <p className="text-sm font-black mt-0.5 truncate" style={{ color: tierColor, fontFamily: "var(--font-heading)" }}>
              {pred.winnerLabel.split(" ").at(-1)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums" style={{ color: tierColor, fontFamily: "var(--font-heading)" }}>
              {pred.confidence.toFixed(0)}%
            </p>
            <p className="text-xs" style={{ color: "var(--secondary)" }}>{pred.tier}</p>
          </div>
        </div>
        <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
          <div style={{ width: `${pred.p1P}%`, background: "var(--green)", opacity: 0.8 }} />
          <div style={{ width: `${pred.p2P}%`, background: "var(--danger)", opacity: 0.7 }} />
        </div>
      </div>
    </Link>
  );
}

// ─── Tournament Row ────────────────────────────────────────────────────────────

function TournamentRow({ name, icon, count, strongCount, href }: {
  name: string; icon: string; count: number; strongCount: number; href: string;
}) {
  return (
    <Link href={href}
      className="card-hover flex items-center gap-4 px-5 py-4 rounded-xl border transition-all"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: "var(--elevated)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ fontFamily: "var(--font-heading)" }}>{name}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
          {count} upcoming match{count !== 1 ? "es" : ""}
          {strongCount > 0 && <span style={{ color: "var(--green)" }}> · {strongCount} strong pick{strongCount !== 1 ? "s" : ""}</span>}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {strongCount > 0 && (
          <span className="text-xs font-bold px-2 py-1 rounded-lg badge-strong">
            {strongCount} Strong
          </span>
        )}
        <span style={{ color: "var(--secondary)" }}>›</span>
      </div>
    </Link>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [football, setFootball] = useState<FootballMatch[]>([]);
  const [tennisAtp, setTennisAtp] = useState<TennisMatch[]>([]);
  const [tennisWta, setTennisWta] = useState<TennisMatch[]>([]);
  const [loading, setLoading] = useState(true);

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

  const allTennis = [...tennisAtp, ...tennisWta];
  const footballWithOdds = football.filter(hasFootballBookmakerOdds);
  const tennisWithOdds = allTennis.filter(hasTennisBookmakerOdds);
  const totalMatches = football.length + allTennis.length;
  const isDemoMode = football.some((match) => match.bookmaker.toLowerCase().includes("demo"));

  // Top predictions — strong picks first, then by confidence desc
  const topFootball = [...footballWithOdds]
    .map(m => ({ m, pred: getFootballPrediction(m.homeTeam, m.awayTeam, m.odds.home, m.odds.draw, m.odds.away) }))
    .sort((a, b) => {
      if (a.pred.tier === b.pred.tier) return b.pred.confidence - a.pred.confidence;
      const order = { Strong: 0, Moderate: 1, Competitive: 2 };
      return order[a.pred.tier] - order[b.pred.tier];
    })
    .slice(0, 8);

  const topTennis = [...tennisWithOdds]
    .map(m => ({ m, pred: getTennisPrediction(m.player1, m.player2, m.odds.p1, m.odds.p2) }))
    .sort((a, b) => b.pred.confidence - a.pred.confidence)
    .slice(0, 6);

  // Tournament groupings
  const fbByComp = football.reduce<Record<string, FootballMatch[]>>((acc, m) => {
    const comp = m.competition ?? "Football";
    (acc[comp] ??= []).push(m);
    return acc;
  }, {});

  const tennisByTournament = allTennis.reduce<Record<string, TennisMatch[]>>((acc, m) => {
    (acc[m.tournament] ??= []).push(m);
    return acc;
  }, {});

  const hour = new Date().getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8 pb-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm mb-1" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
            {greeting} 👋
          </p>
          <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-heading)" }}>
            Find Your Edge
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
            {`${totalMatches} matches analysed · Model updated live`}
          </p>
        </div>
        <Link href="/betting"
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: "var(--green)", color: "#0B0E13", fontFamily: "var(--font-heading)" }}>
          View All Odds →
        </Link>
      </div>

      {isDemoMode && (
        <div className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.35)", color: "var(--warning)" }}>
          MVP demo mode: seeded fixtures, model probabilities, and virtual wallet are active. Add `ODDS_API_KEY` later for live markets.
        </div>
      )}

      {/* ── Sport summary chips ── */}
      <div className="flex gap-3">
        {[
          { icon: "⚽", label: "Football", count: football.length, href: "/betting" },
          { icon: "🎾", label: "Tennis",   count: allTennis.length, href: "/betting" },
          { icon: "📡", label: "Live",     count: null, href: "/live" },
          { icon: "💰", label: "Wallet",   count: null, href: "/wallet" },
        ].map(s => (
          <Link key={s.label} href={s.href}
            className="card-hover flex items-center gap-2.5 px-4 py-3 rounded-xl border"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="text-xs font-bold" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
              {s.count !== null && (
                <p className="text-xs tabular-nums" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
                  {`${s.count} matches`}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ── Top Predictions — Football ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black" style={{ fontFamily: "var(--font-heading)" }}>
            ⚽ Top Football Predictions
          </h2>
          <Link href="/betting" className="text-sm font-semibold" style={{ color: "var(--green)" }}>
            View all →
          </Link>
        </div>

        {topFootball.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-3xl mb-2">⚽</p>
            <p className="font-semibold text-sm">No football markets open right now</p>
            <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>Markets open closer to match time</p>
          </div>
        ) : (
          <div className="flex gap-3 scroll-x pb-2">
            {topFootball.map(({ m }) => <FootballPredCard key={m.id} m={m} />)}
          </div>
        )}
      </section>

      {/* ── Top Predictions — Tennis ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black" style={{ fontFamily: "var(--font-heading)" }}>
            🎾 Top Tennis Predictions
          </h2>
          <Link href="/betting" className="text-sm font-semibold" style={{ color: "var(--green)" }}>
            View all →
          </Link>
        </div>

        {topTennis.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-3xl mb-2">🎾</p>
            <p className="font-semibold text-sm">No tennis markets open right now</p>
          </div>
        ) : (
          <div className="flex gap-3 scroll-x pb-2">
            {topTennis.map(({ m }) => <TennisPredCard key={m.id} m={m} />)}
          </div>
        )}
      </section>

      {/* ── Active Competitions ── */}
      <section>
        <h2 className="text-lg font-black mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Active Competitions
        </h2>
        <div className="space-y-2">
          {Object.entries(fbByComp).map(([comp, matches]) => {
            const strong = matches.filter(m => {
              if (!hasFootballBookmakerOdds(m)) return false;
              const p = getFootballPrediction(m.homeTeam, m.awayTeam, m.odds.home, m.odds.draw, m.odds.away);
              return p.tier === "Strong";
            }).length;
            return (
              <TournamentRow key={comp} name={comp} icon="⚽" count={matches.length} strongCount={strong} href="/betting" />
            );
          })}
          {Object.entries(tennisByTournament).map(([name, matches]) => {
            const strong = matches.filter(m => {
              if (!hasTennisBookmakerOdds(m)) return false;
              const p = getTennisPrediction(m.player1, m.player2, m.odds.p1, m.odds.p2);
              return p.tier === "Strong";
            }).length;
            return (
              <TournamentRow
                key={name}
                name={name}
                icon={matches[0].surface === "Grass" ? "🌿" : matches[0].surface === "Clay" ? "🟤" : "🎾"}
                count={matches.length}
                strongCount={strong}
                href="/betting"
              />
            );
          })}
          {football.length === 0 && allTennis.length === 0 && (
            <div className="rounded-2xl border p-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <p className="text-3xl mb-2">📅</p>
              <p className="font-semibold text-sm">No active competitions right now</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <p className="text-xs border-t pt-4" style={{ color: "var(--secondary)", borderColor: "var(--border)", fontFamily: "var(--font-body)" }}>
        Predictions based on bookmaker-implied probabilities with margin removed. For analysis only — not financial advice.
      </p>
    </div>
  );
}
