"use client";

import { useState } from "react";
import wcData from "@/data/fifa-wc-2026.json";

type Team = { name: string; flag: string; confederation: string };
type Group = { id: string; teams: Team[] };
type Match = {
  id: string;
  group: string;
  matchday: number;
  home: string;
  away: string;
  kickoff_utc: string;
  venue: string;
  city: string;
  status: string;
  score: { home: number; away: number } | null;
};

const groups: Group[] = wcData.groups as Group[];
const allMatches: Match[] = wcData.matches as Match[];

function formatMatchDate(utc: string) {
  const d = new Date(utc);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function MatchCard({ match, homeFlag, awayFlag }: { match: Match; homeFlag: string; awayFlag: string }) {
  const isLive = match.status === "live";
  const isFT = match.status === "ft";
  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{
        background: "var(--surface)",
        borderColor: isLive ? "rgba(22,199,132,0.4)" : "var(--border)",
      }}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xl">{homeFlag}</span>
          <span className="font-semibold truncate">{match.home}</span>
        </div>
        <div className="text-center flex-shrink-0 min-w-[52px]">
          {isFT && match.score ? (
            <span className="font-bold text-base">{match.score.home}–{match.score.away}</span>
          ) : isLive ? (
            <span className="font-bold text-xs live-dot" style={{ color: "var(--green)" }}>LIVE</span>
          ) : (
            <span className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: "var(--elevated)", color: "var(--secondary)" }}>vs</span>
          )}
        </div>
        <div className="flex-1 flex items-center gap-2 justify-end">
          <span className="font-semibold truncate text-right">{match.away}</span>
          <span className="text-xl">{awayFlag}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--secondary)" }}>
        <span>{formatMatchDate(match.kickoff_utc)}</span>
        <span className="truncate ml-2 text-right">{match.city}</span>
      </div>
      {isFT && <span className="text-xs" style={{ color: "var(--secondary)" }}>Full Time · {match.venue}</span>}
    </div>
  );
}

