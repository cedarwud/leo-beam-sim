#!/usr/bin/env node
// stage-h2-windows.mjs — ONE command to rebuild the ephemeral /tmp staging for the
// H2 dense-ablation windows after a reboot (npm run stage:h2).
//
// Custody model (2026-07-10 truth-audit finding): /tmp/leo-beam-sim is CLEARED on
// reboot, and the H2 export's origin lives on the sat GPU server — so this repo's
// data-dependent validators and the modqn-replay-proof lane die after every reboot
// unless the bundles are re-staged. The DURABLE local home for the bundles is the
// artifacts library (path-symmetric with the server):
//   /home/u24/papers/modqn-weights-consolidated/diagnostics/h2-dense-ablation-2026-07-04
// (backed up to /mnt/d by that repo's backup.sh). This script stages FROM that
// mirror INTO /tmp; when the mirror itself is missing it prints the exact
// server-pull command and exits 2 (it never invents data).
//
// What it stages (idempotent; --force re-does everything):
//   1. per-arm raw visual-showcase-v1.json + timeline/step-trace.jsonl (gunzipped
//      from the mirror's .gz when the raw is absent) + small sidecars (manifest,
//      self-check, summary).
//   2. the a2/b1 SCENE windows via scripts/build-h2-scene-payload.mjs (the two
//      arms REPLAY_ARM_WINDOWS pins; includes the manifest.json co-location).
//   3. the dense-q-proof-window-600-130 symlink used by validate:modqn:decode-parity.
//
// Immutability: producer bytes are copied/gunzipped as-is; the only derived file
// is the scene window built by build-h2-scene-payload.mjs (display payload).

import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, copyFileSync, symlinkSync, rmSync, lstatSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);

const DURABLE_DEFAULT = '/home/u24/papers/modqn-weights-consolidated/diagnostics/h2-dense-ablation-2026-07-04';
const BUNDLES = '/tmp/leo-beam-sim/modqn-bundles';
const TMP_ABLATION = `${BUNDLES}/h2-dense-ablation-2026-07-04`;
const SCENE_ARMS = ['a2', 'b1']; // the arms REPLAY_ARM_WINDOWS (src/App.tsx) pins
const WINDOW_SUFFIX = '-t0_9000-w117_213';

// decode-parity real-window staging (separate, older convention — a symlink).
const PARITY_STAGING = `${BUNDLES}/dense-q-proof-window-600-130`;
const PARITY_TARGET = '/home/u24/papers/modqn-paper-reproduction/artifacts/dense-q-proof-window-600-130';

const args = process.argv.slice(2);
const force = args.includes('--force');
const durable = args.find((a) => !a.startsWith('--')) ?? DURABLE_DEFAULT;

// The GPU-server address is deliberately NOT committed (public repo). Export
// H2_REMOTE (user@host) and optionally H2_SSH_PORT before running to get a
// copy-pasteable pull command; the concrete values live in the private devkit
// note (docs/devkit/reports/fable-final-truth-audit-2026-07-10.md).
const REMOTE = process.env.H2_REMOTE ?? '<user>@<gpu-server>';
const SSH_PORT = process.env.H2_SSH_PORT ?? '<port>';
const SERVER_PULL = [
  '# H2 durable mirror is missing on this machine. Pull it (password auth) from the',
  '# GPU server into the artifacts library, .gz + sidecars only (~200MB):',
  `mkdir -p ${DURABLE_DEFAULT}`,
  `rsync -avzP -e 'ssh -p ${SSH_PORT}' \\`,
  "  --include='*/' --include='*.gz' --include='manifest.json' --include='*self_check*' \\",
  "  --include='*summary*' --include='*.md' --exclude='*' \\",
  `  ${REMOTE}:~/modqn-weights-consolidated/diagnostics/h2-dense-ablation-2026-07-04/ \\`,
  `  ${DURABLE_DEFAULT}/`,
  '# then re-run: npm run stage:h2',
].join('\n');

function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.isFile()) out.push(p);
    }
  }
  return out;
}

function fileReady(path) {
  return existsSync(path) && statSync(path).size > 0;
}

