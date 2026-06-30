"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BetSelection, PlanStatus, useBetSlip } from "@/contexts/BetSlipContext";

type LabPreset = "focused" | "balanced" | "exploratory" | "custom";

const PRESETS: Array<{ value: LabPreset; label: string; description: string }> = [
  { value: "focused", label: "Focused", description: "Strong-interest items only, capped to the clearest analysis opportunities." },
  { value: "balanced", label: "Balanced", description: "Strong-interest and watching items with a practical review load." },
  { value: "exploratory", label: "Exploratory", description: "Everything except avoided items, useful for broader discovery." },
  { value: "custom", label: "Custom", description: "Manual selection from the saved plan." },
];

function probabilityFromOdds(odds: number) {
  if (!Number.isFinite(odds) || odds <= 1) return 0;
  return Math.min(95, Math.max(1, (1 / odds) * 100));
}

function statusLabel(status: PlanStatus) {
  if (status === "strong-interest") return "Strong interest";
  if (status === "review-later") return "Review later";
  if (status === "avoid") return "Avoid";
  return "Watching";
}

function statusWeight(status: PlanStatus) {
  if (status === "strong-interest") return 1.1;
  if (status === "watching") return 0.95;
  if (status === "review-later") return 0.75;
  return 0.45;
}

function statusTone(status: PlanStatus) {
  if (status === "strong-interest") return "var(--green)";
  if (status === "review-later") return "var(--warning)";
  if (status === "avoid") return "#EF4444";
  return "var(--cyan, #06b6d4)";
}

