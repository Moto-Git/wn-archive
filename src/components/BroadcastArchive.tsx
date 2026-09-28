import { Fragment, useEffect, useMemo, useState } from "react";
import LiveNowBanner from "./LiveNowBanner";
import {
  type Broadcast, KIND_LABEL, KIND_COLOR, KIND_BORDER,
  weekday, slotLabel, shortTitle, Highlight, useLiveStatus, jstTime, useAutoMore,
} from "../lib/broadcast";
import { useDisplay, useTimes, TimeInfo } from "../lib/display";

type NameCount = { name: string; count: number };

const PROGRAMS = ["モーニング", "サンシャイン", "コーヒータイム", "アフタヌーン", "イブニング", "ムーン"];
const PAGE = 60;
// URL に載せる絞り込み条件（既定値は "all" / 空文字で、既定値のときは URL から省く）
const FILTER_KEYS = ["q", "kind", "program", "year", "caster", "forecaster"] as const;
type FilterKey = typeof FILTER_KEYS[number];
type Filters = Record<FilterKey, string>;
const DEFAULTS: Filters = { q: "", kind: "all", program: "all", year: "all", caster: "all", forecaster: "all" };

function dayHeading(d: string) {
  const [y, m, dd] = d.split("-");
  return `${y}年${+m}月${+dd}日（${weekday(d)}）`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

// 年ごとの放送数を小さな棒で見せ、そのまま年の絞り込みボタンとして使う。
// 件数は「年以外の条件」を当てた結果なので、キャスターを選ぶとその人の年別推移になる。
function YearBars({ rows, year, onPick }: { rows: NameCount[]; year: string; onPick: (y: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="mb-6 flex items-end gap-2">
      <Chip active={year === "all"} onClick={() => onPick("all")}>全期間</Chip>
      <div className="flex min-w-0 flex-1 items-end gap-1">
        {rows.map((r) => {
          const active = year === r.name;
          return (
            <button
              key={r.name}
              onClick={() => onPick(active ? "all" : r.name)}
              aria-pressed={active}
              title={`${r.name}年 ${r.count.toLocaleString()}件`}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <span className="text-[10px] text-neutral-400 tabular-nums">{r.count ? r.count.toLocaleString() : ""}</span>
              <span className="flex h-12 w-full items-end">
                <span
                  className={`w-full rounded-t transition-colors ${
                    active ? "bg-sky-500" : "bg-sky-500/35 group-hover:bg-sky-500/60"
                  }`}
                  style={{ height: `${Math.max(r.count ? 6 : 0, (r.count / max) * 100)}%` }}
                />
              </span>
              <span className={`w-full rounded-md border px-1 py-1 text-xs transition-colors ${
                active
                  ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-200 text-neutral-600 group-hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:group-hover:bg-neutral-800"
              }`}>{r.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BroadcastArchive() {
  const base = import.meta.env.BASE_URL;
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [full, setFull] = useState(false);
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [limit, setLimit] = useState(PAGE);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const liveStatus = useLiveStatus(base);
  const [display] = useDisplay();
  const times = useTimes(base, display.pub || display.live || display.dur);

  const set = (k: FilterKey, v: string) => { setF((p) => ({ ...p, [k]: v })); setLimit(PAGE); };
  const clearAll = () => { setF(DEFAULTS); setLimit(PAGE); };
  const active = FILTER_KEYS.filter((k) => f[k] !== DEFAULTS[k]);

  // 絞り込み条件を URL から復元（再読み込み・共有リンク・YouTube から「戻る」で同じ状態に戻る）
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const init = { ...DEFAULTS };
    for (const k of FILTER_KEYS) { const v = p.get(k); if (v) init[k] = v; }
    setF(init);
    setUrlReady(true);
  }, []);

  // 条件が変わったら URL を置き換え（履歴は増やさない）。?full=1 など他のパラメータは残す。
  useEffect(() => {
    if (!urlReady) return;  // 復元前に既定値で URL を上書きしない
    const p = new URLSearchParams(window.location.search);
    for (const k of FILTER_KEYS) f[k] !== DEFAULTS[k] ? p.set(k, f[k]) : p.delete(k);
    const qs = p.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`)
      window.history.replaceState(null, "", next);
  }, [f, urlReady]);

  const markCopied = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const copyLink = (e: React.MouseEvent, url: string, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(
      () => markCopied(id),
      () => {
        // Clipboard API が使えない環境向けのフォールバック（古いブラウザ・権限制限時）。
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          markCopied(id);
        } catch {
          // それでも失敗したら諦める（クリック自体は無害なので何もしない）。
        }
        document.body.removeChild(ta);
      }
    );
  };

  useEffect(() => {
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
    const c: Record<string, number> = {}, fc: Record<string, number> = {}, y = new Set<string>();
    for (const b of broadcasts) {
      if (b.caster) c[b.caster] = (c[b.caster] || 0) + 1;
      if (b.weather) fc[b.weather] = (fc[b.weather] || 0) + 1;
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
      years: [...y].sort(),
      casters: rank(c), forecasters: rank(fc),
    };
  }, [broadcasts]);

  // 年以外の条件で絞った集合（年別の棒グラフ用）→ さらに年で絞ったものが一覧
  const nq = f.q.replace(/\s/g, "");
  const exceptYear = useMemo(() => broadcasts.filter(
    (b) =>
      (f.kind === "all" || b.kind === f.kind) &&
      (f.program === "all" || b.program === f.program) &&
      (f.caster === "all" || b.caster === f.caster) &&
      (f.forecaster === "all" || b.weather === f.forecaster) &&
      (!nq || [b.caster, b.title || ""].some((s) => s.replace(/\s/g, "").includes(nq)))
  ), [broadcasts, nq, f.kind, f.program, f.caster, f.forecaster]);
  const filtered = useMemo(
    () => (f.year === "all" ? exceptYear : exceptYear.filter((b) => b.date.startsWith(f.year))),
    [exceptYear, f.year]
  );
  const yearRows = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of exceptYear) { const y = b.date.slice(0, 4); c[y] = (c[y] || 0) + 1; }
    return meta.years.map((y) => ({ name: y, count: c[y] || 0 }));
  }, [exceptYear, meta.years]);
  const perDay = useMemo(() => {
    const c = new Map<string, number>();
    for (const b of filtered) c.set(b.date, (c.get(b.date) || 0) + 1);
    return c;
  }, [filtered]);

  const shown = filtered.slice(0, limit);
  // 1日あたり平均2件以上のときだけ日付の区切り見出しを出す。キャスター絞り込みなど
  // 1日1件が続く一覧では区切りだらけになるので、代わりにカードへ日付を出す。
  const groupByDay = perDay.size > 0 && filtered.length / perDay.size >= 2;
  const hasMore = limit < filtered.length;
  const more = () => setLimit((l) => Math.min(l + PAGE, filtered.length));
  const sentinel = useAutoMore(more, hasMore);

  const stats = [
    { label: "総放送数", value: meta.total.toLocaleString() },
    { label: "キャスター", value: meta.casters.length },
    { label: "収録日数", value: meta.days.toLocaleString() },
    { label: "天体・花火", value: (meta.event + meta.hanabi).toLocaleString() },
  ];
  const KINDS: [string, string, number][] = [
    ["live", "通常LIVE", 1], ["rugby", "ラグビー特番", meta.rugby], ["event", "天体LIVE", meta.event],
    ["hanabi", "花火中継", meta.hanabi], ["special", "特別番組", meta.special], ["collab", "コラボ", meta.collab],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">ウェザーニュースLiVE アーカイブ</h1>
          <p className="text-sm text-neutral-500">
            {meta.years[0] ? `${meta.years[0]}年` : ""}〜現在の放送をキャスター・番組・日付で検索
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <input
            type="search"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="キャスター名・タイトルで検索…"
            aria-label="キャスター名・タイトルで検索"
            className="h-10 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700"
          />
        </div>
      </header>

      <LiveNowBanner base={base} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-neutral-100 px-4 py-3 dark:bg-neutral-800/60">
            <div className="text-xs text-neutral-500">{s.label}</div>
            <div className="text-2xl font-medium">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <Chip active={f.kind === "all"} onClick={() => set("kind", "all")}>すべて</Chip>
        {KINDS.filter(([, , n]) => n > 0).map(([k, label]) => (
          <Chip key={k} active={f.kind === k} onClick={() => set("kind", k)}>{label}</Chip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={f.program === "all"} onClick={() => set("program", "all")}>全番組</Chip>
        {PROGRAMS.map((p) => (
          <Chip key={p} active={f.program === p} onClick={() => set("program", p)}>{p}</Chip>
        ))}
      </div>
      <YearBars rows={yearRows} year={f.year} onPick={(y) => set("year", y)} />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-neutral-500">
          キャスター別
          <select
            value={f.caster}
            onChange={(e) => set("caster", e.target.value)}
            className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:text-neutral-100"
          >
            <option value="all">すべてのキャスター</option>
            {meta.casters.map((c) => (
              <option key={c.name} value={c.name}>{c.name}（{c.count}）</option>
            ))}
          </select>
          {f.caster !== "all" && (
            <a
              href={`${base}caster/${f.caster.replace(/\s/g, "")}`}
              className="text-xs text-sky-700 hover:underline dark:text-sky-400"
            >
              {f.caster} の詳細ページ（出演履歴・統計）→
            </a>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-500">
          予報士別
          <select
            value={f.forecaster}
            onChange={(e) => set("forecaster", e.target.value)}
            className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:text-neutral-100"
          >
            <option value="all">すべての予報士</option>
            {meta.forecasters.map((c) => (
              <option key={c.name} value={c.name}>{c.name}（{c.count}）</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <span aria-live="polite">{loading ? "読み込み中…" : `${filtered.length.toLocaleString()} 件`}</span>
        {active.length > 0 && (
          <button
            onClick={clearAll}
            className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            条件をクリア（{active.length}）✕
          </button>
        )}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          該当する放送がありません。
          {active.length > 0 && <button onClick={clearAll} className="ml-1 text-sky-700 hover:underline dark:text-sky-400">条件をクリア</button>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b, i) => {
          const kindColor = KIND_COLOR[b.kind] ?? KIND_COLOR.live;
          const kindLabel = KIND_LABEL[b.kind] ?? "LIVE";
          const id = b.video + b.date + b.slot;
          const url = `https://www.youtube.com/watch?v=${b.video}`;
          const short = shortTitle(b.title);
          const st = liveStatus.get(b.video);
          const newDay = groupByDay && (i === 0 || shown[i - 1].date !== b.date);
          return (
            <Fragment key={id}>
              {newDay && (
                <h2 className="col-span-full mt-3 flex items-baseline gap-2 border-b border-neutral-200 pb-1 first:mt-0 dark:border-neutral-800">
                  <span className="text-sm font-medium">{dayHeading(b.date)}</span>
                  <span className="text-xs text-neutral-400">{perDay.get(b.date)}件</span>
                </h2>
              )}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={`group overflow-hidden rounded-xl border bg-white transition-colors hover:border-neutral-400 dark:bg-neutral-900 dark:hover:border-neutral-600 ${
                  KIND_BORDER[b.kind] ?? "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
                  <img
                    loading="lazy"
                    src={`https://i.ytimg.com/vi/${b.video}/mqdefault.jpg`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-xs text-white">
                    {slotLabel(b)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => copyLink(e, url, id)}
                    title="リンクをコピー"
                    className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-xs text-white transition-colors hover:bg-black/80"
                  >
                    {copiedId === id ? "コピー済み" : "🔗 コピー"}
                  </button>
                  {st && (
                    <span className={`absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-xs font-medium text-white ${st.live ? "bg-red-600" : "bg-amber-600"}`}>
                      {st.live ? "● LIVE中" : `配信予定 ${jstTime(st.at)}`}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium">{b.caster ? <Highlight text={b.caster} q={f.q} /> : "—"}</div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${kindColor}`}>{kindLabel}</span>
                  </div>
                  {!groupByDay && <div className="text-xs text-neutral-500">{b.date.replace(/-/g, "/")}（{weekday(b.date)}）</div>}
                  {short && (
                    <p title={b.title} className="line-clamp-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                      <Highlight text={short} q={f.q} />
                    </p>
                  )}
                  {b.weather && <div className="text-xs text-neutral-400">天気 / {b.weather}</div>}
                  <TimeInfo id={b.video} d={display} times={times} />
                </div>
              </a>
            </Fragment>
          );
        })}
      </div>

      {hasMore && (
        <div ref={sentinel} className="mt-6 text-center">
          <button
            onClick={more}
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
