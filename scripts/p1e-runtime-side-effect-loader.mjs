/**
 * P1e (b2) — Node ESM loader hook that stubs forbidden modules with a
 * top-level `throw` so any runtime evaluation surfaces as an immediate
 * exception in the main thread.
 *
 * Registered into the child driver process by
 * `p1e-runtime-side-effect-register.mjs`. SDD §9 P1 exit criterion (b2) calls
 * for a `vi.spyOn` style import-side-effect probe; this loader emulates the
 * intent without bringing in vitest: a forbidden module replaced by a
 * synthesized throw cannot evaluate without crashing the process.
 *
 * Forbidden module URLs (file:// URL substring match):
 *   - `/src/core/channel/`
 *   - `/src/core/beam/`
 *   - `/src/engine/handover/handover-manager`
 *   - `/src/engine/signal/link-budget`
 *   - `/src/scene/runtimeFrameStep`
 *
 * Composed with `tsx/esm` (the TS → ESM loader). Node 22+ runs hooks on a
 * worker thread; the synthesized source string ships back to the main thread
 * and evaluates there, so the throw fires in the driver isolate where we can
 * see it from the parent test.
 */

const FORBIDDEN_URL_PATTERNS = [
  /\/src\/core\/channel\//,
  /\/src\/core\/beam\//,
  /\/src\/engine\/handover\/handover-manager(?:\.|\/)/,
  /\/src\/engine\/signal\/link-budget(?:\.|\/)/,
  /\/src\/scene\/runtimeFrameStep(?:\.|\/)/,
];

export async function load(url, context, nextLoad) {
  for (const re of FORBIDDEN_URL_PATTERNS) {
    if (re.test(url)) {
      const safe = url.replace(/'/g, "\\'");
      return {
        format: 'module',
        source: `throw new Error('P1E_FORBIDDEN_MODULE_EVALUATED:${safe}');`,
        shortCircuit: true,
      };
    }
  }
  return nextLoad(url, context);
}
