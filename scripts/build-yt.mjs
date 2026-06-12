// ウェザーニュース公式YouTubeチャンネルの全動画を「動画/ショート/ライブ」に分類し、
// type別にチャンク分割して public/wn-yt/ に書き出す。
//   public/wn-yt/{type}.json        … index（総数・チャンク一覧）
//   public/wn-yt/{type}-000.json …  各 CHUNK 件の配列（新しい順）
// 差分更新: scripts/.cache/wn-yt-all.json（全件キャッシュ・gitignore）を基準に
//   uploads playlist 先頭から新規IDのみ取得。既知IDに連続ヒットで早期停止。
//   --full で全件を強制再取得（初回バックフィル）。
// APIキー: 環境変数 YT_API_KEY → ~/ClaudeOps/.env の CLAUDE_OPS_YOUTUBE_API_KEY の順。
//   キーが無ければ既存の出力を維持してスキップ（CIでキー未設定でも壊れない）。
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dir, "../public/wn-yt");
const CACHE = resolve(__dir, ".cache/wn-yt-all.json");
const CHANNEL = "UCNsidkYpIAQ4QaufptQBPHQ";
const CHUNK = 500;                        // 1チャンクの件数
const TYPES = ["video", "short", "live"];
const FULL = process.argv.includes("--full");
const STOP_AFTER = 60;                     // 差分時、既知IDに連続ヒットしたら停止する本数

function apiKey() {
  if (process.env.YT_API_KEY) return process.env.YT_API_KEY.trim();
  const env = join(homedir(), "ClaudeOps", ".env");
  if (existsSync(env)) {
    for (const line of readFileSync(env, "utf8").split("\n"))
      if (line.startsWith("CLAUDE_OPS_YOUTUBE_API_KEY"))
        return line.split("=")[1].trim().replace(/["']/g, "");
  }
  return "";
}
const KEY = apiKey();

async function api(ep, params) {
  const u = `https://www.googleapis.com/youtube/v3/${ep}?` +
    new URLSearchParams({ ...params, key: KEY });
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${ep} ${r.status}: ${await r.text()}`);
  return r.json();
}

function durationSec(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

function loadCache() {
  if (!FULL && existsSync(CACHE)) {
    try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { /* 壊れていれば作り直す */ }
  }
  return { items: [] };
}

// uploads playlist を辿って動画IDを集める。
// 差分モードでは既知IDに STOP_AFTER 本連続でヒックしたら早期停止。
async function collectIds(uploads, known) {
  const ids = [];
  let token = "", hitStreak = 0;
  for (;;) {
    const d = await api("playlistItems", {
      part: "contentDetails", playlistId: uploads, maxResults: "50",
      ...(token ? { pageToken: token } : {}),
    });
    for (const it of d.items || []) {
      const id = it.contentDetails.videoId;
      if (known.has(id)) {
        if (++hitStreak >= STOP_AFTER && !FULL) return { ids, partial: true };
        continue;
      }
      hitStreak = 0;
      ids.push(id);
    }
    token = d.nextPageToken || "";
    if (!token) break;
  }
  return { ids, partial: false };
}

// videos.list で詳細を取得して {id,title,date,type,sec} に整形。
async function fetchDetails(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await api("videos", {
      part: "snippet,contentDetails,liveStreamingDetails",
      id: ids.slice(i, i + 50).join(","),
    });
    for (const v of d.items || []) {
      const live = !!v.liveStreamingDetails;
      const sec = durationSec(v.contentDetails?.duration);
      // ショートは duration 近似（API はショートを区別しない）: 1〜60秒を short 扱い。
      const type = live ? "live" : sec > 0 && sec <= 60 ? "short" : "video";
      out.push({
        id: v.id,
        title: v.snippet.title,
        date: (v.liveStreamingDetails?.actualStartTime || v.snippet.publishedAt || "").slice(0, 10),
        type,
        sec,
      });
    }
    if ((i / 50) % 10 === 0) process.stdout.write(`\r  詳細取得 ${Math.min(i + 50, ids.length)}/${ids.length}`);
  }
  if (ids.length) process.stdout.write("\n");
  return out;
}

// type別に新しい順でチャンク分割して書き出す。既存の {type}-*.json は一掃してから出す。
function emit(all) {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) {
    if (/^(video|short|live)(-\d+)?\.json$/.test(f)) rmSync(join(OUT_DIR, f));
  }
  const updated = new Date().toISOString().slice(0, 16);
  const summary = {};
  for (const type of TYPES) {
    const items = all.filter((x) => x.type === type)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const chunks = [];
    for (let i = 0; i < items.length; i += CHUNK) {
      const part = items.slice(i, i + CHUNK);
      const file = `${type}-${String(chunks.length).padStart(3, "0")}.json`;
      writeFileSync(join(OUT_DIR, file), JSON.stringify(part));
      chunks.push({ file, n: part.length, from: part[0]?.date || "", to: part.at(-1)?.date || "" });
    }
    writeFileSync(join(OUT_DIR, `${type}.json`),
      JSON.stringify({ updated, type, total: items.length, chunkSize: CHUNK, chunks }));
    summary[type] = items.length;
  }
  return summary;
}

async function main() {
  if (!KEY) {
    console.log("! YouTube APIキー未設定。wn-yt は既存出力を維持してスキップ。");
    return;
  }
  const cache = loadCache();
  const byId = new Map(cache.items.map((x) => [x.id, x]));
  const uploads = "UU" + CHANNEL.slice(2);

  console.log(FULL ? "● フルバックフィル（全件取得）" : `● 差分更新（キャッシュ ${byId.size} 件）`);
  const { ids, partial } = await collectIds(uploads, FULL ? new Set() : new Set(byId.keys()));
  console.log(`  新規ID ${ids.length} 件${partial ? "（既知ヒットで早期停止）" : ""}`);

  if (ids.length) {
    const fresh = await fetchDetails(ids);
    for (const it of fresh) byId.set(it.id, it);
  }

  const all = [...byId.values()];
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify({ updated: new Date().toISOString(), items: all }));

  const summary = emit(all);
  console.log(`✓ wn-yt 出力: 動画${summary.video} / ショート${summary.short} / ライブ${summary.live}（計${all.length}） → ${OUT_DIR}`);
}
main().catch((e) => { console.error("✗ build-yt 失敗:", e.message); process.exit(1); });
