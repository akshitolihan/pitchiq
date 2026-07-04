"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  MatchJournal,
  journalCompleteness,
  loadCloudMatchJournals,
  readLocalMatchJournals,
  writeLocalMatchJournals,
} from "@/lib/match-journals";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SportFilter = "all" | "football" | "tennis";
type CompletionFilter = "all" | "complete" | "incomplete";
type ConfidenceFilter = "all" | "high" | "medium" | "low";

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidenceBand(score: number): ConfidenceFilter {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function confidenceLabel(score: number) {
  const band = confidenceBand(score);
  if (band === "high") return "High";
  if (band === "medium") return "Medium";
  return "Low";
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const { isPro } = useSubscription();
  const [journals, setJournals] = useState<Record<string, MatchJournal>>({});
  const [query, setQuery] = useState("");
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [syncMessage, setSyncMessage] = useState("Local research library");

  useEffect(() => {
    const localJournals = readLocalMatchJournals();
    setJournals(localJournals);

    const supabase = getSupabaseBrowserClient();
    if (authLoading) return;
    if (!supabase || !user) {
      setSyncMessage("Local research library");
      return;
    }

    let cancelled = false;
    setSyncMessage("Loading cloud research library...");
    loadCloudMatchJournals(supabase)
      .then(cloudJournals => {
        if (cancelled) return;
        const merged = { ...localJournals, ...cloudJournals };
        setJournals(merged);
        writeLocalMatchJournals(merged);
        setSyncMessage("Cloud research library synced");
      })
      .catch(error => {
        if (cancelled) return;
        setSyncMessage(error instanceof Error ? `Cloud library unavailable: ${error.message}` : "Cloud library unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const allJournals = useMemo(() => {
    return Object.values(journals)
      .filter(journal => journalCompleteness(journal) > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [journals]);

  const filtered = allJournals.filter(journal => {
    const normalizedQuery = query.trim().toLowerCase();
    if (sportFilter !== "all" && journal.sport !== sportFilter) return false;
    if (completionFilter === "complete" && journalCompleteness(journal) < 4) return false;
    if (completionFilter === "incomplete" && journalCompleteness(journal) === 4) return false;
    if (confidenceFilter !== "all" && confidenceBand(journal.confidenceScore) !== confidenceFilter) return false;
    if (!normalizedQuery) return true;
    return [
      journal.matchTitle,
      journal.sport,
      journal.modelView,
      journal.teamNews,
      journal.riskFlags,
      journal.finalReview,
    ].join(" ").toLowerCase().includes(normalizedQuery);
  });

  const visible = isPro ? filtered : filtered.slice(0, 3);
  const lockedCount = Math.max(0, filtered.length - visible.length);
  const completeCount = allJournals.filter(journal => journalCompleteness(journal) === 4).length;
  const highConfidenceCount = allJournals.filter(journal => journal.confidenceScore >= 70).length;

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Research archive
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Research Library
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Browse saved match journals, confidence notes, and completed research across your workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/journal" className="px-4 py-2 rounded-xl text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            Journal
          </Link>
          <Link href="/exports" className="px-4 py-2 rounded-xl text-sm font-bold border" style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}>
            Exports
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Journals" value={allJournals.length} tone="var(--green)" />
        <Metric label="Complete" value={completeCount} tone="var(--cyan, #06b6d4)" />
        <Metric label="High conf." value={highConfidenceCount} tone="var(--warning)" />
        <Metric label="Visible" value={`${visible.length}/${filtered.length}`} tone={isPro ? "var(--green)" : "var(--warning)"} />
      </div>

      <section className="rounded-xl border px-4 py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div>
          <p className="text-xs font-black uppercase" style={{ color: user ? "var(--green)" : "var(--secondary)" }}>
            {user ? "Cloud research library" : "Local research library"}
          </p>
          <p className="text-sm" style={{ color: "var(--secondary)" }}>
            {user ? syncMessage : "Sign in on Account to sync library records across browsers."}
          </p>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-lg border" style={{ borderColor: "var(--border)", color: isPro ? "var(--green)" : "var(--warning)" }}>
          {isPro ? "Full library" : "Free preview"}
        </span>
      </section>

      <section className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search teams, model notes, context, risk flags..."
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
          />
          <select value={sportFilter} onChange={event => setSportFilter(event.target.value as SportFilter)} className="rounded-xl px-3 py-3 text-sm font-bold outline-none" style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}>
            <option value="all">All sports</option>
            <option value="football">Football</option>
            <option value="tennis">Tennis</option>
          </select>
          <select value={completionFilter} onChange={event => setCompletionFilter(event.target.value as CompletionFilter)} className="rounded-xl px-3 py-3 text-sm font-bold outline-none" style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}>
            <option value="all">All completion</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>
          <select value={confidenceFilter} onChange={event => setConfidenceFilter(event.target.value as ConfidenceFilter)} className="rounded-xl px-3 py-3 text-sm font-bold outline-none" style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}>
            <option value="all">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </section>

      {allJournals.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No saved research yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            Apply a Journal template or write notes for a planned match to build the library.
          </p>
          <Link href="/journal" className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
            Open Journal
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border px-5 py-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No journals match this filter</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>Adjust search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map(journal => {
            const completion = journalCompleteness(journal);
            return (
              <article key={journal.id} className="rounded-xl border p-4 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-black px-2 py-1 rounded-lg capitalize" style={{ color: "var(--green)", background: "rgba(22,199,132,0.12)" }}>
                        {journal.sport}
                      </span>
                      <span className="text-xs font-bold" style={{ color: "var(--secondary)" }}>
                        {completion}/4 fields
                      </span>
                    </div>
                    <h2 className="font-black text-lg leading-snug">{journal.matchTitle}</h2>
                    <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
                      Updated {formatUpdated(journal.updatedAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Confidence</p>
                    <p className="text-2xl font-black tabular-nums" style={{ color: journal.confidenceScore >= 70 ? "var(--green)" : journal.confidenceScore >= 45 ? "var(--warning)" : "#EF4444" }}>
                      {journal.confidenceScore}%
                    </p>
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>{confidenceLabel(journal.confidenceScore)}</p>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Snippet label="Model view" value={journal.modelView} />
                  <Snippet label="Risk flags" value={journal.riskFlags} />
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/journal?selection=${encodeURIComponent(journal.selectionId)}`}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-black text-center"
                    style={{ background: "var(--green)", color: "#000" }}
                  >
                    Open journal
                  </Link>
                  <Link
                    href="/exports"
                    className="rounded-xl px-4 py-2.5 text-sm font-bold border"
                    style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--green)" }}
                  >
                    Export
                  </Link>
                </div>
              </article>
            );
          })}
          {lockedCount > 0 && (
            <div className="rounded-xl border p-6 flex flex-col justify-center" style={{ background: "var(--surface)", borderColor: "rgba(245,166,35,0.35)" }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--warning)" }}>
                {lockedCount} library item{lockedCount === 1 ? "" : "s"} locked
              </p>
              <h2 className="text-xl font-black mt-2" style={{ fontFamily: "var(--font-heading)" }}>
                Unlock the full research library
              </h2>
              <p className="text-sm mt-2" style={{ color: "var(--secondary)" }}>
                Pro Analysis unlocks every saved journal, full filtering, and complete research review access.
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

function Metric({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>{label}</p>
      <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: tone }}>{value}</p>
    </div>
  );
}

function Snippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg)" }}>
      <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>{label}</p>
      <p className="text-sm mt-1 line-clamp-3" style={{ color: "var(--white)" }}>
        {value.trim() || "No note added yet."}
      </p>
    </div>
  );
}
