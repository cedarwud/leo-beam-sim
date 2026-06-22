#!/usr/bin/env node
/**
 * Beam-display-spec PURITY gate (v2) — the durability lock for the beam control surface
 * (docs/beam-display-control-surface-sdd.md §7).
 *
 * THE RULE: beam APPEARANCE for the SINR-LIVE CELL-CONE lane (the cone / footprint / mosaic
 * colours, + the cone-mount opacity / blending) lives in ONE place — `BeamDisplaySpec`, whose
 * DEFAULTS are the consts in `src/constants/sinrLiveConeStyle.ts`. The render sites read
 * appearance from the spec / props / item data, never a hardcoded literal at the mount. So
 * "adjust a beam colour/opacity" = edit ONE spec field, and no other rule can shadow it.
 *
 * WHY (the owner's pain): "我想用 prompt 快速調整波束的所有相關行為，改對地方、不被覆蓋，不要
 * 又變回一團亂." Prose + memory do NOT bind a memory-less agent — only an executable gate does.
 *
 * ── EXACT SCOPE (honest, post independent-review 2026-06-22) ──────────────────────────────
 * COVERED (turns RED):
 *   1. a colour LITERAL (#rgb / #rrggbb / #rrggbbaa / 0xRRGGBB / rgb()/rgba()/hsl()/hsla()) at a
 *      geometry-colour render site: SinrLiveCellBeamCones, SinrLiveCellFootprintRings, the mosaic
 *      cone/dot colour — outside the per-file allowlist.
 *   2. a colour / numeric-opacity / THREE.*Blending LITERAL, or a migrated appearance const, in a
 *      `<SinrLiveCellBeamCones …/>` MOUNT in MainScene (mounts must pass `beamDisplaySpec.*`).
 *   3. a migrated appearance const re-appearing ANYWHERE in MainScene.
 *   4. a NEW `src/viz/SinrLiveCell*` render file that is not classified here (closes the
 *      new-file bypass).
 * NOT COVERED YET (KNOWN GAPS — Phase B; do NOT trust the gate for these):
 *   - non-hex appearance consts read INSIDE the render components (SINR_LIVE_CONE_BLENDING,
 *     _SEGMENTS, _BASE_ALPHA_FACTOR, the SINR_LIVE_FOOTPRINT_* factors, callout Y-lift): still
 *     hardcoded in-component, migrate in Phase B + extend this gate to forbid their import.
 *   - `servingColour.ts` (the colorForServingBeam identity authority): legitimately COMPUTES the
 *     palette (it is a colour-authority home, like sinrLiveConeStyle); the separate
 *     `beam:colour-match` gate covers its CONSISTENCY, this gate does not police its values.
 *   - GroundScene UE-marker colours + OTHER scene lanes (EarthFixedCells, CellBeamCones, …): a
 *     different render lane, out of this lane's spec by render-governance lane separation.
 *   - SINR-band / data-driven colour: needs a colour FUNCTION, which a flat spec field cannot
 *     hold — the sanctioned home is a resolver like `resolveSinrLiveConeRenderColor` (the gate
 *     does NOT forbid literals there; that is the blessed place for a ramp). See SDD §7 escape.
 *
 * ALLOWLIST = the not-yet-migrated literal sites, each tagged with its migration step. FAILS on
 * a literal NOT in the allowlist (NEW scatter), and reports a RE-TINTED allowlisted literal with
 * a clear single message (update the entry OR migrate to a field) — never a contradictory pair.
 * Empty allowlists == ENFORCE state. Wired into `validate:governance` (pre-commit) + discovered
 * by `validate:static:all` + CI `static-gates`.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

/** Every literal COLOUR form (not just 6-digit hex): #rgb/#rrggbb/#rrggbbaa, 0xRRGGBB, rgb()/rgba()/hsl()/hsla(). */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b0x[0-9a-fA-F]{6}\b|\b(?:rgba?|hsla?)\([^)]*\)/g;

