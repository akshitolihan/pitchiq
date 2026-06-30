"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BetSelection, PlanStatus, useBetSlip } from "@/contexts/BetSlipContext";

const STATUS_OPTIONS: Array<{ value: PlanStatus; label: string; tone: string; bg: string }> = [
  { value: "watching", label: "Watching", tone: "var(--cyan, #06b6d4)", bg: "rgba(6,182,212,0.12)" },
  { value: "strong-interest", label: "Strong interest", tone: "var(--green)", bg: "rgba(22,199,132,0.12)" },
  { value: "review-later", label: "Review later", tone: "var(--warning)", bg: "rgba(245,166,35,0.12)" },
  { value: "avoid", label: "Avoid", tone: "#EF4444", bg: "rgba(239,68,68,0.12)" },
];

type Filter = "all" | PlanStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  ...STATUS_OPTIONS.map(({ value, label }) => ({ value, label })),
];

function statusLabel(status: PlanStatus) {
  return STATUS_OPTIONS.find(option => option.value === status)?.label ?? "Watching";
}

function statusTone(status: PlanStatus) {
  return STATUS_OPTIONS.find(option => option.value === status)?.tone ?? "var(--cyan, #06b6d4)";
}

function statusBg(status: PlanStatus) {
  return STATUS_OPTIONS.find(option => option.value === status)?.bg ?? "rgba(6,182,212,0.12)";
}

function dateKey(selection: BetSelection) {
  if (!selection.commenceTime) return "unscheduled";
  const date = new Date(selection.commenceTime);
  if (Number.isNaN(date.getTime())) return "unscheduled";
  return date.toISOString().slice(0, 10);
}

function formatDate(key: string) {
  if (key === "unscheduled") return "Saved without kickoff";
  const date = new Date(`${key}T00:00:00Z`);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatTime(selection: BetSelection) {
  if (!selection.commenceTime) return "Kickoff pending";
  const date = new Date(selection.commenceTime);
  if (Number.isNaN(date.getTime())) return "Kickoff pending";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

export default function PlannerPage() {
  const {
    state,
    clearSlip,
    removeSelection,
    getSelectionMeta,
    setSelectionStatus,
    setSelectionNote,
  } = useBetSlip();
  const [filter, setFilter] = useState<Filter>("all");

  const selectionsWithMeta = useMemo(() => {
    return state.selections
      .map(selection => ({ selection, meta: getSelectionMeta(selection.id) }))
      .sort((a, b) => {
        const aTime = a.selection.commenceTime ? new Date(a.selection.commenceTime).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.selection.commenceTime ? new Date(b.selection.commenceTime).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime || a.selection.matchTitle.localeCompare(b.selection.matchTitle);
      });
  }, [getSelectionMeta, state.selections]);

  const filtered = selectionsWithMeta.filter(item => filter === "all" || item.meta.status === filter);

  const groups = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
    const key = dateKey(item.selection);
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});

  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (a === "unscheduled") return 1;
    if (b === "unscheduled") return -1;
    return a.localeCompare(b);
  });

  const counts = STATUS_OPTIONS.map(option => ({
    ...option,
    count: selectionsWithMeta.filter(item => item.meta.status === option.value).length,
  }));

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Future match planner
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Planner
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Track matches you want to analyze, review, avoid, or revisit before kickoff.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/betting"
            className="px-4 py-2 rounded-xl text-sm font-bold border"
            style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}
          >
            Add matches
          </Link>
          <button
            onClick={clearSlip}
            disabled={state.selections.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-bold border"
            style={{
              borderColor: "var(--border)",
              color: state.selections.length > 0 ? "var(--secondary)" : "rgba(255,255,255,0.24)",
              background: "var(--surface)",
              cursor: state.selections.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Total</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{state.selections.length}</p>
        </div>
        {counts.map(item => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className="rounded-xl border p-4 text-left transition-all"
            style={{
              background: filter === item.value ? item.bg : "var(--surface)",
              borderColor: filter === item.value ? item.tone : "var(--border)",
            }}
          >
            <p className="text-xs font-bold uppercase" style={{ color: item.tone }}>{item.label}</p>
            <p className="text-2xl font-black mt-1 tabular-nums">{item.count}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(option => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border"
              style={{
                background: active ? "var(--green)" : "var(--surface)",
                color: active ? "#000" : "var(--secondary)",
                borderColor: active ? "var(--green)" : "var(--border)",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {state.selections.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-lg font-black">No planned matches yet</p>
          <p className="text-sm mt-2" style={{ color: "var(--secondary)" }}>
            Add analysis selections from the markets page to start planning upcoming fixtures.
          </p>
          <Link
            href="/betting"
            className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Browse markets
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border px-5 py-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No matches in this status</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            Switch filters or update a match status below.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupKeys.map(key => (
            <section key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--secondary)" }}>
                  {formatDate(key)}
                </h2>
                <span className="text-xs font-bold tabular-nums" style={{ color: "var(--secondary)" }}>
                  {groups[key].length} item{groups[key].length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {groups[key].map(({ selection, meta }) => (
                  <article
                    key={selection.id}
                    className="rounded-xl border p-4 space-y-4"
                    style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span
                            className="text-xs font-black px-2 py-1 rounded-lg"
                            style={{ color: statusTone(meta.status), background: statusBg(meta.status) }}
                          >
                            {statusLabel(meta.status)}
                          </span>
                          <span className="text-xs font-semibold capitalize" style={{ color: "var(--secondary)" }}>
                            {selection.sport}
                          </span>
                          {selection.competition && (
                            <span className="text-xs truncate" style={{ color: "var(--secondary)" }}>
                              {selection.competition}
                            </span>
                          )}
                        </div>
                        <h3 className="font-black text-base leading-snug">{selection.matchTitle}</h3>
                        <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
                          {formatTime(selection)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSelection(selection.id)}
                        className="shrink-0 w-8 h-8 rounded-lg text-sm font-black"
                        style={{ background: "var(--bg)", color: "var(--secondary)" }}
                        aria-label={`Remove ${selection.outcome}`}
                      >
                        X
                      </button>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl p-3" style={{ background: "var(--bg)" }}>
                      <div className="min-w-0">
                        <p className="text-xs" style={{ color: "var(--secondary)" }}>{selection.market}</p>
                        <p className="font-bold text-sm mt-0.5 truncate">{selection.outcome}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: "var(--secondary)" }}>Model odds</p>
                        <p className="font-black tabular-nums" style={{ color: "var(--cyan, #06b6d4)" }}>
                          {selection.odds.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {STATUS_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setSelectionStatus(selection.id, option.value)}
                          className="rounded-lg px-2 py-2 text-xs font-bold border"
                          style={{
                            background: meta.status === option.value ? option.bg : "var(--bg)",
                            color: meta.status === option.value ? option.tone : "var(--secondary)",
                            borderColor: meta.status === option.value ? option.tone : "var(--border)",
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={meta.note}
                      onChange={event => setSelectionNote(selection.id, event.target.value)}
                      placeholder="Planning note: lineup dependency, model concern, recheck timing..."
                      className="w-full min-h-20 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
                    />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
