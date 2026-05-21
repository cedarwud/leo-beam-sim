import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  MODQN_PRODUCER_BASELINE_RUN_PATH,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
} from '../../src/modqn/replay-bundle/index.ts';

const MODQN_PRODUCER_REPO_PATH = '/home/u24/papers/modqn-paper-reproduction';
const MODQN_EXPORT_BIN = join(MODQN_PRODUCER_REPO_PATH, '.venv/bin/modqn-export');
const REQUIRED_SURFACES = [
  'manifest.json',
  'provenance-map.json',
  'timeline/step-trace.jsonl',
] as const;

function hasRequiredSurfaces(): boolean {
  return REQUIRED_SURFACES.every(relative => (
    existsSync(join(SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH, relative))
  ));
}

export function ensureModqnCurrentBaselineExport(): void {
  if (hasRequiredSurfaces()) return;

  if (!existsSync(MODQN_EXPORT_BIN)) {
    throw new Error(`MODQN export command is missing: ${MODQN_EXPORT_BIN}`);
  }
  if (!existsSync(MODQN_PRODUCER_BASELINE_RUN_PATH)) {
    throw new Error(`MODQN producer baseline run is missing: ${MODQN_PRODUCER_BASELINE_RUN_PATH}`);
  }

  mkdirSync(dirname(SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH), { recursive: true });
  const result = spawnSync(
    MODQN_EXPORT_BIN,
    [
      '--input',
      MODQN_PRODUCER_BASELINE_RUN_PATH,
      '--output-dir',
      SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
    ],
    {
      cwd: MODQN_PRODUCER_REPO_PATH,
      encoding: 'utf8',
      env: {
        ...process.env,
        MPLCONFIGDIR: process.env.MPLCONFIGDIR ?? '/tmp/modqn-mplconfig',
      },
    },
  );

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(
      `MODQN producer export failed with status ${result.status ?? 'unknown'}${detail ? `: ${detail}` : ''}`,
    );
  }

  if (!hasRequiredSurfaces()) {
    throw new Error(
      `MODQN producer export completed but required surfaces are missing under ${SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH}`,
    );
  }
}
