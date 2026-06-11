// ウェザーニュース公式YouTubeチャンネルの新着を「動画/ショート/ライブ」に分類して
// public/wn-youtube.json に書き出す。uploadsプレイリスト＋videos.list を使用。
// APIキー: 環境変数 YT_API_KEY → ~/ClaudeOps/.env の CLAUDE_OPS_YOUTUBE_API_KEY の順。
// キーが無ければ既存JSONを維持してスキップ（CIでキー未設定でも壊れない）。
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, "../public/wn-youtube.json");
const CHANNEL = "UCNsidkYpIAQ4QaufptQBPHQ";
const PAGES = 4; // 50件×4 ≈ 直近200本

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
  return r.json();
}

function durationSec(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

async function main() {
  if (!KEY) {
    console.log("! YouTube APIキー未設定。wn-youtube.json はスキップ。");
    return;
  }
  const uploads = "UU" + CHANNEL.slice(2);
  const ids = [];
  let token = "";
  for (let p = 0; p < PAGES; p++) {
    const d = await api("playlistItems", {
      part: "contentDetails", playlistId: uploads, maxResults: "50",
      ...(token ? { pageToken: token } : {}),
    });
    for (const it of d.items || []) ids.push(it.contentDetails.videoId);
    token = d.nextPageToken || "";
    if (!token) break;
  }

  const items = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await api("videos", {
      part: "snippet,contentDetails,liveStreamingDetails",
      id: ids.slice(i, i + 50).join(","),
    });
    for (const v of d.items || []) {
      const live = !!v.liveStreamingDetails;
      const sec = durationSec(v.contentDetails?.duration);
      const type = live ? "live" : sec > 0 && sec <= 60 ? "short" : "video";
      items.push({
        id: v.id,
        title: v.snippet.title,
        date: (v.liveStreamingDetails?.actualStartTime || v.snippet.publishedAt || "").slice(0, 10),
        type,
        sec,
      });
    }
  }
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 16), items }));
  const n = (t) => items.filter((x) => x.type === t).length;
  console.log(`✓ YouTube ${items.length}本（動画${n("video")}/ショート${n("short")}/ライブ${n("live")}） → ${OUT}`);
}
main();
