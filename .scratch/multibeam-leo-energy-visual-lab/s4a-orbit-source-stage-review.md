# S4a orbit-source stage review

Status: PASS for the bounded S4a `a1-orient` delivery. This is not a claim that the complete S4 scientific narrative has shipped.

## Delivered surface

- Direct route: `/explain`
- Entry action: `進入軌道場景`
- Scene owner: `src/explain/scene/OrbitSourceStage.tsx`
- Scientific input: `state.evidence.methodState.frame`
- Visual donor: `SimulatorOrbitSceneContents`; no second Canvas, homepage scene, Walker engine, or prototype metric producer is mounted.
- Return action: `返回問題`
- Supporting values remain available through the collapsed `查看數值證據` disclosure.

The scene renders the accepted TLE snapshot, SGP4/TEME trajectory, selected satellite, NTPU observer reference, and same-frame constellation context. The later Earth-fixed, NTPU topocentric, and service-eligibility steps are intentionally dim and are not claimed as completed visual layers.

## Automated checks

- `npm run test:explain` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS; the repository's existing Vite chunk-size advisory remains non-blocking.

## Browser checks

Verified at `http://127.0.0.1:3000/explain`:

1. The accepted source token loads without exposing a stale result.
2. `進入軌道場景` mounts the 3D TLE-derived scene.
3. Orbit controls accept drag and zoom interaction.
4. `查看數值證據` exposes the same run/frame-linked evidence.
5. `返回問題` restores the clean entry state.
6. Browser console: zero application errors. WebGL emitted only GPU readback/context-disposal diagnostics during screenshot and Canvas unmount.

Visual evidence: `output/playwright/explain-s4-orbit-source.png`.

## Fresh-context audit

Fresh read-only review returned PASS with no blocking scientific or runtime finding. It confirmed accepted-frame provenance, absence of prototype/homepage/Walker authority leakage, and no overclaim that the dimmed coordinate-conversion stages are already visualized.

## Remaining S4 boundary

The Earth-fixed projection, NTPU topocentric view, local service scene, link cross-section, and formula/value overlays remain future additive stages. This checkpoint must be described as S4a orbit-source orientation only.
