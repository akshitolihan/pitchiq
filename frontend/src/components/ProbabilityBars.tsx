"use client";

function pct(p: number) {
  return `${(p * 100).toFixed(1)}%`;
}

interface WDLProps {
  home: string;
  away: string;
  pHome: number;
  pDraw: number;
  pAway: number;
}

export function WDLBar({ home, away, pHome, pDraw, pAway }: WDLProps) {
  return (
    <div className="space-y-1">
      <div className="flex text-xs text-slate-400 justify-between mb-1">
        <span>{home}</span>
        <span>Draw</span>
        <span>{away}</span>
      </div>
      {/* Segmented bar */}
      <div className="flex h-7 rounded-lg overflow-hidden text-xs font-semibold">
        <div
          style={{ width: pct(pHome) }}
          className="bg-green-600 flex items-center justify-center text-white shrink-0"
          title={`Home win: ${pct(pHome)}`}
        >
          {pHome > 0.12 ? pct(pHome) : ""}
        </div>
        <div
          style={{ width: pct(pDraw) }}
          className="bg-slate-500 flex items-center justify-center text-white shrink-0"
          title={`Draw: ${pct(pDraw)}`}
        >
          {pDraw > 0.1 ? pct(pDraw) : ""}
        </div>
        <div
          style={{ width: pct(pAway) }}
          className="bg-blue-600 flex items-center justify-center text-white shrink-0 flex-1"
          title={`Away win: ${pct(pAway)}`}
        >
          {pAway > 0.12 ? pct(pAway) : ""}
        </div>
      </div>
    </div>
  );
}

interface MarketRowProps {
  label: string;
  left: string;
  right: string;
  pLeft: number;
  pRight: number;
}

export function MarketRow({ label, left, right, pLeft, pRight }: MarketRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{left}</span>
        <span className="font-medium text-slate-300">{label}</span>
        <span>{right}</span>
      </div>
      <div className="flex h-5 rounded overflow-hidden text-xs">
        <div
          style={{ width: pct(pLeft) }}
          className="bg-green-700 flex items-center justify-center text-white text-[10px]"
        >
          {pLeft > 0.15 ? pct(pLeft) : ""}
        </div>
        <div
          style={{ width: pct(pRight) }}
          className="bg-slate-600 flex items-center justify-center text-white text-[10px] flex-1"
        >
          {pRight > 0.15 ? pct(pRight) : ""}
        </div>
      </div>
    </div>
  );
}