function GroupView({ group }: { group: Group }) {
  const flagMap = Object.fromEntries(group.teams.map(t => [t.name, t.flag]));
  const groupMatches = allMatches.filter(m => m.group === group.id).sort(
    (a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime()
  );
  const [md, setMd] = useState(1);
  const displayed = groupMatches.filter(m => m.matchday === md);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {group.teams.map(team => (
          <div key={team.name} className="flex items-center gap-2 rounded-xl px-3 py-2.5 border"
            style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
            <span className="text-xl">{team.flag}</span>
            <div>
              <p className="text-sm font-semibold leading-tight">{team.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--secondary)" }}>{team.confederation}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b pb-0" style={{ borderColor: "var(--border)" }}>
        {[1, 2, 3].map(day => (
          <button
            key={day}
            onClick={() => setMd(day)}
            className="px-4 py-2 text-sm font-medium rounded-t transition-colors"
            style={{
              background: md === day ? "var(--elevated)" : "transparent",
              color: md === day ? "var(--white)" : "var(--secondary)",
              borderBottom: md === day ? `2px solid var(--green)` : "2px solid transparent",
            }}
          >
            MD {day}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {displayed.map(m => (
          <MatchCard key={m.id} match={m} homeFlag={flagMap[m.home] ?? "🏳️"} awayFlag={flagMap[m.away] ?? "🏳️"} />
        ))}
      </div>
    </div>
  );
}

function KnockoutView() {
  const { r32, r16, qf, sf, third, final } = wcData.knockout;
  const stages = [
    { label: r32.label, dates: r32.dates, icon: "R32", isFinal: false, note: "" },
    { label: r16.label, dates: r16.dates, icon: "R16", isFinal: false, note: "" },
    { label: qf.label, dates: qf.dates, icon: "QF", isFinal: false, note: "" },
    { label: sf.label, dates: sf.dates, icon: "SF", isFinal: false, note: "" },
    { label: third.label, dates: third.date, icon: "3rd", isFinal: false, note: third.venue },
    { label: final.label, dates: final.date, icon: "🏆", isFinal: true, note: final.venue },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--secondary)" }}>
        Knockout rounds begin after the group stage concludes on 30 June. Top 2 from each group plus 8 best third-placed sides advance.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map(stage => (
          <div key={stage.label} className="rounded-2xl border p-4 space-y-3"
            style={{
              background: "var(--surface)",
              borderColor: stage.isFinal ? "rgba(245,158,11,0.3)" : "var(--border)",
            }}>
            <div className="flex items-center gap-3">
              <span className="rounded-lg px-2 py-1 text-xs font-bold"
                style={{
                  background: stage.isFinal ? "rgba(245,158,11,0.15)" : "var(--elevated)",
                  color: stage.isFinal ? "#F59E0B" : "var(--secondary)",
                }}>
                {stage.icon}
              </span>
              <h3 className="font-semibold">{stage.label}</h3>
            </div>
            <p className="text-xs" style={{ color: "var(--secondary)" }}>{stage.dates}</p>
            {stage.note && (
              <p className="text-xs" style={{ color: "var(--secondary)" }}>{stage.note}</p>
            )}
            <div className="rounded-lg px-3 py-2 text-xs italic"
              style={{ background: "var(--elevated)", color: "var(--secondary)" }}>
              Teams TBD after group stage
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FifaPage() {
  const [view, setView] = useState<"groups" | "schedule" | "knockout">("groups");
  const [selectedGroup, setSelectedGroup] = useState("A");

  const currentGroup = groups.find(g => g.id === selectedGroup)!;

  const upcomingAll = allMatches
    .filter(m => m.status === "scheduled")
    .sort((a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border p-6 space-y-3"
        style={{
          background: "linear-gradient(135deg, var(--surface) 0%, rgba(245,158,11,0.08) 100%)",
          borderColor: "rgba(245,158,11,0.25)",
        }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏆</span>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#F59E0B" }}>
                FIFA World Cup 2026
              </span>
            </div>
            <h1 className="text-3xl font-bold">Group Stage Schedule</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--secondary)" }}>
              {wcData.tournament.dates} · {wcData.tournament.teams} teams · {wcData.tournament.venues} venues
            </p>
          </div>
          <div className="flex gap-2">
            {(["🇺🇸", "🇲🇽", "🇨🇦"] as const).map(f => (
              <span key={f} className="text-3xl">{f}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 text-xs flex-wrap" style={{ color: "var(--secondary)" }}>
          <span className="rounded px-2 py-0.5" style={{ background: "var(--elevated)" }}>
            Host: {wcData.tournament.hosts.join(" · ")}
          </span>
          <span className="rounded px-2 py-0.5" style={{ background: "var(--elevated)" }}>
            Final: {wcData.tournament.final_venue}
          </span>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-1 rounded-xl p-1 w-fit border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {(["groups", "schedule", "knockout"] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize"
            style={{
              background: view === v ? "var(--elevated)" : "transparent",
              color: view === v ? "var(--white)" : "var(--secondary)",
            }}
          >
            {v === "knockout" ? "Knockout" : v === "schedule" ? "All Fixtures" : "Groups"}
          </button>
        ))}
      </div>

      {/* Groups view */}
      {view === "groups" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                className="w-9 h-9 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: selectedGroup === g.id ? "var(--green)" : "var(--elevated)",
                  color: selectedGroup === g.id ? "#000" : "var(--secondary)",
                }}
              >
                {g.id}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border p-5 space-y-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="text-lg font-bold">Group {selectedGroup}</h2>
            <GroupView group={currentGroup} />
          </div>
        </div>
      )}

      {/* All fixtures schedule */}
      {view === "schedule" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--secondary)" }}>
            Showing next {upcomingAll.length} scheduled matches across all groups.
          </p>
          {upcomingAll.map(m => {
            const grp = groups.find(g => g.id === m.group)!;
            const fm = Object.fromEntries(grp.teams.map(t => [t.name, t.flag]));
            return (
              <div key={m.id} className="flex items-start gap-3">
                <span className="mt-3 text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0"
                  style={{ background: "var(--elevated)", color: "var(--secondary)" }}>
                  {m.group}{m.matchday}
                </span>
                <div className="flex-1">
                  <MatchCard match={m} homeFlag={fm[m.home] ?? "🏳️"} awayFlag={fm[m.away] ?? "🏳️"} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Knockout bracket */}
      {view === "knockout" && <KnockoutView />}

      <p className="text-xs border-t pt-4" style={{ color: "var(--secondary)", borderColor: "var(--border)" }}>
        Schedule and group assignments based on best available pre-tournament information. Verify with FIFA.com for official times.
        No predictions shown for international fixtures — Dixon-Coles model is calibrated on domestic league data only.
      </p>
    </div>
  );
}
