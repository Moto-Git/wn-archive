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

const raw = readFileSync(CSV, "utf8");
const [header, ...lines] = parseCsv(raw);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const broadcasts = lines
  .filter((r) => r[idx.video_id])
  .map((r) => ({
    date: r[idx.date],
    slot: r[idx.slot],
    program: r[idx.program],
    caster: r[idx.caster],
    weather: r[idx.weather_caster],
    kind: r[idx.kind] || "live",
    video: r[idx.video_id],
    title: r[idx.title],
  }))
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slot < b.slot ? 1 : -1));

// 集計（キャスター出演数・年一覧）
const casterCount = {};
const years = new Set();
for (const b of broadcasts) {
  if (b.caster) casterCount[b.caster] = (casterCount[b.caster] || 0) + 1;
  years.add(b.date.slice(0, 4));
}
const meta = {
  total: broadcasts.length,
  days: new Set(broadcasts.map((b) => b.date)).size,
  rugby: broadcasts.filter((b) => b.kind === "rugby").length,
  years: [...years].sort().reverse(),
  casters: Object.entries(casterCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count })),
  updated: new Date().toISOString().slice(0, 10),
};

// 大きい放送配列は public/ に置きクライアントで非同期fetch。metaは小さいのでビルド時import。
const dataOut = resolve(__dir, "../public/broadcasts.json");
const metaOut = resolve(__dir, "../src/data/meta.json");
mkdirSync(dirname(dataOut), { recursive: true });
mkdirSync(dirname(metaOut), { recursive: true });
writeFileSync(dataOut, JSON.stringify(broadcasts));
writeFileSync(metaOut, JSON.stringify(meta));
console.log(`✓ ${broadcasts.length} 件 / ${meta.days} 日 / キャスター${meta.casters.length}名`);
console.log(`  → ${dataOut}`);
console.log(`  → ${metaOut}`);
