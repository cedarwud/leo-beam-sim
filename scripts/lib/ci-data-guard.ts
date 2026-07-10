// ci-data-guard — CI environment semantics for DATA-DEPENDENT validators (P2 SN-3c).
//
// A handful of static validators depend on machine-local data a hosted CI runner
// can never have: bundles staged under /tmp/leo-beam-sim (cleared on reboot,
// re-staged by hand) and read-only sibling repos under /home/u24/papers
// (ntn-sim-core, modqn-paper-reproduction). On the dev machine those deps are
// normally present and the validator MUST run exactly as before; on a hosted
// runner their absence is an ENVIRONMENT fact, not a code regression.
//
// SKIP semantics — exit 0 WITH a grep-able marker:
//   - Exit 0, not non-zero: a gate must never go red for a reason that cannot be
//     fixed by changing this repo's code. A permanently-red environment gate
//     trains people to ignore the gate (or `--no-verify` it) — the exact failure
//     mode validate:static:all exists to prevent.
//   - NOT silent: every skip prints one `[SKIP-DATA-UNAVAILABLE]` line per
//     missing dependency to stdout, so the validate:static-all runner can
//     detect, NAME and COUNT skipped validators ("M skipped (data
//     unavailable)"). A validator can never silently stop validating.
//   - Call this BEFORE the first DATA-dependent read/spawn. Default placement is
//     module top, immediately after imports and path constants. A validator MAY
//     run purely data-FREE sections first (committed fixtures, purity greps) so
//     a hosted CI runner still gates those — this is safe because a pre-guard
//     assert failure exits 1, i.e. a real red can never be mislabeled as a skip
//     (only pass-then-skip is possible). The marker `why` should then say what
//     DID run before the skip. Never call it after DATA assertions have started.
//   - `regenerableFrom` is ONLY for validators that SELF-HEAL: if the validator
//     itself can autonomously rebuild the missing data from this source and
//     still PASS (e.g. ensureModqnCurrentBaselineExport() re-exports the /tmp
//     bundle from the producer repo), the dependency counts as available and we
//     do NOT skip — skipping would throw away a real pass. Do NOT use it for
//     data a human must re-stage by hand: there the validator cannot pass
//     anyway, so a missing staging is a SKIP whose marker line carries the
//     restore command instead of a red.

import { existsSync } from 'node:fs';

export interface CiDataDependency {
  /** Absolute path the validator actually reads / spawns into. */
  readonly path: string;
  /** One-line reason: what the data is (+ how to restore it, if not obvious). */
  readonly why: string;
  /**
   * Optional local regeneration source. If it exists while `path` is missing,
   * the dependency is treated as AVAILABLE (run the validator; let its own
   * restore instructions / self-heal fire) instead of skipping.
   */
  readonly regenerableFrom?: string;
}

/** stdout marker consumed by scripts/validate-static-all.mjs (keep in sync). */
export const SKIP_DATA_UNAVAILABLE_MARKER = '[SKIP-DATA-UNAVAILABLE]';

/**
 * If any dependency is unavailable (path missing AND no present regeneration
 * source), print one marker line per missing dependency and exit 0.
 * Otherwise return without output.
 */
export function skipIfDataUnavailable(deps: ReadonlyArray<CiDataDependency>): void {
  const missing = deps.filter(
    (dep) => !existsSync(dep.path)
      && (dep.regenerableFrom === undefined || !existsSync(dep.regenerableFrom)),
  );
  if (missing.length === 0) return;
  for (const dep of missing) {
    const regenNote = dep.regenerableFrom === undefined
      ? ''
      : ` (regeneration source also missing: ${dep.regenerableFrom})`;
    console.log(`${SKIP_DATA_UNAVAILABLE_MARKER} ${dep.why} — missing: ${dep.path}${regenNote}`);
  }
  process.exit(0);
}
