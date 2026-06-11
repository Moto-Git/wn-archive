import { useEffect, useMemo, useState } from "react";

type Broadcast = {
  date: string; slot: string; program: string;
  caster: string; weather: string; kind: string; video: string; title: string;
};
type Meta = {
  total: number; days: number; rugby: number; years: string[];
  casters: { name: string; count: number }[]; updated: string;
};

const PROGRAMS = ["モーニング", "サンシャイン", "コーヒータイム", "アフタヌーン", "イブニング", "ムーン"];
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const PAGE = 60;

function dateLabel(d: string) {
  const t = new Date(d + "T00:00:00");
  return `${d.slice(5).replace("-", "/")}（${WD[t.getDay()]}）`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function BroadcastArchive({ meta }: { meta: Meta }) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [program, setProgram] = useState("all");
  const [year, setYear] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}broadcasts.json`)
      .then((r) => r.json())
      .then((d: Broadcast[]) => { setBroadcasts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const nq = q.replace(/\s/g, "");
    return broadcasts.filter(
      (b) =>
        (kind === "all" || b.kind === kind) &&
        (program === "all" || b.program === program) &&
        (year === "all" || b.date.startsWith(year)) &&
        (!nq || b.caster.replace(/\s/g, "").includes(nq))
    );
  }, [broadcasts, q, kind, program, year]);

  const shown = filtered.slice(0, limit);
  const reset = () => setLimit(PAGE);

  const stats = [
    { label: "総放送数", value: meta.total.toLocaleString() },
    { label: "キャスター", value: meta.casters.length },
    { label: "収録日数", value: meta.days.toLocaleString() },
    { label: "ラグビー特番", value: meta.rugby },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">ウェザーニュースLiVE アーカイブ</h1>
          <p className="text-sm text-neutral-500">2022年〜現在の放送をキャスター・番組・日付で検索</p>
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); reset(); }}
          placeholder="キャスター名で検索…"
          className="h-10 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus:border-neutral-400 sm:w-64 dark:border-neutral-700"
        />
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-neutral-100 px-4 py-3 dark:bg-neutral-800/60">
            <div className="text-xs text-neutral-500">{s.label}</div>
            <div className="text-2xl font-medium">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <Chip active={kind === "all"} onClick={() => { setKind("all"); reset(); }}>すべて</Chip>
        <Chip active={kind === "live"} onClick={() => { setKind("live"); reset(); }}>通常LIVE</Chip>
        <Chip active={kind === "rugby"} onClick={() => { setKind("rugby"); reset(); }}>ラグビー特番</Chip>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <Chip active={program === "all"} onClick={() => { setProgram("all"); reset(); }}>全番組</Chip>
        {PROGRAMS.map((p) => (
          <Chip key={p} active={program === p} onClick={() => { setProgram(p); reset(); }}>{p}</Chip>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={year === "all"} onClick={() => { setYear("all"); reset(); }}>全期間</Chip>
        {meta.years.map((y) => (
          <Chip key={y} active={year === y} onClick={() => { setYear(y); reset(); }}>{y}年</Chip>
        ))}
      </div>

      <p className="mb-3 text-sm text-neutral-500">
        {loading ? "読み込み中…" : `${filtered.length.toLocaleString()} 件`}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => {
          const rugby = b.kind === "rugby";
          return (
            <a
              key={b.video + b.date + b.slot}
              href={`https://www.youtube.com/watch?v=${b.video}`}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
                <img
                  loading="lazy"
                  src={`https://i.ytimg.com/vi/${b.video}/mqdefault.jpg`}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-xs text-white">
                  {b.slot} {b.program}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-neutral-500">{dateLabel(b.date)}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs ${
                    rugby ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                          : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"}`}>
                    {rugby ? "ラグビー特番" : "LIVE"}
                  </span>
                </div>
                <div className="font-medium">{b.caster || "—"}</div>
                {b.weather && <div className="text-xs text-neutral-400">天気 / {b.weather}</div>}
              </div>
            </a>
          );
        })}
      </div>

      {limit < filtered.length && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-neutral-300 px-5 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            もっと見る（残り {(filtered.length - limit).toLocaleString()} 件）
          </button>
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-neutral-400">
        データ更新: {meta.updated} ・ 出典: 公式番組表 / minorin
      </footer>
    </div>
  );
}
