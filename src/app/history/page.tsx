"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnalysisSession,
  deleteCloudAnalysisSession,
  readAnalysisSessions,
  readCloudAnalysisSessions,
  writeAnalysisSessions,
} from "@/lib/analysis-sessions";
import { useAuth } from "@/contexts/AuthContext";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionStats(session: AnalysisSession) {
  const metaValues = Object.values(session.selectionMeta);
  return {
    strong: metaValues.filter(meta => meta.status === "strong-interest").length,
    review: metaValues.filter(meta => meta.status === "review-later").length,
    avoid: metaValues.filter(meta => meta.status === "avoid").length,
    notes: metaValues.filter(meta => meta.note.trim().length > 0).length,
  };
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [syncMessage, setSyncMessage] = useState("Local history");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const { user, loading: authLoading } = useAuth();
  const { replacePlan } = useBetSlip();
  const router = useRouter();

  useEffect(() => {
    const localSessions = readAnalysisSessions();
    setSessions(localSessions);

    const supabase = getSupabaseBrowserClient();
    if (authLoading) return;
    if (!supabase || !user) {
      setSyncMessage("Local history");
      return;
    }

    let cancelled = false;
    setSyncMessage("Loading cloud history...");
    readCloudAnalysisSessions(supabase)
      .then(cloudSessions => {
        if (cancelled) return;
        const merged = [
          ...cloudSessions,
          ...localSessions.filter(local => !cloudSessions.some(cloud => cloud.id === local.id)),
        ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 50);
        writeAnalysisSessions(merged);
        setSessions(merged);
        setSyncMessage("Cloud history synced");
      })
      .catch(error => {
        if (cancelled) return;
        setSyncMessage(error instanceof Error ? `Cloud history unavailable: ${error.message}` : "Cloud history unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const tags = useMemo(() => {
    return ["all", ...Array.from(new Set(sessions.map(session => session.tag)))];
  }, [sessions]);

  const filtered = sessions.filter(session => {
    const tagMatch = tagFilter === "all" || session.tag === tagFilter;
    if (!tagMatch) return false;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    const text = [
      session.name,
      session.tag,
      ...session.selections.map(selection => [
        selection.matchTitle,
        selection.market,
        selection.outcome,
        selection.competition ?? "",
      ].join(" ")),
    ].join(" ").toLowerCase();
    return text.includes(normalizedQuery);
  });

  function restoreSession(session: AnalysisSession) {
    replacePlan(session.selections, session.selectionMeta);
    router.push("/planner");
  }

  async function deleteSession(id: string) {
    const next = sessions.filter(session => session.id !== id);
    setSessions(next);
    writeAnalysisSessions(next);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    try {
      await deleteCloudAnalysisSession(supabase, id);
      setSyncMessage("Cloud history synced");
    } catch (error) {
      setSyncMessage(error instanceof Error ? `Deleted locally. Cloud delete failed: ${error.message}` : "Deleted locally. Cloud delete failed.");
    }
  }

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Saved analysis
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            History
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Reopen named plans, recover prior analysis, and compare previous watchlists.
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
            href="/lab"
            className="px-4 py-2 rounded-xl text-sm font-bold border"
            style={{ borderColor: "var(--border)", color: "var(--green)", background: "var(--surface)" }}
          >
            Lab
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Sessions</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{sessions.length}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Saved items</p>
          <p className="text-3xl font-black mt-1 tabular-nums">
            {sessions.reduce((total, session) => total + session.selections.length, 0)}
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Labels</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{Math.max(0, tags.length - 1)}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Filtered</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{filtered.length}</p>
        </div>
      </div>

      <section className="rounded-xl border px-4 py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div>
          <p className="text-xs font-black uppercase" style={{ color: user ? "var(--green)" : "var(--secondary)" }}>
            {user ? "Cloud history" : "Local history"}
          </p>
          <p className="text-sm" style={{ color: "var(--secondary)" }}>
            {user ? syncMessage : "Sign in on Account to recover saved sessions across browsers."}
          </p>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-lg border" style={{ borderColor: "var(--border)", color: user ? "var(--green)" : "var(--secondary)" }}>
          {user ? "account" : "local"}
        </span>
      </section>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search sessions, teams, markets, notes..."
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--surface)", color: "var(--white)", border: "1px solid var(--border)" }}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tags.map(tag => {
            const active = tagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border"
                style={{
                  background: active ? "var(--green)" : "var(--surface)",
                  color: active ? "#000" : "var(--secondary)",
                  borderColor: active ? "var(--green)" : "var(--border)",
                }}
              >
                {tag === "all" ? "All" : tag}
              </button>
            );
          })}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border px-5 py-12 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No saved sessions yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            Save the current plan from Planner to build your analysis history.
          </p>
          <Link
            href="/planner"
            className="inline-flex mt-5 px-4 py-2 rounded-xl text-sm font-black"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Open planner
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border px-5 py-10 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="font-black">No sessions found</p>
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>Adjust search or label filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map(session => {
            const stats = sessionStats(session);
            return (
              <article
                key={session.id}
                className="rounded-xl border p-4 space-y-4"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-black px-2 py-1 rounded-lg" style={{ color: "var(--green)", background: "rgba(22,199,132,0.12)" }}>
                        {session.tag}
                      </span>
                      <span className="text-xs" style={{ color: "var(--secondary)" }}>
                        {formatDate(session.updatedAt)}
                      </span>
                    </div>
                    <h2 className="font-black text-lg truncate">{session.name}</h2>
                    <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
                      {session.selections.length} item{session.selections.length === 1 ? "" : "s"} saved
                    </p>
                  </div>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="shrink-0 w-8 h-8 rounded-lg text-sm font-black"
                    style={{ background: "var(--bg)", color: "var(--secondary)" }}
                    aria-label={`Delete ${session.name}`}
                  >
                    X
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Strong", value: stats.strong, color: "var(--green)" },
                    { label: "Review", value: stats.review, color: "var(--warning)" },
                    { label: "Avoid", value: stats.avoid, color: "#EF4444" },
                    { label: "Notes", value: stats.notes, color: "var(--cyan, #06b6d4)" },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg p-3" style={{ background: "var(--bg)" }}>
                      <p className="text-xs font-bold uppercase" style={{ color: item.color }}>{item.label}</p>
                      <p className="text-xl font-black mt-1 tabular-nums">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {session.selections.slice(0, 3).map(selection => (
                    <div key={selection.id} className="rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}>
                      <p className="text-sm font-bold truncate">{selection.matchTitle}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--secondary)" }}>
                        {selection.market} - {selection.outcome}
                      </p>
                    </div>
                  ))}
                  {session.selections.length > 3 && (
                    <p className="text-xs" style={{ color: "var(--secondary)" }}>
                      +{session.selections.length - 3} more saved item{session.selections.length - 3 === 1 ? "" : "s"}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => restoreSession(session)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-black"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  Restore to planner
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
