"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";

export interface BetSelection {
  id: string;           // unique: `${matchId}||${market}||${outcome}`
  matchId: string;
  matchTitle: string;   // "Netherlands vs Sweden"
  sport: "football" | "tennis";
  commenceTime?: string;
  competition?: string;
  market: string;       // "1X2" | "Double Chance" | "Draw No Bet" | "BTTS" | "Over/Under" | "Match Winner"
  outcome: string;      // "Netherlands" | "1X" | "Home DNB" | "Yes" | "Over 2.5"
  odds: number;
}

export type PlanStatus = "watching" | "strong-interest" | "avoid" | "review-later";

export interface SelectionMeta {
  status: PlanStatus;
  note: string;
}

interface BetSlipState {
  selections: BetSelection[];
  selectionMeta: Record<string, SelectionMeta>;
  stake: number;        // per-selection stake
  open: boolean;
}

type Action =
  | { type: "TOGGLE_SELECTION"; payload: BetSelection }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" }
  | { type: "SET_SELECTION_STATUS"; id: string; status: PlanStatus }
  | { type: "SET_SELECTION_NOTE"; id: string; note: string }
  | { type: "SET_STAKE"; stake: number }
  | { type: "SET_OPEN"; open: boolean }
  | { type: "LOAD"; selections: BetSelection[]; selectionMeta?: Record<string, SelectionMeta>; stake: number };

const DEFAULT_SELECTION_META: SelectionMeta = { status: "watching", note: "" };

function normalizedMarket(market: string) {
  return market.toLowerCase().replace(/\s+/g, " ").trim();
}

function resultSet(selection: BetSelection): Set<string> | null {
  const market = normalizedMarket(selection.market);
  const outcome = selection.outcome.toLowerCase();

  if (market === "1x2" || market === "match winner") {
    if (outcome === "draw") return new Set(["draw"]);
    if (outcome.includes("draw")) return new Set(["draw"]);
    if (outcome === selection.matchTitle.split(" vs ")[0].toLowerCase()) return new Set(["home"]);
    if (outcome === selection.matchTitle.split(" vs ")[1]?.toLowerCase()) return new Set(["away"]);
    return selection.id.endsWith("||home") || selection.id.endsWith("||p1")
      ? new Set(["home"])
      : selection.id.endsWith("||away") || selection.id.endsWith("||p2")
        ? new Set(["away"])
        : null;
  }

  if (market === "double chance") {
    if (outcome.includes("1x")) return new Set(["home", "draw"]);
    if (outcome.includes("x2")) return new Set(["draw", "away"]);
    if (outcome.includes("12")) return new Set(["home", "away"]);
  }

  if (market === "draw no bet") {
    if (selection.id.endsWith("||home")) return new Set(["home"]);
    if (selection.id.endsWith("||away")) return new Set(["away"]);
  }

  return null;
}

function exclusiveGroup(selection: BetSelection): string | null {
  const market = normalizedMarket(selection.market);
  if (["1x2", "match winner", "draw no bet", "btts", "correct score", "total sets"].includes(market)) {
    return market;
  }
  if (market.startsWith("over/under")) return market;
  return null;
}

function areMutuallyExclusive(a: BetSelection, b: BetSelection) {
  if (a.matchId !== b.matchId || a.sport !== b.sport) return false;

  const aGroup = exclusiveGroup(a);
  const bGroup = exclusiveGroup(b);
  if (aGroup && aGroup === bGroup) return true;

  const aResults = resultSet(a);
  const bResults = resultSet(b);
  if (!aResults || !bResults) return false;

  return Array.from(aResults).every(result => !bResults.has(result));
}

function withoutMutuallyExclusiveSelections(selections: BetSelection[]) {
  return selections.reduce<BetSelection[]>((validSelections, selection) => [
    ...validSelections.filter(existing => !areMutuallyExclusive(existing, selection)),
    selection,
  ], []);
}

function cleanSelectionMeta(selections: BetSelection[], selectionMeta: Record<string, SelectionMeta> = {}) {
  const selectionIds = new Set(selections.map(selection => selection.id));
  return Object.fromEntries(
    Object.entries(selectionMeta)
      .filter(([id]) => selectionIds.has(id))
      .map(([id, meta]) => [id, { ...DEFAULT_SELECTION_META, ...meta }])
  );
}

