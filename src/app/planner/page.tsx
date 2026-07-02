"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BetSelection, PlanStatus, useBetSlip } from "@/contexts/BetSlipContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AnalysisSession,
  makeSessionId,
  makeSessionName,
  readAnalysisSessions,
  saveCloudAnalysisSession,
  writeAnalysisSessions,
} from "@/lib/analysis-sessions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const STATUS_OPTIONS: Array<{ value: PlanStatus; label: string; tone: string; bg: string }> = [
  { value: "watching", label: "Watching", tone: "var(--cyan, #06b6d4)", bg: "rgba(6,182,212,0.12)" },
  { value: "strong-interest", label: "Strong interest", tone: "var(--green)", bg: "rgba(22,199,132,0.12)" },
  { value: "review-later", label: "Review later", tone: "var(--warning)", bg: "rgba(245,166,35,0.12)" },
  { value: "avoid", label: "Avoid", tone: "#EF4444", bg: "rgba(239,68,68,0.12)" },
];

type Filter = "all" | PlanStatus;
type SortMode = "kickoff" | "status" | "odds";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  ...STATUS_OPTIONS.map(({ value, label }) => ({ value, label })),
];

const SESSION_TAGS = ["Weekly Plan", "Watchlist", "High Confidence", "Tournament", "Custom"];

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

