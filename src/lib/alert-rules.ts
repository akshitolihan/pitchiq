import { SupabaseClient } from "@supabase/supabase-js";

export type ReminderOffset = "none" | "kickoff" | "30m" | "1h" | "3h" | "24h";

export interface ReviewReminder {
  id: string;
  selectionId: string;
  offset: ReminderOffset;
  triggerAt: string | null;
  enabled: boolean;
  updatedAt: string;
}

interface AlertRuleRow {
  id: string;
  selection_id: string | null;
  trigger_at: string | null;
  enabled: boolean;
  payload: { offset?: ReminderOffset } | null;
  updated_at: string;
}

const ALERT_RULES_KEY = "pitchiq_alert_rules";

export const REMINDER_OPTIONS: Array<{ value: ReminderOffset; label: string }> = [
  { value: "none", label: "No reminder" },
  { value: "kickoff", label: "At kickoff" },
  { value: "30m", label: "30m before" },
  { value: "1h", label: "1h before" },
  { value: "3h", label: "3h before" },
  { value: "24h", label: "24h before" },
];

export function readLocalReviewReminders(): Record<string, ReviewReminder> {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(ALERT_RULES_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLocalReviewReminders(reminders: Record<string, ReviewReminder>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ALERT_RULES_KEY, JSON.stringify(reminders));
}

export function reminderTriggerAt(commenceTime: string | undefined, offset: ReminderOffset) {
  if (!commenceTime || offset === "none") return null;
  const kickoff = new Date(commenceTime).getTime();
  if (Number.isNaN(kickoff)) return null;
  const offsetMs = {
    kickoff: 0,
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "3h": 3 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  }[offset];
  return new Date(kickoff - offsetMs).toISOString();
}

export function makeReviewReminder(selectionId: string, offset: ReminderOffset, commenceTime?: string): ReviewReminder {
  const updatedAt = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `rule-${Date.now()}`,
    selectionId,
    offset,
    triggerAt: reminderTriggerAt(commenceTime, offset),
    enabled: offset !== "none",
    updatedAt,
  };
}

function fromAlertRuleRow(row: AlertRuleRow): ReviewReminder | null {
  if (!row.selection_id) return null;
  const offset = row.payload?.offset ?? "kickoff";
  return {
    id: row.id,
    selectionId: row.selection_id,
    offset,
    triggerAt: row.trigger_at,
    enabled: row.enabled,
    updatedAt: row.updated_at,
  };
}

export async function loadCloudReviewReminders(supabase: SupabaseClient): Promise<Record<string, ReviewReminder>> {
  const { data, error } = await supabase
    .from("alert_rules")
    .select("id, selection_id, trigger_at, enabled, payload, updated_at")
    .eq("rule_type", "review")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return Object.fromEntries(
    ((data ?? []) as AlertRuleRow[])
      .map(fromAlertRuleRow)
      .filter((rule): rule is ReviewReminder => Boolean(rule))
      .map(rule => [rule.selectionId, rule]),
  );
}

export async function saveCloudReviewReminder(supabase: SupabaseClient, userId: string, reminder: ReviewReminder) {
  const { error: deleteError } = await supabase
    .from("alert_rules")
    .delete()
    .eq("user_id", userId)
    .eq("selection_id", reminder.selectionId)
    .eq("rule_type", "review");

  if (deleteError) throw deleteError;
  if (!reminder.enabled || reminder.offset === "none") return;

  const { error: insertError } = await supabase
    .from("alert_rules")
    .insert({
      id: reminder.id,
      user_id: userId,
      selection_id: reminder.selectionId,
      rule_type: "review",
      trigger_at: reminder.triggerAt,
      enabled: reminder.enabled,
      payload: { offset: reminder.offset },
      updated_at: reminder.updatedAt,
    });

  if (insertError) throw insertError;
}
