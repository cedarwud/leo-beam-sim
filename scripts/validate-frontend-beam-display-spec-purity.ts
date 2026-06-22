#!/usr/bin/env node
/**
 * Beam-display-spec PURITY gate — the durability lock for the beam control surface
 * (docs/beam-display-control-surface-sdd.md §7).
 *
 * THE RULE IT ENFORCES: beam APPEARANCE (cone / footprint / callout / mosaic colours +
 * opacities + blending) lives in ONE place — `BeamDisplaySpec`, whose DEFAULTS are the
 * consts in `src/constants/sinrLiveConeStyle.ts`. Every beam RENDER site reads appearance
 * from the spec / props / item data, NEVER a hardcoded hex or an appearance const imported
 * at the mount. So "adjust a beam colour/opacity" = edit ONE spec field, and no other rule
 * can shadow it.
 *
 * WHY THIS EXISTS (the user's pain, verbatim): "我想用 prompt 快速調整波束的所有相關行為，
 * 改對地方、不被其他規則覆蓋，不要很容易又變回一團亂." Prose docs + memory do NOT bind a
 * memory-less agent (Codex, a fresh session) — only an executable gate does. This is that
 * gate: a NEW hardcoded beam colour/opacity at a render site, or a migrated appearance const
 * sneaking back into the mount, turns this RED. Wired into `validate:governance` (pre-commit)
 * + auto-discovered by `validate:static:all` + the CI `static-gates` job, so it cannot orphan
 * and (once `static-gates` is a required check) cannot be bypassed on a PR.
 *
 * ALLOWLIST (WARN→ENFORCE migration): the not-yet-migrated literal sites are listed below,
 * each tagged with the migration step that removes it. The gate FAILS if a render file holds
 * a literal NOT in its allowlist (NEW scatter — blocks the mess from day one) OR if an
 * allowlisted literal no longer appears (STALE — forces you to shrink the list as you migrate).
 * When every allowlist is empty, the control surface is complete = the ENFORCE state.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

const HEX = /#[0-9a-fA-F]{6}\b/g;

/**
 * The ONLY files allowed to DEFINE beam-appearance literal values:
 *   - src/constants/sinrLiveConeStyle.ts — the cone-style consts = the spec DEFAULTS home.
 *   - src/scene/beamDisplaySpec.ts        — BeamDisplaySpec + DEFAULT_BEAM_DISPLAY_SPEC.
 * Every other beam RENDER file must be hex-free for appearance (colours via props / the
 * resolver / item data). The allowlist is the CURRENT not-yet-migrated literals per file.
 */
const RENDER_FILE_HEX_ALLOWLIST: Record<string, readonly string[]> = {
  'src/viz/SinrLiveCellBeamCones.tsx': [], // clean: colours via resolveSinrLiveConeRenderColor + props
  'src/viz/SinrLiveCellFootprintRings.tsx': [], // clean: uses item.color (data)
  'src/viz/SinrLiveCellBeamCallouts.tsx': ['#ffffff'], // chip text/border white — Phase B (callout chrome → spec)
  'src/scene/sinrServingMosaic.ts': ['#64748b', '#334155'], // unserved dot colour + emissive — Phase B (mosaic colours → spec)
};

/**
 * Appearance consts (COLOR / OPACITY / BLENDING + the triggered-intra timing) that
 * `MainScene.tsx` is still allowed to import directly — i.e. the not-yet-migrated mount
 * literals. The migrated ones (SERVING_PRIMARY_COLOR, BACKGROUND_COLOR, NONSERVING_OPACITY,
 * SERVING_PRIMARY_OPACITY) MUST NOT reappear here — they are spec fields now. As A5 migrates
 * the triggered-intra cluster, this set shrinks to empty.
 */
const MAINSCENE_APPEARANCE_CONST_ALLOWLIST = new Set<string>([
  // EMPTY — A5 migrated the triggered-intra cluster onto BeamDisplaySpec, so MainScene no
  // longer imports ANY beam-appearance const. A new entry here would mean a NEW un-migrated
  // mount literal — keep this empty.
]);

