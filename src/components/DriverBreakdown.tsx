import type { Driver } from "@/lib/api";

interface Props {
  drivers: Record<string, Driver>;
  homeName: string;
  awayName: string;
}

function SignBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.min(Math.abs(value) / max, 1) * 100;
  const positive = value >= 0;
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 flex h-2 rounded overflow-hidden bg-slate-700">
        {positive ? (
          <>
            <div className="w-1/2" />
            <div style={{ width: `${pct / 2}%` }} className="bg-green-500 rounded-r" />
          </>
        ) : (
          <>
            <div style={{ width: `${pct / 2}%` }} className="bg-blue-500 rounded-l ml-auto" />
            <div className="w-1/2" />
          </>
        )}
      </div>
      <span className={`text-xs w-12 text-right font-mono ${positive ? "text-green-400" : "text-blue-400"}`}>
        {value >= 0 ? "+" : ""}
        {value.toFixed(3)}
      </span>
    </div>
  );
}

export default function DriverBreakdown({ drivers, homeName, awayName }: Props) {
  const entries = Object.values(drivers);
  const maxVal = Math.max(...entries.map((d) => Math.abs(d.value)), 0.01);

  return (
    <section className="space-y-4">
      <div className="flex justify-between text-xs text-slate-500 px-1">
        <span>← favours {awayName}</span>
        <span className="font-medium text-slate-400">Model drivers</span>
        <span>favours {homeName} →</span>
      </div>

      {entries.map((driver) => (
        <div key={driver.label} className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-200 w-44 shrink-0">
              {driver.label}
            </span>
            <SignBar value={driver.value} max={maxVal} />
          </div>
          <p className="text-xs text-slate-400 ml-0 leading-relaxed">
            {driver.description}
          </p>
        </div>
      ))}

      <p className="text-[10px] text-slate-600 mt-2">
        Driver values are model parameters, not probabilities. Positive = favours
        home side. These are one part of the picture — not the whole story.
      </p>
    </section>
  );
}
