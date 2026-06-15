import { useEffect, useMemo, useState } from "react";

type Item = { source: string; platform: string; title: string; url: string; thumb?: string; date: string };
type Feed = { updated: string; items: Item[] };

const PLATFORMS: Record<string, { label: string; cls: string }> = {
  youtube: { label: "YouTube", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  site: { label: "公式サイト", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
};

function dateLabel(d: string) {
  const t = new Date(d);
  return isNaN(+t) ? d?.slice(0, 10) ?? "" : `${t.getMonth() + 1}/${t.getDate()}`;
}

export default function UpdatesFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [plat, setPlat] = useState("all");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}updates.json`)
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setFeed({ updated: "", items: [] }));
  }, []);

  const items = useMemo(
    () => (feed?.items ?? []).filter((i) => plat === "all" || i.platform === plat),
    [feed, plat]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <header className="mb-6">
        <h1 className="text-2xl font-medium">更新情報</h1>
        <p className="text-sm text-neutral-500">ウェザーニュースの公式サイト・YouTube の新着</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {[["all", "すべて"], ["site", "公式サイト"], ["youtube", "YouTube"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPlat(k)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              plat === k
                ? "border-neutral-400 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!feed ? (
        <p className="text-sm text-neutral-500">読み込み中…</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {items.map((i, n) => {
            const p = PLATFORMS[i.platform] ?? { label: i.platform, cls: "bg-neutral-100 text-neutral-700" };
            return (
              <li key={i.url + n}>
                <a href={i.url} target="_blank" rel="noreferrer"
                   className="flex items-center gap-3 py-3 hover:opacity-80">
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${p.cls}`}>{p.label}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{i.title}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{dateLabel(i.date)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-1 font-medium text-neutral-700 dark:text-neutral-300">X（Twitter）・Instagram は準備中</div>
        無料で安定して取得できる手段が現状ないため未対応です。キャスター個人のYouTubeチャンネルは順次追加予定です。
      </div>

      {feed?.updated && (
        <footer className="mt-6 text-center text-xs text-neutral-400">データ更新: {feed.updated}</footer>
      )}
    </div>
  );
}
