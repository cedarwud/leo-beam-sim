# Third-party 3D asset notices

This file records the provenance required for the visual-lab satellite assets.
It does not change the licence of this repository.

## Starlink display stand-in

- File: `public/models/satellite-starlink.glb`
- Original title: **Satellite**
- Creator: **ilarioseb**
- Source: <https://sketchfab.com/3d-models/satellite-402afb3459db47658c39875c38a6ff2a>
- Licence: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Local modification inherited from the BeamShift donor: flattened hierarchy,
  joined mesh, welded and simplified geometry, 128 x 128 textures, pruned unused
  attributes, and quantized mesh data.

## OneWeb display stand-in

- File: `public/models/satellite-oneweb.glb`
- Original title: **Simple Satellite Low Poly Free**
- Creator: **DjalalxJay**
- Source: <https://sketchfab.com/3d-models/simple-satellite-low-poly-free-f23b484cda664f1cb91b4f62ea5ef8bf>
- Licence: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Local modification inherited from the BeamShift donor: flattened hierarchy,
  joined meshes, welded and simplified geometry, 128 x 128 textures, material
  factor conversion, pruned unused attributes, and quantized mesh data.

Both models are generic display stand-ins. They do not reproduce the geometry,
antenna configuration, beam width, attitude, or panel layout of real Starlink or
OneWeb spacecraft. The constellation-to-model mapping is a presentation choice.

## Retired satellite model

The former `public/models/sat.glb` declares the following provenance in its
embedded metadata:

- Original title: **Satellite**
- Creator: **Daan van Leeuwen**
- Source: <https://sketchfab.com/3d-models/satellite-d232fe608c874009bad9613c8093a972>
- Licence: [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/)

It is retired from the new visual-lab renderer because the non-commercial term
is not suitable for an unrestricted public product build. It must not be
silently restored as an active publishable asset.

## NTPU scene

The NTPU GLB contains an embedded satellite-basemap image whose redistribution
rights have not been established. Treat all current NTPU variants as local
demonstration material. Replace or clear the basemap imagery and confirm any
OpenStreetMap attribution before public deployment.
