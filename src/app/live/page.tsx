"use client";
import { useEffect, useState } from "react";

const FLAG: Record<string, string> = {
  "Netherlands":"🇳🇱","Sweden":"🇸🇪","Germany":"🇩🇪","Ivory Coast":"🇨🇮","Ecuador":"🇪🇨",
  "Colombia":"🇨🇴","Mexico":"🇲🇽","United States":"🇺🇸","Argentina":"🇦🇷","France":"🇫🇷",
  "Brazil":"🇧🇷","England":"🇬🇧","Portugal":"🇵🇹","Spain":"🇪🇸","Italy":"🇮🇹","Japan":"🇯🇵",
  "Morocco":"🇲🇦","Senegal":"🇸🇳","Uruguay":"🇺🇾","Canada":"🇨🇦","Croatia":"🇭🇷",
  "Belgium":"🇧🇪","Denmark":"🇩🇰","Switzerland":"🇨🇭","Austria":"🇦🇹","Poland":"🇵🇱",
  "Ukraine":"🇺🇦","Serbia":"🇷🇸","Australia":"🇦🇺","Turkey":"🇹🇷","South Korea":"🇰🇷",
  "Saudi Arabia":"🇸🇦","Iran":"🇮🇷","Nigeria":"🇳🇬","Cameroon":"🇨🇲","Ghana":"🇬🇭",
  "Egypt":"🇪🇬","Chile":"🇨🇱","Paraguay":"🇵🇾","Venezuela":"🇻🇪","Honduras":"🇭🇳",
  "Jamaica":"🇯🇲","Panama":"🇵🇦","South Africa":"🇿🇦","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Indonesia":"🇮🇩",
  "New Zealand":"🇳🇿","Iraq":"🇮🇶","Tunisia":"🇹🇳","Cape Verde":"🇨🇻","Curaçao":"🇨🇼",
  "Haiti":"🇭🇹","Qatar":"🇶🇦",
};
const f = (t: string) => FLAG[t] ?? "🏳";

interface Match {
  homeTeam: string; awayTeam: string;
  homeScore: number | null; awayScore: number | null;
  minute: number | null; utcDate: string;
  stage: string; group: string | null;
  status: "LIVE" | "FT" | "UPCOMING";
}

function MatchRow({ m }: { m: Match }) {
  const isLive = m.status === "LIVE";
  const isFT = m.status === "FT";
  const kickoff = new Date(m.utcDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  const stageLabel = m.group ? `Group ${m.group.replace("GROUP_", "")}` : m.stage.replace(/_/g, " ");

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b last:border-b-0 hover:bg-white/[0.02] transition-colors" style={{ borderColor: "var(--border)" }}>
      <div className="w-16 shrink-0 text-center">
        {isLive ? (
          <div className="flex flex-col items-center">
            <span className="w-2 h-2 rounded-full live-dot mb-1" style={{ background: "#EF4444" }} />
            <span className="text-xs font-black" style={{ color: "#EF4444" }}>{m.minute ? `${m.minute}'` : "LIVE"}</span>
          </div>
        ) : isFT ? (
          <span className="text-xs font-black uppercase" style={{ color: "var(--secondary)" }}>FT</span>
        ) : (
          <span className="text-xs" style={{ color: "var(--secondary)" }}>{kickoff}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-sm font-semibold truncate text-right">{m.homeTeam}</span>
        <span className="text-xl shrink-0">{f(m.homeTeam)}</span>
      </div>
      <div className="shrink-0 w-20 text-center">
        {(isLive || isFT) ? (
          <span className="text-xl font-black tabular-nums">{m.homeScore ?? 0} – {m.awayScore ?? 0}</span>
        ) : (
          <span className="text-sm font-bold" style={{ color: "var(--secondary)" }}>vs</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xl shrink-0">{f(m.awayTeam)}</span>
        <span className="text-sm font-semibold truncate">{m.awayTeam}</span>
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className="text-xs" style={{ color: "var(--secondary)" }}>{stageLabel}</span>
      </div>
    </div>
  );
}

export default function LivePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");
  const [pulsing, setPulsing] = useState(false);

  async function fetchData() {
    try {
      const r = await fetch("/api/live-scores", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setMatches(d.matches ?? []);
        setLastUpdate(new Date().toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
        setPulsing(true);
        setTimeout(() => setPulsing(false), 1500);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 30_000); return () => clearInterval(t); }, []);

  const live     = matches.filter(m => m.status === "LIVE");
  const ft       = matches.filter(m => m.status === "FT");
  const upcoming = matches.filter(m => m.status === "UPCOMING");
  const sections = [
    { label: "Live Now", matches: live, color: "#EF4444", dot: true },
    { label: "Today's Upcoming", matches: upcoming, color: "var(--secondary)", dot: false },
    { label: "Today's Results", matches: ft, color: "var(--secondary)", dot: false },
  ].filter(s => s.matches.length > 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-heading)" }}>Live Scores</h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: "var(--secondary)" }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: pulsing ? "var(--green)" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />
            Auto-refreshes every 30s{lastUpdate && ` · ${lastUpdate}`}
          </p>
        </div>
        <button onClick={fetchData} className="px-3 py-1.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all"
          style={{ background: "var(--elevated)", color: "var(--green)", fontFamily: "var(--font-heading)" }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />)}</div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border p-16 text-center space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="text-4xl">📡</p>
          <p className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>No matches today</p>
          <p className="text-sm" style={{ color: "var(--secondary)" }}>Check back on match days</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map(s => (
            <section key={s.label}>
              <div className="flex items-center gap-2 mb-2 px-1">
                {s.dot && <span className="w-2 h-2 rounded-full live-dot" style={{ background: s.color }} />}
                <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: s.color, fontFamily: "var(--font-heading)" }}>
                  {s.label} <span className="font-normal normal-case tracking-normal text-xs ml-1" style={{ color: "var(--secondary)" }}>({s.matches.length})</span>
                </h2>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: s.dot ? "rgba(239,68,68,0.25)" : "var(--border)" }}>
                {s.matches.map((m, i) => <MatchRow key={i} m={m} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
