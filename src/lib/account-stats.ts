import { SupabaseClient } from "@supabase/supabase-js";

export interface AccountStats {
  plannedItems: number;
  savedSessions: number;
  activeReminders: number;
  lastPlannerSync: string | null;
  lastHistorySync: string | null;
  lastReminderSync: string | null;
}

const EMPTY_STATS: AccountStats = {
  plannedItems: 0,
  savedSessions: 0,
  activeReminders: 0,
  lastPlannerSync: null,
  lastHistorySync: null,
  lastReminderSync: null,
};

export async function loadCloudAccountStats(supabase: SupabaseClient): Promise<AccountStats> {
  const [
    plannerCount,
    historyCount,
    reminderCount,
    latestPlanner,
    latestHistory,
    latestReminder,
  ] = await Promise.all([
    supabase.from("planner_items").select("id", { count: "exact", head: true }),
    supabase.from("analysis_sessions").select("id", { count: "exact", head: true }),
    supabase.from("alert_rules").select("id", { count: "exact", head: true }).eq("rule_type", "review").eq("enabled", true),
    supabase.from("planner_items").select("updated_at").order("updated_at", { ascending: false }).limit(1),
    supabase.from("analysis_sessions").select("updated_at").order("updated_at", { ascending: false }).limit(1),
    supabase.from("alert_rules").select("updated_at").eq("rule_type", "review").order("updated_at", { ascending: false }).limit(1),
  ]);

  const errors = [plannerCount.error, historyCount.error, reminderCount.error, latestPlanner.error, latestHistory.error, latestReminder.error].filter(Boolean);
  if (errors[0]) throw errors[0];

  return {
    plannedItems: plannerCount.count ?? 0,
    savedSessions: historyCount.count ?? 0,
    activeReminders: reminderCount.count ?? 0,
    lastPlannerSync: latestPlanner.data?.[0]?.updated_at ?? null,
    lastHistorySync: latestHistory.data?.[0]?.updated_at ?? null,
    lastReminderSync: latestReminder.data?.[0]?.updated_at ?? null,
  };
}

export function emptyAccountStats() {
  return { ...EMPTY_STATS };
}
