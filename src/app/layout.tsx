import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import BetSlip, { BetSlipFAB } from "@/components/BetSlip";
import { BetSlipProvider } from "@/contexts/BetSlipContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { WalletProvider } from "@/contexts/WalletContext";
import MainWrapper from "@/components/MainWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pitch IQ — Match Analysis & Predictions",
  description: "AI-powered football and tennis match analysis, planning, probabilities, and simulation.",
  keywords: ["football analysis", "match predictions", "tennis predictions", "FIFA World Cup 2026"],
  openGraph: {
    title: "Pitch IQ — Match Analysis & Predictions",
    description: "AI-powered football and tennis analysis with match planning and probability insights.",
    type: "website",
    siteName: "Pitch IQ",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${inter.variable}`}>
      <body className="min-h-screen">
        <WalletProvider>
          <SubscriptionProvider>
            <BetSlipProvider>
              <div className="flex min-h-screen">
                <Sidebar />
                <MainWrapper>{children}</MainWrapper>
              </div>
              <BottomNav />
              <BetSlipFAB />
              <BetSlip />
            </BetSlipProvider>
          </SubscriptionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
