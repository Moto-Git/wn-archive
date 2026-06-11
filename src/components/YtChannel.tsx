import { useEffect, useMemo, useState } from "react";

type Item = { id: string; title: string; date: string; type: string; sec: number };
type Feed = { updated: string; items: Item[] };

const TABS: [string, string][] = [
  ["all", "すべて"], ["video", "動画"], ["short", "ショート"], ["live", "ライブ"],
];
const BADGE: Record<string, string> = {
  video: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  short: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
  live: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
const LABEL: Record<string, string> = { video: "動画", short: "ショート", live: "ライブ" };
const PAGE = 48;

function dur(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                 : `${m}:${String(s).padStart(2, "0")}`;
}

export default function YtChannel() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [tab, setTab] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}wn-youtube.json`)
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setFeed({ updated: "", items: [] }));
  }, []);

  const items = useMemo(
    () => (feed?.items ?? []).filter((i) => tab === "all" || i.type === tab),
    [feed, tab]
  );
  const count = (t: string) => (feed?.items ?? []).filter((i) => i.type === t).length;
  const shown = items.slice(0, limit);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <header className="mb-6">
        <a href={import.meta.env.BASE_URL} className="text-sm text-neutral-500 hover:underline">← アーカイブに戻る</a>
        <h1 className="mt-1 text-2xl font-medium">公式YouTube</h1>
        <p className="text-sm text-neutral-500">ウェザーニュース公式チャンネルの動画・ショート・ライブ</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setLimit(PAGE); }}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              tab === k
                ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}>
            {label}{k !== "all" && feed ? `（${count(k)}）` : ""}
          </button>
        ))}
      </div>

      {!feed ? (
        <p className="text-sm text-neutral-500">読み込み中…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((i) => (
            <a key={i.id} href={`https://www.youtube.com/watch?v=${i.id}`} target="_blank" rel="noreferrer"
               className="overflow-hidden rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
                <img loading="lazy" src={`https://i.ytimg.com/vi/${i.id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs ${BADGE[i.type]}`}>{LABEL[i.type]}</span>
                {i.sec > 0 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 text-xs text-white">{dur(i.sec)}</span>}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-sm">{i.title}</p>
                <p className="mt-1 text-xs text-neutral-400">{i.date?.slice(5).replace("-", "/")}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      {feed && limit < items.length && (
        <div className="mt-6 text-center">
          <button onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-neutral-300 px-5 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
            もっと見る（残り {(items.length - limit).toLocaleString()} 件）
          </button>
        </div>
      )}

      {feed?.updated && <footer className="mt-8 text-center text-xs text-neutral-400">データ更新: {feed.updated}</footer>}
    </div>
  );
}