/**
 * Geometry-colour render sites — should hold ZERO colour literals (colour comes from the
 * resolver / props / item data). The allowlist is the CURRENT not-yet-migrated literals.
 * (SinrLiveCellBeamCallouts is intentionally NOT here: it is a label/CHROME component whose
 * beam-linked colour is `item.color` (data); its chrome rgba()/border are not beam colours.)
 */
const COLOUR_RENDER_FILE_ALLOWLIST: Record<string, readonly string[]> = {
  'src/viz/SinrLiveCellBeamCones.tsx': [],
  'src/viz/SinrLiveCellFootprintRings.tsx': [],
  'src/scene/sinrServingMosaic.ts': ['#64748b', '#334155'], // unserved dot colour + emissive — Phase B (mosaic colours → spec)
};

/** Appearance consts already migrated to the spec — must NOT reappear ANYWHERE in MainScene. */
const MIGRATED_APPEARANCE_CONSTS = [
  'SINR_LIVE_CONE_SERVING_PRIMARY_COLOR', // A1
  'SINR_LIVE_CONE_BACKGROUND_COLOR', // A1
  'SINR_LIVE_CONE_NONSERVING_OPACITY', // A3
  'SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY', // A4
  'SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR', // A5
  'SINR_LIVE_TRIGGERED_INTRA_TO_COLOR', // A5
  'SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY', // A5
  'SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS', // A5
  'SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG', // A6
  'SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG', // A6
  'SINR_LIVE_CONE_DIM_MIN_FACTOR', // A6
];

/** Every `src/viz/SinrLiveCell*` file must be classified, so a NEW one cannot silently bypass. */
const SINR_LIVE_CELL_VIZ_FILES_KNOWN = new Set([
  'SinrLiveCellBeamCones.tsx', // policed (colour render site)
  'SinrLiveCellFootprintRings.tsx', // policed (colour render site)
  'SinrLiveCellBeamCallouts.tsx', // CHROME/label — colour via item.color (data), not policed for colour
]);

let checks = 0;
const ok = (msg: string): void => { checks += 1; console.log(`  ok ${msg}`); };
console.log('beam-display-spec purity checks (v2):');

// (1) Geometry-colour render sites are colour-literal-free except the documented allowlist.
for (const [file, allow] of Object.entries(COLOUR_RENDER_FILE_ALLOWLIST)) {
  const src = read(file);
  const found = [...src.matchAll(COLOUR_LITERAL)].map(m => m[0]);
  const unexpected = found.filter(c => !allow.includes(c));
  const missing = allow.filter(c => !found.includes(c));
  // F1 fix (independent review): a RE-TINT (an allowlisted literal changed value) shows as
  // BOTH a missing allow entry AND an unexpected new one. Report it as ONE clear message —
  // never the old contradictory "new scatter" + "migration done" pair.
  if (missing.length > 0 && unexpected.length > 0) {
    assert.fail(`${file}: an allowlisted beam colour looks RE-TINTED (${missing.join(', ')} → ${unexpected.join(', ')}). Update its COLOUR_RENDER_FILE_ALLOWLIST entry to the new value, OR migrate it to a BeamDisplaySpec field. (This is NOT new scatter, and the migration is NOT done.)`);
  }
  assert.deepEqual(
    unexpected, [],
    `${file}: NEW hardcoded beam colour literal ${JSON.stringify(unexpected)} at a render site. If it IS a beam colour → route it through a BeamDisplaySpec field (default in sinrLiveConeStyle.ts). If it is genuinely NOT a beam colour → add it to COLOUR_RENDER_FILE_ALLOWLIST with a reason.`,
  );
  for (const c of missing) {
    assert.fail(`${file}: allowlisted literal ${c} no longer present — you MIGRATED it to a spec field, so delete this COLOUR_RENDER_FILE_ALLOWLIST entry.`);
  }
  ok(`${file} — no un-allowlisted beam colour literal (${allow.length} tolerated, pending Phase-B migration)`);
}

