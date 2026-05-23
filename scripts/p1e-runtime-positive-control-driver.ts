/**
 * P1e (b2) — positive-control driver. Intentionally imports a forbidden
 * live-engine module. Under the `p1e-runtime-side-effect-loader.mjs` hook
 * this import is rewritten to `throw new Error('P1E_FORBIDDEN_MODULE_…')`,
 * which kills the process before the success print. The parent assertion
 * confirms the hook actually fires; without this control the b2 probe
 * could give a false-PASS on a misconfigured loader.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// The import below is the test surface — its top-level evaluation must trigger
// the loader's stubbed throw. Static `import` is required (dynamic import()
// would defer evaluation past the success print).
import '../src/core/channel/index';

console.log('POSITIVE_CONTROL_UNREACHABLE');
