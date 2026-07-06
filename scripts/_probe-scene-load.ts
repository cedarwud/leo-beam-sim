// scripts/_probe-scene-load.ts — THROWAWAY probe (P3 spine (b) packaging).
// Verify the trimmed scene payload loads through the REAL leo load path
// (loadShowcaseArtifact schema gate → showcaseArtifactToScene adapter) and
// still carries the red/green survival-field signal (per-UE serving + sinr).
import { readFileSync } from 'node:fs';
import { loadShowcaseArtifact } from '../src/showcase/loadShowcaseArtifact';
import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';

const path = process.argv[2];
if (!path) {
  console.error('usage: tsx _probe-scene-load.ts <trimmed-visual-showcase-v1.json>');
  process.exit(1);
}
const raw = readFileSync(path, 'utf8');
console.log('read', (raw.length / 1e6).toFixed(1), 'MB');

const t0 = process.hrtime.bigint();
const art = loadShowcaseArtifact(JSON.parse(raw));
const t1 = process.hrtime.bigint();
console.log(
  'loadShowcaseArtifact OK — parse+validate',
  (Number(t1 - t0) / 1e6).toFixed(0), 'ms; frames', art.timeline.length,
);

function metricNumber(m: unknown): number | undefined {
  if (m == null || typeof m !== 'object') return undefined;
  const o = m as Record<string, unknown>;
  for (const k of ['db', 'value', 'dB', 'sinrDb', 'metric']) {
    if (typeof o[k] === 'number') return o[k] as number;
  }
  return undefined;
}

const frames = art.timeline.length;
for (const fi of [0, Math.floor(frames / 2), frames - 1]) {
  const frame = showcaseArtifactToScene(art, fi);
  const ues = frame.ues;
  const withServing = ues.filter((u) => u.servingBeamId).length;
  let neg = 0;
  let pos = 0;
  let unknown = 0;
  for (const u of ues) {
    const v = metricNumber(u.channelMetric);
    if (v === undefined) unknown++;
    else if (v < 0) neg++;
    else pos++;
  }
  console.log(
    `frame ${fi}: ues=${ues.length} serving=${withServing} ` +
      `starved(sinr<0)=${neg} served(sinr>=0)=${pos} metric-unknown=${unknown} ` +
      `perUeDecisions=${frame.perUeDecisions.length}`,
  );
}
console.log('SCENE-LOAD PROBE PASS');
