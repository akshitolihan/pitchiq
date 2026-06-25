"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/",        label: "Home",   icon: "⊞" },
  { href: "/live",    label: "Live",   icon: "📡" },
  { href: "/betting", label: "Odds",   icon: "📊" },
  { href: "/wallet",  label: "Wallet", icon: "💰" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {items.map(({ href, label, icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative"
            style={{
              color: active ? "var(--green)" : "var(--secondary)",
              fontFamily: "var(--font-heading)",
            }}>
            <span className="text-lg leading-none">{icon}</span>
            {label}
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
                style={{ background: "var(--green)" }} />
            )}
            {label === "Live" && (
              <span className="absolute top-2 right-[calc(50%-12px)] w-1.5 h-1.5 rounded-full live-dot" style={{ background: "var(--danger)" }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
