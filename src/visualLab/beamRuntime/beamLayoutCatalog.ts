/**
 * Visual-Lab compatibility facade.  Geometry and preset validation live in the
 * framework-free core module so the simulator producer and renderer consume
 * one layout authority.
 */
export {
  DEFAULT_BEAM_LAYOUT_COUNT,
  SUPPORTED_BEAM_LAYOUT_COUNTS,
  assertSupportedBeamLayoutCount,
  beamCountForCompleteHexRings,
  createCompleteHexBeamLayout,
  createHexBeamLayout,
  isSupportedBeamLayoutCount,
  ringCountForSupportedBeamLayout,
  type CompleteHexBeamLayout as HexBeamLayout,
  type CompleteHexBeamPosition as HexBeamPosition,
  type SupportedBeamLayoutCount,
  type SupportedBeamLayoutRingCount,
} from '../../core/beam/completeHexPresets';
