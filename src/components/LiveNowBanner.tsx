import { useEffect, useState } from "react";

// 現在LIVE中・配信予定のスナップショット（build-yt が wn-yt/live-now.json に出力）。
type LiveItem = { id: string; title: string; scheduled: string; started: string; viewers: number };
type LiveNow = { checked: string; live: LiveItem[]; upcoming: LiveItem[] };

// JST の「M/D HH:MM」表記。
function jst(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// 経過/残り時間を「○日○時間」「○時間○分」「○分」で表す。
function span(ms: number) {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), mm = min % 60;
  if (d > 0) return `${d}日${h}時間`;
  if (h > 0) return `${h}時間${mm}分`;
  return `${mm}分`;
}

// LiVEアーカイブ／YouTubeライブページ共通の「今LIVE中・配信予定」バナー。
// 配信予定は閲覧時のブラウザ現在時刻と比較してカウントダウン表示する。
export default function LiveNowBanner({ base }: { base: string }) {
  const [data, setData] = useState<LiveNow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    fetch(`${base}wn-yt/live-now.json`)
      .then((r) => { if (!r.ok) throw 0; return r.json(); })
      .then((d: LiveNow) => { if (alive) setData(d); })
      .catch(() => { /* 無ければ非表示で続行 */ });
    return () => { alive = false; };
  }, [base]);

  useEffect(() => {
    const h = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(h);
  }, []);

  const live = data?.live ?? [];
  const upcoming = data?.upcoming ?? [];
  if (live.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      {live.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600 dark:bg-red-400" />
            今LIVE中（{live.length}）
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((v) => (
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

      {upcoming.length > 0 && (
        <>
          <div className="mb-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            配信予定（{upcoming.length}）
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((v) => {
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

      {data?.checked && (
        <p className="mt-3 text-[11px] text-neutral-400">
          最終確認: {jst(data.checked)}（LIVE中の状況は自動更新が1日1回のため、実際とずれる場合があります）
        </p>
      )}
    </div>
  );
}
