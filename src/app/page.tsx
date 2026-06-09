import FixtureCard from "@/components/FixtureCard";
import type { FixtureSummary } from "@/lib/api";

// Static fixtures data generated at build time by scripts/generate_static_data.py
// Falls back to empty array if the file doesn't exist yet (local dev without prebuild)
function loadFixtures(): FixtureSummary[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require("../data/fixtures.json");
    return data.fixtures ?? [];
  } catch {
    return [];
  }
}

export default function FixturesPage() {
  const fixtures = loadFixtures();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-100">Upcoming Fixtures</h1>
        <p className="text-slate-400 max-w-xl">
          Dixon-Coles probability estimates for each match. These are model
          outputs — not predictions of certainty. Football is high variance.
          You decide.
        </p>
      </div>

      {/* Fixtures grid */}
      {fixtures.length === 0 ? (
        <div className="text-center py-20 text-slate-400 space-y-2">
          <p className="text-lg">No fixtures loaded.</p>
          <p className="text-sm">
            Run <code className="text-slate-300">python -m scripts.generate_static_data</code> then rebuild.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {fixtures.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-slate-600 border-t border-slate-800 pt-4">
        Probabilities are model estimates — not guarantees. This is analysis.
        You decide.
      </p>
    </div>
  );
}
