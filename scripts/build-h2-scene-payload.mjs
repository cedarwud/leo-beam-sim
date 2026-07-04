// scripts/_trim-scene-payload.mjs — THROWAWAY probe (P3 spine (b) packaging).
//
// (1) Strip dense-Q + candidate-SINR bloat from a ~250MB visual-showcase-v1.json
//     (objectiveQByAction / scalarizedQByAction / candidateActionOrder ride the
//     ω-knob PROOF path, loaded separately; the scene field needs only per-UE
//     geo + serving + coverage truth).
// (2) ENRICH each timeline ue with producer served/starved truth joined from the
//     matching step-trace.jsonl kpiOverlay. The red/green SURVIVAL field must
//     colour by producer COVERAGE truth (served 0.26 vs 0.997 = the toggle-slam
//     win), NOT a leo-invented sinrDb floor. The served/starved VALUES are the
//     producer's — leo only co-locates them into a derived display payload.
//
// Join keys: artifact frame.tSec (0..95) == step-trace timeSec; ue id "ue-N" ==
// step-trace userIndex N.
import { readFileSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname } from 'node:path';

const src = process.argv[2];
const dst = process.argv[3];
const stepTrace = process.argv[4]; // optional: enrich served/starved
if (!src || !dst) {
  console.error('usage: node _trim-scene-payload.mjs <src.json> <dst.json> [step-trace.jsonl]');
  process.exit(1);
}

// --- producer served/starved map from step-trace kpiOverlay (streamed) ---
const servedMap = new Map(); // `${timeSec}|${userIndex}` -> { served, starved }
if (stepTrace) {
  const rl = createInterface({ input: createReadStream(stepTrace), crlfDelay: Infinity });
  let rows = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const ko = r.kpiOverlay ?? {};
    servedMap.set(`${r.timeSec}|${r.userIndex}`, {
      served: !!ko.served,
      starved: !!ko.starved,
    });
    rows++;
  }
  console.log('step-trace served map rows', rows);
}

const raw = readFileSync(src, 'utf8');
console.log('read', (raw.length / 1e6).toFixed(1), 'MB');
const art = JSON.parse(raw);

let uesStripped = 0;
let dfStripped = 0;
let joined = 0;
let joinMiss = 0;
for (const frame of art.timeline ?? []) {
  const tSec = frame.tSec;
  for (const u of frame.ues ?? []) {
    if (u.candidateSinrDbByBeamId) {
      delete u.candidateSinrDbByBeamId;
      uesStripped++;
    }
    if (stepTrace) {
      const idx = Number(String(u.id).replace(/^\D+/, '')); // "ue-7" -> 7
      const hit = servedMap.get(`${tSec}|${idx}`);
      if (hit) {
        u.served = hit.served;
        u.starved = hit.starved;
        joined++;
      } else {
        joinMiss++;
      }
    }
  }
  if (frame.metrics?.candidateSinrDbByBeamId) {
    delete frame.metrics.candidateSinrDbByBeamId;
  }
}
// Scene payload needs no per-UE decision detail — that is the dense-Q PROOF
// layer, loaded separately by the ω-knob path. Drop decisionFrames entirely
// but keep an empty array so showcaseArtifactToScene's buildPerUeDecisions
// iterates [] rather than crashing on an undefined `diagnostics`.
if (art.diagnostics && Array.isArray(art.diagnostics.decisionFrames)) {
  dfStripped = art.diagnostics.decisionFrames.length;
  art.diagnostics.decisionFrames = [];
}

mkdirSync(dirname(dst), { recursive: true });
const out = JSON.stringify(art);
writeFileSync(dst, out);
console.log(
  'wrote', (out.length / 1e6).toFixed(1), 'MB',
  ' ues-stripped', uesStripped,
  ' df-dropped', dfStripped,
  ' served-joined', joined,
  ' join-miss', joinMiss,
);
