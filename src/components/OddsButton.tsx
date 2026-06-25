"use client";

import { useBetSlip, BetSelection } from "@/contexts/BetSlipContext";

interface Props {
  selection: BetSelection;
  label?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  layout?: "vertical" | "horizontal";
}

export default function OddsButton({ selection, label, sublabel, size = "md", layout = "vertical" }: Props) {
  const { toggleSelection, isSelected } = useBetSlip();
  const selected = isSelected(selection.id);
  const { odds } = selection;

  const displayOdds = odds > 0 ? odds.toFixed(2) : "—";
  const displayLabel = label ?? selection.outcome;

  if (layout === "horizontal") {
    return (
      <button
        onClick={() => toggleSelection(selection)}
        className="flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all hover:brightness-125 active:scale-95"
        style={{
          background: selected ? "rgba(22,199,132,0.15)" : "var(--elevated)",
          border: selected ? "1px solid var(--green)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected && <span className="text-xs" style={{ color: "var(--green)" }}>✓</span>}
          <span className="text-sm font-medium truncate" style={{ color: selected ? "var(--white)" : "var(--secondary)" }}>
            {displayLabel}
          </span>
          {sublabel && <span className="text-xs" style={{ color: "var(--secondary)" }}>{sublabel}</span>}
        </div>
        <span className="font-black text-base tabular-nums ml-3 shrink-0"
          style={{ color: selected ? "var(--green)" : odds < 2.0 ? "var(--green)" : odds < 3.5 ? "var(--white)" : "var(--cyan)" }}>
          {displayOdds}
        </span>
      </button>
    );
  }

  const pad = size === "sm" ? "py-2 px-3" : size === "lg" ? "py-4 px-4" : "py-3 px-3";
  const textSize = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg";
  const labelSize = size === "sm" ? "text-xs" : "text-xs";

  return (
    <button
      onClick={() => toggleSelection(selection)}
      className={`flex-1 flex flex-col items-center justify-center ${pad} rounded-xl transition-all hover:brightness-125 active:scale-95 relative`}
      style={{
        background: selected ? "rgba(22,199,132,0.15)" : "var(--elevated)",
        border: selected ? "1px solid var(--green)" : "1px solid transparent",
      }}
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5 text-xs" style={{ color: "var(--green)" }}>✓</span>
      )}
      <span className={`font-black ${textSize} tabular-nums leading-none`}
        style={{ color: selected ? "var(--green)" : odds < 2.0 ? "var(--green)" : odds < 3.5 ? "var(--white)" : "var(--cyan)" }}>
        {displayOdds}
      </span>
      {displayLabel && (
        <span className={`${labelSize} mt-1 text-center leading-tight`} style={{ color: "var(--secondary)" }}>
          {displayLabel}
        </span>
      )}
      {sublabel && (
        <span className="text-xs leading-tight" style={{ color: "var(--secondary)" }}>{sublabel}</span>
      )}
    </button>
  );
}
