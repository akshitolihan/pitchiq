"use client";

import { usePathname } from "next/navigation";
import { useBetSlip } from "@/contexts/BetSlipContext";

export default function BetSlip() {
  const { state, removeSelection, clearSlip, setStake, setOpen } = useBetSlip();
  const { selections, stake, open } = state;

  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const totalStake = stake * selections.length;
  const potentialReturn = totalStake * totalOdds;

  const pathname = usePathname();
  // Betting page has its own in-flow panel — never render the overlay there
  if (!open || pathname.startsWith("/betting")) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-sm shadow-2xl border-l"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">Match Plan</span>
            {selections.length > 0 && (
              <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: "var(--green)", color: "#000" }}>
                {selections.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {selections.length > 0 && (
              <button onClick={clearSlip} className="text-xs font-medium"
                style={{ color: "#EF4444" }}>
                Clear all
              </button>
            )}
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "var(--elevated)", color: "var(--secondary)" }}>
              ✕
            </button>
          </div>
        </div>

        {/* Selections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {selections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <span className="text-4xl mb-3">📋</span>
              <p className="font-semibold">Your match plan is empty</p>
              <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
                Add analysis picks to plan future matches
              </p>
            </div>
          ) : (
            selections.map(sel => (
              <div key={sel.id} className="rounded-xl border p-3"
                style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--secondary)" }}>
                      {sel.matchTitle}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--secondary)" }}>
                      {sel.market}
                    </p>
                    <p className="font-bold text-sm mt-0.5">{sel.outcome}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => removeSelection(sel.id)}
                      className="text-xs w-5 h-5 flex items-center justify-center rounded-full"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                      ✕
                    </button>
                    <span className="font-black text-lg tabular-nums" style={{ color: "var(--green)" }}>
                      {sel.odds.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with stake + return */}
        {selections.length > 0 && (
          <div className="border-t p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
            {/* Stake per bet */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Simulation stake</span>
              <div className="flex items-center gap-1">
                <span className="text-sm" style={{ color: "var(--secondary)" }}>£</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={stake}
                  onChange={e => setStake(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                  className="w-20 text-right text-sm font-bold rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: "var(--elevated)", color: "var(--white)", border: "1px solid var(--border)" }}
                />
              </div>
            </div>

            {/* Quick stake buttons */}
            <div className="flex gap-2">
              {[5, 10, 20, 50].map(v => (
                <button key={v} onClick={() => setStake(v)}
                  className="flex-1 text-xs py-1.5 rounded-lg font-semibold transition-colors"
                  style={{
                    background: stake === v ? "var(--green)" : "var(--elevated)",
                    color: stake === v ? "#000" : "var(--secondary)",
                  }}>
                  £{v}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--elevated)" }}>
              {selections.length > 1 && (
                <div className="flex justify-between text-xs" style={{ color: "var(--secondary)" }}>
                  <span>Combined model odds</span>
                  <span className="font-bold tabular-nums">{totalOdds.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs" style={{ color: "var(--secondary)" }}>
                <span>Simulation stake</span>
                <span className="font-bold tabular-nums">£{totalStake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
                <span>Simulated outcome</span>
                <span style={{ color: "var(--green)" }} className="text-base tabular-nums">
                  £{potentialReturn.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Save plan button */}
            <button className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-95"
              style={{ background: "var(--green)", color: "#000" }}>
              Save Plan · {selections.length} item{selections.length !== 1 ? "s" : ""}
            </button>

            <p className="text-center text-xs" style={{ color: "var(--secondary)" }}>
              For analysis and education only
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// Floating match-plan toggle button (hidden on /betting page which has inline plan)
export function BetSlipFAB() {
  const { state, setOpen } = useBetSlip();
  const { selections, open } = state;
  const pathname = usePathname();

  if (open || pathname === "/betting") return null;

  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-24 right-4 md:bottom-6 z-30 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg font-bold text-sm transition-all hover:scale-105 active:scale-95"
      style={{ background: "var(--green)", color: "#000" }}
    >
      <span>📋</span>
      <span>Match Plan</span>
      {selections.length > 0 && (
        <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center"
          style={{ background: "#000", color: "var(--green)" }}>
          {selections.length}
        </span>
      )}
    </button>
  );
}
