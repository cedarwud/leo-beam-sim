# GLB geometry-locked candidates

This is a scratch-only lane. It does not modify `public/`, BeamShift, package
files, or any production asset. The candidate workflow is:

```bash
./.scratch/glb-geometry-locked/run-candidates.sh
```

The script copies the already-optimized BeamShift NTPU donors and the two
owner-adopted CC-BY-4.0 constellation display models into scratch candidate
names. It byte-preserves the current Leo `uav.glb`. The validator compares each
candidate with its Leo production baseline and its BeamShift geometry donor.

The validator checks decoded glTF semantics rather than file bytes:

- primitive count/mode/attribute structure;
- exact decoded `POSITION` and `indices` arrays;
- node transforms and mesh/child graph;
- world-space bounds (min, max, size);
- candidate byte size, SHA-256, texture bytes/MIME and extensions.

The former CC-BY-NC `sat.glb` is no longer a candidate. Starlink uses the
twin-array model and OneWeb uses the front-dish model by explicit owner
decision. UAV remains unchanged because no local texture-only/lossless GLB tool
was verified; this workflow does not install or invoke `npx`.