function reducer(state: BetSlipState, action: Action): BetSlipState {
  switch (action.type) {
    case "TOGGLE_SELECTION": {
      const exists = state.selections.find(s => s.id === action.payload.id);
      const selections = exists
        ? state.selections.filter(s => s.id !== action.payload.id)
        : withoutMutuallyExclusiveSelections([...state.selections, action.payload]);
      return { ...state, selections, selectionMeta: cleanSelectionMeta(selections, state.selectionMeta) };
    }
    case "REMOVE":
      return {
        ...state,
        selections: state.selections.filter(s => s.id !== action.id),
        selectionMeta: cleanSelectionMeta(state.selections.filter(s => s.id !== action.id), state.selectionMeta),
      };
    case "CLEAR":
      return { ...state, selections: [], selectionMeta: {} };
    case "SET_SELECTION_STATUS":
      return {
        ...state,
        selectionMeta: {
          ...state.selectionMeta,
          [action.id]: { ...(state.selectionMeta[action.id] ?? DEFAULT_SELECTION_META), status: action.status },
        },
      };
    case "SET_SELECTION_NOTE":
      return {
        ...state,
        selectionMeta: {
          ...state.selectionMeta,
          [action.id]: { ...(state.selectionMeta[action.id] ?? DEFAULT_SELECTION_META), note: action.note },
        },
      };
    case "SET_STAKE":
      return { ...state, stake: action.stake };
    case "SET_OPEN":
      return { ...state, open: action.open };
    case "LOAD":
      const selections = withoutMutuallyExclusiveSelections(action.selections);
      return {
        ...state,
        selections,
        selectionMeta: cleanSelectionMeta(selections, action.selectionMeta),
        stake: action.stake,
      };
    default:
      return state;
  }
}

interface BetSlipCtx {
  state: BetSlipState;
  toggleSelection: (sel: BetSelection) => void;
  removeSelection: (id: string) => void;
  clearSlip: () => void;
  getSelectionMeta: (id: string) => SelectionMeta;
  setSelectionStatus: (id: string, status: PlanStatus) => void;
  setSelectionNote: (id: string, note: string) => void;
  setStake: (n: number) => void;
  setOpen: (open: boolean) => void;
  isSelected: (id: string) => boolean;
}

const BetSlipContext = createContext<BetSlipCtx | null>(null);

export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { selections: [], selectionMeta: {}, stake: 10, open: false });

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pitchiq_betslip");
      if (saved) {
        const { selections, selectionMeta, stake } = JSON.parse(saved);
        dispatch({ type: "LOAD", selections: selections ?? [], selectionMeta, stake: stake ?? 10 });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pitchiq_betslip", JSON.stringify({
        selections: state.selections,
        selectionMeta: state.selectionMeta,
        stake: state.stake,
      }));
    } catch { /* ignore */ }
  }, [state.selections, state.selectionMeta, state.stake]);

  const toggleSelection = useCallback((sel: BetSelection) => dispatch({ type: "TOGGLE_SELECTION", payload: sel }), []);
  const removeSelection = useCallback((id: string) => dispatch({ type: "REMOVE", id }), []);
  const clearSlip = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const getSelectionMeta = useCallback((id: string) => state.selectionMeta[id] ?? DEFAULT_SELECTION_META, [state.selectionMeta]);
  const setSelectionStatus = useCallback((id: string, status: PlanStatus) => dispatch({ type: "SET_SELECTION_STATUS", id, status }), []);
  const setSelectionNote = useCallback((id: string, note: string) => dispatch({ type: "SET_SELECTION_NOTE", id, note }), []);
  const setStake = useCallback((stake: number) => dispatch({ type: "SET_STAKE", stake }), []);
  const setOpen = useCallback((open: boolean) => dispatch({ type: "SET_OPEN", open }), []);
  const isSelected = useCallback((id: string) => state.selections.some(s => s.id === id), [state.selections]);

  return (
    <BetSlipContext.Provider value={{
      state,
      toggleSelection,
      removeSelection,
      clearSlip,
      getSelectionMeta,
      setSelectionStatus,
      setSelectionNote,
      setStake,
      setOpen,
      isSelected,
    }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used inside BetSlipProvider");
  return ctx;
}
