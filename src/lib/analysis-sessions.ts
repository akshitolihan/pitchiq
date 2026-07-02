import { SupabaseClient } from "@supabase/supabase-js";
import type { BetSelection, SelectionMeta } from "@/contexts/BetSlipContext";

export interface AnalysisSession {
  id: string;
  name: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
  selections: BetSelection[];
  selectionMeta: Record<string, SelectionMeta>;
}

export const ANALYSIS_SESSIONS_KEY = "pitchiq_analysis_sessions";

export function readAnalysisSessions(): AnalysisSession[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(ANALYSIS_SESSIONS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeAnalysisSessions(sessions: AnalysisSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYSIS_SESSIONS_KEY, JSON.stringify(sessions));
}

interface AnalysisSessionRow {
  id: string;
  name: string;
  tag: string;
  selections: BetSelection[];
  selection_meta: Record<string, SelectionMeta>;
  created_at: string;
  updated_at: string;
}

function fromSessionRow(row: AnalysisSessionRow): AnalysisSession {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    selections: row.selections ?? [],
    selectionMeta: row.selection_meta ?? {},
  };
}

export async function readCloudAnalysisSessions(supabase: SupabaseClient): Promise<AnalysisSession[]> {
  const { data, error } = await supabase
    .from("analysis_sessions")
    .select("id, name, tag, selections, selection_meta, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as AnalysisSessionRow[]).map(fromSessionRow);
}

export async function saveCloudAnalysisSession(supabase: SupabaseClient, userId: string, session: AnalysisSession) {
  const { error } = await supabase
    .from("analysis_sessions")
    .upsert({
      id: session.id,
      user_id: userId,
      name: session.name,
      tag: session.tag,
      selections: session.selections,
      selection_meta: session.selectionMeta,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });

  if (error) throw error;
}

export async function deleteCloudAnalysisSession(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .from("analysis_sessions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export function makeSessionName() {
  return `Analysis Session ${new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

export function makeSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-" + String(Date.now()).slice(-12).padStart(12, "0");
}
