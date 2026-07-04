"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BetSelection, useBetSlip } from "@/contexts/BetSlipContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { buildJournalCsv, buildJournalMarkdown, downloadTextFile } from "@/lib/journal-exports";
import {
  MatchJournal,
  blankJournal,
  journalCompleteness,
  loadCloudMatchJournals,
  readLocalMatchJournals,
  saveCloudMatchJournal,
  writeLocalMatchJournals,
} from "@/lib/match-journals";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type JournalField = "modelView" | "teamNews" | "riskFlags" | "finalReview";
type ExportScope = "current" | "all";
type ExportFormat = "markdown" | "csv";

interface JournalTemplate {
  id: string;
  title: string;
  label: string;
  proOnly: boolean;
  sport?: "football" | "tennis";
  confidenceScore: number;
  fields: Record<JournalField, string>;
}

const FIELD_LABELS: Array<{ key: JournalField; label: string; placeholder: string }> = [
  {
    key: "modelView",
    label: "Model view",
    placeholder: "Probability edge, price sensitivity, confidence driver, or disagreement with market...",
  },
  {
    key: "teamNews",
    label: "Team news / context",
    placeholder: "Lineups, injuries, travel, schedule pressure, surface/venue context...",
  },
  {
    key: "riskFlags",
    label: "Risk flags",
    placeholder: "Volatility, missing data, motivation uncertainty, late-news dependency...",
  },
  {
    key: "finalReview",
    label: "Final review",
    placeholder: "Final decision, what changed, and whether this stays in the plan...",
  },
];

const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: "football-prematch",
    title: "Football pre-match review",
    label: "Starter",
    proOnly: false,
    sport: "football",
    confidenceScore: 55,
    fields: {
      modelView: "- Model probability vs market price:\n- Main edge driver:\n- Price movement to watch:\n- Minimum confidence needed before final review:",
      teamNews: "- Expected lineup notes:\n- Injury/suspension dependency:\n- Schedule/travel context:\n- Tactical matchup note:",
      riskFlags: "- Late lineup risk:\n- Motivation/rotation uncertainty:\n- Market overreaction risk:\n- Data gap to recheck:",
      finalReview: "- Final decision:\n- What changed since first review:\n- Keep, downgrade, or remove from plan:\n- Recheck time:",
    },
  },
  {
    id: "risk-audit",
    title: "Risk audit",
    label: "Starter",
    proOnly: false,
    confidenceScore: 45,
    fields: {
      modelView: "- What the model likes:\n- What the model may be missing:\n- Sensitivity to odds movement:\n- Confidence after stress test:",
      teamNews: "- News item that could invalidate the view:\n- Context still unverified:\n- Source or timing to recheck:\n- Alternate scenario:",
      riskFlags: "- Primary risk:\n- Secondary risk:\n- Correlation with other planned items:\n- Reason to avoid if unresolved:",
      finalReview: "- Final risk rating:\n- Required condition before keeping:\n- Remove if:\n- Final note:",
    },
  },
  {
    id: "tennis-prematch",
    title: "Tennis pre-match review",
    label: "Pro",
    proOnly: true,
    sport: "tennis",
    confidenceScore: 58,
    fields: {
      modelView: "- Hold/break profile:\n- Surface fit:\n- Recent form signal:\n- Price sensitivity:",
      teamNews: "- Fitness or retirement concern:\n- Schedule fatigue:\n- Head-to-head context:\n- Tournament motivation:",
      riskFlags: "- Volatile serve pattern:\n- Small sample concern:\n- Surface mismatch uncertainty:\n- Live-only angle to consider:",
      finalReview: "- Final lean:\n- Confidence after news check:\n- Keep or downgrade:\n- Recheck time:",
    },
  },
  {
    id: "high-confidence",
    title: "High-confidence shortlist",
    label: "Pro",
    proOnly: true,
    confidenceScore: 72,
    fields: {
      modelView: "- Clear model edge:\n- Agreement across drivers:\n- Why this outranks other planned items:\n- Price ceiling:",
      teamNews: "- Confirmed context supporting the view:\n- Any remaining news dependency:\n- Match conditions:\n- Timing of final check:",
      riskFlags: "- Main reason confidence could be overstated:\n- Tail-risk scenario:\n- Correlated exposure:\n- Downgrade trigger:",
      finalReview: "- Final shortlist decision:\n- Confidence score rationale:\n- Action after final news:\n- Post-match learning note:",
    },
  },
  {
    id: "final-review",
    title: "Final review",
    label: "Pro",
    proOnly: true,
    confidenceScore: 60,
    fields: {
      modelView: "- Initial model view:\n- Current model view:\n- Change since planning:\n- Final price context:",
      teamNews: "- Final lineup/news check:\n- Confirmed absences or returns:\n- Market reaction to news:\n- Context still unknown:",
      riskFlags: "- Risks resolved:\n- Risks still open:\n- Reason to downgrade:\n- Reason to remove:",
      finalReview: "- Final status:\n- Final confidence:\n- Decision timestamp:\n- Lesson to carry forward:",
    },
  },
];

