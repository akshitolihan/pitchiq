import { SupabaseClient } from "@supabase/supabase-js";
import type { BetSelection } from "@/contexts/BetSlipContext";

export interface MatchJournal {
  id: string;
  selectionId: string;
  matchId: string;
  matchTitle: string;
  sport: "football" | "tennis";
  modelView: string;
  teamNews: string;
  riskFlags: string;
  finalReview: string;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
}

interface MatchJournalRow {
  id: string;
  selection_id: string | null;
  payload: {
    matchId?: string;
    matchTitle?: string;
    sport?: "football" | "tennis";
    modelView?: string;
    teamNews?: string;
    riskFlags?: string;
    finalReview?: string;
    confidenceScore?: number;
    createdAt?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

const MATCH_JOURNALS_KEY = "pitchiq_match_journals";

export function blankJournal(selection: BetSelection): MatchJournal {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `journal-${Date.now()}`,
    selectionId: selection.id,
    matchId: selection.matchId,
    matchTitle: selection.matchTitle,
    sport: selection.sport,
    modelView: "",
    teamNews: "",
    riskFlags: "",
    finalReview: "",
    confidenceScore: 50,
    createdAt: now,
    updatedAt: now,
  };
}

export function readLocalMatchJournals(): Record<string, MatchJournal> {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(MATCH_JOURNALS_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLocalMatchJournals(journals: Record<string, MatchJournal>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MATCH_JOURNALS_KEY, JSON.stringify(journals));
}

function fromRow(row: MatchJournalRow): MatchJournal | null {
  if (!row.selection_id || !row.payload?.matchId || !row.payload?.matchTitle || !row.payload?.sport) return null;
  return {
    id: row.id,
    selectionId: row.selection_id,
    matchId: row.payload.matchId,
    matchTitle: row.payload.matchTitle,
    sport: row.payload.sport,
    modelView: row.payload.modelView ?? "",
    teamNews: row.payload.teamNews ?? "",
    riskFlags: row.payload.riskFlags ?? "",
    finalReview: row.payload.finalReview ?? "",
    confidenceScore: row.payload.confidenceScore ?? 50,
    createdAt: row.payload.createdAt ?? row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadCloudMatchJournals(supabase: SupabaseClient): Promise<Record<string, MatchJournal>> {
  const { data, error } = await supabase
    .from("alert_rules")
    .select("id, selection_id, payload, created_at, updated_at")
    .eq("rule_type", "journal")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as MatchJournalRow[])
      .map(fromRow)
      .filter((journal): journal is MatchJournal => Boolean(journal))
      .map(journal => [journal.selectionId, journal]),
  );
}

export async function saveCloudMatchJournal(supabase: SupabaseClient, userId: string, journal: MatchJournal) {
  const now = new Date().toISOString();
  const { error: deleteError } = await supabase
    .from("alert_rules")
    .delete()
    .eq("user_id", userId)
    .eq("selection_id", journal.selectionId)
    .eq("rule_type", "journal");

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("alert_rules")
    .insert({
      id: journal.id,
      user_id: userId,
      selection_id: journal.selectionId,
      rule_type: "journal",
      trigger_at: null,
      enabled: true,
      payload: {
        matchId: journal.matchId,
        matchTitle: journal.matchTitle,
        sport: journal.sport,
        modelView: journal.modelView,
        teamNews: journal.teamNews,
        riskFlags: journal.riskFlags,
        finalReview: journal.finalReview,
        confidenceScore: journal.confidenceScore,
        createdAt: journal.createdAt,
      },
      updated_at: now,
    });

  if (insertError) throw insertError;
}

export function journalCompleteness(journal: MatchJournal | undefined) {
  if (!journal) return 0;
  return [journal.modelView, journal.teamNews, journal.riskFlags, journal.finalReview]
    .filter(value => value.trim().length > 0).length;
}
