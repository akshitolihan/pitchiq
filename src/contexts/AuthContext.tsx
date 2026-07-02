"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SubscriptionPlan } from "@/contexts/SubscriptionContext";

interface UserProfile {
  id: string;
  email: string | null;
  subscriptionPlan: SubscriptionPlan;
  updatedAt?: string;
}

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  updateSubscriptionPlan: (plan: SubscriptionPlan) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toProfile(user: User, data?: { subscription_plan?: string | null; updated_at?: string | null } | null): UserProfile {
  return {
    id: user.id,
    email: user.email ?? null,
    subscriptionPlan: data?.subscription_plan === "pro" ? "pro" : "free",
    updatedAt: data?.updated_at ?? undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const supabase = getSupabaseBrowserClient();

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!supabase || !currentUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("subscription_plan, updated_at")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      setProfile(toProfile(currentUser));
      return;
    }

    setProfile(toProfile(currentUser, data));
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      await loadProfile(currentUser);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      loadProfile(currentUser);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, supabase]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Supabase is not configured yet.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Supabase is not configured yet.";
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  const updateSubscriptionPlan = useCallback(async (plan: SubscriptionPlan) => {
    if (!supabase || !user) return "Sign in before syncing access mode.";
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_plan: plan, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return error.message;
    setProfile(current => current ? { ...current, subscriptionPlan: plan, updatedAt: new Date().toISOString() } : current);
    return null;
  }, [supabase, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      user,
      profile,
      signIn,
      signUp,
      signOut,
      updateSubscriptionPlan,
      refreshProfile,
    }),
    [loading, profile, refreshProfile, signIn, signOut, signUp, updateSubscriptionPlan, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