// (2) The `<SinrLiveCellBeamCones …/>` mounts in MainScene pass beamDisplaySpec.*, not literals.
const mainScene = read('src/scene/MainScene.tsx');
const mountBlocks = [...mainScene.matchAll(/<SinrLiveCellBeamCones\b[\s\S]*?\/>/g)].map(m => m[0]);
assert.ok(mountBlocks.length >= 1, 'expected at least one <SinrLiveCellBeamCones/> mount in MainScene');
mountBlocks.forEach((block, i) => {
  const colour = block.match(COLOUR_LITERAL);
  assert.ok(colour === null, `MainScene <SinrLiveCellBeamCones/> mount #${i + 1}: a hardcoded colour literal ${JSON.stringify(colour)} in a mount prop — pass beamDisplaySpec.<field> instead.`);
  const opacity = block.match(/\bopacity=\{\s*[0-9.]/);
  assert.ok(opacity === null, `MainScene <SinrLiveCellBeamCones/> mount #${i + 1}: a numeric-literal opacity prop — pass beamDisplaySpec.<opacity field> instead.`);
  const blending = block.match(/\bblending=\{?\s*THREE\.\w*Blending/);
  assert.ok(blending === null, `MainScene <SinrLiveCellBeamCones/> mount #${i + 1}: a literal THREE.*Blending prop — pass beamDisplaySpec.<field> instead.`);
});
ok(`MainScene — ${mountBlocks.length} <SinrLiveCellBeamCones/> mount(s) carry no colour/opacity/blending literal (all via beamDisplaySpec)`);

// (3) Migrated appearance consts must not reappear anywhere in MainScene (the mounts + the memos).
for (const c of MIGRATED_APPEARANCE_CONSTS) {
  assert.ok(
    !mainScene.includes(c),
    `MainScene.tsx references ${c} — that value is a BeamDisplaySpec field now; read beamDisplaySpec.<field>, do not re-import the const.`,
  );
}
ok(`MainScene — none of the ${MIGRATED_APPEARANCE_CONSTS.length} migrated appearance consts have crept back`);

// (4) Every src/viz/SinrLiveCell* render file is classified (a NEW one cannot silently bypass).
const vizSinrLiveCellFiles = readdirSync(join(ROOT, 'src/viz')).filter(f => /^SinrLiveCell.*\.tsx$/.test(f));
const unclassified = vizSinrLiveCellFiles.filter(f => !SINR_LIVE_CELL_VIZ_FILES_KNOWN.has(f));
assert.deepEqual(
  unclassified, [],
  `New src/viz render file(s) ${JSON.stringify(unclassified)} are unpoliced — classify each in SINR_LIVE_CELL_VIZ_FILES_KNOWN and, if it renders beam colour, add it to COLOUR_RENDER_FILE_ALLOWLIST so the gate covers it.`,
);
for (const f of SINR_LIVE_CELL_VIZ_FILES_KNOWN) {
  assert.ok(vizSinrLiveCellFiles.includes(f), `SINR_LIVE_CELL_VIZ_FILES_KNOWN lists ${f} but it no longer exists in src/viz — remove the stale entry.`);
}
ok(`src/viz/SinrLiveCell* — all ${vizSinrLiveCellFiles.length} render files classified (no new-file bypass)`);

// (5) The control surface exists: the migrated fields are on the spec.
const spec = read('src/scene/beamDisplaySpec.ts');
for (const field of ['heroConeColor', 'backgroundConeColor', 'nonServingConeOpacity', 'heroConeOpacity', 'triggeredIntraFromColor', 'triggeredIntraToColor', 'elevationDimEnabled']) {
  assert.ok(spec.includes(field), `beamDisplaySpec.ts is missing the migrated field ${field} — the control surface regressed.`);
}
ok('beamDisplaySpec.ts — the migrated beam-appearance fields are present (control surface intact)');

console.log(`\nbeam-display-spec purity: ${checks} checks passed. Scope is in the header — trust it ONLY for what it lists as COVERED.`);
