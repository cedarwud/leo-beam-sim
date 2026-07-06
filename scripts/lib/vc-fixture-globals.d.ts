// P2 SN-5: shared Window fixture globals for the vc* browser validators.
// Type-layer ONLY — this declaration file is never imported at runtime; it is
// picked up by tsconfig.scripts.json's include and augments Window with the
// fixture entry points that each validator installs via page.addScriptTag
// (e.g. `window.__renderVc2NonTextChannelsFixture = renderVc2NonTextChannelsFixture`).
// The property types are `typeof` the real exported fixture functions, so the
// validators' page.evaluate results keep the fixtures' true return types.
import type { renderVc1cFrequencyDemotionFixture } from '../../src/validation/vc1cFrequencyDemotionFixture.tsx';
import type { renderVc2NonTextChannelsFixture } from '../../src/validation/vc2NonTextChannelsFixture.tsx';
import type { renderVc3HexPaintFixture } from '../../src/validation/vc3HexPaintFixture.tsx';
import type { renderVc3OrbitTrailFixture } from '../../src/validation/vc3OrbitTrailFixture.tsx';
import type { renderVc3ServingRippleFixture } from '../../src/validation/vc3ServingRippleFixture.tsx';
import type { renderVc3SpineParticlesFixture } from '../../src/validation/vc3SpineParticlesFixture.tsx';
import type { renderVc3SpotlightFogFixture } from '../../src/validation/vc3SpotlightFogFixture.tsx';

declare global {
  interface Window {
    __renderVc1cFrequencyDemotionFixture: typeof renderVc1cFrequencyDemotionFixture;
    __renderVc2NonTextChannelsFixture: typeof renderVc2NonTextChannelsFixture;
    __renderVc3HexPaintFixture: typeof renderVc3HexPaintFixture;
    __renderVc3OrbitTrailFixture: typeof renderVc3OrbitTrailFixture;
    __renderVc3ServingRippleFixture: typeof renderVc3ServingRippleFixture;
    __renderVc3SpineParticlesFixture: typeof renderVc3SpineParticlesFixture;
    __renderVc3SpotlightFogFixture: typeof renderVc3SpotlightFogFixture;
  }
}

export {};
