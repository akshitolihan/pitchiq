import { fetchFixtures } from "@/lib/api";
import FixtureCard from "@/components/FixtureCard";

// Default to "paid" tier on the server so Vercel preview shows full data.
// In production, swap for real auth claim; in M1 it reads STUB_USER_TIER from the API.
const TIER = (process.env.STUB_USER_TIER as string) || "paid";

export default async function FixturesPage() {
  let data;
  try {
    data = await fetchFixtures(TIER);
  } catch (err) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-lg">Could not load fixtures.</p>
        <p className="text-sm mt-2">Make sure the API is running and seeded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-100">Upcoming Fixtures</h1>
        <p className="text-slate-400 max-w-xl">
          Dixon-Coles probability estimates for each match. These are model outputs
          — not predictions of certainty. Football is high variance. You decide.
        </p>
      </div>

      {/* Gated message */}
      {data.gated_message && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          {data.gated_message}
        </div>
      )}

      {/* Fixtures grid */}
      {data.items.length === 0 ? (
        <p className="text-slate-400">
          No upcoming fixtures found. Run the seed command to populate data.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.items.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-slate-600 border-t border-slate-800 pt-4">
        {data.disclaimer}
      </p>
    </div>
  );
}
