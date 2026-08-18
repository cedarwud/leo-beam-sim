#!/usr/bin/env bash
set -euo pipefail

exec codex exec \
  --model gpt-5.6-luna \
  --config 'model_reasoning_effort="max"' \
  --config 'service_tier="fast"' \
  --enable fast_mode \
  --sandbox workspace-write \
  -C /home/sat/leo-beam-sim \
  -o /tmp/c120-style-app098-server-last.txt \
  - < /home/sat/leo-beam-sim/courseware/c120-lora-leo-deck/alt-skill-deck/dispatch-prompts/local-style-app-p098-p107.md
