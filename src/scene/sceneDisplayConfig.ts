/**
 * SceneDisplayConfig — the thin DIRECT-PROP seam for display-only beam knobs
 * (Tier-2 beam-display seam, 2026-06-14).
 *
 * WHY THIS EXISTS (the "I change a beam-display value and nothing re-renders"
 * bug): every other runtime knob flows through `buildAppRuntimeConfig` → the
 * 17-input `runtime` useMemo → the `runtimeWithCinema` wrap → MainScene's single
 * `runtime` prop. Adding a display knob there means appending it to that
 * dep-array AND to the inner cone useMemos in MainScene — miss either and the
 * edit silently does not re-render. This config bypasses that bag entirely: App
 * holds it in its own `useState` and passes it DIRECTLY to MainScene, so a
 * `setSceneDisplayConfig` call changes a distinct prop reference and re-renders
 * MainScene without touching the runtime memo. (The inner cone memos still must
 * key on these fields — see MainScene — but that is the only dep to remember,
 * and it lives next to the cone resolver, not in a 17-input bag.)
 *
 * SCOPE: display-only (CLAUDE.md Rule#6). These knobs change what cones are
 * DRAWN, never which beam is serving, the SINR, handover events, or any truth.
 * Keep the fields primitive (booleans/numbers) so MainScene's React.memo and the
 * inner cone memos can key on stable values rather than a churning object.
 */
export interface SceneDisplayConfig {
  /**
   * Show the dim NON-SERVING cone layer (co-channel / secondary illuminated
   * beams) behind the serving cones. Default OFF: the serving cones are the
   * always-on field; this is an opt-in "show me every beam, not just serving"
   * switch. When ON, the non-serving cones draw at
   * `resolveSinrLiveConeLayerOpacity('nonServing')` (dimmer than ambient). It is
   * a pure display filter over the model's non-serving `illuminatedBeams`; the
   * serving-only resolver (and the s0/s4 serving must-holds it feeds) is
   * untouched.
   */
  readonly showNonServingCones: boolean;
}

export const DEFAULT_SCENE_DISPLAY_CONFIG: SceneDisplayConfig = {
  showNonServingCones: false,
};
