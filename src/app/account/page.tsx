"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SubscriptionPlan, useSubscription } from "@/contexts/SubscriptionContext";

const planFeatures = {
  free: [
    "Top 3 ranked insights preview",
    "Planner, alerts, history, and simulation tools",
    "Demo data workflow for MVP testing",
  ],
  pro: [
    "Full ranked insights board",
    "Advanced analysis reports and planning actions",
    "Lab workflows for scenario review and portfolio planning",
    "Priority exports, history restores, and future alerts",
  ],
};

export default function AccountPage() {
  const { state, isPro, setPlan } = useSubscription();
  const { configured, loading, user, profile, signIn, signUp, signOut, updateSubscriptionPlan } = useAuth();
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage(null);
    const error = authMode === "sign-in"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setAuthMessage(error ?? (authMode === "sign-in" ? "Signed in" : "Account created. Check email confirmation if enabled."));
  }

  async function selectPlan(plan: SubscriptionPlan) {
    setPlan(plan);
    if (user) {
      const error = await updateSubscriptionPlan(plan);
      setAuthMessage(error ? `Plan saved locally. Supabase sync failed: ${error}` : "Plan synced to account");
    }
  }

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--green)" }}>
            Access and billing
          </p>
          <h1 className="text-2xl md:text-3xl font-black mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            Account
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--secondary)" }}>
            Manage access mode, account identity, and the first database-backed subscription state for the MVP.
          </p>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-bold uppercase" style={{ color: "var(--secondary)" }}>Current mode</p>
          <p className="text-xl font-black mt-1" style={{ color: isPro ? "var(--green)" : "var(--warning)" }}>
            {isPro ? "Pro Analysis" : "Free Preview"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--secondary)" }}>
            {user ? "Synced account" : "Local mode"}
          </p>
        </div>
      </div>

      <section className="rounded-xl border p-4 md:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black" style={{ fontFamily: "var(--font-heading)" }}>Account identity</h2>
            <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
              {configured
                ? user
                  ? `Signed in as ${profile?.email ?? user.email ?? "Pitch IQ user"}. Subscription state can now sync to Supabase.`
                  : "Sign in or create an account to sync plans and subscription state beyond this browser."
                : "Supabase keys are not configured yet. The app is still running in local MVP mode."}
            </p>
          </div>
          {configured && user ? (
            <button
              onClick={signOut}
              className="rounded-xl px-4 py-2.5 text-sm font-bold border"
              style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--secondary)" }}
            >
              Sign out
            </button>
          ) : configured ? (
            <form onSubmit={submitAuth} className="grid gap-2 md:grid-cols-[150px_180px_180px_auto]">
              <select
                value={authMode}
                onChange={event => setAuthMode(event.target.value as "sign-in" | "sign-up")}
                className="rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
              >
                <option value="sign-in">Sign in</option>
                <option value="sign-up">Sign up</option>
              </select>
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                type="email"
                placeholder="Email"
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
              />
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
                type="password"
                placeholder="Password"
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--bg)", color: "var(--white)", border: "1px solid var(--border)" }}
              />
              <button
                disabled={loading}
                className="rounded-xl px-4 py-2.5 text-sm font-black"
                style={{ background: "var(--green)", color: "#000" }}
              >
                Continue
              </button>
            </form>
          ) : (
            <Link
              href="/exports"
              className="rounded-xl px-4 py-2.5 text-sm font-black"
              style={{ background: "var(--green)", color: "#000" }}
            >
              Keep local mode
            </Link>
          )}
        </div>
        {authMessage && (
          <p className="text-xs font-bold mt-3" style={{ color: authMessage.includes("failed") ? "#EF4444" : "var(--green)" }}>
            {authMessage}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          plan="free"
          title="Free Preview"
          price="PQ$0"
          description="A usable analysis preview for new users who want to understand Pitch IQ before upgrading."
          active={state.plan === "free"}
          features={planFeatures.free}
          onSelect={() => selectPlan("free")}
        />
        <PlanCard
          plan="pro"
          title="Pro Analysis"
          price="PQ$19"
          description="Paid workspace positioning for users who need the full board, deeper planning, and repeatable analysis workflows."
          active={state.plan === "pro"}
          features={planFeatures.pro}
          onSelect={() => selectPlan("pro")}
        />
      </div>

      <section className="rounded-xl border p-4 md:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black" style={{ fontFamily: "var(--font-heading)" }}>Feature gates in this MVP</h2>
            <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
              Insights, Daily, and Exports now demonstrate paid gates. Supabase is ready to store the real subscription tier once project keys are configured.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/insights" className="rounded-xl px-4 py-2.5 text-sm font-black" style={{ background: "var(--green)", color: "#000" }}>
              Open Insights
            </Link>
            <Link href="/planner" className="rounded-xl px-4 py-2.5 text-sm font-bold border" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--green)" }}>
              Planner
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-4 md:p-5" style={{ background: "rgba(255,255,255,0.03)", borderColor: "var(--border)" }}>
        <h2 className="text-lg font-black" style={{ fontFamily: "var(--font-heading)" }}>Commercial positioning</h2>
        <div className="grid gap-3 mt-4 md:grid-cols-3">
          {[
            ["Analysis only", "Language stays focused on research, planning, model confidence, and risk review."],
            ["Planning value", "Users pay for saved workflows, future match preparation, alerts, and review discipline."],
            ["Scalable gates", "The access context can now read and update Supabase profile subscription state."],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <p className="font-black">{title}</p>
              <p className="text-sm mt-2" style={{ color: "var(--secondary)" }}>{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  title,
  price,
  description,
  active,
  features,
  onSelect,
}: {
  plan: SubscriptionPlan;
  title: string;
  price: string;
  description: string;
  active: boolean;
  features: string[];
  onSelect: () => void;
}) {
  const isPro = plan === "pro";

  return (
    <section
      className="rounded-xl border p-5 space-y-5"
      style={{
        background: active ? (isPro ? "rgba(22,199,132,0.08)" : "rgba(245,166,35,0.08)") : "var(--surface)",
        borderColor: active ? (isPro ? "rgba(22,199,132,0.45)" : "rgba(245,166,35,0.45)") : "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: isPro ? "var(--green)" : "var(--warning)" }}>
            {active ? "Active plan" : "Available"}
          </p>
          <h2 className="text-xl font-black mt-2" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
          <p className="text-sm mt-2" style={{ color: "var(--secondary)" }}>{description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black tabular-nums">{price}</p>
          <p className="text-xs" style={{ color: "var(--secondary)" }}>/mo</p>
        </div>
      </div>

      <ul className="space-y-2">
        {features.map(feature => (
          <li key={feature} className="flex gap-2 text-sm" style={{ color: "var(--secondary)" }}>
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: isPro ? "var(--green)" : "var(--warning)" }} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        className="w-full rounded-xl px-4 py-3 text-sm font-black"
        style={{
          background: active ? "var(--bg)" : isPro ? "var(--green)" : "var(--surface)",
          color: active ? (isPro ? "var(--green)" : "var(--warning)") : isPro ? "#000" : "var(--secondary)",
          border: active || !isPro ? "1px solid var(--border)" : "1px solid var(--green)",
        }}
      >
        {active ? "Selected" : `Switch to ${title}`}
      </button>
    </section>
  );
}
