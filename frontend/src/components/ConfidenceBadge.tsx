type Level = "High" | "Medium" | "Low";

const styles: Record<Level, string> = {
  High: "bg-green-900/60 text-green-300 border border-green-700",
  Medium: "bg-yellow-900/60 text-yellow-300 border border-yellow-700",
  Low: "bg-red-900/60 text-red-300 border border-red-700",
};

const descriptions: Record<Level, string> = {
  High: "Model has good data and a clear favourite",
  Medium: "Moderate certainty — treat with care",
  Low: "High variance fixture — wide outcome spread",
};

export default function ConfidenceBadge({ level }: { level: Level }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[level]}`}
      title={descriptions[level]}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          level === "High"
            ? "bg-green-400"
            : level === "Medium"
            ? "bg-yellow-400"
            : "bg-red-400"
        }`}
      />
      {level} confidence
    </span>
  );
}
