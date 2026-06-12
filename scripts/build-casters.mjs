// ウェザーニュース公式のキャスタープロフィール（一次情報）を取得し src/data/caster-profiles.json に出力。
// 一覧 https://weathernews.jp/wnl/caster/index.html → 各 /caster/{code}.html。
// 取得失敗・ページ未変更でも壊れないよう、失敗時は既存JSONを維持。
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, "../src/data/caster-profiles.json");
const INDEX = "https://weathernews.jp/wnl/caster/index.html";
const BASE = "https://weathernews.jp/wnl/caster/";

const get = (url) => fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
const clean = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const m1 = (re, s) => { const m = re.exec(s); return m ? m[1].trim() : ""; };

async function main() {
  let idx;
  try { idx = await get(INDEX); }
  catch (e) { console.log("! 一覧取得失敗。既存を維持:", e.message); return; }

  const codes = [...new Set([...idx.matchAll(/caster\/([a-z0-9_]+)\.html/g)].map((m) => m[1]))]
    .filter((c) => c !== "index");

  const profiles = {};
  for (const code of codes) {
    try {
      const h = await get(BASE + code + ".html");
      const t = clean(h);
      const title = m1(/<title>([^<|]+)/, h);
      const name = title.split("（")[0].trim();
      if (!name) continue;
      const sns = {};
      const x = m1(/(https?:\/\/(?:x|twitter)\.com\/[A-Za-z0-9_]+)/, h);
      const ig = m1(/(https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+)/, h);
      const tt = m1(/(https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+)/, h);
      const yt = m1(/(https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/)[^"'<> ]+)/, h);
      if (x) sns.x = x;
      if (ig) sns.instagram = ig;
      if (tt) sns.tiktok = tt;
      if (yt) sns.youtube = yt;
      profiles[name.replace(/\s/g, "")] = {
        code, name,
        kana: m1(/（([^）]+)）/, title),
        photo: m1(/og:image" content="([^"]+)"/, h),
        birthday: m1(/生年月日\s*([0-9/]+)/, t),
        blood: m1(/血液型\s*([^\s]+型)/, t),
        birthplace: m1(/出身地\s*(.+?)\s*(?:趣味|血液型|星座|more)/, t),
        hobby: m1(/趣味・特技\s*(.+?)\s*(?:more info|お仕事|X |Instagram|TikTok)/, t),
        sns,
        url: BASE + code + ".html",
      };
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.log(`! ${code} 失敗:`, e.message);
    }
  }

  if (!Object.keys(profiles).length) {
    if (existsSync(OUT)) { console.log("! 取得0件。既存JSONを維持。"); return; }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(profiles));
  console.log(`✓ キャスタープロフィール ${Object.keys(profiles).length}名 → ${OUT}`);
}
main();
