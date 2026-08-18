# Scientific explain 3D prototype

Question: can one controlled 2.5D scene make the spatial meaning of off-axis angle and its downstream power, throughput, and EE effects more legible and memorable than the existing 2D scene?

One variant only: the user requested the fastest demo-grade answer, so this prototype intentionally skips the usual multi-variant comparison.

## Outcome

`/prototype/scientific-explain-3d` opens as a standalone front-end demo. Two-dimensional controls and results frame a fixed-camera 3D scene; changing the demo inputs visibly updates both the scene and the result ledger.

## Mutation boundary

- `src/main.tsx`
- `src/prototype/scientific-explain/ScientificExplain3DPrototype.tsx`
- `src/prototype/scientific-explain/ScientificExplain3DPrototype.scss`
- this specification

## Proof

- TypeScript and production build pass.
- The route returns HTTP 200 and renders without browser console errors.
- Browser interaction proves that changing the off-axis angle changes the 3D geometry, gain, power, throughput, and EE.
- `/` and `/simulator` routing remain unchanged.

## Stop

Do not add TLE, canonical analysis, backend calls, persistence, free camera controls, GLB asset work, or production abstractions. The page must remain clearly marked as illustrative and non-citable.