function formatUpdated(value: string | undefined) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kickoffLabel(selection: BetSelection) {
  if (!selection.commenceTime) return "Kickoff pending";
  const date = new Date(selection.commenceTime);
  if (Number.isNaN(date.getTime())) return "Kickoff pending";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

export default function JournalPage() {
  const { user, loading: authLoading } = useAuth();
  const { isPro } = useSubscription();
  const { state } = useBetSlip();
  const [journals, setJournals] = useState<Record<string, MatchJournal>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("Local journal");
  const [exportScope, setExportScope] = useState<ExportScope>("current");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  const selectedSelection = useMemo(() => {
    return state.selections.find(selection => selection.id === selectedId) ?? state.selections[0] ?? null;
  }, [selectedId, state.selections]);

  const selectedJournal = selectedSelection ? (journals[selectedSelection.id] ?? blankJournal(selectedSelection)) : null;

  useEffect(() => {
    const requestedSelectionId = typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("selection");
    const localJournals = readLocalMatchJournals();
    setJournals(localJournals);
    setSelectedId(current => current ?? requestedSelectionId ?? state.selections[0]?.id ?? null);

    const supabase = getSupabaseBrowserClient();
    if (authLoading) return;
    if (!supabase || !user) {
      setSyncMessage("Local journal");
      return;
    }

    let cancelled = false;
    setSyncMessage("Loading cloud journal...");
    loadCloudMatchJournals(supabase)
      .then(cloudJournals => {
        if (cancelled) return;
        const merged = { ...localJournals, ...cloudJournals };
        setJournals(merged);
        writeLocalMatchJournals(merged);
        setSyncMessage("Cloud journal synced");
      })
      .catch(error => {
        if (cancelled) return;
        setSyncMessage(error instanceof Error ? `Cloud journal unavailable: ${error.message}` : "Cloud journal unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, state.selections, user]);

  function updateJournal(selection: BetSelection, updater: (journal: MatchJournal) => MatchJournal) {
    const current = journals[selection.id] ?? blankJournal(selection);
    const updated = {
      ...updater(current),
      updatedAt: new Date().toISOString(),
    };
    const next = { ...journals, [selection.id]: updated };
    setJournals(next);
    writeLocalMatchJournals(next);
  }

  async function saveJournal() {
    if (!selectedSelection || !selectedJournal) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) {
      setSyncMessage("Journal saved locally");
      return;
    }

    setSyncMessage("Saving cloud journal...");
    try {
      await saveCloudMatchJournal(supabase, user.id, selectedJournal);
      setSyncMessage("Cloud journal synced");
    } catch (error) {
      setSyncMessage(error instanceof Error ? `Journal saved locally. Cloud sync failed: ${error.message}` : "Journal saved locally. Cloud sync failed.");
    }
  }

  function exportJournalReport() {
    if (!selectedSelection) return;
    const source = exportScope === "current" ? [selectedSelection] : state.selections;
    const stamp = new Date().toISOString().slice(0, 10);
    if (exportFormat === "markdown") {
      downloadTextFile(
        `pitchiq-journal-${stamp}.md`,
        buildJournalMarkdown(source, journals, isPro),
        "text/markdown;charset=utf-8",
      );
    } else {
      downloadTextFile(
        `pitchiq-journal-${stamp}.csv`,
        buildJournalCsv(source, journals, isPro),
        "text/csv;charset=utf-8",
      );
    }
    setExportMessage(isPro ? "Full journal report exported" : "Free journal preview exported");
    setTimeout(() => setExportMessage(null), 2500);
  }

  function applyTemplate(template: JournalTemplate) {
    if (!selectedSelection) return;
    if (template.proOnly && !isPro) {
      setTemplateMessage("Upgrade to Pro Analysis to use this template");
      setTimeout(() => setTemplateMessage(null), 2500);
      return;
    }

    updateJournal(selectedSelection, journal => ({
      ...journal,
      ...template.fields,
      confidenceScore: template.confidenceScore,
    }));
    setTemplateMessage(`${template.title} applied`);
    setTimeout(() => setTemplateMessage(null), 2500);
  }

  const completedFields = journalCompleteness(selectedJournal ?? undefined);
  const totalJournals = Object.values(journals).filter(journal => journalCompleteness(journal) > 0).length;
  const exportIncluded = isPro ? (exportScope === "current" ? Math.min(1, state.selections.length) : state.selections.length) : 1;
  const recommendedTemplates = selectedSelection
    ? JOURNAL_TEMPLATES.filter(template => !template.sport || template.sport === selectedSelection.sport)
    : JOURNAL_TEMPLATES;

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Research notes
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Match Journal
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Build structured analysis notes around planned matches before final review.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/library" className="px-4 py-2 rounded-xl text-sm font-bold border" style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}>
            Library
          </Link>
          <Link href="/planner" className="px-4 py-2 rounded-xl text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            Planner
          </Link>
          <Link href="/alerts" className="px-4 py-2 rounded-xl text-sm font-bold border" style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}>
            Alerts
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Planned" value={state.selections.length} tone="var(--green)" />
        <Metric label="Journals" value={totalJournals} tone="var(--cyan, #06b6d4)" />
        <Metric label="Current" value={`${completedFields}/4`} tone="var(--warning)" />
        <Metric label="Mode" value={user ? "Cloud" : "Local"} tone={user ? "var(--green)" : "var(--secondary)"} />
      </div>

      <section className="rounded-xl border px-4 py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div>
          <p className="text-xs font-black uppercase" style={{ color: user ? "var(--green)" : "var(--secondary)" }}>
            {user ? "Cloud match journal" : "Local match journal"}
          </p>
          <p className="text-sm" style={{ color: "var(--secondary)" }}>
            {user ? syncMessage : "Sign in on Account to sync research notes across browsers."}
          </p>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-lg border" style={{ borderColor: "var(--border)", color: user ? "var(--green)" : "var(--secondary)" }}>
          {formatUpdated(selectedJournal?.updatedAt)}
        </span>
      </section>

      <section className="rounded-xl border p-4 md:p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: isPro ? "var(--green)" : "var(--warning)" }}>
              {isPro ? "Full journal exports" : "Free journal preview"}
            </p>
            <h2 className="text-lg font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>Journal report</h2>
            <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
              {isPro
                ? "Export complete research notes for the selected match or the full active plan."
                : "Free Preview exports one journal with locked Pro fields."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[auto_auto_auto]">
            <select
              value={exportScope}
              onChange={event => setExportScope(event.target.value as ExportScope)}
              className="rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
              style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
            >
              <option value="current">Current journal</option>
              <option value="all">All planned journals</option>
            </select>
            <select
              value={exportFormat}
              onChange={event => setExportFormat(event.target.value as ExportFormat)}
              className="rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
              style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
            >
              <option value="markdown">Markdown</option>
              <option value="csv">CSV</option>
            </select>
            <button
              onClick={exportJournalReport}
              disabled={state.selections.length === 0}
              className="rounded-xl px-4 py-2.5 text-sm font-black"
              style={{
                background: state.selections.length > 0 ? "var(--green)" : "var(--bg)",
                color: state.selections.length > 0 ? "#000" : "rgba(255,255,255,0.24)",
                cursor: state.selections.length > 0 ? "pointer" : "not-allowed",
              }}
            >
              Export
            </button>
          </div>
        </div>
        <div className="rounded-xl p-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between" style={{ background: "var(--bg)" }}>
          <p className="text-sm" style={{ color: "var(--secondary)" }}>
            Included: {state.selections.length === 0 ? 0 : exportIncluded}/{exportScope === "current" ? Math.min(1, state.selections.length) : state.selections.length} journal{exportIncluded === 1 ? "" : "s"}
          </p>
          {!isPro && state.selections.length > 0 && (
            <Link href="/account" className="text-sm font-black" style={{ color: "var(--green)" }}>
              Unlock full journal reports
            </Link>
          )}
        </div>
        {exportMessage && <p className="text-xs font-bold" style={{ color: "var(--green)" }}>{exportMessage}</p>}
      </section>

      <section className="rounded-xl border p-4 md:p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: isPro ? "var(--green)" : "var(--warning)" }}>
              Research templates
            </p>
            <h2 className="text-lg font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>Guided note structures</h2>
            <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
              Apply a repeatable checklist to the selected match, then edit the details before saving.
            </p>
          </div>
          <span className="text-xs font-black px-3 py-1 rounded-lg border self-start" style={{ borderColor: "var(--border)", color: isPro ? "var(--green)" : "var(--warning)" }}>
            {isPro ? "All templates" : "Free starters"}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {recommendedTemplates.map(template => {
            const locked = template.proOnly && !isPro;
            return (
              <article
                key={template.id}
                className="rounded-xl border p-4 space-y-3"
                style={{
                  background: locked ? "rgba(245,166,35,0.06)" : "var(--bg)",
                  borderColor: locked ? "rgba(245,166,35,0.35)" : "var(--border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase" style={{ color: locked ? "var(--warning)" : "var(--green)" }}>
                      {template.label}
                    </p>
                    <h3 className="font-black mt-1">{template.title}</h3>
                  </div>
                  <span className="text-xs font-black tabular-nums" style={{ color: "var(--secondary)" }}>
                    {template.confidenceScore}%
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--secondary)" }}>
                  {locked ? "Pro template for deeper repeatable analysis." : "Applies structured bullets to all journal fields."}
                </p>
                <button
                  onClick={() => applyTemplate(template)}
                  disabled={!selectedSelection}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-black border"
                  style={{
                    background: locked ? "var(--surface)" : "var(--green)",
                    borderColor: locked ? "rgba(245,166,35,0.35)" : "var(--green)",
                    color: locked ? "var(--warning)" : "#000",
                    cursor: selectedSelection ? "pointer" : "not-allowed",
                  }}
                >
                  {locked ? "Unlock Pro" : "Apply template"}
                </button>
              </article>
            );
          })}
        </div>
        {templateMessage && <p className="text-xs font-bold" style={{ color: templateMessage.includes("Upgrade") ? "var(--warning)" : "var(--green)" }}>{templateMessage}</p>}
      </section>

      {state.selections.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No planned matches yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            Add matches to Planner before writing research notes.
          </p>
          <Link href="/planner" className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            Open planner
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <section className="rounded-xl border p-3 space-y-2 h-fit" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {state.selections.map(selection => {
              const active = selection.id === selectedSelection?.id;
              const count = journalCompleteness(journals[selection.id]);
              return (
                <button
                  key={selection.id}
                  onClick={() => setSelectedId(selection.id)}
                  className="w-full rounded-xl border p-3 text-left"
                  style={{
                    background: active ? "rgba(22,199,132,0.1)" : "var(--bg)",
                    borderColor: active ? "rgba(22,199,132,0.45)" : "var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate">{selection.matchTitle}</p>
                      <p className="text-xs mt-1 truncate" style={{ color: "var(--secondary)" }}>
                        {selection.market} - {selection.outcome}
                      </p>
                    </div>
                    <span className="text-xs font-black tabular-nums" style={{ color: count === 4 ? "var(--green)" : "var(--secondary)" }}>
                      {count}/4
                    </span>
                  </div>
                </button>
              );
            })}
          </section>

          {selectedSelection && selectedJournal && (
            <section className="rounded-xl border p-4 md:p-5 space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase" style={{ color: "var(--secondary)" }}>
                    {selectedSelection.sport} {selectedSelection.competition ? `- ${selectedSelection.competition}` : ""}
                  </p>
                  <h2 className="text-xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
                    {selectedSelection.matchTitle}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
                    {kickoffLabel(selectedSelection)} - {selectedSelection.market}: {selectedSelection.outcome}
                  </p>
                </div>
                <button
                  onClick={saveJournal}
                  className="rounded-xl px-4 py-2.5 text-sm font-black"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  Save journal
                </button>
              </div>

              <div className="rounded-xl p-4" style={{ background: "var(--bg)" }}>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Confidence score</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selectedJournal.confidenceScore}
                    onChange={event => updateJournal(selectedSelection, journal => ({ ...journal, confidenceScore: Number(event.target.value) }))}
                  />
                  <span className="text-2xl font-black tabular-nums" style={{ color: "var(--green)" }}>{selectedJournal.confidenceScore}%</span>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {FIELD_LABELS.map(field => (
                  <label key={field.key} className="block">
                    <span className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>{field.label}</span>
                    <textarea
                      value={selectedJournal[field.key]}
                      onChange={event => updateJournal(selectedSelection, journal => ({ ...journal, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="mt-2 w-full min-h-36 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
                    />
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>{label}</p>
      <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: tone }}>{value}</p>
    </div>
  );
}
