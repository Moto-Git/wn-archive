// ウェザーニュースの「更新情報」フィードを集めて public/updates.json に書き出す。
// 確実・無料に取れるソースのみ（公式YouTube RSS / 公式サイトtopics JSON）。
// X・Instagram は無料での安定取得手段が無いため取得しない（UI側で「準備中」表示）。
// ネットワーク失敗は致命的にしない（既存 updates.json を保つ）。
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, "../public/updates.json");

const SOURCES = [
  { source: "ウェザーニュース公式", platform: "youtube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCNsidkYpIAQ4QaufptQBPHQ" },
  // キャスター個人YouTubeチャンネルはここに追加（{ source:"檜山沙耶", platform:"youtube", url:"...RSS..." }）
];
const TOPICS = "https://mws.cdn.weathernews.jp/s/topics/json/rec_ch_zero.json";

const unescape = (s) =>
  (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function fetchYouTube(src) {
  const xml = await (await fetch(src.url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const items = [];
  for (const e of xml.split("<entry>").slice(1)) {
    const id = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
    const title = unescape((e.match(/<title>(.*?)<\/title>/) || [])[1]);
    const date = (e.match(/<published>(.*?)<\/published>/) || [])[1];
    if (id && title)
      items.push({ source: src.source, platform: "youtube", title,
        url: `https://www.youtube.com/watch?v=${id}`, thumb: id, date });
  }
  return items.slice(0, 15);
}

async function fetchTopics() {
  const arr = await (await fetch(TOPICS, { headers: { "User-Agent": "Mozilla/5.0" } })).json();
  return arr.map((t) => ({
    source: "ウェザーニュース公式", platform: "site",
    title: (t.title || "").trim(),
    url: `https://weathernews.jp${t.url}`,
    thumb: t.thumb_img || "",
    date: (t.edit_tstr || "").replace(/\./g, "-").replace(" ", "T"),
  }));
}

async function main() {
  const all = [];
  for (const s of SOURCES) {
    try { all.push(...(await fetchYouTube(s))); }
    catch (e) { console.log(`! ${s.source} 取得失敗: ${e.message}`); }
  }
  try { all.push(...(await fetchTopics())); }
  catch (e) { console.log(`! topics 取得失敗: ${e.message}`); }

  if (!all.length) {
    if (existsSync(OUT)) { console.log("! 取得0件。既存 updates.json を維持。"); return; }
    all.push();
  }
  all.sort((a, b) => (a.date < b.date ? 1 : -1));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 16), items: all }));
  console.log(`✓ 更新情報 ${all.length}件 → ${OUT}`);
}
main();
