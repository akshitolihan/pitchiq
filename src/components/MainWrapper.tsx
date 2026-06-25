"use client";

import { usePathname } from "next/navigation";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBetting = pathname === "/betting";
  return (
    <main
      className={`flex-1 overflow-hidden md:ml-60 ${isBetting ? "" : "min-h-screen pb-20 md:pb-0"}`}
      style={{ background: "var(--bg)" }}
    >
      <div className={isBetting ? "h-full" : "max-w-[1200px] mx-auto px-5 py-7"}>
        {children}
      </div>
    </main>
  );
}
