// wn-broadcasts.csv → src/data/broadcasts.json（+ 集計）に変換するビルドスクリプト。
// 使い方: node scripts/build-data.mjs [CSVパス]
//   省略時は WN_CSV 環境変数 → ClaudeOps の既定パスの順で探す。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const CSV =
  process.argv[2] ||
  process.env.WN_CSV ||
  "/Users/unknown1/ClaudeOps/roles/publisher/output/watch-digest/wn-broadcasts.csv";

// CSVが無い環境（CIなど）ではコミット済みの生成データをそのまま使う。
if (!existsSync(CSV)) {
  console.log(`! CSVが見つかりません (${CSV})。コミット済みデータを使用します。`);
  process.exit(0);
}

// 最小CSVパーサ（カンマ区切り・ダブルクオート対応）
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// WN_FULL=1 のときだけ minorin 由来のキャスター対応を含む「フル版」を別ファイルに出す（ローカル専用）。
// 既定（公開ビルド）は一次情報源のみ: 動画タイトル(YouTube)＋公式取得(timetable.json)由来のキャスターだけ。
const FULL = process.env.WN_FULL === "1";

// ウェザーニュースの公式キャスター（公開情報）。動画タイトルからの抽出に使う。
const CASTERS = ["駒木 結衣", "戸北 美月", "小林 李衣奈", "小川 千奈", "魚住 茉由", "山岸 愛梨",
  "青原 桃香", "大島 璃音", "岡本 結子 リサ", "松雪 彩花", "高山 奈々", "江川 清音", "川畑 玲",
  "檜山 沙耶", "白井 ゆかり", "松本 真央", "内田 侑希", "田辺 真南葉", "福吉 貴文",
  "角田 奈緒子", "武藤 彩芽", "眞家 泉"];
const CASTER_NS = CASTERS.map((n) => [n.replace(/\s/g, ""), n]).sort((a, b) => b[0].length - a[0].length);

// タイトル(YouTube)に含まれる公式キャスター名を抽出（一次情報源）。無ければ空。
function casterFromTitle(title) {
  const t = (title || "").replace(/\s/g, "");
  for (const [ns, name] of CASTER_NS) if (t.includes(ns)) return name;
  return "";
}

const raw = readFileSync(CSV, "utf8");
const [header, ...lines] = parseCsv(raw);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
let broadcasts = lines
  .filter((r) => r[idx.video_id])
  .map((r) => {
    const source = r[idx.source];
    const rawCaster = r[idx.caster];
    // 公開: タイトル抽出 → 公式取得(official)のみ採用。minorin由来は出さない。
    const pubCaster = casterFromTitle(r[idx.title]) || (source === "official" ? rawCaster : "");
    const pubWeather = source === "official" ? r[idx.weather_caster] : "";
    return {
      date: r[idx.date],
      slot: r[idx.slot],
      program: r[idx.program],
      caster: FULL ? rawCaster : pubCaster,
      weather: FULL ? r[idx.weather_caster] : pubWeather,
      kind: r[idx.kind] || "live",
      video: r[idx.video_id],
      title: r[idx.title],
    };
  });

// specials.json（天体ライブ / 花火中継 / コラボ）をマージ
const specialsPath = resolve(__dir, "../src/data/specials.json");
if (existsSync(specialsPath)) {
  const specials = JSON.parse(readFileSync(specialsPath, "utf8"));
  const existingIds = new Set(broadcasts.map((b) => b.video));
  for (const s of specials) {
    if (existingIds.has(s.video)) continue; // CSV済みの動画は重複除外
    if (!FULL && s.source !== "official") continue; // 公開はofficial(天体/花火)のみ
    broadcasts.push({
      date: s.date,
      slot: s.slot || "",
      program: s.program,
      caster: casterFromTitle(s.title),
      weather: "",
      kind: s.kind,
      video: s.video,
      title: s.title,
    });
  }
}

broadcasts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slot < b.slot ? 1 : -1));

// 集計（キャスター出演数・予報士出演数・年一覧）
const casterCount = {};
const foreCount = {};
const years = new Set();
for (const b of broadcasts) {
  if (b.caster) casterCount[b.caster] = (casterCount[b.caster] || 0) + 1;
  if (b.weather) foreCount[b.weather] = (foreCount[b.weather] || 0) + 1;
  years.add(b.date.slice(0, 4));
}
const rank = (obj) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, slug: name.replace(/\s/g, "") }));
const meta = {
  total: broadcasts.length,
  days: new Set(broadcasts.map((b) => b.date)).size,
  rugby: broadcasts.filter((b) => b.kind === "rugby").length,
  event: broadcasts.filter((b) => b.kind === "event").length,
  hanabi: broadcasts.filter((b) => b.kind === "hanabi").length,
  special: broadcasts.filter((b) => b.kind === "special").length,
  collab: broadcasts.filter((b) => b.kind === "collab").length,
  years: [...years].sort().reverse(),
  casters: rank(casterCount),
  forecasters: rank(foreCount),
  updated: new Date().toISOString().slice(0, 10),
};

// 公開ビルド: broadcasts.json / meta.json（一次情報源のみ・コミット対象）
// フルビルド(WN_FULL=1): broadcasts-full.json / meta-full.json（minorin込み・gitignore・ローカル専用）
const dataOut = resolve(__dir, FULL ? "../public/broadcasts-full.json" : "../public/broadcasts.json");
const metaOut = resolve(__dir, FULL ? "../src/data/meta-full.json" : "../src/data/meta.json");
mkdirSync(dirname(dataOut), { recursive: true });
mkdirSync(dirname(metaOut), { recursive: true });
writeFileSync(dataOut, JSON.stringify(broadcasts));
writeFileSync(metaOut, JSON.stringify(meta));
console.log(`✓ ${FULL ? "[フル/ローカル専用] " : "[公開] "}${broadcasts.length} 件 / ${meta.days} 日 / キャスター${meta.casters.length}名`);
console.log(`  → ${dataOut}`);
console.log(`  → ${metaOut}`);
