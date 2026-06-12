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

type Profile = {
  code?: string; name?: string; kana?: string; photo?: string;
  birthday?: string; blood?: string; birthplace?: string; hobby?: string;
  url?: string; sns?: { x?: string; instagram?: string; tiktok?: string; youtube?: string };
};

const SNS_META: Record<string, { label: string; cls: string }> = {
  x: { label: "X", cls: "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" },
  instagram: { label: "Instagram", cls: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300" },
  tiktok: { label: "TikTok", cls: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100" },
  youtube: { label: "YouTube", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

function age(birthday?: string) {
  if (!birthday) return "";
  const b = new Date(birthday.replace(/\//g, "-"));
  if (isNaN(+b)) return "";
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return `${a}歳`;
}

export default function CasterDetail({ name, profile = {} }: { name: string; profile?: Profile }) {
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
      <a href={import.meta.env.BASE_URL} className="text-sm text-neutral-500 hover:underline">← アーカイブに戻る</a>

      <header className="mt-3 mb-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          {profile.photo && (
            <img src={profile.photo} alt={name}
                 className="h-28 w-28 shrink-0 rounded-full border border-neutral-200 object-cover dark:border-neutral-700" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-medium">{name}</h1>
              {profile.kana && <span className="text-sm text-neutral-400">{profile.kana}</span>}
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {loading ? "読み込み中…" : `担当 ${mine.length.toLocaleString()} 放送 ・ ${stats.first?.slice(0, 4)}〜${stats.last?.slice(0, 4)}年`}
            </p>

            {(profile.birthday || profile.birthplace || profile.blood || profile.hobby) && (
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {profile.birthday && (
                  <div><dt className="inline text-neutral-400">生年月日 </dt>
                    <dd className="inline">{profile.birthday}{age(profile.birthday) && <span className="text-neutral-400">（{age(profile.birthday)}）</span>}</dd></div>
                )}
                {profile.birthplace && <div><dt className="inline text-neutral-400">出身 </dt><dd className="inline">{profile.birthplace}</dd></div>}
                {profile.blood && <div><dt className="inline text-neutral-400">血液型 </dt><dd className="inline">{profile.blood}</dd></div>}
                {profile.hobby && <div className="w-full"><dt className="inline text-neutral-400">趣味・特技 </dt><dd className="inline">{profile.hobby}</dd></div>}
              </dl>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {profile.sns && Object.entries(profile.sns).map(([k, url]) => url && SNS_META[k] && (
                <a key={k} href={url} target="_blank" rel="noreferrer"
                   className={`rounded-lg px-3 py-1 text-xs font-medium ${SNS_META[k].cls}`}>{SNS_META[k].label}</a>
              ))}
              {profile.url && (
                <a href={profile.url} target="_blank" rel="noreferrer"
                   className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">公式プロフィール</a>
              )}
            </div>
          </div>
        </div>
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
