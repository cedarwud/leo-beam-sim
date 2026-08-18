#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

# Every write in this workflow is under ROOT. Production assets and package
# manifests are read-only references in manifest.json.
mkdir -p "$ROOT/candidates/ntpu" "$ROOT/candidates/satellites" "$ROOT/candidates/unchanged"
cp -- /home/u24/papers/beamshift/src/scene/assets/NTPU.glb "$ROOT/candidates/ntpu/NTPU.glb"
cp -- /home/u24/papers/beamshift/src/scene/assets/NTPU_v2.glb "$ROOT/candidates/ntpu/NTPU_large.glb"
cp -- /home/u24/papers/beamshift/src/scene/assets/satellite-twin-array.glb "$ROOT/candidates/satellites/satellite-starlink.glb"
cp -- /home/u24/papers/beamshift/src/scene/assets/satellite-front-dish.glb "$ROOT/candidates/satellites/satellite-oneweb.glb"
cp -- /home/u24/demo/leo-beam-sim/public/models/uav.glb "$ROOT/candidates/unchanged/uav.glb"

node "$ROOT/validate-glb-geometry.mjs" --manifest "$ROOT/manifest.json"