function kickoffTime(selection: BetSelection) {
  if (!selection.commenceTime) return Number.MAX_SAFE_INTEGER;
  const time = new Date(selection.commenceTime).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function PlannerPage() {
  const {
    state,
    clearSlip,
    removeSelection,
    getSelectionMeta,
    setSelectionStatus,
    setSelectionNote,
    cloudSyncEnabled,
    cloudSyncStatus,
    cloudSyncError,
  } = useBetSlip();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("kickoff");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [sessionName, setSessionName] = useState(makeSessionName());
  const [sessionTag, setSessionTag] = useState(SESSION_TAGS[0]);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const selectionsWithMeta = useMemo(() => {
    return state.selections
      .map(selection => ({ selection, meta: getSelectionMeta(selection.id) }))
      .sort((a, b) => {
        if (sortMode === "odds") return b.selection.odds - a.selection.odds;
        if (sortMode === "status") return statusLabel(a.meta.status).localeCompare(statusLabel(b.meta.status));
        return kickoffTime(a.selection) - kickoffTime(b.selection) || a.selection.matchTitle.localeCompare(b.selection.matchTitle);
      });
  }, [getSelectionMeta, sortMode, state.selections]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = selectionsWithMeta.filter(item => {
    const statusMatch = filter === "all" || item.meta.status === filter;
    if (!statusMatch) return false;
    if (reviewOnly && (item.meta.status === "avoid" || item.meta.note.trim().length > 0)) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      item.selection.matchTitle,
      item.selection.market,
      item.selection.outcome,
      item.selection.competition ?? "",
      item.meta.note,
      statusLabel(item.meta.status),
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });

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

  const now = Date.now();
  const nextItem = selectionsWithMeta.find(item => kickoffTime(item.selection) !== Number.MAX_SAFE_INTEGER);
  const dueSoon = selectionsWithMeta.filter(item => {
    const time = kickoffTime(item.selection);
    return time !== Number.MAX_SAFE_INTEGER && time >= now && time <= now + 24 * 60 * 60 * 1000;
  }).length;
  const needsReview = selectionsWithMeta.filter(item => item.meta.status !== "avoid" && item.meta.note.trim().length === 0).length;
  const strongInterest = selectionsWithMeta.filter(item => item.meta.status === "strong-interest").length;

  function exportPlan() {
    const rows = selectionsWithMeta.map(({ selection, meta }) => [
      selection.matchTitle,
      selection.sport,
      selection.competition ?? "",
      selection.commenceTime ?? "",
      selection.market,
      selection.outcome,
      selection.odds,
      statusLabel(meta.status),
      meta.note,
    ]);
    const csv = [
      ["Match", "Sport", "Competition", "Kickoff", "Market", "Outcome", "Model Odds", "Status", "Note"],
      ...rows,
    ].map(row => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pitchiq-planner-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function saveSession() {
    if (state.selections.length === 0) return;
    const nowIso = new Date().toISOString();
    const session: AnalysisSession = {
      id: makeSessionId(),
      name: sessionName.trim() || makeSessionName(),
      tag: sessionTag,
      createdAt: nowIso,
      updatedAt: nowIso,
      selections: state.selections,
      selectionMeta: state.selectionMeta,
    };
    writeAnalysisSessions([session, ...readAnalysisSessions()].slice(0, 50));
    const supabase = getSupabaseBrowserClient();
    if (supabase && user) {
      try {
        await saveCloudAnalysisSession(supabase, user.id, session);
        setSessionMessage("Session saved to history and cloud");
      } catch (error) {
        setSessionMessage(error instanceof Error ? `Saved locally. Cloud sync failed: ${error.message}` : "Saved locally. Cloud sync failed.");
      }
    } else {
      setSessionMessage("Session saved to history");
    }
    setTimeout(() => setSessionMessage(null), 2500);
  }

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
          <button
            onClick={exportPlan}
            disabled={state.selections.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-bold border"
            style={{
              borderColor: "var(--border)",
              color: state.selections.length > 0 ? "var(--secondary)" : "rgba(255,255,255,0.24)",
              background: "var(--surface)",
              cursor: state.selections.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Export
          </button>
          <Link
            href="/exports"
            className="px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Export Center
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Next review</p>
          <p className="font-black mt-1 truncate">
            {nextItem ? nextItem.selection.matchTitle : "No dated plans"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
            {nextItem ? `${formatDate(dateKey(nextItem.selection))} at ${formatTime(nextItem.selection)}` : "Add selections with kickoff times from Markets."}
          </p>
        </div>
        <button
          onClick={() => setFilter("strong-interest")}
          className="rounded-xl border p-4 text-left"
          style={{ background: "rgba(22,199,132,0.08)", borderColor: "rgba(22,199,132,0.35)" }}
        >
          <p className="text-xs font-bold uppercase" style={{ color: "var(--green)" }}>Priority watchlist</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{strongInterest}</p>
          <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>Strong-interest plans ready for deeper analysis.</p>
        </button>
        <button
          onClick={() => setReviewOnly(value => !value)}
          className="rounded-xl border p-4 text-left"
          style={{
            background: reviewOnly ? "rgba(245,166,35,0.16)" : needsReview > 0 ? "rgba(245,166,35,0.08)" : "var(--surface)",
            borderColor: reviewOnly || needsReview > 0 ? "rgba(245,166,35,0.35)" : "var(--border)",
          }}
        >
          <p className="text-xs font-bold uppercase" style={{ color: needsReview > 0 ? "var(--warning)" : "var(--secondary)" }}>Review needed</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{needsReview}</p>
          <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>{dueSoon} planned item{dueSoon === 1 ? "" : "s"} within 24 hours.</p>
        </button>
      </div>

      <section className="rounded-xl border px-4 py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div>
          <p className="text-xs font-black uppercase" style={{ color: cloudSyncEnabled ? "var(--green)" : "var(--secondary)" }}>
            {cloudSyncEnabled ? "Cloud planner sync" : "Local planner mode"}
          </p>
          <p className="text-sm" style={{ color: "var(--secondary)" }}>
            {cloudSyncEnabled
              ? cloudSyncStatus === "loading"
                ? "Loading saved planner items from your account..."
                : cloudSyncStatus === "saving"
                  ? "Saving planner changes to your account..."
                  : cloudSyncStatus === "error"
                    ? cloudSyncError ?? "Planner cloud sync needs attention."
                    : "Planner changes are saved to this browser and your account."
              : "Sign in on Account to sync planner items across browsers."}
          </p>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-lg border" style={{ borderColor: "var(--border)", color: cloudSyncStatus === "error" ? "#EF4444" : cloudSyncEnabled ? "var(--green)" : "var(--secondary)" }}>
          {cloudSyncEnabled ? cloudSyncStatus : "local"}
        </span>
      </section>

      <section className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Save analysis session</p>
            <input
              value={sessionName}
              onChange={event => setSessionName(event.target.value)}
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Label</p>
            <select
              value={sessionTag}
              onChange={event => setSessionTag(event.target.value)}
              className="mt-2 rounded-xl px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
            >
              {SESSION_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          <button
            onClick={saveSession}
            disabled={state.selections.length === 0}
            className="px-4 py-3 rounded-xl text-sm font-black"
            style={{
              background: state.selections.length > 0 ? "var(--green)" : "var(--bg)",
              color: state.selections.length > 0 ? "#000" : "rgba(255,255,255,0.24)",
              cursor: state.selections.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Save session
          </button>
          <Link
            href="/history"
            className="px-4 py-3 rounded-xl text-sm font-bold border text-center"
            style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--bg)" }}
          >
            History
          </Link>
        </div>
        {sessionMessage && (
          <p className="text-xs font-bold" style={{ color: "var(--green)" }}>{sessionMessage}</p>
        )}
      </section>

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
        {reviewOnly && (
          <button
            onClick={() => setReviewOnly(false)}
            className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border"
            style={{ background: "rgba(245,166,35,0.12)", color: "var(--warning)", borderColor: "rgba(245,166,35,0.35)" }}
          >
            Needs note
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search match, market, outcome, competition, note..."
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--surface)", color: "var(--white)", border: "1px solid var(--border)" }}
        />
        <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {([
            { value: "kickoff", label: "Kickoff" },
            { value: "status", label: "Status" },
            { value: "odds", label: "Odds" },
          ] as Array<{ value: SortMode; label: string }>).map(option => (
            <button
              key={option.value}
              onClick={() => setSortMode(option.value)}
              className="px-3 py-3 text-xs font-bold"
              style={{
                background: sortMode === option.value ? "var(--green)" : "transparent",
                color: sortMode === option.value ? "#000" : "var(--secondary)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
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
          <p className="font-black">No matches found</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            Adjust the search, status, or review filter.
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