function kickoffTime(selection: BetSelection) {
  if (!selection.commenceTime) return Number.MAX_SAFE_INTEGER;
  const value = new Date(selection.commenceTime).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function formatKickoff(selection: BetSelection) {
  if (!selection.commenceTime) return "Kickoff pending";
  const date = new Date(selection.commenceTime);
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

function presetSelectionIds(
  preset: LabPreset,
  items: Array<{ selection: BetSelection; status: PlanStatus; note: string }>,
) {
  if (preset === "focused") {
    return items
      .filter(item => item.status === "strong-interest")
      .slice(0, 4)
      .map(item => item.selection.id);
  }

  if (preset === "balanced") {
    return items
      .filter(item => item.status === "strong-interest" || item.status === "watching")
      .slice(0, 6)
      .map(item => item.selection.id);
  }

  if (preset === "exploratory") {
    return items
      .filter(item => item.status !== "avoid")
      .slice(0, 10)
      .map(item => item.selection.id);
  }

  return [];
}

export default function LabPage() {
  const { state, getSelectionMeta, setSelectionStatus } = useBetSlip();
  const [preset, setPreset] = useState<LabPreset>("balanced");
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [reviewBudget, setReviewBudget] = useState(45);

  const plannedItems = useMemo(() => {
    return state.selections
      .map(selection => {
        const meta = getSelectionMeta(selection.id);
        return { selection, status: meta.status, note: meta.note };
      })
      .sort((a, b) => kickoffTime(a.selection) - kickoffTime(b.selection) || a.selection.matchTitle.localeCompare(b.selection.matchTitle));
  }, [getSelectionMeta, state.selections]);

  const selectedIds = preset === "custom"
    ? customIds
    : presetSelectionIds(preset, plannedItems);

  const selectedItems = plannedItems.filter(item => selectedIds.includes(item.selection.id));
  const avgModelProbability = selectedItems.length
    ? selectedItems.reduce((total, item) => total + probabilityFromOdds(item.selection.odds), 0) / selectedItems.length
    : 0;
  const noteCoverage = selectedItems.length
    ? selectedItems.filter(item => item.note.trim().length > 0).length / selectedItems.length
    : 0;
  const statusScore = selectedItems.length
    ? selectedItems.reduce((total, item) => total + statusWeight(item.status), 0) / selectedItems.length
    : 0;
  const workloadPerItem = selectedItems.length ? reviewBudget / selectedItems.length : 0;
  const readiness = Math.min(100, Math.round(
    avgModelProbability * 0.45 +
    noteCoverage * 30 +
    statusScore * 18 +
    Math.min(12, workloadPerItem / 5)
  ));
  const needsNotes = selectedItems.filter(item => item.note.trim().length === 0 && item.status !== "avoid");
  const highExposure = selectedItems.filter(item => item.selection.odds >= 2.5);
  const dueSoon = selectedItems.filter(item => {
    const time = kickoffTime(item.selection);
    return time !== Number.MAX_SAFE_INTEGER && time >= Date.now() && time <= Date.now() + 24 * 60 * 60 * 1000;
  });

  function toggleCustom(id: string) {
    setPreset("custom");
    setCustomIds(current => current.includes(id)
      ? current.filter(existing => existing !== id)
      : [...current, id]);
  }

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Strategy workspace
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Lab
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Turn saved analysis picks into review scenarios, readiness scores, and action checklists.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/insights"
            className="px-4 py-2 rounded-xl text-sm font-bold border"
            style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}
          >
            Find insights
          </Link>
          <Link
            href="/planner"
            className="px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Planner
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Scenario readiness</p>
          <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: readiness >= 70 ? "var(--green)" : readiness >= 45 ? "var(--warning)" : "#EF4444" }}>
            {readiness}
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Selected</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{selectedItems.length}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Avg model probability</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{avgModelProbability.toFixed(0)}%</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Note coverage</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{Math.round(noteCoverage * 100)}%</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black">Scenario preset</h2>
                <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
                  Choose a review strategy for the saved plan.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--bg)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--secondary)" }}>Minutes</span>
                <input
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  value={reviewBudget}
                  onChange={event => setReviewBudget(Math.max(15, Number(event.target.value) || 15))}
                  className="w-16 bg-transparent text-right font-black outline-none"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {PRESETS.map(option => {
                const active = preset === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setPreset(option.value)}
                    className="rounded-xl border p-3 text-left"
                    style={{
                      background: active ? "rgba(22,199,132,0.12)" : "var(--bg)",
                      borderColor: active ? "var(--green)" : "var(--border)",
                    }}
                  >
                    <p className="text-sm font-black" style={{ color: active ? "var(--green)" : "var(--white)" }}>
                      {option.label}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--secondary)" }}>
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black">Saved plan items</h2>
              <span className="text-xs font-bold" style={{ color: "var(--secondary)" }}>
                {plannedItems.length} available
              </span>
            </div>

            {plannedItems.length === 0 ? (
              <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <p className="font-black">No saved plan items yet</p>
                <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
                  Add recommendations from Insights or Markets to start building scenarios.
                </p>
                <Link
                  href="/insights"
                  className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  Open insights
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {plannedItems.map(item => {
                  const selected = selectedIds.includes(item.selection.id);
                  return (
                    <article
                      key={item.selection.id}
                      className="rounded-xl border p-4 space-y-3"
                      style={{
                        background: selected ? "rgba(22,199,132,0.06)" : "var(--surface)",
                        borderColor: selected ? "rgba(22,199,132,0.45)" : "var(--border)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span
                              className="text-xs font-black px-2 py-1 rounded-lg"
                              style={{ color: statusTone(item.status), background: "var(--bg)" }}
                            >
                              {statusLabel(item.status)}
                            </span>
                            <span className="text-xs font-semibold capitalize" style={{ color: "var(--secondary)" }}>
                              {item.selection.sport}
                            </span>
                            {item.selection.competition && (
                              <span className="text-xs truncate" style={{ color: "var(--secondary)" }}>
                                {item.selection.competition}
                              </span>
                            )}
                          </div>
                          <h3 className="font-black leading-snug">{item.selection.matchTitle}</h3>
                          <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>{formatKickoff(item.selection)}</p>
                        </div>
                        <button
                          onClick={() => toggleCustom(item.selection.id)}
                          className="shrink-0 px-3 py-2 rounded-lg text-xs font-black border"
                          style={{
                            background: selected ? "var(--green)" : "var(--bg)",
                            color: selected ? "#000" : "var(--secondary)",
                            borderColor: selected ? "var(--green)" : "var(--border)",
                          }}
                        >
                          {selected ? "In lab" : "Add"}
                        </button>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl p-3" style={{ background: "var(--bg)" }}>
                        <div className="min-w-0">
                          <p className="text-xs" style={{ color: "var(--secondary)" }}>{item.selection.market}</p>
                          <p className="font-bold text-sm mt-0.5 truncate">{item.selection.outcome}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs" style={{ color: "var(--secondary)" }}>Model probability</p>
                          <p className="font-black tabular-nums" style={{ color: "var(--cyan, #06b6d4)" }}>
                            {probabilityFromOdds(item.selection.odds).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-xs line-clamp-2" style={{ color: item.note.trim() ? "var(--secondary)" : "var(--warning)" }}>
                        {item.note.trim() || "No review note yet"}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="font-black">Scenario readout</h2>
            <div className="space-y-3">
              <div className="flex justify-between gap-3 text-sm">
                <span style={{ color: "var(--secondary)" }}>Review time per item</span>
                <span className="font-black tabular-nums">{workloadPerItem.toFixed(0)} min</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span style={{ color: "var(--secondary)" }}>Missing notes</span>
                <span className="font-black tabular-nums" style={{ color: needsNotes.length ? "var(--warning)" : "var(--green)" }}>
                  {needsNotes.length}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span style={{ color: "var(--secondary)" }}>High variance items</span>
                <span className="font-black tabular-nums" style={{ color: highExposure.length ? "var(--warning)" : "var(--green)" }}>
                  {highExposure.length}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span style={{ color: "var(--secondary)" }}>Due within 24h</span>
                <span className="font-black tabular-nums">{dueSoon.length}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="font-black">Review checklist</h2>
            <div className="space-y-2">
              {needsNotes.slice(0, 4).map(item => (
                <button
                  key={item.selection.id}
                  onClick={() => setSelectionStatus(item.selection.id, "review-later")}
                  className="w-full rounded-xl border p-3 text-left"
                  style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                >
                  <p className="text-xs font-bold" style={{ color: "var(--warning)" }}>Add note</p>
                  <p className="text-sm font-black mt-0.5 truncate">{item.selection.matchTitle}</p>
                </button>
              ))}
              {highExposure.slice(0, 3).map(item => (
                <div key={`variance-${item.selection.id}`} className="rounded-xl border p-3" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--warning)" }}>High variance</p>
                  <p className="text-sm font-black mt-0.5 truncate">{item.selection.outcome}</p>
                </div>
              ))}
              {needsNotes.length === 0 && highExposure.length === 0 && (
                <div className="rounded-xl border p-3" style={{ background: "rgba(22,199,132,0.08)", borderColor: "rgba(22,199,132,0.35)" }}>
                  <p className="text-sm font-black" style={{ color: "var(--green)" }}>Scenario is ready for deeper review</p>
                  <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>Notes and variance checks look tidy.</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
