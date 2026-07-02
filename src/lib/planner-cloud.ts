import { SupabaseClient } from "@supabase/supabase-js";
import type { BetSelection, PlanStatus, SelectionMeta } from "@/contexts/BetSlipContext";

interface PlannerItemRow {
  selection_id: string;
  match_id: string;
  match_title: string;
  sport: "football" | "tennis";
  commence_time: string | null;
  competition: string | null;
  market: string;
  outcome: string;
  odds: number | string;
  status: PlanStatus;
  note: string;
}

export interface CloudPlan {
  selections: BetSelection[];
  selectionMeta: Record<string, SelectionMeta>;
}

function toPlannerRow(userId: string, selection: BetSelection, meta: SelectionMeta): PlannerItemRow & { user_id: string } {
  return {
    user_id: userId,
    selection_id: selection.id,
    match_id: selection.matchId,
    match_title: selection.matchTitle,
    sport: selection.sport,
    commence_time: selection.commenceTime ?? null,
    competition: selection.competition ?? null,
    market: selection.market,
    outcome: selection.outcome,
    odds: selection.odds,
    status: meta.status,
    note: meta.note,
  };
}

function fromPlannerRow(row: PlannerItemRow): { selection: BetSelection; meta: SelectionMeta } {
  return {
    selection: {
      id: row.selection_id,
      matchId: row.match_id,
      matchTitle: row.match_title,
      sport: row.sport,
      commenceTime: row.commence_time ?? undefined,
      competition: row.competition ?? undefined,
      market: row.market,
      outcome: row.outcome,
      odds: Number(row.odds),
    },
    meta: {
      status: row.status,
      note: row.note ?? "",
    },
  };
}

export async function loadCloudPlan(supabase: SupabaseClient): Promise<CloudPlan> {
  const { data, error } = await supabase
    .from("planner_items")
    .select("selection_id, match_id, match_title, sport, commence_time, competition, market, outcome, odds, status, note")
    .order("commence_time", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as PlannerItemRow[];
  const selections: BetSelection[] = [];
  const selectionMeta: Record<string, SelectionMeta> = {};
  rows.forEach(row => {
    const item = fromPlannerRow(row);
    selections.push(item.selection);
    selectionMeta[item.selection.id] = item.meta;
  });

  return { selections, selectionMeta };
}

export async function saveCloudPlan(
  supabase: SupabaseClient,
  userId: string,
  selections: BetSelection[],
  selectionMeta: Record<string, SelectionMeta>,
) {
  const { error: deleteError } = await supabase
    .from("planner_items")
    .delete()
    .eq("user_id", userId);

  if (deleteError) throw deleteError;
  if (selections.length === 0) return;

  const rows = selections.map(selection => toPlannerRow(userId, selection, selectionMeta[selection.id] ?? { status: "watching", note: "" }));
  const { error: insertError } = await supabase.from("planner_items").insert(rows);
  if (insertError) throw insertError;
}
