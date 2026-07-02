import type { BetSelection } from "@/contexts/BetSlipContext";
import type { MatchJournal } from "@/lib/match-journals";

function formatDate(value?: string) {
  if (!value) return "Kickoff pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kickoff pending";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function journalOrEmpty(selection: BetSelection, journals: Record<string, MatchJournal>) {
  return journals[selection.id] ?? null;
}

export function buildJournalMarkdown(
  selections: BetSelection[],
  journals: Record<string, MatchJournal>,
  isPro: boolean,
  title = "Pitch IQ Journal Report",
) {
  const visible = isPro ? selections : selections.slice(0, 1);
  const lines = [
    `# ${title}`,
    "",
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    `Access mode: ${isPro ? "Pro Analysis" : "Free Preview"}`,
    "",
    "## Summary",
    "",
    `- Included journals: ${visible.length}${!isPro && selections.length > visible.length ? ` of ${selections.length}` : ""}`,
    `- Completed journal fields: ${visible.reduce((total, selection) => {
      const journal = journalOrEmpty(selection, journals);
      if (!journal) return total;
      return total + [journal.modelView, journal.teamNews, journal.riskFlags, journal.finalReview].filter(value => value.trim()).length;
    }, 0)}`,
    "",
  ];

  visible.forEach((selection, index) => {
    const journal = journalOrEmpty(selection, journals);
    lines.push(
      `## ${index + 1}. ${selection.matchTitle}`,
      "",
      `- Sport: ${selection.sport}`,
      `- Competition: ${selection.competition ?? "Not specified"}`,
      `- Kickoff: ${formatDate(selection.commenceTime)}`,
      `- Market: ${selection.market}`,
      `- Outcome: ${selection.outcome}`,
      `- Model odds: ${selection.odds.toFixed(2)}`,
      `- Confidence score: ${journal?.confidenceScore ?? 50}%`,
      "",
      "### Model View",
      "",
      journal?.modelView.trim() || "No model view added yet.",
      "",
    );

    if (isPro) {
      lines.push(
        "### Team News / Context",
        "",
        journal?.teamNews.trim() || "No team news or context added yet.",
        "",
        "### Risk Flags",
        "",
        journal?.riskFlags.trim() || "No risk flags added yet.",
        "",
        "### Final Review",
        "",
        journal?.finalReview.trim() || "No final review added yet.",
        "",
      );
    } else {
      lines.push(
        "### Locked In Free Preview",
        "",
        "Team news, risk flags, and final review require Pro Analysis journal export access.",
        "",
      );
    }
  });

  if (!isPro && selections.length > visible.length) {
    lines.push(
      "## Additional Journals Locked",
      "",
      `${selections.length - visible.length} additional planned journal${selections.length - visible.length === 1 ? "" : "s"} require Pro Analysis export access.`,
      "",
    );
  }

  return lines.join("\n");
}

export function buildJournalCsv(
  selections: BetSelection[],
  journals: Record<string, MatchJournal>,
  isPro: boolean,
) {
  const visible = isPro ? selections : selections.slice(0, 1);
  const rows = [
    ["Match", "Sport", "Competition", "Kickoff", "Market", "Outcome", "Model Odds", "Confidence", "Model View", "Team News", "Risk Flags", "Final Review"],
    ...visible.map(selection => {
      const journal = journalOrEmpty(selection, journals);
      return [
        selection.matchTitle,
        selection.sport,
        selection.competition ?? "",
        selection.commenceTime ?? "",
        selection.market,
        selection.outcome,
        selection.odds,
        journal?.confidenceScore ?? 50,
        journal?.modelView ?? "",
        isPro ? journal?.teamNews ?? "" : "Locked in Free Preview",
        isPro ? journal?.riskFlags ?? "" : "Locked in Free Preview",
        isPro ? journal?.finalReview ?? "" : "Locked in Free Preview",
      ];
    }),
  ];

  return rows.map(row => row.map(escapeCsv).join(",")).join("\n");
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
