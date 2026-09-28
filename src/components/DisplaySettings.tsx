import { useEffect, useRef, useState } from "react";
import { DISPLAY_ITEMS, useDisplay } from "../lib/display";

// ヘッダー右端の「表示設定」。カードに出す追加情報をチェックで切り替える（全ページ共通・この端末に保存）。
export default function DisplaySettings() {
  const [d, save] = useDisplay();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const count = DISPLAY_ITEMS.filter(([k]) => d[k]).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
          count ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                : "text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-neutral-800/60"}`}
      >
        <span aria-hidden>⚙︎</span>表示設定{count > 0 && <span className="text-xs">（{count}）</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="表示設定"
          className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <p className="mb-2 text-xs text-neutral-500">カードに表示する情報</p>
          <div className="flex flex-col gap-1">
            {DISPLAY_ITEMS.map(([k, label, hint]) => (
              <label key={k} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <input type="checkbox" checked={d[k]} onChange={(e) => save({ ...d, [k]: e.target.checked })}
                  className="mt-0.5 accent-sky-600" />
                <span className="text-sm">
                  {label}
                  <span className="block text-[11px] text-neutral-400">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 border-t border-neutral-100 pt-2 text-[11px] leading-relaxed text-neutral-400 dark:border-neutral-800">
            オンにすると日時データ（約0.8MB）を読み込みます。設定はこの端末のブラウザに保存されます。
          </p>
        </div>
      )}
    </div>
  );
}
