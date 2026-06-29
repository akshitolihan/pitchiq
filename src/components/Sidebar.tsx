"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";

const navItems = [
  { href: "/",        label: "Home",     icon: HomeIcon },
  { href: "/live",    label: "Live",     icon: LiveIcon,    dot: true },
  { href: "/betting", label: "Plan",     icon: OddsIcon },
  { href: "/matches", label: "Matches",  icon: MatchesIcon },
  { href: "/fifa",    label: "FIFA WC",  icon: TrophyIcon },
  { href: "/wallet",  label: "Sim",      icon: WalletIcon },
];

export default function Sidebar() {
  const path = usePathname();
  const { state } = useWallet();
  const pendingBets = state.bets.filter(b => b.status === "pending").length;

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-30"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}>

      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
            style={{ background: "var(--green)", color: "#0B0E13", fontFamily: "var(--font-heading)" }}>
            P
          </div>
          <div>
            <span className="font-black text-base tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              Pitch IQ
            </span>
            <span className="block text-xs" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
              Match Analysis
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, dot }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative"
              style={{
                background: active ? "rgba(22,199,132,0.1)" : "transparent",
                color: active ? "var(--green)" : "var(--secondary)",
                fontFamily: "var(--font-heading)",
              }}>
              <Icon size={18} active={active} />
              {label}
              {dot && (
                <span className="ml-auto w-2 h-2 rounded-full live-dot" style={{ background: "var(--danger)" }} />
              )}
              {label === "Sim" && pendingBets > 0 && (
                <span className="ml-auto text-xs font-black w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--warning)", color: "#0B0E13" }}>
                  {pendingBets}
                </span>
              )}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: "var(--green)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Wallet balance card */}
      <div className="px-3 pb-3">
        <Link href="/wallet"
          className="block rounded-xl p-3.5 border transition-all hover:border-green-500/30"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--secondary)", fontFamily: "var(--font-heading)" }}>
              Demo Simulation
            </span>
            <span className="text-xs" style={{ color: "var(--secondary)" }}>→</span>
          </div>
          <p className="text-xl font-black tabular-nums" style={{ color: "var(--green)", fontFamily: "var(--font-heading)" }}>
            PQ$ {state.balance.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>
            {pendingBets > 0 ? `${pendingBets} saved simulation${pendingBets > 1 ? "s" : ""}` : "No saved simulations"}
          </p>
        </Link>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
            style={{ background: "var(--elevated)", color: "var(--secondary)" }}>
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ fontFamily: "var(--font-heading)" }}>You</p>
            <p className="text-xs truncate" style={{ color: "var(--secondary)", fontFamily: "var(--font-body)" }}>Personal Mode</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function HomeIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function LiveIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}
function OddsIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      <line x1="7" y1="8" x2="7" y2="12" /><line x1="12" y1="6" x2="12" y2="12" /><line x1="17" y1="9" x2="17" y2="12" />
    </svg>
  );
}
function MatchesIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function TrophyIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  );
}
function WalletIcon({ size, active }: { size: number; active: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1 0-4h14v4" />
      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
      <circle cx="17" cy="12" r="1" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}
