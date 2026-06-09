import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pitch IQ — Football Analysis",
  description:
    "Model-derived football match probabilities. Analysis only — you decide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100">
        <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-green-400">⚽</span>
              <span>Pitch IQ</span>
            </a>
            <span className="text-xs text-slate-400 hidden sm:block">
              Analysis only · you decide
            </span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-slate-800 mt-16 py-6 text-center text-xs text-slate-500 px-4">
          <p>
            Pitch IQ is a football analysis tool. It presents model-derived
            probabilities and statistics — it is not a betting operator, does not
            accept bets, and never tells you what to do with this information.
            Football is inherently uncertain. Use this as one input among many.
          </p>
        </footer>
      </body>
    </html>
  );
}
