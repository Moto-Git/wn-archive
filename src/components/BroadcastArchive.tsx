import { useEffect, useMemo, useState } from "react";
import LiveNowBanner from "./LiveNowBanner";

type Broadcast = {
  date: string; slot: string; program: string;
  caster: string; weather: string; kind: string; video: string; title: string;
};
type NameCount = { name: string; count: number };
type Meta = {
  total: number; days: number; rugby: number;
  event: number; hanabi: number; special: number; collab: number;
  years: string[]; casters: NameCount[]; forecasters: NameCount[];
};

const KIND_LABEL: Record<string, string> = {
  live: "LIVE", rugby: "ラグビー特番", event: "天体LIVE",
  hanabi: "花火", special: "特別番組", collab: "コラボ",
};
const KIND_COLOR: Record<string, string> = {
  live:    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  rugby:   "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  event:   "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  hanabi:  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  special: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  collab:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
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

export default function BroadcastArchive() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [full, setFull] = useState(false);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [program, setProgram] = useState("all");
  const [year, setYear] = useState("all");
  const [caster, setCaster] = useState("all");
  const [forecaster, setForecaster] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    // ?full=1 のときだけローカル専用のフル版(minorin込み)を試す。無ければ公開版にフォールバック。
    const wantFull = new URLSearchParams(window.location.search).get("full") === "1";
    const load = (url: string) => fetch(url).then((r) => { if (!r.ok) throw 0; return r.json(); });
    (wantFull
      ? load(`${base}broadcasts-full.json`).then((d) => { setFull(true); return d; })
          .catch(() => load(`${base}broadcasts.json`))
      : load(`${base}broadcasts.json`)
    )
      .then((d: Broadcast[]) => { setBroadcasts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const meta = useMemo(() => {
    const c: Record<string, number> = {}, f: Record<string, number> = {}, y = new Set<string>();
    for (const b of broadcasts) {
      if (b.caster) c[b.caster] = (c[b.caster] || 0) + 1;
      if (b.weather) f[b.weather] = (f[b.weather] || 0) + 1;
      y.add(b.date.slice(0, 4));
    }
    const rank = (o: Record<string, number>) =>
      Object.entries(o).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    return {
      total: broadcasts.length,
      days: new Set(broadcasts.map((b) => b.date)).size,
      rugby: broadcasts.filter((b) => b.kind === "rugby").length,
      event: broadcasts.filter((b) => b.kind === "event").length,
      hanabi: broadcasts.filter((b) => b.kind === "hanabi").length,
      special: broadcasts.filter((b) => b.kind === "special").length,
      collab: broadcasts.filter((b) => b.kind === "collab").length,
      years: [...y].sort().reverse(),
      casters: rank(c), forecasters: rank(f),
    };
  }, [broadcasts]);

  const filtered = useMemo(() => {
    const nq = q.replace(/\s/g, "");
    return broadcasts.filter(
      (b) =>
        (kind === "all" || b.kind === kind) &&
        (program === "all" || b.program === program) &&
        (year === "all" || b.date.startsWith(year)) &&
        (caster === "all" || b.caster === caster) &&
        (forecaster === "all" || b.weather === forecaster) &&
        (!nq || b.caster.replace(/\s/g, "").includes(nq))
    );
  }, [broadcasts, q, kind, program, year, caster, forecaster]);

  const shown = filtered.slice(0, limit);
  const reset = () => setLimit(PAGE);

  const stats = [
    { label: "総放送数", value: meta.total.toLocaleString() },
    { label: "キャスター", value: meta.casters.length },
    { label: "収録日数", value: meta.days.toLocaleString() },
    { label: "天体・花火", value: (meta.event + meta.hanabi).toLocaleString() },
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

      <LiveNowBanner base={import.meta.env.BASE_URL} />

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
        {meta.rugby > 0 && <Chip active={kind === "rugby"} onClick={() => { setKind("rugby"); reset(); }}>ラグビー特番</Chip>}
        {meta.event > 0 && <Chip active={kind === "event"} onClick={() => { setKind("event"); reset(); }}>天体LIVE</Chip>}
        {meta.hanabi > 0 && <Chip active={kind === "hanabi"} onClick={() => { setKind("hanabi"); reset(); }}>花火中継</Chip>}
        {meta.special > 0 && <Chip active={kind === "special"} onClick={() => { setKind("special"); reset(); }}>特別番組</Chip>}
        {meta.collab > 0 && <Chip active={kind === "collab"} onClick={() => { setKind("collab"); reset(); }}>コラボ</Chip>}
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-500">
          キャスター別
          <select
            value={caster}
            onChange={(e) => { setCaster(e.target.value); reset(); }}
            className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:text-neutral-100"
          >
            <option value="all">すべてのキャスター</option>
            {meta.casters.map((c) => (
              <option key={c.name} value={c.name}>{c.name}（{c.count}）</option>
            ))}
          </select>
          {caster !== "all" && (
            <a
              href={`${import.meta.env.BASE_URL}caster/${caster.replace(/\s/g, "")}`}
              className="text-xs text-sky-700 hover:underline dark:text-sky-400"
            >
              {caster} の詳細ページ（出演履歴・統計）→
            </a>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-500">
          予報士別
          <select
            value={forecaster}
            onChange={(e) => { setForecaster(e.target.value); reset(); }}
            className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:text-neutral-100"
          >
            <option value="all">すべての予報士</option>
            {meta.forecasters.map((c) => (
              <option key={c.name} value={c.name}>{c.name}（{c.count}）</option>
            ))}
          </select>
        </label>
      </div>

      <p className="mb-3 text-sm text-neutral-500">
        {loading ? "読み込み中…" : `${filtered.length.toLocaleString()} 件`}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => {
          const kindColor = KIND_COLOR[b.kind] ?? KIND_COLOR.live;
          const kindLabel = KIND_LABEL[b.kind] ?? "LIVE";
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
                  <span className={`rounded-md px-2 py-0.5 text-xs ${kindColor}`}>{kindLabel}</span>
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

      {full && (
        <footer className="mt-10 text-center text-xs text-neutral-400">
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">フル表示（ローカル専用）</span>
        </footer>
      )}
    </div>
  );
}
