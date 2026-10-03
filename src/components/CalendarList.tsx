import { useEffect, useMemo, useState } from "react";
import { Highlight } from "../lib/broadcast";
import { useDisplay, useTimes, TimeInfo, durLabel } from "../lib/display";

// キャスターカレンダー（キャスカレ）関連動画の一覧。データは build-yt.mjs が出す wn-yt/calendar.json。
type Item = {
  id: string; title: string; date: string; type: "video" | "short" | "live"; sec: number;
  ed: string; cat: "promo" | "making" | "live"; casters?: string[];
};

const CATS: [string, string][] = [["all", "すべて"], ["promo", "告知・販売"], ["making", "メイキング・Vlog"], ["live", "配信"]];
const CAT_COLOR: Record<string, string> = {
  promo: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  making: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  live: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
const TYPE_LABEL: Record<string, string> = { video: "動画", short: "ショート", live: "ライブ" };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}>
      {children}
    </button>
  );
}

const KEYS = ["ed", "cat", "caster", "q"] as const;
type F = Record<typeof KEYS[number], string>;
const DEF: F = { ed: "", cat: "all", caster: "all", q: "" };   // ed="" は「最新の版」

export default function CalendarList() {
  const base = import.meta.env.BASE_URL;
  const [items, setItems] = useState<Item[] | null>(null);
  const [f, setF] = useState<F>(DEF);
  const [ready, setReady] = useState(false);
  const [display] = useDisplay();
  const times = useTimes(base, display.pub || display.live || display.dur);
  const set = (k: keyof F, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch(`${base}wn-yt/calendar.json`).then((r) => r.json()).then((d) => setItems(d.items)).catch(() => setItems([]));
    const p = new URLSearchParams(window.location.search);
    const init = { ...DEF };
    for (const k of KEYS) { const v = p.get(k); if (v) init[k] = v; }
    setF(init);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams();
    for (const k of KEYS) if (f[k] !== DEF[k]) p.set(k, f[k]);
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [f, ready]);

  const editions = useMemo(() => {
    const c = new Map<string, number>();
    for (const it of items || []) c.set(it.ed, (c.get(it.ed) || 0) + 1);
    return [...c].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [items]);
  const ed = f.ed || editions[0]?.[0] || "";            // 既定は最新の版

  const inEd = useMemo(() => (items || []).filter((it) => ed === "all" || it.ed === ed), [items, ed]);
  const casters = useMemo(() => {
    const c = new Map<string, number>();
    for (const it of inEd) for (const n of it.casters || []) c.set(n, (c.get(n) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]);
  }, [inEd]);
  const nq = f.q.replace(/\s/g, "");
  const shown = inEd.filter((it) =>
    (f.cat === "all" || it.cat === f.cat) &&
    (f.caster === "all" || it.casters?.includes(f.caster)) &&
    (!nq || it.title.replace(/\s/g, "").includes(nq))
  );
  // 「全版」表示のときは版ごとに見出しで区切る
  const groups = useMemo(() => {
    const g = new Map<string, Item[]>();
    for (const it of shown) g.set(it.ed, [...(g.get(it.ed) || []), it]);
    return [...g];
  }, [shown]);
  const filtered = f.cat !== "all" || f.caster !== "all" || nq;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <header className="mb-6">
        <h1 className="text-2xl font-medium">キャスターカレンダー</h1>
        <p className="text-sm text-neutral-500">
          ウェザーニュースキャスターカレンダー（キャスカレ）の告知・メイキング・販売配信を版ごとにまとめています
        </p>
      </header>

      <div className="mb-2 flex flex-wrap gap-2">
        {editions.map(([y, n]) => (
          <Chip key={y} active={ed === y} onClick={() => set("ed", y)}>{y}年版<span className="ml-1 text-xs opacity-60">{n}</span></Chip>
        ))}
        <Chip active={ed === "all"} onClick={() => set("ed", "all")}>全版</Chip>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {CATS.map(([k, label]) => (
          <Chip key={k} active={f.cat === k} onClick={() => set("cat", k)}>{label}</Chip>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={f.caster} onChange={(e) => set("caster", e.target.value)} aria-label="キャスターで絞り込み"
          className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:text-neutral-100">
          <option value="all">すべてのキャスター</option>
          {casters.map(([n, c]) => <option key={n} value={n}>{n}（{c}）</option>)}
        </select>
        <input type="search" value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="タイトルで検索…" aria-label="タイトルで検索"
          className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <span aria-live="polite">{items ? `${shown.length} 本` : "読み込み中…"}</span>
        {filtered && (
          <button onClick={() => setF({ ...DEF, ed: f.ed })}
            className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
            絞り込みをクリア ✕
          </button>
        )}
      </div>

      {items && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          該当する動画がありません。
        </div>
      )}

      {groups.map(([y, list]) => (
        <section key={y} className="mb-6">
          {ed === "all" && (
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-neutral-200 pb-1 dark:border-neutral-800">
              <span className="text-sm font-medium">{y}年版</span><span className="text-xs text-neutral-400">{list.length}本</span>
            </h2>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((it) => (
              <a key={it.id} href={`https://www.youtube.com/watch?v=${it.id}`} target="_blank" rel="noreferrer"
                className="overflow-hidden rounded-xl border border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600">
                <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
                  <img loading="lazy" src={`https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                  <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs ${CAT_COLOR[it.cat]}`}>
                    {CATS.find(([k]) => k === it.cat)?.[1]}
                  </span>
                  {it.sec > 0 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 text-xs text-white">{durLabel(it.sec)}</span>}
                </div>
                <div className="flex flex-col gap-1 p-2.5">
                  <p className="line-clamp-2 text-sm"><Highlight text={it.title} q={f.q} /></p>
                  <p className="text-xs text-neutral-400">
                    {it.date.replace(/-/g, "/")} · {TYPE_LABEL[it.type]}
                    {it.casters && <span className="ml-1 text-teal-600 dark:text-teal-400">· {it.casters.join("・")}</span>}
                  </p>
                  <TimeInfo id={it.id} d={display} times={times} sec={it.sec} hideDur />
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
