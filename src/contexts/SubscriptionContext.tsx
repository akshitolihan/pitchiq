"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";

export type SubscriptionPlan = "free" | "pro";

interface SubscriptionState {
  plan: SubscriptionPlan;
  startedAt?: string;
  updatedAt?: string;
}

type SubscriptionAction =
  | { type: "LOAD"; state: SubscriptionState }
  | { type: "SET_PLAN"; plan: SubscriptionPlan };

interface SubscriptionContextValue {
  state: SubscriptionState;
  isPro: boolean;
  setPlan: (plan: SubscriptionPlan) => void;
}

const STORAGE_KEY = "pitchiq_subscription";
const DEFAULT_STATE: SubscriptionState = { plan: "free" };

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function reducer(state: SubscriptionState, action: SubscriptionAction): SubscriptionState {
  if (action.type === "LOAD") return action.state;
  const now = new Date().toISOString();
  return {
    plan: action.plan,
    startedAt: action.plan === state.plan ? state.startedAt : now,
    updatedAt: now,
  };
}

function normaliseState(value: unknown): SubscriptionState {
  if (!value || typeof value !== "object") return DEFAULT_STATE;
  const candidate = value as Partial<SubscriptionState>;
  return {
    plan: candidate.plan === "pro" ? "pro" : "free",
    startedAt: candidate.startedAt,
    updatedAt: candidate.updatedAt,
  };
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      dispatch({ type: "LOAD", state: normaliseState(JSON.parse(raw)) });
    } catch {
      dispatch({ type: "LOAD", state: DEFAULT_STATE });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setPlan = useCallback((plan: SubscriptionPlan) => {
    dispatch({ type: "SET_PLAN", plan });
  }, []);

  const value = useMemo(
    () => ({
      state,
      isPro: state.plan === "pro",
      setPlan,
    }),
    [setPlan, state],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}
