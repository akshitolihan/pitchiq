"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BetSelection, PlanStatus, useBetSlip } from "@/contexts/BetSlipContext";

type AlertFilter = "all" | "urgent" | "today" | "missing-note" | "past";

interface AlertItem {
  selection: BetSelection;
  status: PlanStatus;
  note: string;
  kickoffMs: number;
  category: AlertFilter;
  title: string;
  description: string;
  tone: string;
}

const FILTERS: Array<{ value: AlertFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "today", label: "Today" },
  { value: "missing-note", label: "Missing note" },
  { value: "past", label: "Past kickoff" },
];

function kickoffMs(selection: BetSelection) {
  if (!selection.commenceTime) return Number.MAX_SAFE_INTEGER;
  const value = new Date(selection.commenceTime).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function formatKickoff(selection: BetSelection) {
  const value = kickoffMs(selection);
  if (value === Number.MAX_SAFE_INTEGER) return "Kickoff pending";
  return new Date(value).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

function timeUntil(value: number) {
  if (value === Number.MAX_SAFE_INTEGER) return "No kickoff time";
  const diff = value - Date.now();
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  if (diff < 0) return `${hours}h ${minutes}m ago`;
  return `${hours}h ${minutes}m left`;
}

function statusLabel(status: PlanStatus) {
  if (status === "strong-interest") return "Strong interest";
  if (status === "review-later") return "Review later";
  if (status === "avoid") return "Avoid";
  return "Watching";
}

function buildAlert(selection: BetSelection, status: PlanStatus, note: string): AlertItem {
  const value = kickoffMs(selection);
  const now = Date.now();
  const missingNote = note.trim().length === 0 && status !== "avoid";
  const withinSixHours = value !== Number.MAX_SAFE_INTEGER && value >= now && value <= now + 6 * 60 * 60 * 1000;
  const withinToday = value !== Number.MAX_SAFE_INTEGER && value >= now && value <= now + 24 * 60 * 60 * 1000;
  const past = value !== Number.MAX_SAFE_INTEGER && value < now;

  if (past) {
    return {
      selection,
      status,
      note,
      kickoffMs: value,
      category: "past",
      title: "Past kickoff",
      description: "Archive or review this item before keeping it in the active plan.",
      tone: "#EF4444",
    };
  }

  if (withinSixHours) {
    return {
      selection,
      status,
      note,
      kickoffMs: value,
      category: "urgent",
      title: "Review now",
      description: missingNote ? "Kickoff is close and this item still needs a note." : "Kickoff is close. Recheck final context.",
      tone: "var(--warning)",
    };
  }

  if (missingNote) {
    return {
      selection,
      status,
      note,
      kickoffMs: value,
      category: "missing-note",
      title: "Add review note",
      description: "Capture lineup dependency, model concern, or reason to watch.",
      tone: "var(--cyan, #06b6d4)",
    };
  }

  if (withinToday) {
    return {
      selection,
      status,
      note,
      kickoffMs: value,
      category: "today",
      title: "Due today",
      description: "Scheduled for review within the next 24 hours.",
      tone: "var(--green)",
    };
  }

  return {
    selection,
    status,
    note,
    kickoffMs: value,
    category: "all",
    title: "Scheduled",
    description: "No immediate action needed.",
    tone: "var(--secondary)",
  };
}

export default function AlertsPage() {
  const { state, getSelectionMeta, setSelectionStatus, setSelectionNote, removeSelection } = useBetSlip();
  const [filter, setFilter] = useState<AlertFilter>("all");

  const alerts = useMemo(() => {
    return state.selections
      .map(selection => {
        const meta = getSelectionMeta(selection.id);
        return buildAlert(selection, meta.status, meta.note);
      })
      .sort((a, b) => {
        const rank = { urgent: 0, missing: 1, today: 2, past: 3, scheduled: 4 };
        const aRank = a.category === "missing-note" ? rank.missing : a.category === "all" ? rank.scheduled : rank[a.category];
        const bRank = b.category === "missing-note" ? rank.missing : b.category === "all" ? rank.scheduled : rank[b.category];
        return aRank - bRank || a.kickoffMs - b.kickoffMs;
      });
  }, [getSelectionMeta, state.selections]);

  const counts = {
    urgent: alerts.filter(alert => alert.category === "urgent").length,
    today: alerts.filter(alert => alert.category === "today" || alert.category === "urgent").length,
    missing: alerts.filter(alert => alert.category === "missing-note" || (alert.note.trim().length === 0 && alert.status !== "avoid")).length,
    past: alerts.filter(alert => alert.category === "past").length,
  };

  const filtered = alerts.filter(alert => {
    if (filter === "all") return true;
    if (filter === "today") return alert.category === "today" || alert.category === "urgent";
    if (filter === "missing-note") return alert.note.trim().length === 0 && alert.status !== "avoid";
    return alert.category === filter;
  });

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Review queue
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Alerts
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Prioritize planned matches that need review before kickoff.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/planner"
            className="px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Planner
          </Link>
          <Link
            href="/history"
            className="px-4 py-2 rounded-xl text-sm font-bold border"
            style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}
          >
            History
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Active plan</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{alerts.length}</p>
        </div>
        <button onClick={() => setFilter("urgent")} className="rounded-xl border p-4 text-left" style={{ background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.35)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--warning)" }}>Urgent</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{counts.urgent}</p>
        </button>
        <button onClick={() => setFilter("today")} className="rounded-xl border p-4 text-left" style={{ background: "rgba(22,199,132,0.08)", borderColor: "rgba(22,199,132,0.35)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--green)" }}>Due today</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{counts.today}</p>
        </button>
        <button onClick={() => setFilter("missing-note")} className="rounded-xl border p-4 text-left" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--cyan, #06b6d4)" }}>Missing notes</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{counts.missing}</p>
        </button>
        <button onClick={() => setFilter("past")} className="rounded-xl border p-4 text-left" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.35)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "#EF4444" }}>Past</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{counts.past}</p>
        </button>
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

      {alerts.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No active alerts</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            Add matches to Planner to create a review queue.
          </p>
          <Link
            href="/insights"
            className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Open insights
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border px-5 py-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No alerts in this filter</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>Switch filters to see the full queue.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map(alert => (
            <article key={alert.selection.id} className="rounded-xl border p-4 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-black px-2 py-1 rounded-lg" style={{ color: alert.tone, background: "var(--bg)" }}>
                      {alert.title}
                    </span>
                    <span className="text-xs font-semibold capitalize" style={{ color: "var(--secondary)" }}>
                      {alert.selection.sport}
                    </span>
                    <span className="text-xs" style={{ color: "var(--secondary)" }}>
                      {statusLabel(alert.status)}
                    </span>
                  </div>
                  <h2 className="font-black text-lg leading-snug">{alert.selection.matchTitle}</h2>
                  <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
                    {formatKickoff(alert.selection)} - {timeUntil(alert.kickoffMs)}
                  </p>
                </div>
                <button
                  onClick={() => removeSelection(alert.selection.id)}
                  className="shrink-0 w-8 h-8 rounded-lg text-sm font-black"
                  style={{ background: "var(--bg)", color: "var(--secondary)" }}
                  aria-label={`Remove ${alert.selection.outcome}`}
                >
                  X
                </button>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl p-3" style={{ background: "var(--bg)" }}>
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "var(--secondary)" }}>{alert.selection.market}</p>
                  <p className="font-bold text-sm mt-0.5 truncate">{alert.selection.outcome}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "var(--secondary)" }}>Model odds</p>
                  <p className="font-black tabular-nums" style={{ color: "var(--cyan, #06b6d4)" }}>
                    {alert.selection.odds.toFixed(2)}
                  </p>
                </div>
              </div>

              <p className="text-sm" style={{ color: "var(--secondary)" }}>{alert.description}</p>

              <textarea
                value={alert.note}
                onChange={event => setSelectionNote(alert.selection.id, event.target.value)}
                placeholder="Add review note..."
                className="w-full min-h-20 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  { value: "watching", label: "Watching" },
                  { value: "strong-interest", label: "Strong" },
                  { value: "review-later", label: "Later" },
                  { value: "avoid", label: "Avoid" },
                ] as Array<{ value: PlanStatus; label: string }>).map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSelectionStatus(alert.selection.id, option.value)}
                    className="rounded-lg px-2 py-2 text-xs font-bold border"
                    style={{
                      background: alert.status === option.value ? "rgba(22,199,132,0.12)" : "var(--bg)",
                      color: alert.status === option.value ? "var(--green)" : "var(--secondary)",
                      borderColor: alert.status === option.value ? "var(--green)" : "var(--border)",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
