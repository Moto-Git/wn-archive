// アーカイブ本体（BroadcastArchive）とキャスター別ページ（CasterDetail）で共有する表示部品。
import { useEffect, useRef, useState } from "react";

export type Broadcast = {
  date: string; slot: string; program: string;
  caster: string; weather: string; kind: string; video: string; title: string;
};

export const KIND_LABEL: Record<string, string> = {
  live: "LIVE", rugby: "ラグビー特番", event: "天体LIVE",
  hanabi: "花火", special: "特別番組", collab: "コラボ",
};
export const KIND_COLOR: Record<string, string> = {
  live:    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  rugby:   "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  event:   "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  hanabi:  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  special: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  collab:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};
// 通常LIVE以外のカードは種別色の縁取りで一覧の中から見つけやすくする。
export const KIND_BORDER: Record<string, string> = {
  rugby:   "border-orange-300 dark:border-orange-800",
  event:   "border-violet-300 dark:border-violet-800",
  hanabi:  "border-rose-300 dark:border-rose-800",
  special: "border-amber-300 dark:border-amber-800",
  collab:  "border-emerald-300 dark:border-emerald-800",
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];
export const weekday = (d: string) => WD[new Date(d + "T00:00:00").getDay()];

// サムネ左上の枠表示。「23:00 23:00」「特番 特番」のような重複は片方だけにする。
export const slotLabel = (b: Broadcast) =>
  !b.program || b.slot === b.program ? b.slot : `${b.slot} ${b.program}`;

// 定型の枠（【LIVE】/最新天気ニュース・地震情報/日付/〈ウェザーニュースLiVE…〉/#タグ）を外して、その回の見出しだけ残す。
const FRAME = [
  /[〈＜<][^〈＜<〉＞>]*ウェザーニュースLiVE[^〉＞>]*[〉＞>]?/g,          // 〈ウェザーニュースLiVEムーン・…〉
  /ウェザーニュースLiVE[^〉＞>]*[〉＞>]/g,                              // 開き括弧が欠けた版
  /#\S+/g,                                                             // #防災DAY
  /^[^【]{0,8}?【(?:LIVE|ライブ|アーカイブ|archives)[^】]{0,8}】/i,       // 【LIVE】【ライブ配信済み】など配信状態の見出し
  /(?:[朝昼夜]の)?(?:最新|最近)?(?:天気|気象|台風[0-9０-９]+号)?(?:ニュース)?[・／/]?(?:台風[0-9０-９]+号・)?(?:地震|気象)・?(?:気象|地震)?情報/g,
  /天気解説/g,
  /(?:\d{4}年\s*\d{1,2}月|\d{1,2}月|\d{4}\.\d{1,2}\.)\s*\d{1,2}日?\s*(?:[(（][^)）]*[)）])?(?:\s*→\s*(?:\d{1,2}月)?\d{1,2}日?\s*[(（][^)）]*[)）])?(?:\s*\d{1,2}:\d{2}(?:\s*[〜~]\s*(?:\d{1,2}日\s*[(（][^)）]*[)）]\s*)?(?:\d{1,2}(?::\d{2}|時))?)?)?/g,
  /^\s*\d{1,2}:\d{2}\s*〜/,
  /ウェザーニュースLiVE/g,
];
export function shortTitle(t = ""): string {
  let s = t;
  for (const re of FRAME) s = s.replace(re, " ");
  return s.replace(/[\s　]*[／/][\s　／/]*/g, "／").replace(/[\s　]+/g, " ")
    .replace(/^[\s／]+|[\s／]+$/g, "");
}

// 検索語に一致した部分を <mark> で強調（空白の有無は区別しない）。
export function Highlight({ text, q }: { text: string; q: string }) {
  const nq = q.replace(/\s/g, "");
  if (!nq) return <>{text}</>;
  // 検索語の各文字の間に空白を許す正規表現（「小林李衣奈」で「小林 李衣奈」にも当たる）
  const re = new RegExp(`(${[...nq].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*")})`, "g");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? <mark key={i} className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-700/60">{p}</mark> : p
      )}
    </>
  );
}

// 今LIVE中・配信予定（build-yt の live-now.json）。一覧のカードに「LIVE中」「配信予定」を付けるのに使う。
// スナップショットは古い場合があるので、配信予定は予定時刻が閲覧時点より未来のものだけ有効にする。
export function useLiveStatus(base: string) {
  const [status, setStatus] = useState<Map<string, { live: boolean; at: string }>>(new Map());
  useEffect(() => {
    fetch(`${base}wn-yt/live-now.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const m = new Map<string, { live: boolean; at: string }>();
        // 「LIVE中」は取得から3時間以内のスナップショットだけ信用する（古いと終了済みの配信に付いてしまう）
        if (Date.now() - Date.parse(d.checked) < 3 * 3600e3)
          for (const x of d.live || []) m.set(x.id, { live: true, at: x.started });
        for (const x of d.upcoming || [])
          if (x.scheduled && Date.parse(x.scheduled) > Date.now()) m.set(x.id, { live: false, at: x.scheduled });
        setStatus(m);
      })
      .catch(() => { /* 無ければ印なしで続行 */ });
  }, [base]);
  return status;
}

export const jstTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

// 一覧の末尾が見えたら onMore を呼ぶ（無限スクロール）。ボタンも残すのでキーボード操作でも進める。
export function useAutoMore(onMore: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onMore);
  cb.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) cb.current(); },
      { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
