// 「表示設定」: カードに出す追加情報（公開日時・配信時刻・長さ）のオン/オフ。
// 閲覧者ごとの好みなので localStorage に保存し、同じページ内の各一覧へはイベントで即時反映する。
// 日時データ（wn-yt/times.json・圧縮後約0.8MB）は、どれかをオンにしたときだけ読み込む。
import { useEffect, useState } from "react";

export type Display = { pub: boolean; live: boolean; dur: boolean };
export const DISPLAY_ITEMS: [keyof Display, string, string][] = [
  ["pub", "公開日時", "YouTubeで公開された日時"],
  ["live", "配信時刻", "ライブ配信の開始〜終了の日時"],
  ["dur", "長さ", "配信・動画の長さ"],
];
const KEY = "wn-display";
const EVENT = "wn-display-change";
const OFF: Display = { pub: false, live: false, dur: false };

function read(): Display {
  try { return { ...OFF, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return OFF; }
}

export function useDisplay(): [Display, (d: Display) => void] {
  const [d, setD] = useState<Display>(OFF);
  useEffect(() => {
    setD(read());
    const on = () => setD(read());
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);   // 別タブで変えたときも追従
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener("storage", on); };
  }, []);
  const save = (next: Display) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 保存できなくてもこの画面では反映 */ }
    setD(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [d, save];
}

// times.json: { id: 公開分 | [公開分, 開始-公開, 終了-開始] }（分=Unix分）。build-yt.mjs の encT と対応。
type Times = Map<string, [number, number, number]>;
let timesPromise: Promise<Times> | null = null;
function loadTimes(base: string): Promise<Times> {
  timesPromise ??= fetch(`${base}wn-yt/times.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((o: Record<string, number | number[]>) => {
      const m: Times = new Map();
      for (const [id, v] of Object.entries(o)) {
        if (typeof v === "number") m.set(id, [v, 0, 0]);
        else if (v[0]) m.set(id, [v[0], v[0] + v[1], v[2] ? v[0] + v[1] + v[2] : 0]);
      }
      return m;
    })
    .catch(() => new Map());
  return timesPromise;
}

export function useTimes(base: string, enabled: boolean) {
  const [t, setT] = useState<Times | null>(null);
  useEffect(() => {
    if (!enabled || t) return;
    let alive = true;
    loadTimes(base).then((m) => { if (alive) setT(m); });
    return () => { alive = false; };
  }, [base, enabled, t]);
  return t;
}

const fmt = (min: number, withDate = true) =>
  new Date(min * 60000).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    ...(withDate ? { year: "numeric", month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit", minute: "2-digit",
  });
const sameDay = (a: number, b: number) => fmt(a).slice(0, 10) === fmt(b).slice(0, 10);
export function durLabel(sec: number) {
  if (sec <= 0) return "";
  const m = Math.round(sec / 60);
  if (m < 1) return `${sec}秒`;
  return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ""}` : `${m}分`;
}

// カード下部に出す日時の行。sec（動画の長さ）が分かっていればそれを、無ければ配信の開始〜終了から長さを出す。
export function TimeInfo({ id, d, times, sec = 0, hideDur = false }:
  { id: string; d: Display; times: Times | null; sec?: number; hideDur?: boolean }) {
  if (!d.pub && !d.live && !d.dur) return null;
  if (!times) return <div className="text-[11px] text-neutral-400">日時を読み込み中…</div>;
  const t = times.get(id);
  const [pub, start, end] = t || [0, 0, 0];
  const len = sec || (start && end ? (end - start) * 60 : 0);
  const rows: [string, string][] = [];
  if (d.pub && pub) rows.push(["公開", fmt(pub)]);
  if (d.live && start) rows.push(["配信", `${fmt(start)}〜${end ? fmt(end, !sameDay(start, end)) : ""}`]);
  // 配信の開始・終了（分単位）から出した長さは「約」を付ける
  if (d.dur && !hideDur && len) rows.push(["長さ", (sec ? "" : "約") + durLabel(len)]);
  if (!rows.length) return t ? null : <div className="text-[11px] text-neutral-400">日時データなし</div>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-[11px] leading-5 text-neutral-500 tabular-nums">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-400">{k}</dt><dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
