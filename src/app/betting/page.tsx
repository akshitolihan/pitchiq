"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBetSlip, BetSelection, PlanStatus } from "@/contexts/BetSlipContext";
import { useWallet } from "@/contexts/WalletContext";
import { computeFootballMarkets, computeTennisMarkets, getFootballPrediction, getTennisPrediction } from "@/lib/odds-utils";

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
interface FootballOddsResponse {
  matches?: FootballMatch[];
  source?: string;
  warning?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FLAG: Record<string, string> = {
  "Netherlands":"🇳🇱","Sweden":"🇸🇪","Germany":"🇩🇪","Ivory Coast":"🇨🇮","Ecuador":"🇪🇨",
  "Colombia":"🇨🇴","Mexico":"🇲🇽","United States":"🇺🇸","Argentina":"🇦🇷","France":"🇫🇷",
  "Brazil":"🇧🇷","England":"🇬🇧","Portugal":"🇵🇹","Spain":"🇪🇸","Italy":"🇮🇹","Japan":"🇯🇵",
  "Morocco":"🇲🇦","Senegal":"🇸🇳","Uruguay":"🇺🇾","Canada":"🇨🇦","Croatia":"🇭🇷",
  "Belgium":"🇧🇪","Denmark":"🇩🇰","Switzerland":"🇨🇭","Austria":"🇦🇹","Poland":"🇵🇱",
  "Ukraine":"🇺🇦","Serbia":"🇷🇸","Australia":"🇦🇺","Turkey":"🇹🇷","South Korea":"🇰🇷",
  "Saudi Arabia":"🇸🇦","Iran":"🇮🇷","Nigeria":"🇳🇬","Cameroon":"🇨🇲","Ghana":"🇬🇭",
  "Egypt":"🇪🇬","Chile":"🇨🇱","Paraguay":"🇵🇾","Venezuela":"🇻🇪","Honduras":"🇭🇳",
  "Jamaica":"🇯🇲","Panama":"🇵🇦","South Africa":"🇿🇦","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Indonesia":"🇮🇩",
  "New Zealand":"🇳🇿","Iraq":"🇮🇶","Tunisia":"🇹🇳","Cape Verde":"🇨🇻","Curaçao":"🇨🇼",
  "Haiti":"🇭🇹","Qatar":"🇶🇦","Costa Rica":"🇨🇷","Bolivia":"🇧🇴","Peru":"🇵🇪",
  "Czechia":"🇨🇿","Romania":"🇷🇴","Hungary":"🇭🇺","Slovakia":"🇸🇰","Greece":"🇬🇷",
};
const f = (t: string) => FLAG[t] ?? "🏳";

function fmtKickoff(s: string) {
  return new Date(s).toLocaleString("en-GB", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
}

// ─── Odds Pill Button ─────────────────────────────────────────────────────────

function OddsPill({ sel, label }: { sel: BetSelection; label: string }) {
  const { toggleSelection, isSelected } = useBetSlip();
  const active = isSelected(sel.id);
  const unavailable = sel.odds <= 1.0;

  return (
    <button
      onClick={e => { e.stopPropagation(); e.preventDefault(); if (!unavailable) toggleSelection(sel); }}
      disabled={unavailable}
      className="flex-1 flex flex-col items-center py-2.5 px-1 rounded-xl transition-all active:scale-95"
      style={{
        background: active ? "rgba(22,199,132,0.18)" : "var(--bg)",
        border: active ? "1.5px solid var(--green)" : "1px solid var(--border)",
        opacity: unavailable ? 0.35 : 1,
      }}
    >
      <span className="text-xs leading-tight text-center truncate w-full px-0.5"
        style={{ color: active ? "var(--green)" : "var(--secondary)" }}>
        {label}
      </span>
      <span className="font-black text-sm tabular-nums mt-0.5"
        style={{ color: active ? "var(--green)" : "var(--cyan, #06b6d4)" }}>
        {unavailable ? "—" : sel.odds.toFixed(2)}
      </span>
    </button>
  );
}

// ─── Prediction Badge ─────────────────────────────────────────────────────────

function PredictionBadge({
  label, confidence, tier,
  bars,
}: {
  label: string;
  confidence: number;
  tier: "Strong" | "Moderate" | "Competitive";
  bars: { label: string; pct: number }[];
}) {
  const tierColor = tier === "Strong" ? "var(--green)" : tier === "Moderate" ? "#F59E0B" : "var(--secondary)";
  const tierBg   = tier === "Strong" ? "rgba(22,199,132,0.1)" : tier === "Moderate" ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.04)";

  return (
    <div className="mx-4 mb-3 rounded-xl p-3 space-y-2" style={{ background: tierBg, border: `1px solid ${tierColor}33` }}>
      {/* Outcome + confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: tierColor }}>
            {tier === "Strong" ? "🎯" : tier === "Moderate" ? "📊" : "⚖️"} {tier}
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--white)" }}>
            · {label}
          </span>
        </div>
        <span className="text-sm font-black tabular-nums" style={{ color: tierColor }}>
          {confidence.toFixed(0)}%
        </span>
      </div>

      {/* Probability bar */}
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
        {bars.map((b, i) => (
          <div key={i} style={{ width: `${b.pct}%`, background: i === 0 ? "var(--green)" : i === 1 ? "var(--secondary)" : "#EF4444", opacity: 0.85 }} />
        ))}
      </div>

      {/* Labels under bar */}
      <div className="flex justify-between">
        {bars.map((b, i) => (
          <span key={i} className="text-xs tabular-nums" style={{ color: "var(--secondary)" }}>
            {b.label} <strong style={{ color: "var(--white)" }}>{b.pct.toFixed(0)}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Football Match Card ───────────────────────────────────────────────────────

function FootballCard({ m }: { m: FootballMatch }) {
  const hasBookmakerOdds = m.odds.home !== null && m.odds.draw !== null && m.odds.away !== null;
  const raw_h = m.odds.home ? 1 / m.odds.home : 0.38;
  const raw_d = m.odds.draw ? 1 / m.odds.draw : 0.27;
  const raw_a = m.odds.away ? 1 / m.odds.away : 0.35;
  const s = raw_h + raw_d + raw_a;
  const mkts = computeFootballMarkets({
    pHomeWin: raw_h / s, pDraw: raw_d / s, pAwayWin: raw_a / s,
    pBtts: 0.52, pOver25: 0.55,
    realHome: m.odds.home, realDraw: m.odds.draw, realAway: m.odds.away,
  });
  const pred = getFootballPrediction(m.homeTeam, m.awayTeam, m.odds.home, m.odds.draw, m.odds.away);
  const title = `${m.homeTeam} vs ${m.awayTeam}`;
  const base = {
    matchId: m.id,
    matchTitle: title,
    sport: "football" as const,
    commenceTime: m.commenceTime,
    competition: m.competition ?? "Football",
  };

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Clickable header → match detail */}
      <Link href={`/betting/football/${m.id}`} className="block hover:brightness-110 transition-all">
        <div className="px-4 pt-3 pb-2 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--secondary)" }}>
            ⚽ {m.competition ?? "Football"}
          </span>
          <span className="text-xs" style={{ color: "var(--secondary)" }}>
            {fmtKickoff(m.commenceTime)}
          </span>
        </div>

        {/* Teams */}
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-snug truncate">{f(m.homeTeam)} {m.homeTeam}</p>
            <p className="font-bold text-base leading-snug truncate mt-1">{f(m.awayTeam)} {m.awayTeam}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--secondary)" }}>
              {m.bookmaker}
            </span>
            <span className="text-xs font-bold" style={{ color: "var(--green)" }}>View all markets →</span>
          </div>
        </div>
      </Link>

      {/* Prediction */}
      <PredictionBadge
        label={pred.outcome === "Home Win" ? `${m.homeTeam} Win` : pred.outcome === "Away Win" ? `${m.awayTeam} Win` : "Draw"}
        confidence={pred.confidence}
        tier={pred.tier}
        bars={[
          { label: m.homeTeam.split(" ").at(-1)!, pct: pred.homeP },
          { label: "Draw", pct: pred.drawP },
          { label: m.awayTeam.split(" ").at(-1)!, pct: pred.awayP },
        ]}
      />

      {/* Quick 1X2 odds — clicking does NOT navigate */}
      <div className="px-4 pb-4 flex gap-2">
        <OddsPill label={m.homeTeam} sel={{ id: `${m.id}||1X2||home`, ...base, market: "1X2", outcome: m.homeTeam, odds: hasBookmakerOdds ? mkts.homeWin : 0 }} />
        <OddsPill label="Draw"      sel={{ id: `${m.id}||1X2||draw`, ...base, market: "1X2", outcome: "Draw",       odds: hasBookmakerOdds ? mkts.draw : 0 }} />
        <OddsPill label={m.awayTeam} sel={{ id: `${m.id}||1X2||away`, ...base, market: "1X2", outcome: m.awayTeam, odds: hasBookmakerOdds ? mkts.awayWin : 0 }} />
      </div>
    </div>
  );
}

// ─── Tennis Match Card ─────────────────────────────────────────────────────────

function TennisCard({ m }: { m: TennisMatch }) {
  const mkts = computeTennisMarkets(m.odds.p1, m.odds.p2);
  const pred = getTennisPrediction(m.player1, m.player2, m.odds.p1, m.odds.p2);
  const title = `${m.player1} vs ${m.player2}`;
  const base = {
    matchId: m.id,
    matchTitle: title,
    sport: "tennis" as const,
    commenceTime: m.commenceTime,
    competition: m.tournament,
  };
  const surfIcon = m.surface === "Grass" ? "🌿" : m.surface === "Clay" ? "🟤" : "💙";
  const levelColor = m.level === "Grand Slam" ? "#F59E0B"
    : m.level.includes("1000") ? "var(--cyan)" : "var(--secondary)";

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Clickable header → match detail */}
      <Link href={`/betting/tennis/${m.id}`} className="block hover:brightness-110 transition-all">
        <div className="px-4 pt-3 pb-2 border-b flex items-center justify-between gap-2"
          style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: "rgba(0,0,0,0.4)", color: levelColor }}>
              {m.level}
            </span>
            <span className="text-xs font-semibold truncate" style={{ color: "var(--secondary)" }}>
              {surfIcon} {m.tournament}
            </span>
          </div>
          <span className="text-xs shrink-0" style={{ color: "var(--secondary)" }}>
            {fmtKickoff(m.commenceTime)}
          </span>
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-snug truncate">🎾 {m.player1}</p>
            <p className="font-bold text-base leading-snug truncate mt-1">🎾 {m.player2}</p>
          </div>
          <span className="text-xs font-bold shrink-0" style={{ color: "var(--green)" }}>View all markets →</span>
        </div>
      </Link>

      {/* Prediction */}
      <PredictionBadge
        label={`${pred.winnerLabel.split(" ").at(-1)} to Win`}
        confidence={pred.confidence}
        tier={pred.tier}
        bars={[
          { label: m.player1.split(" ").at(-1)!, pct: pred.p1P },
          { label: m.player2.split(" ").at(-1)!, pct: pred.p2P },
        ]}
      />

      {/* Quick Match Winner odds */}
      <div className="px-4 pb-4 flex gap-2">
        <OddsPill label={m.player1.split(" ").at(-1)!} sel={{ id: `${m.id}||MW||p1`, ...base, market: "Match Winner", outcome: m.player1, odds: mkts.p1Win }} />
        <OddsPill label={m.player2.split(" ").at(-1)!} sel={{ id: `${m.id}||MW||p2`, ...base, market: "Match Winner", outcome: m.player2, odds: mkts.p2Win }} />
      </div>
    </div>
  );
}

