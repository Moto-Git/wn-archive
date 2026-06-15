import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: string; title: string; date: string; sec: number; caster?: string; weather?: string };
type ChunkInfo = { file: string; n: number; from: string; to: string };
type Index = { updated: string; type: string; total: number; chunkSize: number; chunks: ChunkInfo[] };

type LiveItem = { id: string; title: string; scheduled: string; started: string; viewers: number };
type LiveNow = { checked: string; live: LiveItem[]; upcoming: LiveItem[] };

type YtType = "video" | "short" | "live";

const META: Record<YtType, { label: string; desc: string; badge: string }> = {
  video: { label: "動画", desc: "公式チャンネルの通常動画", badge: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200" },
  short: { label: "ショート", desc: "60秒以内のショート動画", badge: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300" },
  live: { label: "ライブ", desc: "ライブ配信のアーカイブ", badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

const SORTS: [string, string][] = [
  ["new", "新しい順"], ["old", "古い順"], ["long", "長い順"], ["short", "短い順"],
];
const PAGE = 48;

function dur(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                 : `${m}:${String(s).padStart(2, "0")}`;
}

// JST の「M/D HH:MM」表記。
function jst(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// from→to の差を「○日○時間○分」「○時間○分」「○分」で表す（経過/残りの両用）。
function span(ms: number) {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), mm = min % 60;
  if (d > 0) return `${d}日${h}時間`;
  if (h > 0) return `${h}時間${mm}分`;
  return `${mm}分`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}>
      {children}
    </button>
  );
}

export default function YtList({ type }: { type: YtType }) {
  const base = import.meta.env.BASE_URL;
  const m = META[type];

  const [index, setIndex] = useState<Index | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(0);          // ロード済みチャンク数
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const [sort, setSort] = useState("new");
  const [year, setYear] = useState("all");
  const [caster, setCaster] = useState("all");
  const [forecaster, setForecaster] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  // ライブページのみ: 現在LIVE中・配信予定のスナップショットと、現在時刻ティック。
  const [liveNow, setLiveNow] = useState<LiveNow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadingRef = useRef(false);

  // 現在LIVE中・配信予定を読み込む（ライブページのみ）。
  useEffect(() => {
    if (type !== "live") return;
    let alive = true;
    fetch(`${base}wn-yt/live-now.json`)
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((d: LiveNow) => { if (alive) setLiveNow(d); })
      .catch(() => { /* 無ければバナー非表示で続行 */ });
    return () => { alive = false; };
  }, [base, type]);

  // カウントダウン用に現在時刻を30秒ごとに更新（ライブページのみ）。
  useEffect(() => {
    if (type !== "live") return;
    const h = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(h);
  }, [type]);

  // index を読み、最初のチャンクを表示
  useEffect(() => {
    let alive = true;
    fetch(`${base}wn-yt/${type}.json`)
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((idx: Index) => { if (alive) setIndex(idx); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [base, type]);

  // 次のチャンクを1つ読み込む（順次 append）
  async function loadNext() {
    if (!index || loadingRef.current) return;
    if (loaded >= index.chunks.length) return;
    loadingRef.current = true;
    setBusy(true);
    try {
      const ck = index.chunks[loaded];
      const part: Item[] = await fetch(`${base}wn-yt/${ck.file}`).then((r) => r.json());
      setItems((prev) => prev.concat(part));
      setLoaded((n) => n + 1);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setBusy(false);
    }
  }

  // index 確定後、最初のチャンクを即ロード
  useEffect(() => { if (index && loaded === 0) loadNext(); /* eslint-disable-next-line */ }, [index]);

  // アイドル時に後続チャンクをバックグラウンド先読み（予測読み込み）
  useEffect(() => {
    if (!index || loaded === 0 || loaded >= index.chunks.length || busy) return;
    const ric: (cb: () => void) => number =
      (window as any).requestIdleCallback || ((cb) => window.setTimeout(cb, 400));
    const h = ric(() => loadNext());
    return () => ((window as any).cancelIdleCallback || clearTimeout)(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, loaded, busy]);

  const allLoaded = !!index && loaded >= index.chunks.length;

  // ロード済みアイテムに対して年フィルタ・検索・ソートを適用
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.date) s.add(it.date.slice(0, 4));
    return [...s].sort().reverse();
  }, [items]);

  const people = useMemo(() => {
    const c: Record<string, number> = {}, f: Record<string, number> = {};
    for (const it of items) {
      if (it.caster) c[it.caster] = (c[it.caster] || 0) + 1;
      if (it.weather) f[it.weather] = (f[it.weather] || 0) + 1;
    }
    const rank = (o: Record<string, number>) =>
      Object.entries(o).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    return { casters: rank(c), forecasters: rank(f) };
  }, [items]);

  const filtered = useMemo(() => {
    const nq = q.trim();
    let r = items.filter((it) =>
      (year === "all" || it.date.startsWith(year)) &&
      (caster === "all" || it.caster === caster) &&
      (forecaster === "all" || it.weather === forecaster) &&
      (!nq || it.title.includes(nq))
    );
    r = r.slice().sort((a, b) => {
      if (sort === "new") return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      if (sort === "old") return a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
      if (sort === "long") return b.sec - a.sec;
      return a.sec - b.sec; // short
    });
    return r;
  }, [items, year, caster, forecaster, q, sort]);

  const shown = filtered.slice(0, limit);
  const reset = () => setLimit(PAGE);

  // 現在LIVE中・配信予定バナー（ライブページのみ）。配信予定は閲覧時刻と比較して出し分け。
  const liveCards = liveNow?.live ?? [];
  const upcomingCards = liveNow?.upcoming ?? [];
  const showLiveBanner = type === "live" && (liveCards.length > 0 || upcomingCards.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <header className="mb-6">
        <span className="flex flex-wrap gap-3 text-sm text-neutral-500">
          <a href={base} className="hover:underline">← LiVEアーカイブ</a>
          <a href={`${base}youtube/`} className="hover:underline">公式YouTube トップ →</a>
        </span>
        <h1 className="mt-1 text-2xl font-medium">公式YouTube・{m.label}</h1>
        <p className="text-sm text-neutral-500">{m.desc}</p>
      </header>

      {/* type切替 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(META) as YtType[]).map((t) => (
          <a key={t} href={`${base}youtube/${t}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              t === type
                ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}>
            {META[t].label}
          </a>
        ))}
      </div>

      {/* 現在LIVE中・配信予定（ライブページのみ） */}
      {showLiveBanner && (
        <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          {liveCards.length > 0 && (
            <>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600 dark:bg-red-400" />
                今LIVE中（{liveCards.length}）
              </div>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {liveCards.map((v) => (
                  <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer"
                     className="flex gap-3 rounded-lg border border-red-200 bg-white p-2 hover:border-red-300 dark:border-red-950 dark:bg-neutral-900">
                    <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                      <img loading="lazy" src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white">● LIVE</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{v.title}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {v.started && `配信中・${span(now - Date.parse(v.started))}経過`}
                        {v.viewers > 0 && ` ・ ${v.viewers.toLocaleString()}人視聴`}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {upcomingCards.length > 0 && (
            <>
              <div className="mb-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                配信予定（{upcomingCards.length}）
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingCards.map((v) => {
                  const t = Date.parse(v.scheduled);
                  const future = now < t;
                  return (
                    <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer"
                       className="flex gap-3 rounded-lg border border-amber-200 bg-white p-2 hover:border-amber-300 dark:border-amber-950 dark:bg-neutral-900">
                      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                        <img loading="lazy" src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                        <span className="absolute left-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">予定</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{v.title}</p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {jst(v.scheduled)} 開始予定
                          {v.scheduled && <span className="ml-1 text-amber-600 dark:text-amber-400">
                            {future ? `（あと${span(t - now)}）` : "（まもなく）"}
                          </span>}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {liveNow?.checked && (
            <p className="mt-3 text-[11px] text-neutral-400">
              最終確認: {jst(liveNow.checked)}（LIVE中の状況は自動更新が1日1回のため、実際とずれる場合があります）
            </p>
          )}
        </div>
      )}

      {/* 並び替え */}
      <div className="mb-2 flex flex-wrap gap-2">
        {SORTS.map(([k, label]) => (
          <Chip key={k} active={sort === k} onClick={() => { setSort(k); reset(); }}>{label}</Chip>
        ))}
      </div>
      {/* 年フィルタ */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip active={year === "all"} onClick={() => { setYear("all"); reset(); }}>全期間</Chip>
        {years.map((y) => (
          <Chip key={y} active={year === y} onClick={() => { setYear(y); reset(); }}>{y}年</Chip>
        ))}
      </div>
      {/* キャスター別・予報士別（全件ロード完了後に有効化） */}
      {(people.casters.length > 0 || people.forecasters.length > 0) && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {people.casters.length > 0 && (
            <label className="flex flex-col gap-1 text-sm text-neutral-500">
              キャスター別{!allLoaded && <span className="ml-1 text-xs text-neutral-400">（読込中…）</span>}
              <select value={caster} onChange={(e) => { setCaster(e.target.value); reset(); }}
                disabled={!allLoaded}
                className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100">
                <option value="all">すべてのキャスター</option>
                {people.casters.map((c) => (<option key={c.name} value={c.name}>{c.name}（{c.count}）</option>))}
              </select>
              {caster !== "all" && (
                <a href={`${base}caster/${caster.replace(/\s/g, "")}`} className="text-xs text-teal-700 hover:underline dark:text-teal-400">
                  {caster} の詳細ページ（出演履歴・統計）→
                </a>
              )}
            </label>
          )}
          {people.forecasters.length > 0 && (
            <label className="flex flex-col gap-1 text-sm text-neutral-500">
              予報士別{!allLoaded && <span className="ml-1 text-xs text-neutral-400">（読込中…）</span>}
              <select value={forecaster} onChange={(e) => { setForecaster(e.target.value); reset(); }}
                disabled={!allLoaded}
                className="h-10 rounded-lg border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100">
                <option value="all">すべての予報士</option>
                {people.forecasters.map((c) => (<option key={c.name} value={c.name}>{c.name}（{c.count}）</option>))}
              </select>
            </label>
          )}
        </div>
      )}
      {/* タイトル検索 */}
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); reset(); }}
        placeholder="タイトルで検索（番組名・キャスター名など）…"
        className="mb-4 h-10 w-full rounded-lg border border-neutral-200 bg-transparent px-3 text-sm outline-none focus:border-neutral-400 sm:w-80 dark:border-neutral-700"
      />

      {/* 件数 */}
      <p className="mb-3 text-sm text-neutral-500">
        {error ? "読み込みに失敗しました" :
         !index ? "読み込み中…" :
         `${filtered.length.toLocaleString()} 件` +
           (allLoaded ? `（全${index.total.toLocaleString()}件）`
                      : `（全${index.total.toLocaleString()}件中 ${items.length.toLocaleString()}件 読込済${busy ? "・読込中…" : ""}）`)}
      </p>

      {/* 一覧 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((i) => (
          <a key={i.id} href={`https://www.youtube.com/watch?v=${i.id}`} target="_blank" rel="noreferrer"
             className="overflow-hidden rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
              <img loading="lazy" src={`https://i.ytimg.com/vi/${i.id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
              <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs ${m.badge}`}>{m.label}</span>
              {i.sec > 0 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 text-xs text-white">{dur(i.sec)}</span>}
            </div>
            <div className="p-2.5">
              <p className="line-clamp-2 text-sm">{i.title}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {i.date?.slice(0, 4)}/{i.date?.slice(5).replace("-", "/")}
                {i.caster && <span className="ml-1 text-teal-600 dark:text-teal-400">· {i.caster}</span>}
                {i.weather && <span className="ml-1">／{i.weather}</span>}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* もっと見る / さらに読み込む */}
      {index && (
        <div className="mt-6 flex flex-col items-center gap-3">
          {limit < filtered.length && (
            <button onClick={() => setLimit((l) => l + PAGE)}
              className="rounded-lg border border-neutral-300 px-5 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
              もっと見る（残り {(filtered.length - limit).toLocaleString()} 件）
            </button>
          )}
          {!allLoaded && (
            <button onClick={() => loadNext()} disabled={busy}
              className="text-sm text-neutral-500 hover:underline disabled:opacity-50">
              {busy ? "読み込み中…" : `さらに古い動画を読み込む（残り ${(index.total - items.length).toLocaleString()} 件）`}
            </button>
          )}
        </div>
      )}

      {index?.updated && <footer className="mt-8 text-center text-xs text-neutral-400">データ更新: {index.updated} ／ 出典: ウェザーニュース公式 / YouTube</footer>}
    </div>
  );
}
