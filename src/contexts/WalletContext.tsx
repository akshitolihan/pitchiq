"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { BetSelection } from "./BetSlipContext";

export interface PlacedBet {
  id: string;
  placedAt: string;
  selections: BetSelection[];
  stake: number;
  mode: "single" | "acca";
  potentialReturn: number;
  totalOdds: number;
  status: "pending" | "won" | "lost" | "void";
  settledAt?: string;
  actualReturn: number;
}

interface WalletState {
  balance: number;
  bets: PlacedBet[];
}

type Action =
  | { type: "LOAD"; state: WalletState }
  | { type: "PLACE_BET"; bet: PlacedBet }
  | { type: "SETTLE_BET"; id: string; result: "won" | "lost" | "void" }
  | { type: "RESET" };

const STARTING_BALANCE = 5000;

function reducer(state: WalletState, action: Action): WalletState {
  switch (action.type) {
    case "LOAD":
      return action.state;

    case "PLACE_BET":
      return {
        balance: state.balance - action.bet.stake * (action.bet.mode === "single" ? action.bet.selections.length : 1),
        bets: [action.bet, ...state.bets],
      };

    case "SETTLE_BET": {
      const bet = state.bets.find(b => b.id === action.id);
      if (!bet) return state;
      const actualReturn = action.result === "won" ? bet.potentialReturn : 0;
      return {
        balance: state.balance + actualReturn,
        bets: state.bets.map(b => b.id === action.id
          ? { ...b, status: action.result, settledAt: new Date().toISOString(), actualReturn }
          : b),
      };
    }

    case "RESET":
      return { balance: STARTING_BALANCE, bets: [] };

    default:
      return state;
  }
}

interface WalletCtx {
  state: WalletState;
  placeBet: (selections: BetSelection[], stake: number, mode: "single" | "acca") => boolean;
  settleBet: (id: string, result: "won" | "lost" | "void") => void;
  resetWallet: () => void;
}

const WalletContext = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { balance: STARTING_BALANCE, bets: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pitchiq_wallet");
      if (saved) dispatch({ type: "LOAD", state: JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pitchiq_wallet", JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  const placeBet = useCallback((selections: BetSelection[], stake: number, mode: "single" | "acca"): boolean => {
    const totalStake = stake * (mode === "single" ? selections.length : 1);
    if (totalStake > state.balance) return false;

    const totalOdds = selections.reduce((a, s) => a * s.odds, 1);
    const potentialReturn = mode === "acca"
      ? stake * totalOdds
      : selections.reduce((a, s) => a + stake * s.odds, 0);

    const bet: PlacedBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      placedAt: new Date().toISOString(),
      selections,
      stake,
      mode,
      totalOdds,
      potentialReturn,
      status: "pending",
      actualReturn: 0,
    };
    dispatch({ type: "PLACE_BET", bet });
    return true;
  }, [state.balance]);

  const settleBet = useCallback((id: string, result: "won" | "lost" | "void") => {
    dispatch({ type: "SETTLE_BET", id, result });
  }, []);

  const resetWallet = useCallback(() => dispatch({ type: "RESET" }), []);

  return (
    <WalletContext.Provider value={{ state, placeBet, settleBet, resetWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