// ─── Match Plan Panel (sidebar / bottom sheet) ────────────────────────────────

const PLAN_STATUS_OPTIONS: Array<{ value: PlanStatus; label: string }> = [
  { value: "watching", label: "Watching" },
  { value: "strong-interest", label: "Strong interest" },
  { value: "avoid", label: "Avoid" },
  { value: "review-later", label: "Review later" },
];

function BetSlipPanel({ onClose }: { onClose: () => void }) {
  const {
    state,
    removeSelection,
    clearSlip,
    setStake,
    getSelectionMeta,
    setSelectionStatus,
    setSelectionNote,
  } = useBetSlip();
  const { state: wallet } = useWallet();
  const { selections, stake } = state;
  const [mode, setMode] = useState<"single" | "acca">("single");
  const [msg, setMsg] = useState<string | null>(null);

  const totalOdds = selections.reduce((a, s) => a * s.odds, 1);
  const totalStake = mode === "acca" ? stake : stake * selections.length;
  const payout = mode === "acca" && selections.length > 1
    ? stake * totalOdds
    : selections.reduce((a, s) => a + stake * s.odds, 0);

  function handlePlace() {
    setMsg("Analysis plan saved locally");
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black">Match Plan</span>
          {selections.length > 0 && (
            <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center"
              style={{ background: "var(--green)", color: "#000" }}>
              {selections.length}
            </span>
          )}
          {selections.length > 1 && (
            <div className="flex rounded-lg overflow-hidden border ml-1" style={{ borderColor: "var(--border)" }}>
              {(["single", "acca"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="text-xs px-2.5 py-1 font-semibold"
                  style={{ background: mode === m ? "var(--green)" : "transparent", color: mode === m ? "#000" : "var(--secondary)" }}>
                  {m === "single" ? "Singles" : "Multi"}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full text-sm"
          style={{ background: "var(--bg)", color: "var(--secondary)" }}>✕</button>
      </div>

      {/* Selections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="text-5xl mb-4 opacity-20">📋</div>
            <p className="font-bold text-sm">Match Plan is Empty</p>
            <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
              Add analysis picks to plan future matches
            </p>
          </div>
        ) : (
          <div>
            {selections.map(sel => {
              const meta = getSelectionMeta(sel.id);
              return (
              <div key={sel.id} className="px-4 py-3 border-b space-y-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: "var(--secondary)" }}>{sel.matchTitle}</p>
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>{sel.market}</p>
                    <p className="text-sm font-bold mt-0.5 truncate">{sel.outcome}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => removeSelection(sel.id)}
                      className="text-xs" style={{ color: "var(--secondary)" }}>✕</button>
                    <span className="font-black tabular-nums text-base"
                      style={{ color: "var(--cyan, #06b6d4)" }}>
                      {sel.odds.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PLAN_STATUS_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSelectionStatus(sel.id, option.value)}
                      className="text-xs rounded-lg px-2 py-1.5 font-semibold"
                      style={{
                        background: meta.status === option.value ? "rgba(22,199,132,0.16)" : "var(--bg)",
                        color: meta.status === option.value ? "var(--green)" : "var(--secondary)",
                        border: `1px solid ${meta.status === option.value ? "var(--green)" : "var(--border)"}`,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={meta.note}
                  onChange={event => setSelectionNote(sel.id, event.target.value)}
                  placeholder="Plan note: lineup dependency, risk, model disagreement..."
                  className="w-full min-h-16 rounded-lg px-3 py-2 text-xs outline-none resize-none"
                  style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
                />
                {(mode === "single" || selections.length === 1) && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 flex items-center gap-1 rounded-lg px-2.5 py-1.5"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <span className="text-xs" style={{ color: "var(--secondary)" }}>PQ$</span>
                      <input type="number" min="0.5" step="0.5" value={stake}
                        onChange={e => setStake(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                        className="flex-1 bg-transparent outline-none text-right font-bold text-xs"
                        style={{ color: "var(--white)", width: 48 }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: "var(--green)" }}>
                      → {(stake * sel.odds).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )})}

            {mode === "acca" && selections.length > 1 && (
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span style={{ color: "var(--secondary)" }}>Combined model odds</span>
                  <span className="font-black tabular-nums" style={{ color: "var(--cyan, #06b6d4)" }}>
                    {totalOdds.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--secondary)" }}>PQ$ Stake</span>
                  <input type="number" min="0.5" step="0.5" value={stake}
                    onChange={e => setStake(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                    className="flex-1 bg-transparent outline-none text-right font-bold text-sm"
                    style={{ color: "var(--white)" }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t shrink-0 p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
        {selections.length > 0 && (
          <div className="flex gap-1.5">
            {[5, 10, 25, 50].map(v => (
              <button key={v} onClick={() => setStake(v)}
                className="flex-1 text-xs py-1.5 rounded-lg font-bold"
                style={{ background: stake === v ? "var(--green)" : "var(--bg)", color: stake === v ? "#000" : "var(--secondary)" }}>
                {v}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--secondary)" }}>Simulation Stake</span>
          <span className="font-bold tabular-nums">PQ$ {totalStake.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: "var(--border)" }}>
          <span style={{ color: "var(--secondary)" }}>Simulated Outcome</span>
          <span className="font-black tabular-nums" style={{ color: "var(--green)" }}>
            PQ$ {payout.toFixed(2)}
          </span>
        </div>
        {msg && (
          <div className="text-center text-xs py-1.5 rounded-lg font-bold"
            style={{
              background: msg.startsWith("✓") ? "rgba(22,199,132,0.12)" : "rgba(239,68,68,0.12)",
              color: msg.startsWith("✓") ? "var(--green)" : "#EF4444",
            }}>
            {msg}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={clearSlip}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border"
            style={{ borderColor: "var(--border)", color: "var(--secondary)", background: "var(--bg)" }}>
            Clear
          </button>
          <button
            disabled={selections.length === 0}
            onClick={handlePlace}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
            style={{
              background: selections.length > 0 ? "var(--green)" : "var(--bg)",
              color: selections.length > 0 ? "#000" : "var(--secondary)",
              cursor: selections.length === 0 ? "not-allowed" : "pointer",
            }}>
            {selections.length > 0 ? `Save Plan (${selections.length})` : "Save Plan"}
          </button>
        </div>
        <p className="text-center text-xs" style={{ color: "var(--secondary)" }}>
          Demo balance: PQ$ {wallet.balance.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Sport = "football" | "tennis";

export default function BettingPage() {
  const [sport, setSport] = useState<Sport>("football");
  const [tennisTab, setTennisTab] = useState<"atp" | "wta">("atp");

  const [football, setFootball] = useState<FootballMatch[]>([]);
  const [footballSource, setFootballSource] = useState("");
  const [footballWarning, setFootballWarning] = useState("");
  const [tennisAtp, setTennisAtp] = useState<TennisMatch[]>([]);
  const [tennisWta, setTennisWta] = useState<TennisMatch[]>([]);

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");
  const [pulsing, setPulsing] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);

  const { state: slipState } = useBetSlip();
  const selCount = slipState.selections.length;

  const fetchAll = useCallback(async () => {
    const [fbRes, atpRes, wtaRes] = await Promise.allSettled([
      fetch("/api/odds/football", { cache: "no-store" }).then(r => r.json() as Promise<FootballOddsResponse>),
      fetch("/api/odds/tennis?tour=atp", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/odds/tennis?tour=wta", { cache: "no-store" }).then(r => r.json()),
    ]);
    if (fbRes.status === "fulfilled") {
      setFootball(fbRes.value.matches ?? []);
      setFootballSource(fbRes.value.source ?? "");
      setFootballWarning(fbRes.value.warning ?? "");
    }
    if (atpRes.status === "fulfilled") setTennisAtp(atpRes.value.matches ?? []);
    if (wtaRes.status === "fulfilled") setTennisWta(wtaRes.value.matches ?? []);
    setLastUpdate(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setPulsing(true);
    setTimeout(() => setPulsing(false), 1200);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 60_000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const tennisMatches = tennisTab === "atp" ? tennisAtp : tennisWta;

  const currentList = sport === "football" ? football : tennisMatches;
  const isDemoMode = football.some((match) => match.bookmaker.toLowerCase().includes("demo"));
  const isFixtureFallback = sport === "football" && footballSource === "fixture-schedule";

  return (
    <div className="flex h-full" style={{ minHeight: "100dvh" }}>
      {/* ── Match list ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">

        {/* Top bar */}
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>

          {/* Sport tabs */}
          <div className="flex gap-1">
            {(["football", "tennis"] as Sport[]).map(s => (
              <button key={s} onClick={() => setSport(s)}
                className="px-3 py-1.5 rounded-lg text-sm font-bold capitalize transition-all"
                style={{
                  background: sport === s ? "var(--green)" : "var(--elevated)",
                  color: sport === s ? "#000" : "var(--secondary)",
                }}>
                {s === "football" ? "⚽ Football" : "🎾 Tennis"}
              </button>
            ))}
          </div>

          {/* Right: refresh indicator + match plan toggle */}
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs flex items-center gap-1" style={{ color: "var(--secondary)" }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block transition-colors"
                  style={{ background: pulsing ? "var(--green)" : "rgba(255,255,255,0.15)" }} />
                {lastUpdate}
              </span>
            )}
            <button onClick={() => setSlipOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: slipOpen ? "var(--elevated)" : selCount > 0 ? "var(--green)" : "var(--elevated)",
                color: slipOpen ? "var(--secondary)" : selCount > 0 ? "#000" : "var(--secondary)",
              }}>
              📋 Plan
              {selCount > 0 && (
                <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center"
                  style={{ background: slipOpen ? "var(--green)" : "#000", color: slipOpen ? "#000" : "var(--green)" }}>
                  {selCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tennis sub-tab */}
        {sport === "tennis" && (
          <div className="px-4 py-2 border-b flex gap-2 shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {(["atp", "wta"] as const).map(t => (
              <button key={t} onClick={() => setTennisTab(t)}
                className="px-3 py-1 rounded-lg text-xs font-bold uppercase"
                style={{
                  background: tennisTab === t ? "rgba(6,182,212,0.15)" : "var(--elevated)",
                  color: tennisTab === t ? "var(--cyan, #06b6d4)" : "var(--secondary)",
                  border: tennisTab === t ? "1px solid var(--cyan, #06b6d4)" : "1px solid transparent",
                }}>
                {t.toUpperCase()}
              </button>
            ))}
            <span className="ml-auto text-xs self-center" style={{ color: "var(--secondary)" }}>
              {tennisMatches.length} matches
            </span>
          </div>
        )}

        {sport === "football" && isDemoMode && (
          <div className="px-4 py-2 border-b text-xs font-semibold"
            style={{ borderColor: "var(--border)", background: "rgba(245,166,35,0.08)", color: "var(--warning)" }}>
            MVP demo mode: seeded fixtures, model odds, virtual wallet, and match planning are enabled for testing.
          </div>
        )}

        {isFixtureFallback && (
          <div className="px-4 py-2 border-b text-xs font-semibold"
            style={{ borderColor: "var(--border)", background: "rgba(245,166,35,0.08)", color: "var(--warning)" }}>
            {footballWarning || "Bookmaker odds are unavailable right now. Showing today&apos;s schedule with model-derived analysis only."}
          </div>
        )}

        {/* Match cards */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <p className="text-4xl mb-3">{sport === "football" ? "⚽" : "🎾"}</p>
              <p className="font-bold text-base">No upcoming matches</p>
              <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
                Markets open closer to match time
              </p>
              <button onClick={fetchAll}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "var(--elevated)", color: "var(--green)" }}>
                Refresh
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {sport === "football"
                ? football.map(m => <FootballCard key={m.id} m={m} />)
                : tennisMatches.map(m => <TennisCard key={m.id} m={m} />)
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Match Plan Sidebar (desktop) ── */}
      {slipOpen && (
        <>
          <div className="hidden md:flex flex-col w-80 shrink-0 border-l"
            style={{ borderColor: "var(--border)" }}>
            <BetSlipPanel onClose={() => setSlipOpen(false)} />
          </div>

          {/* Mobile: bottom sheet */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col border-t"
            style={{ borderColor: "var(--border)", maxHeight: "55vh", background: "var(--surface)" }}>
            <BetSlipPanel onClose={() => setSlipOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
