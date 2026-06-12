import { useEffect, useMemo, useState } from "react";

type Broadcast = {
  date: string; slot: string; program: string;
  caster: string; weather: string; kind: string; video: string; title: string;
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const PROGRAMS = ["モーニング", "サンシャイン", "コーヒータイム", "アフタヌーン", "イブニング", "ムーン"];
const PAGE = 60;

function dateLabel(d: string) {
  const t = new Date(d + "T00:00:00");
  return `${d.replace(/-/g, "/")}（${WD[t.getDay()]}）`;
}

function Bar({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate text-neutral-600 dark:text-neutral-300">{r.name}</span>
          <span className="h-2 rounded bg-teal-500/70" style={{ width: `${(r.count / max) * 100}%`, minWidth: 4 }} />
          <span className="text-xs text-neutral-400">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

type Sns = { x?: string; instagram?: string; youtube?: string };

function snsLinks(sns: Sns) {
  const out: { label: string; url: string }[] = [];
  if (sns.x) out.push({ label: "X", url: `https://x.com/${sns.x.replace(/^@/, "")}` });
  if (sns.instagram) out.push({ label: "Instagram", url: `https://www.instagram.com/${sns.instagram.replace(/^@/, "")}/` });
  if (sns.youtube)
    out.push({ label: "YouTube", url: sns.youtube.startsWith("UC")
      ? `https://www.youtube.com/channel/${sns.youtube}`
      : `https://www.youtube.com/@${sns.youtube.replace(/^@/, "")}` });
  return out;
}

export default function CasterDetail({ name, sns = {} }: { name: string; sns?: Sns }) {
  const [all, setAll] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}broadcasts.json`)
      .then((r) => r.json())
      .then((d: Broadcast[]) => { setAll(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const mine = useMemo(() => all.filter((b) => b.caster === name), [all, name]);

  const stats = useMemo(() => {
    const prog: Record<string, number> = {};
    const fore: Record<string, number> = {};
    for (const b of mine) {
      if (b.program) prog[b.program] = (prog[b.program] || 0) + 1;
      if (b.weather) fore[b.weather] = (fore[b.weather] || 0) + 1;
    }
    const progRows = PROGRAMS.filter((p) => prog[p]).map((p) => ({ name: p, count: prog[p] }));
    const foreRows = Object.entries(fore).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([n, c]) => ({ name: n, count: c }));
    const days = new Set(mine.map((b) => b.date)).size;
    const first = mine.length ? mine[mine.length - 1].date : "";
    const last = mine.length ? mine[0].date : "";
    return { progRows, foreRows, days, first, last };
  }, [mine]);

  const shown = mine.slice(0, limit);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <header className="mb-6">
        <a href={import.meta.env.BASE_URL} className="text-sm text-neutral-500 hover:underline">← アーカイブに戻る</a>
        <h1 className="mt-1 text-2xl font-medium">{name}</h1>
        <p className="text-sm text-neutral-500">
          {loading ? "読み込み中…" : `担当 ${mine.length.toLocaleString()} 放送 ・ ${stats.first?.slice(0, 4)}〜${stats.last?.slice(0, 4)}年`}
        </p>
        {snsLinks(sns).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {snsLinks(sns).map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noreferrer"
                 className="rounded-lg border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                {l.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {!loading && mine.length > 0 && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "担当放送", value: mine.length.toLocaleString() },
              { label: "担当日数", value: stats.days.toLocaleString() },
              { label: "最初の担当", value: stats.first || "—" },
              { label: "最新の担当", value: stats.last || "—" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-neutral-100 px-4 py-3 dark:bg-neutral-800/60">
                <div className="text-xs text-neutral-500">{s.label}</div>
                <div className="text-lg font-medium">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <h2 className="mb-3 text-base font-medium">番組別</h2>
              <Bar rows={stats.progRows} />
            </section>
            <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <h2 className="mb-3 text-base font-medium">共演した予報士</h2>
              {stats.foreRows.length ? <Bar rows={stats.foreRows} /> : <p className="text-sm text-neutral-400">記録なし</p>}
            </section>
          </div>

          <h2 className="mb-3 text-base font-medium">担当した放送</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((b) => {
              const rugby = b.kind === "rugby";
              return (
                <a key={b.video + b.date + b.slot}
                   href={`https://www.youtube.com/watch?v=${b.video}`}
                   target="_blank" rel="noreferrer"
                   className="overflow-hidden rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
                    <img loading="lazy" src={`https://i.ytimg.com/vi/${b.video}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-xs text-white">{b.slot} {b.program}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="text-xs text-neutral-500">{dateLabel(b.date)}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs ${rugby ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"}`}>
                      {rugby ? "ラグビー特番" : "LIVE"}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>

          {limit < mine.length && (
            <div className="mt-6 text-center">
              <button onClick={() => setLimit((l) => l + PAGE)}
                className="rounded-lg border border-neutral-300 px-5 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                もっと見る（残り {(mine.length - limit).toLocaleString()} 件）
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
