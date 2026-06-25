"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";

export interface BetSelection {
  id: string;           // unique: `${matchId}||${market}||${outcome}`
  matchId: string;
  matchTitle: string;   // "Netherlands vs Sweden"
  sport: "football" | "tennis";
  market: string;       // "1X2" | "Double Chance" | "Draw No Bet" | "BTTS" | "Over/Under" | "Match Winner"
  outcome: string;      // "Netherlands" | "1X" | "Home DNB" | "Yes" | "Over 2.5"
  odds: number;
}

interface BetSlipState {
  selections: BetSelection[];
  stake: number;        // per-selection stake
  open: boolean;
}

type Action =
  | { type: "TOGGLE_SELECTION"; payload: BetSelection }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" }
  | { type: "SET_STAKE"; stake: number }
  | { type: "SET_OPEN"; open: boolean }
  | { type: "LOAD"; selections: BetSelection[]; stake: number };

function reducer(state: BetSlipState, action: Action): BetSlipState {
  switch (action.type) {
    case "TOGGLE_SELECTION": {
      const exists = state.selections.find(s => s.id === action.payload.id);
      const selections = exists
        ? state.selections.filter(s => s.id !== action.payload.id)
        : [...state.selections, action.payload];
      return { ...state, selections };
    }
    case "REMOVE":
      return { ...state, selections: state.selections.filter(s => s.id !== action.id) };
    case "CLEAR":
      return { ...state, selections: [] };
    case "SET_STAKE":
      return { ...state, stake: action.stake };
    case "SET_OPEN":
      return { ...state, open: action.open };
    case "LOAD":
      return { ...state, selections: action.selections, stake: action.stake };
    default:
      return state;
  }
}

interface BetSlipCtx {
  state: BetSlipState;
  toggleSelection: (sel: BetSelection) => void;
  removeSelection: (id: string) => void;
  clearSlip: () => void;
  setStake: (n: number) => void;
  setOpen: (open: boolean) => void;
  isSelected: (id: string) => boolean;
}

const BetSlipContext = createContext<BetSlipCtx | null>(null);

export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { selections: [], stake: 10, open: false });

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pitchiq_betslip");
      if (saved) {
        const { selections, stake } = JSON.parse(saved);
        dispatch({ type: "LOAD", selections: selections ?? [], stake: stake ?? 10 });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pitchiq_betslip", JSON.stringify({ selections: state.selections, stake: state.stake }));
    } catch { /* ignore */ }
  }, [state.selections, state.stake]);

  const toggleSelection = useCallback((sel: BetSelection) => dispatch({ type: "TOGGLE_SELECTION", payload: sel }), []);
  const removeSelection = useCallback((id: string) => dispatch({ type: "REMOVE", id }), []);
  const clearSlip = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const setStake = useCallback((stake: number) => dispatch({ type: "SET_STAKE", stake }), []);
  const setOpen = useCallback((open: boolean) => dispatch({ type: "SET_OPEN", open }), []);
  const isSelected = useCallback((id: string) => state.selections.some(s => s.id === id), [state.selections]);

  return (
    <BetSlipContext.Provider value={{ state, toggleSelection, removeSelection, clearSlip, setStake, setOpen, isSelected }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used inside BetSlipProvider");
  return ctx;
}
