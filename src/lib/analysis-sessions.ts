import { BetSelection, SelectionMeta } from "@/contexts/BetSlipContext";

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

export function makeSessionName() {
  return `Analysis Session ${new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