/** Appearance consts that have ALREADY migrated to the spec — must never reappear in MainScene. */
const MIGRATED_APPEARANCE_CONSTS = [
  'SINR_LIVE_CONE_SERVING_PRIMARY_COLOR', // A1
  'SINR_LIVE_CONE_BACKGROUND_COLOR', // A1
  'SINR_LIVE_CONE_NONSERVING_OPACITY', // A3
  'SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY', // A4
  'SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR', // A5
  'SINR_LIVE_TRIGGERED_INTRA_TO_COLOR', // A5
  'SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY', // A5
  'SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS', // A5
];

let checks = 0;
const ok = (msg: string): void => { checks += 1; console.log(`  ok ${msg}`); };

console.log('beam-display-spec purity checks:');

// (1) RENDER FILES are hex-free for appearance except the documented allowlist.
for (const [file, allow] of Object.entries(RENDER_FILE_HEX_ALLOWLIST)) {
  const src = read(file);
  const found = [...src.matchAll(HEX)].map(m => m[0]);
  const unexpected = found.filter(h => !allow.includes(h));
  assert.deepEqual(
    unexpected, [],
    `${file}: NEW hardcoded beam-appearance hex ${JSON.stringify(unexpected)} — route it through a BeamDisplaySpec field (a default in sinrLiveConeStyle.ts), not a literal at the render site.`,
  );
  // STALE allowlist: every allowed hex must still appear, else delete the entry.
  for (const h of allow) {
    assert.ok(found.includes(h), `${file}: allowlisted hex ${h} no longer present — remove it from RENDER_FILE_HEX_ALLOWLIST (migration done).`);
  }
  ok(`${file} — no un-allowlisted appearance hex (${allow.length} tolerated, pending migration)`);
}

// (2) MainScene mounts read the spec, not migrated appearance consts.
const mainScene = read('src/scene/MainScene.tsx');
for (const c of MIGRATED_APPEARANCE_CONSTS) {
  assert.ok(
    !mainScene.includes(c),
    `MainScene.tsx references ${c} — that appearance value is a BeamDisplaySpec field now; read beamDisplaySpec.<field> at the mount, do not re-import the const.`,
  );
}
ok('MainScene.tsx — migrated appearance consts (hero/background colour, non-serving/hero opacity) stay on the spec');

const mainSceneAppearanceConsts = [
  ...mainScene.matchAll(/\bSINR_LIVE_[A-Z0-9_]*(?:COLOR|OPACITY|BLENDING)\b/g),
].map(m => m[0]);
const unexpectedConsts = [...new Set(mainSceneAppearanceConsts)].filter(c => !MAINSCENE_APPEARANCE_CONST_ALLOWLIST.has(c));
assert.deepEqual(
  unexpectedConsts, [],
  `MainScene.tsx imports un-allowlisted beam-appearance const(s) ${JSON.stringify(unexpectedConsts)} — migrate the value onto BeamDisplaySpec and pass beamDisplaySpec.<field> at the mount.`,
);
// STALE allowlist: drop a triggered const from the allowlist once A5 migrates it.
for (const c of MAINSCENE_APPEARANCE_CONST_ALLOWLIST) {
  assert.ok(mainSceneAppearanceConsts.includes(c), `MAINSCENE_APPEARANCE_CONST_ALLOWLIST entry ${c} no longer in MainScene — remove it (migration done).`);
}
ok(`MainScene.tsx — only the ${MAINSCENE_APPEARANCE_CONST_ALLOWLIST.size} allowlisted (un-migrated) appearance consts remain`);

// (3) The control surface exists: the migrated fields are on the spec.
const spec = read('src/scene/beamDisplaySpec.ts');
for (const field of ['heroConeColor', 'backgroundConeColor', 'nonServingConeOpacity', 'heroConeOpacity']) {
  assert.ok(spec.includes(field), `beamDisplaySpec.ts is missing the migrated field ${field} — the control surface regressed.`);
}
ok('beamDisplaySpec.ts — the migrated beam-appearance fields are present (control surface intact)');

console.log(`\nbeam-display-spec purity: ${checks} checks passed (allowlist shrinks to empty at the ENFORCE state).`);
