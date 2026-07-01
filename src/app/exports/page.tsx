"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BetSelection, PlanStatus, SelectionMeta, useBetSlip } from "@/contexts/BetSlipContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { AnalysisSession, readAnalysisSessions } from "@/lib/analysis-sessions";

type ExportFormat = "markdown" | "csv";
type ExportScope = "active" | "latest-session";

const STATUS_LABELS: Record<PlanStatus, string> = {
  watching: "Watching",
  "strong-interest": "Strong interest",
  "review-later": "Review later",
  avoid: "Avoid",
};

const DEFAULT_META: SelectionMeta = { status: "watching", note: "" };

function formatDate(value?: string) {
  if (!value) return "Kickoff pending";
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

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function confidenceBand(odds: number) {
  if (odds <= 1.65) return "High model conviction";
  if (odds <= 2.25) return "Balanced model lean";
  return "Higher-variance angle";
}

function buildMarkdown(
  selections: BetSelection[],
  meta: Record<string, SelectionMeta>,
  reportName: string,
  isPro: boolean,
) {
  const visible = isPro ? selections : selections.slice(0, 3);
  const strong = visible.filter(selection => (meta[selection.id] ?? DEFAULT_META).status === "strong-interest").length;
  const missingNotes = visible.filter(selection => !(meta[selection.id] ?? DEFAULT_META).note.trim()).length;
  const lines = [
    `# ${reportName}`,
    "",
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    `Access mode: ${isPro ? "Pro Analysis" : "Free Preview"}`,
    "",
    "## Summary",
    "",
    `- Included matches: ${visible.length}${!isPro && selections.length > visible.length ? ` of ${selections.length}` : ""}`,
    `- Strong-interest items: ${strong}`,
    `- Missing review notes: ${missingNotes}`,
    "",
    "## Planned Analysis",
    "",
  ];

  visible.forEach((selection, index) => {
    const itemMeta = meta[selection.id] ?? DEFAULT_META;
    lines.push(
      `### ${index + 1}. ${selection.matchTitle}`,
      "",
      `- Sport: ${selection.sport}`,
      `- Competition: ${selection.competition ?? "Not specified"}`,
      `- Kickoff: ${formatDate(selection.commenceTime)}`,
      `- Market: ${selection.market}`,
      `- Model view: ${selection.outcome} at ${selection.odds.toFixed(2)}`,
      `- Status: ${STATUS_LABELS[itemMeta.status]}`,
      `- Risk context: ${confidenceBand(selection.odds)}`,
      `- Review note: ${itemMeta.note.trim() || "No note added yet"}`,
      "",
    );
  });

  if (!isPro && selections.length > visible.length) {
    lines.push(
      "## Locked In Free Preview",
      "",
      `${selections.length - visible.length} additional planned item${selections.length - visible.length === 1 ? "" : "s"} require Pro Analysis export access.`,
      "",
    );
  }

  return lines.join("\n");
}

function buildCsv(selections: BetSelection[], meta: Record<string, SelectionMeta>, isPro: boolean) {
  const visible = isPro ? selections : selections.slice(0, 3);
  const rows = [
    ["Match", "Sport", "Competition", "Kickoff", "Market", "Model View", "Model Odds", "Status", "Risk Context", "Review Note"],
    ...visible.map(selection => {
      const itemMeta = meta[selection.id] ?? DEFAULT_META;
      return [
        selection.matchTitle,
        selection.sport,
        selection.competition ?? "",
        selection.commenceTime ?? "",
        selection.market,
        selection.outcome,
        selection.odds,
        STATUS_LABELS[itemMeta.status],
        confidenceBand(selection.odds),
        itemMeta.note,
      ];
    }),
  ];
  return rows.map(row => row.map(escapeCsv).join(",")).join("\n");
}

export default function ExportsPage() {
  const { state } = useBetSlip();
  const { isPro } = useSubscription();
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [scope, setScope] = useState<ExportScope>("active");
  const [reportName, setReportName] = useState("Pitch IQ Analysis Report");
  const [message, setMessage] = useState<string | null>(null);

  const sessions = useMemo(() => readAnalysisSessions(), []);
  const latestSession = sessions[0];
  const source = scope === "latest-session" && latestSession
    ? {
      label: latestSession.name,
      selections: latestSession.selections,
      meta: latestSession.selectionMeta,
    }
    : {
      label: "Active Match Plan",
      selections: state.selections,
      meta: state.selectionMeta,
    };

  const visibleCount = isPro ? source.selections.length : Math.min(3, source.selections.length);
  const lockedCount = Math.max(0, source.selections.length - visibleCount);
  const strongCount = source.selections.filter(selection => (source.meta[selection.id] ?? DEFAULT_META).status === "strong-interest").length;
  const missingNotes = source.selections.filter(selection => !(source.meta[selection.id] ?? DEFAULT_META).note.trim()).length;
  const dueDated = source.selections.filter(selection => selection.commenceTime).length;

  function exportReport() {
    if (source.selections.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "markdown") {
      downloadFile(
        `pitchiq-analysis-${stamp}.md`,
        buildMarkdown(source.selections, source.meta, reportName.trim() || "Pitch IQ Analysis Report", isPro),
        "text/markdown;charset=utf-8",
      );
    } else {
      downloadFile(
        `pitchiq-analysis-${stamp}.csv`,
        buildCsv(source.selections, source.meta, isPro),
        "text/csv;charset=utf-8",
      );
    }
    setMessage(isPro ? "Full report exported" : "Free preview report exported");
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Pro export center
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Exports
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Package planned analysis into shareable reports for review, client notes, or future match preparation.
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

      <div
        className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        style={{
          background: isPro ? "rgba(22,199,132,0.08)" : "rgba(245,166,35,0.08)",
          borderColor: isPro ? "rgba(22,199,132,0.35)" : "rgba(245,166,35,0.35)",
        }}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: isPro ? "var(--green)" : "var(--warning)" }}>
            {isPro ? "Full export access" : "Free export preview"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            {isPro
              ? "Pro exports include every planned item, notes, status, and risk context."
              : "Free exports include the first 3 planned items. Upgrade to export complete reports."}
          </p>
        </div>
        <span className="text-sm font-black tabular-nums" style={{ color: isPro ? "var(--green)" : "var(--warning)" }}>
          {visibleCount}/{source.selections.length} included
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Source items", source.selections.length],
          ["Included", visibleCount],
          ["Strong interest", strongCount],
          ["Missing notes", missingNotes],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>{label}</p>
            <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border p-4 md:p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Report name</p>
            <input
              value={reportName}
              onChange={event => setReportName(event.target.value)}
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Source</p>
            <select
              value={scope}
              onChange={event => setScope(event.target.value as ExportScope)}
              className="mt-2 rounded-xl px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
            >
              <option value="active">Active plan</option>
              <option value="latest-session" disabled={!latestSession}>Latest saved session</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Format</p>
            <div className="mt-2 flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
              {(["markdown", "csv"] as ExportFormat[]).map(value => (
                <button
                  key={value}
                  onClick={() => setFormat(value)}
                  className="px-4 py-3 text-xs font-black uppercase"
                  style={{
                    background: format === value ? "var(--green)" : "transparent",
                    color: format === value ? "#000" : "var(--secondary)",
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl p-4" style={{ background: "var(--bg)" }}>
          <div>
            <p className="font-black">{source.label}</p>
            <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
              {dueDated} dated item{dueDated === 1 ? "" : "s"} ready for timeline review.
              {lockedCount > 0 ? ` ${lockedCount} item${lockedCount === 1 ? "" : "s"} locked in Free Preview.` : ""}
            </p>
          </div>
          <button
            onClick={exportReport}
            disabled={source.selections.length === 0}
            className="rounded-xl px-5 py-3 text-sm font-black"
            style={{
              background: source.selections.length > 0 ? "var(--green)" : "var(--surface)",
              color: source.selections.length > 0 ? "#000" : "rgba(255,255,255,0.24)",
              cursor: source.selections.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Export {format === "markdown" ? "report" : "CSV"}
          </button>
        </div>
        {message && <p className="text-xs font-bold" style={{ color: "var(--green)" }}>{message}</p>}
      </section>

      {source.selections.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-lg font-black">No analysis items to export</p>
          <p className="text-sm mt-2" style={{ color: "var(--secondary)" }}>
            Add matches to Planner or save a History session before creating an export.
          </p>
          <Link href="/insights" className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            Find insights
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {source.selections.slice(0, visibleCount).map(selection => {
            const itemMeta = source.meta[selection.id] ?? DEFAULT_META;
            return (
              <article key={selection.id} className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>
                      {selection.competition ?? selection.sport}
                    </p>
                    <h2 className="font-black text-base mt-1">{selection.matchTitle}</h2>
                    <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>{formatDate(selection.commenceTime)}</p>
                  </div>
                  <span className="text-xs font-black px-2 py-1 rounded-lg" style={{ color: "var(--green)", background: "rgba(22,199,132,0.12)" }}>
                    {STATUS_LABELS[itemMeta.status]}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl p-3" style={{ background: "var(--bg)" }}>
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>{selection.market}</p>
                    <p className="font-black truncate">{selection.outcome}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>Model odds</p>
                    <p className="font-black tabular-nums" style={{ color: "var(--cyan, #06b6d4)" }}>{selection.odds.toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-sm" style={{ color: "var(--secondary)" }}>
                  {itemMeta.note.trim() || "No review note added yet."}
                </p>
              </article>
            );
          })}
          {lockedCount > 0 && (
            <div className="rounded-xl border p-6 flex flex-col justify-center" style={{ background: "var(--surface)", borderColor: "rgba(245,166,35,0.35)" }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--warning)" }}>
                {lockedCount} export items locked
              </p>
              <h2 className="text-xl font-black mt-2" style={{ fontFamily: "var(--font-heading)" }}>
                Unlock full report exports
              </h2>
              <p className="text-sm mt-2" style={{ color: "var(--secondary)" }}>
                Pro Analysis exports the complete plan with all notes, status labels, and risk context.
              </p>
              <Link href="/account" className="mt-5 text-center rounded-xl px-4 py-2.5 text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
                View Pro access
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
