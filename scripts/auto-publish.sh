#!/bin/sh
# ClaudeOps が自動更新する wn-broadcasts.csv から放送データを再生成し、
# 変化があれば commit & push する（push をトリガーに GitHub Pages が自動再デプロイ）。
# launchd から毎日実行する想定。Mac が起動している日に最新化される。
set -e
NODE=/Users/unknown1/.nvm/versions/node/v26.2.0/bin/node
GIT=/usr/bin/git
REPO=/Users/unknown1/Documents/wn-archive
LOG="$REPO/auto-publish.log"

cd "$REPO" || exit 1
echo "[$(date '+%F %T')] auto-publish 開始" >> "$LOG"

"$NODE" scripts/build-data.mjs >> "$LOG" 2>&1 || { echo "  データ生成スキップ/失敗" >> "$LOG"; exit 0; }

if "$GIT" diff --quiet -- public/broadcasts.json src/data/meta.json; then
  echo "  変更なし" >> "$LOG"
  exit 0
fi

"$GIT" add public/broadcasts.json src/data/meta.json
"$GIT" commit -q -m "data: 放送データ自動更新 $(date +%F)"
"$GIT" push -q origin main >> "$LOG" 2>&1 && echo "  push 完了 → サイト再デプロイ" >> "$LOG"
