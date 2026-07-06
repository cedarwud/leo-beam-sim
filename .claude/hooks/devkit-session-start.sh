#!/usr/bin/env bash
# devkit SessionStart hook — 抽查種子預生成＋版本比對＋提案庫提醒＋待決事項提醒
# 設計原則：靜默（沒事不輸出）、快（<1s）、缺 devkit-local（新機器/未建置）直接安靜退出。
# stdout（exit 0）會進 Claude context——只輸出有行動意義的單行提醒。
# 簡化註記：提案庫「最舊逾 30 天」的檢查由 leo-pipeline 開場儀式負責，本 hook 只查條數（≥3）。
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DK="$ROOT/.claude/devkit-local"
[ -d "$DK" ] || exit 0

IN="$(cat 2>/dev/null || true)"
SID="$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "$SID" ] || SID="unknown-$$"

# 1) 抽查種子：每 session 一顆，寫入後 controller 只讀不改（藍圖 §8 亂數源釘在 agent 之外）
SEED_FILE="$DK/spot-check.json"
if [ ! -f "$SEED_FILE" ] || ! grep -q "\"session\": \"$SID\"" "$SEED_FILE" 2>/dev/null; then
  SEED="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  printf '{"session": "%s", "seed": "%s", "generated_at": "%s"}\n' "$SID" "$SEED" "$(date -Is)" > "$SEED_FILE"
fi

OUT=""

# 2) 版本比對（只提醒，不改裝）
STATE="$DK/pipeline-state.json"
SKILL_MD="$HOME/.claude/skills/ai-devkit/SKILL.md"
if [ -f "$STATE" ] && [ -f "$SKILL_MD" ]; then
  IV="$(sed -n 's/.*"devkit_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$STATE" | head -1)"
  PV="$(sed -n 's/^版本：\([0-9][0-9.]*\).*/\1/p' "$SKILL_MD" | head -1)"
  if [ -n "$IV" ] && [ -n "$PV" ] && [ "$IV" != "$PV" ]; then
    OUT="${OUT}[devkit] 安裝版 v${IV} 與套件版 v${PV} 不一致：安裝版較舊→說「跑 devkit 同步」；套件版較舊→git -C ~/papers/ai-devkit pull 後重跑 install.sh\n"
  fi
fi

# 3) 提案庫條數
PROP="$DK/devkit-proposals.md"
if [ -f "$PROP" ]; then
  N="$(grep -c '狀態：未處理' "$PROP" 2>/dev/null || true)"
  case "$N" in (''|*[!0-9]*) N=0;; esac
  if [ "$N" -ge 3 ]; then
    OUT="${OUT}[devkit] 提案庫有 ${N} 條未處理，說「彙整 devkit 提案」收一輪\n"
  fi
fi

# 4) 待決 gate_requests／抽查 due（需要 python3；沒有就留給 pipeline 開場儀式）
if command -v python3 >/dev/null 2>&1 && [ -f "$STATE" ]; then
  P="$(python3 - "$STATE" 2>/dev/null <<'PYEOF'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    g = len(d.get("gate_requests") or [])
    s = len((d.get("spot_check") or {}).get("due") or [])
    if g or s:
        print(f"[devkit] 待決事項：gate_requests={g}、抽查 due={s}——說「跑 pipeline」上桌處理")
except Exception:
    pass
PYEOF
)"
  [ -n "$P" ] && OUT="${OUT}${P}\n"
fi

[ -n "$OUT" ] && printf '%b' "$OUT"
exit 0
