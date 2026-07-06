#!/usr/bin/env bash
# devkit SessionEnd hook — audit log 記一行＋歸還本 session 的租約
# 缺 devkit-local 直接安靜退出；一切失敗都不阻擋（SessionEnd 無 block 語義）。
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DK="$ROOT/.claude/devkit-local"
[ -d "$DK" ] || exit 0

IN="$(cat 2>/dev/null || true)"
SID="$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "$SID" ] || SID="unknown-$$"

printf '{"ts":"%s","session":"%s","actor":"hook","action":"session_end","spec_ref":null,"verification":null,"notes":null}\n' \
  "$(date -Is)" "$SID" >> "$DK/audit-log.jsonl" 2>/dev/null

# 租約歸還：僅當租約屬於本 session
if command -v python3 >/dev/null 2>&1 && [ -f "$DK/pipeline-state.json" ]; then
  python3 - "$DK/pipeline-state.json" "$SID" 2>/dev/null <<'PYEOF'
import json, sys
p, sid = sys.argv[1], sys.argv[2]
try:
    d = json.load(open(p))
    l = d.get("lease")
    if l and l.get("session") == sid:
        d["lease"] = None
        json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
except Exception:
    pass
PYEOF
fi
exit 0