async function stageFile(srcFile, srcRoot, dstRoot) {
  const rel = relative(srcRoot, srcFile);
  if (rel.endsWith('.gz')) {
    const dst = join(dstRoot, rel.slice(0, -3));
    if (!force && fileReady(dst)) return { dst, action: 'kept' };
    mkdirSync(dirname(dst), { recursive: true });
    await pipeline(createReadStream(srcFile), createGunzip(), createWriteStream(dst));
    return { dst, action: 'gunzipped' };
  }
  // a raw file whose .gz sibling exists in the mirror is covered by the .gz path
  if (existsSync(`${srcFile}.gz`)) return null;
  const dst = join(dstRoot, rel);
  if (!force && fileReady(dst)) return { dst, action: 'kept' };
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(srcFile, dst);
  return { dst, action: 'copied' };
}

async function main() {
  if (!existsSync(durable)) {
    console.error(`stage:h2 — durable mirror missing: ${durable}\n`);
    console.error(SERVER_PULL);
    process.exit(2);
  }

  // 1. producer bundles: durable mirror -> /tmp (as-is bytes).
  const armDirs = readdirSync(durable, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.endsWith(WINDOW_SUFFIX))
    .map((e) => e.name);
  if (armDirs.length === 0) {
    console.error(`stage:h2 — no <arm>${WINDOW_SUFFIX} dirs under ${durable} (partial pull?)`);
    console.error(SERVER_PULL);
    process.exit(2);
  }
  let staged = 0;
  for (const armDir of armDirs) {
    const srcRoot = join(durable, armDir);
    const dstRoot = join(TMP_ABLATION, armDir);
    for (const f of walkFiles(srcRoot)) {
      const r = await stageFile(f, srcRoot, dstRoot);
      if (r && r.action !== 'kept') staged += 1;
    }
    console.log(`  [arm] ${armDir} staged -> ${dstRoot}`);
  }
  // root-level sidecars (HANDOFF.md etc.)
  for (const entry of readdirSync(durable, { withFileTypes: true })) {
    if (entry.isFile()) await stageFile(join(durable, entry.name), durable, TMP_ABLATION);
  }

  // 2. scene windows for the UI-pinned arms (a2 hero / b1 argmax baseline).
  for (const arm of SCENE_ARMS) {
    const armDir = `${arm}${WINDOW_SUFFIX}`;
    const src = join(TMP_ABLATION, armDir, 'visual-showcase-v1.json');
    const trace = join(TMP_ABLATION, armDir, 'timeline/step-trace.jsonl');
    const dst = `${BUNDLES}/h2-scene-${arm}${WINDOW_SUFFIX}/visual-showcase-v1.json`;
    if (!fileReady(src) || !fileReady(trace)) {
      console.error(`  [scene] ${arm}: SKIPPED — ${src} or its step-trace is not staged (arm absent in mirror?)`);
      continue;
    }
    if (!force && fileReady(dst)) {
      console.log(`  [scene] ${arm}: kept ${dst}`);
      continue;
    }
    const res = spawnSync(
      process.execPath,
      [join(HERE, 'build-h2-scene-payload.mjs'), src, dst, trace],
      { stdio: 'inherit', cwd: REPO_ROOT },
    );
    if (res.status !== 0) {
      console.error(`  [scene] ${arm}: build-h2-scene-payload FAILED (${res.status})`);
      process.exit(1);
    }
  }

  // 3. decode-parity real-window symlink (durable producer artifact -> /tmp).
  if (existsSync(PARITY_TARGET)) {
    mkdirSync(dirname(PARITY_STAGING), { recursive: true });
    try {
      if (lstatSync(PARITY_STAGING, { throwIfNoEntry: false })) rmSync(PARITY_STAGING, { recursive: true });
    } catch {
      /* stale entry already gone */
    }
    symlinkSync(PARITY_TARGET, PARITY_STAGING);
    console.log(`  [parity] symlinked ${PARITY_STAGING} -> ${PARITY_TARGET}`);
  } else {
    console.error(`  [parity] SKIPPED — producer target missing: ${PARITY_TARGET}`);
  }

  console.log(`\nstage:h2 done (${staged} file(s) written${force ? ', --force' : ''}). Verify with:`);
  console.log('  npm run validate:modqn:coverage-fairness && npm run validate:modqn:decode-parity');
}

main().catch((err) => {
  console.error(`stage:h2 FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
