#!/usr/bin/env bash
set -euo pipefail

REPO=/home/sat/leo-beam-sim
KIT="$REPO/courseware/c120-lora-leo-deck/alt-skill-deck/server-authoring-kit"
SESSION=pptx

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session already exists: $SESSION" >&2
  exit 2
fi

mkdir -p "$KIT/logs" "$KIT/results"
tmux new-session -d -s "$SESSION" -n control -c "$REPO"

launch() {
  local name="$1"
  local prompt="$2"
  local command
  command="cd '$REPO' && codex exec --model gpt-5.6-luna --config 'model_reasoning_effort=\"max\"' --config 'service_tier=\"fast\"' --enable fast_mode --sandbox workspace-write -C '$REPO' -o '$KIT/results/$name.txt' - < '$KIT/launch-prompts/$prompt' > '$KIT/logs/$name.log' 2>&1; status=\$?; echo CODEX_EXIT:\$status; exec bash"
  tmux new-window -d -t "$SESSION" -n "$name" -c "$REPO" "$command"
}

launch opening opening.txt
launch a009-018 a009_018.txt
launch a019-027 a019_027.txt
launch b028-045 b028_045.txt
launch b046-063 b046_063.txt
launch c064-080 c064_080.txt
launch c081-097 c081_097.txt

tmux select-window -t "$SESSION:control"
tmux list-windows -t "$SESSION"

