# ウェザーニュースLiVE アーカイブ

ウェザーニュースLiVE の放送を **キャスター・番組・日付・種別** で検索できる静的アーカイブサイト。
ClaudeOps で蓄積した `wn-broadcasts.csv`（約9,000件・2022年〜）を最善に活かすためのフロントエンド。

- **Astro + React island + Tailwind v4**（バックエンド不要の静的SPA）
- 放送データはビルド時に CSV→JSON 変換。検索・絞り込みはすべてブラウザ側で完結
- 検索: キャスター名 / フィルタ: 種別(通常LIVE・ラグビー特番) × 番組 × 年

## セットアップ

```bash
npm install
npm run dev      # http://localhost:4321
```

`predev` / `prebuild` で自動的に `scripts/build-data.mjs` が走り、CSV からデータを生成します。

## データの生成元

`scripts/build-data.mjs` が CSV を読み、以下を出力します。

- `public/broadcasts.json` … 全放送（クライアントで非同期fetch）
- `src/data/meta.json` … 集計（総数・キャスター一覧・年一覧）

CSV の場所は以下の順で解決（既定は ClaudeOps のパス）:

```bash
node scripts/build-data.mjs /path/to/wn-broadcasts.csv   # 引数で指定
WN_CSV=/path/to/wn-broadcasts.csv npm run data            # 環境変数で指定
```

## ビルド & デプロイ

```bash
npm run build    # dist/ に静的書き出し
npm run preview  # 本番ビルドをローカル確認
```

`dist/` をそのまま **Cloudflare Pages / Vercel / GitHub Pages** に置くだけで公開できます（無料・サーバー不要）。

### 自動更新（推奨）

ClaudeOps 側のクラウド cron が CSV を毎日更新しているので、次のいずれかで自動公開できます。

1. ClaudeOps の CSV を本リポジトリに取り込み（submodule か CI のコピー）
2. push をトリガーに Cloudflare Pages / Vercel が再ビルド → 自動デプロイ

## ロードマップ

- [x] MVP: カード一覧＋種別/番組/年フィルタ＋キャスター検索
- [ ] 日別ビュー（カレンダー）
- [ ] キャスター別ページ（出演履歴・共演お天気キャスター・統計）
- [ ] ラグビー特番アーカイブ専用ビュー
- [ ] 統計ダッシュボード（出演ランキング・年別推移・ペア分析）
- [ ] あいまい検索（Fuse.js）・仮想スクロール（TanStack Virtual）

## 構成

```
scripts/build-data.mjs               CSV → JSON 変換
src/data/meta.json                   集計（ビルド時import）
public/broadcasts.json               全放送（実行時fetch）
src/components/BroadcastArchive.tsx   検索・絞り込みUI（React island）
src/pages/index.astro                トップページ
```
