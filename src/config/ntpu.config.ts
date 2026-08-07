type Vector3Tuple = [number, number, number];

export const NTPU_OBSERVER = {
  // Source: PAP-2024-MORL-MULTIBEAM user-area statement and
  // modqn-paper-reproduction/configs/modqn-paper-baseline.paper-faithful-follow-on.resolved.yaml.
  name: 'MODQN Baseline Ground Point',
  latitude: 40,
  longitude: 116,
  altitude: 0,             // 米
};

export const MODQN_PAPER_USER_AREA_KM = {
  // Source: modqn-paper-reproduction/docs/modqn-reproduction-assumption-register.md
  // ASSUME-MODQN-REP-022: uniform-rectangle sampling inside 200 km x 90 km.
  widthKm: 200,
  heightKm: 90,
};

export interface NTPUSceneConfig {
  observer: typeof NTPU_OBSERVER;
  scene: {
    modelPath: string;
    position: Vector3Tuple;
    scale: number;
    rotation: Vector3Tuple;
    measuredBoundsWu: {
      width: number;
      depth: number;
    };
  };
  uav: {
    modelPath: string;
  };
  camera: {
    initialPosition: Vector3Tuple;
    fov: number;
    near: number;
    far: number;
  };
  visualAlpha: number;
  /**
   * Visual-only camera framing hint. Beam footprint and satellite altitude
   * world-space sizes are derived from physical km through kmPerWorldUnit.
   */
  visualSatelliteAltitude: number;
  /** Maximum number of non-primary UEs shown by the handover display filter. */
  maxOtherHandoverUes: number;
}

export interface InscribedPaperUserArea {
  widthWu: number;
  depthWu: number;
  kmPerWorldUnit: number;
}

export function resolveInscribedPaperUserArea(config: NTPUSceneConfig): InscribedPaperUserArea {
  const targetAspect = MODQN_PAPER_USER_AREA_KM.widthKm / MODQN_PAPER_USER_AREA_KM.heightKm;
  const boundsWidth = config.scene.measuredBoundsWu.width * config.scene.scale;
  const boundsDepth = config.scene.measuredBoundsWu.depth * config.scene.scale;
  const boundsAspect = boundsWidth / boundsDepth;
  const widthWu = boundsAspect >= targetAspect ? boundsDepth * targetAspect : boundsWidth;
  const depthWu = widthWu / targetAspect;

  return {
    widthWu,
    depthWu,
    kmPerWorldUnit: MODQN_PAPER_USER_AREA_KM.widthKm / widthWu,
  };
}

const NTPU_UAV_CONFIG = {
  modelPath: '/models/uav.glb',
};

export const NTPU_CONFIG: NTPUSceneConfig = {
  observer: NTPU_OBSERVER,
  scene: {
    modelPath: '/scenes/NTPU.glb',
    position: [0, 0, 0],
    scale: 1,
    rotation: [0, 0, 0],
    measuredBoundsWu: {
      width: 1375.866516,
      depth: 918.623901,
    },
  },
  uav: NTPU_UAV_CONFIG,
  camera: {
    // Live default framing: the display-only satellite altitude is now 780 km,
    // so the former close position clipped the upper satellite markers/cones.
    initialPosition: [0, 900, 1200],
    fov: 60,
    near: 0.1,
    far: 10000,
  },
  visualAlpha: 0.64,
  // Live-scene display baseline aligned with the repository's 780 km LEO reference.
  // This is world-space framing only; physical profile altitude and SINR inputs stay separate.
  visualSatelliteAltitude: 780,
  maxOtherHandoverUes: 6,
};

export const NTPU_LARGE_CONFIG: NTPUSceneConfig = {
  observer: NTPU_OBSERVER,
  scene: {
    modelPath: '/scenes/NTPU_large.glb',
    position: [0, 0, 0],
    scale: 1,
    rotation: [0, 0, 0],
    measuredBoundsWu: {
      width: 2140.236755,
      depth: 1528.740601,
    },
  },
  uav: NTPU_UAV_CONFIG,
  camera: {
    initialPosition: [0, 600, 800],
    fov: 60,
    near: 0.1,
    far: 15000,
  },
  visualAlpha: 1.0,
  visualSatelliteAltitude: 600,
  maxOtherHandoverUes: 6,
};
