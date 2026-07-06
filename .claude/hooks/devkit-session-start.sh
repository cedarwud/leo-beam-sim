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

# 3) 提案庫條數（v0.19 canonical 計數：「## 」開頭且不含 [resolved 的標題＝未處理）
PROP="$DK/devkit-proposals.md"
if [ -f "$PROP" ]; then
  N="$(grep -c '^## ' "$PROP" 2>/dev/null || true)"
  R="$(grep -c '^## \[resolved' "$PROP" 2>/dev/null || true)"
  case "$N" in (''|*[!0-9]*) N=0;; esac
  case "$R" in (''|*[!0-9]*) R=0;; esac
  U=$(( N - R ))
  if [ "$U" -ge 3 ]; then
    OUT="${OUT}[devkit] 提案庫有 ${U} 條未處理，說「彙整 devkit 提案」收一輪\n"
  fi
fi

# 4) 租約取得（藍圖 §13 v0.22：租約宣告值只有 hooks 能寫——本 hook 有 session_id，controller 沒有）
#    ＋待決 gate_requests／抽查 pending 提醒（需要 python3；沒有就留給 pipeline 開場儀式）
#    heredoc 紀律：stdin 已在上方以 cat 收畢；python 走 argv，不讀 stdin（maintenance-protocol §2b）。
if command -v python3 >/dev/null 2>&1 && [ -f "$STATE" ]; then
  P="$(python3 - "$STATE" "$SID" 2>/dev/null <<'PYEOF'
import json, sys, time
from datetime import datetime, timezone
try:
    p, sid = sys.argv[1], sys.argv[2]
    d = json.load(open(p))
    # 租約：null/自己/過期(>=30min) → 本 hook 取得；他人未過期 → 提醒唯讀
    lease = d.get("lease")
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    def acquire():
        d["lease"] = {"session": sid, "ts": now}
        json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
    if not lease or lease.get("session") == sid:
        acquire()
    else:
        try:
            ts = datetime.fromisoformat(lease.get("ts"))
            age_min = (datetime.now(timezone.utc) - ts.astimezone(timezone.utc)).total_seconds() / 60
        except Exception:
            age_min = 9999
        if age_min >= 30:
            acquire()
            print(f"[devkit] 過期租約已接管（原 session {lease.get('session','?')[:8]}…，{int(age_min)} 分鐘前）")
        else:
            print(f"[devkit] 他 session 持有租約（{int(age_min)} 分鐘前活躍）——本 session 唯讀模式；使用者在場明示續作可接管（把 lease 置 null）")
    g = len(d.get("gate_requests") or [])
    s = len((d.get("spot_check") or {}).get("pending") or [])
    if g or s:
        print(f"[devkit] 待決事項：gate_requests={g}、抽查 pending={s}——說「跑 pipeline」上桌處理")
except Exception:
    pass
PYEOF
)"
  [ -n "$P" ] && OUT="${OUT}${P}\n"
fi

[ -n "$OUT" ] && printf '%b' "$OUT"
exit 0
