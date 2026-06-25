"use client";

import { useState } from "react";
import { useWallet, PlacedBet } from "@/contexts/WalletContext";

const CURRENCY = "PQ$";

function fmt(n: number) {
  return `${CURRENCY} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BetCard({ bet, onSettle }: { bet: PlacedBet; onSettle: (id: string, r: "won" | "lost" | "void") => void }) {
  const isPending = bet.status === "pending";
  const totalStake = bet.stake * (bet.mode === "single" ? bet.selections.length : 1);

  const statusColor = bet.status === "won" ? "var(--green)" : bet.status === "lost" ? "#EF4444" : bet.status === "void" ? "#F59E0B" : "var(--secondary)";
  const statusBg = bet.status === "won" ? "rgba(22,199,132,0.1)" : bet.status === "lost" ? "rgba(239,68,68,0.1)" : bet.status === "void" ? "rgba(245,158,11,0.1)" : "var(--elevated)";

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase"
            style={{ background: statusBg, color: statusColor }}>
            {bet.status}
          </span>
          <span className="text-xs" style={{ color: "var(--secondary)" }}>
            {bet.mode === "acca" ? `Accumulator (${bet.selections.length} legs)` : `Singles (${bet.selections.length})`}
          </span>
        </div>
        <span className="text-xs tabular-nums" style={{ color: "var(--secondary)" }}>
          {new Date(bet.placedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Selections */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {bet.selections.map(sel => (
          <div key={sel.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate" style={{ color: "var(--secondary)" }}>{sel.matchTitle}</p>
              <p className="text-sm font-semibold truncate">{sel.outcome} <span className="font-normal text-xs" style={{ color: "var(--secondary)" }}>· {sel.market}</span></p>
            </div>
            <span className="font-black tabular-nums text-sm shrink-0" style={{ color: "var(--cyan, #06b6d4)" }}>
              {sel.odds.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-4 text-xs">
          <span style={{ color: "var(--secondary)" }}>Stake <strong className="font-bold" style={{ color: "var(--white)" }}>{fmt(totalStake)}</strong></span>
          <span style={{ color: "var(--secondary)" }}>Odds <strong className="font-bold tabular-nums" style={{ color: "var(--white)" }}>{bet.totalOdds.toFixed(2)}</strong></span>
          <span style={{ color: "var(--secondary)" }}>
            {bet.status === "won" ? "Won" : "To win"}{" "}
            <strong className="font-bold" style={{ color: bet.status === "won" ? "var(--green)" : "var(--white)" }}>
              {fmt(bet.potentialReturn)}
            </strong>
          </span>
        </div>

        {/* Settle buttons — only for pending */}
        {isPending && (
          <div className="flex gap-1.5">
            <button onClick={() => onSettle(bet.id, "won")}
              className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:brightness-110"
              style={{ background: "rgba(22,199,132,0.15)", color: "var(--green)" }}>
              ✓ Won
            </button>
            <button onClick={() => onSettle(bet.id, "lost")}
              className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:brightness-110"
              style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
              ✗ Lost
            </button>
            <button onClick={() => onSettle(bet.id, "void")}
              className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:brightness-110"
              style={{ background: "var(--elevated)", color: "var(--secondary)" }}>
              Void
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { state, settleBet, resetWallet } = useWallet();
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost">("all");
  const [showReset, setShowReset] = useState(false);

  const { balance, bets } = state;
  const pending = bets.filter(b => b.status === "pending");
  const won     = bets.filter(b => b.status === "won");
  const lost    = bets.filter(b => b.status === "lost");

  const totalStaked   = bets.filter(b => b.status !== "void").reduce((a, b) => {
    const stake = b.stake * (b.mode === "single" ? b.selections.length : 1);
    return a + stake;
  }, 0);
  const totalReturned = won.reduce((a, b) => a + b.actualReturn, 0);
  const netPL         = totalReturned - bets.filter(b => b.status !== "pending" && b.status !== "void").reduce((a, b) => {
    return a + b.stake * (b.mode === "single" ? b.selections.length : 1);
  }, 0);
  const roi           = totalStaked > 0 ? (netPL / totalStaked) * 100 : 0;
  const winRate       = (won.length + lost.length) > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;

  const filtered = filter === "all" ? bets : bets.filter(b => b.status === filter);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-heading)" }}>Wallet</h1>
        <button onClick={() => setShowReset(true)}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: "var(--elevated)", color: "var(--secondary)" }}>
          Reset
        </button>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--secondary)" }}>Available Balance</p>
        <p className="text-5xl font-black tabular-nums" style={{ color: "var(--green)" }}>
          {fmt(balance)}
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--secondary)" }}>
          Virtual credits · For analysis & planning only
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Staked", value: fmt(totalStaked) },
          { label: "Net P&L", value: `${netPL >= 0 ? "+" : ""}${fmt(netPL)}`, color: netPL >= 0 ? "var(--green)" : "#EF4444" },
          { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`, color: roi >= 0 ? "var(--green)" : "#EF4444" },
          { label: "Win Rate", value: `${winRate.toFixed(0)}%` },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--secondary)" }}>{s.label}</p>
            <p className="text-lg font-black tabular-nums mt-1" style={{ color: s.color ?? "var(--white)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bet counts */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "all",     label: `All (${bets.length})` },
          { id: "pending", label: `Pending (${pending.length})` },
          { id: "won",     label: `Won (${won.length})` },
          { id: "lost",    label: `Lost (${lost.length})` },
        ] as { id: "all"|"pending"|"won"|"lost"; label: string }[]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{
              background: filter === f.id ? "var(--green)" : "var(--elevated)",
              color: filter === f.id ? "#000" : "var(--secondary)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Bet history */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-3xl mb-3">🎯</p>
          <p className="font-semibold">No bets yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            Head to Odds, add selections, and place your first virtual bet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bet => (
            <BetCard key={bet.id} bet={bet} onSettle={settleBet} />
          ))}
        </div>
      )}

      {/* Reset confirmation */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="font-black text-lg">Reset Wallet?</h3>
            <p className="text-sm" style={{ color: "var(--secondary)" }}>
              This will clear all bet history and restore your balance to {CURRENCY} 5,000.00. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowReset(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border"
                style={{ borderColor: "var(--border)", color: "var(--secondary)", background: "var(--elevated)" }}>
                Cancel
              </button>
              <button onClick={() => { resetWallet(); setShowReset(false); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black"
                style={{ background: "#EF4444", color: "#fff" }}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
