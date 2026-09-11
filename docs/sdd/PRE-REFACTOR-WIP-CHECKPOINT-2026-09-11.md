# Pre-refactor WIP checkpoint — 2026-09-11

This checkpoint preserves the complete stable working-tree state that existed
before the teaching-simulator system refactor was rebased onto current work.
It is a preservation boundary, not a claim that every included feature is
finished or owner-approved.

## Source state

- Branch: `wip/ee-handover-authority-2026-09-05`
- Parent HEAD before checkpoint: `c12b67c827c598dcd9a680c55f8ef69b2b571a53`
- Stable status hash: `f0d30409fbd3f9598ad47f2908107746fbb0662bcbd41fbc2307b56cd4591f07`
- Tracked modifications: 40 files
- Previously untracked entries: 38
- No file changed during the inventory and validation interval.

## Preserved groups

1. TLE archive extension through 2026-09-08 and regenerated catalogs.
2. Global, homepage, and two-hour Visual Lab reference artifacts.
3. Shared EE-intensity shading and its tests.
4. Narrative caption and horizon-transition scene surfaces.
5. Teaching handover timeline, cone, rail, and speed controls.
6. Scene/rail candidate focus and multi-candidate presentation refinements.
7. Golden-flow and global-constellation presentation refinements.

## Asset verification

- `check:tle-archive`: PASS; OneWeb 392/392, Starlink 391/392 with one declared exclusion.
- `check:visual-lab:global-first-frame`: PASS; OneWeb 651 admitted / 37 visible,
  Starlink 10,714 admitted / 450 visible.
- `check:visual-lab:default-full-run`: PASS; 241 anchors, 5,033 retained satellites.
- Full-run analysis: 3,449,308-byte gzip, SHA-256
  `6d2b84a89864873cebf251e0d58d59ebcd4175ccb2e787cdfd25a75bbfc5fe43`.
- Full-run geometry: 58,221,744 bytes, SHA-256
  `0c5513994d68d1b130bb4c60e1172f02acb6553c4cdef65e41cc20ac48a456a7`.
- TLE files remain covered by the repository's Git LFS attributes.
- The full-run `.bin` matches the existing 2026-08-12/2026-08-25 artifact convention
  and remains a normal Git blob in this checkpoint.

## Code verification

- `npm run lint`: PASS.
- `npm run test:appearance`: 96/96 PASS.
- `npm run test:multi-candidate`: 182/182 PASS.
- `npm run test:global-constellation`: PASS.
- `npm run test:homepage-projections`: PASS.
- `npm run test:visual-lab:default-full-run`: PASS.
- `git diff --check`: PASS.

## Known baseline exception

`npm run test:scene-presentation` remains red at
`scenePresentationBoundary.test.ts` because it source-pins the retired literal
`presentationPlan.visible['motion-guides'] && !showCellOverlay` inside
`MainScene.tsx`. The runtime layer still exists; this is a source-location/text
assertion failure and was already identified as obsolete governance debt. This
checkpoint does not re-pin or weaken it.

## Integration rule

The system-refactor branch must merge this checkpoint before proceeding beyond
its first surface-composition pass. Conflicts must be resolved by preserving the
newer WIP behavior while keeping the typed surface-plan boundary; neither side
may silently overwrite the other.
