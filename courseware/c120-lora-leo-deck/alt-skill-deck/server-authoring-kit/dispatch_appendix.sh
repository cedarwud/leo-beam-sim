#!/usr/bin/env bash
set -euo pipefail

REPO=/home/sat/leo-beam-sim
KIT="$REPO/courseware/c120-lora-leo-deck/alt-skill-deck/server-authoring-kit"
SESSION=pptx

tmux has-session -t "$SESSION"
mkdir -p "$KIT/logs" "$KIT/results"

launch() {
  local name="$1"
  local prompt="$2"
  local command
  if tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -Fxq "$name"; then
    echo "tmux window already exists: $name" >&2
    return
  fi
  command="cd '$REPO' && codex exec --model gpt-5.6-luna --config 'model_reasoning_effort=\"max\"' --config 'service_tier=\"fast\"' --enable fast_mode --sandbox workspace-write -C '$REPO' -o '$KIT/results/$name.txt' - < '$KIT/launch-prompts/$prompt' > '$KIT/logs/$name.log' 2>&1; status=\$?; echo CODEX_EXIT:\$status; exec bash"
  tmux new-window -d -t "$SESSION" -n "$name" -c "$REPO" "$command"
}

launch app098-107 app098_107.txt
launch app108-116 app108_116.txt
tmux list-windows -t "$SESSION"

