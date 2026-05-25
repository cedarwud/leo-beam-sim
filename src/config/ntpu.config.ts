type Vector3Tuple = [number, number, number];

export const NTPU_OBSERVER = {
  name: 'Beijing Observer',
  latitude: 40,            // 度 (paper consensus: 40°N)
  longitude: 116,          // 度 (116°E)
  altitude: 0,             // 米
};

export interface NTPUSceneConfig {
  observer: typeof NTPU_OBSERVER;
  scene: {
    modelPath: string;
    position: Vector3Tuple;
    scale: number;
    rotation: Vector3Tuple;
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
  },
  uav: NTPU_UAV_CONFIG,
  camera: {
    initialPosition: [0, 400, 500],
    fov: 60,
    near: 0.1,
    far: 10000,
  },
};

export const NTPU_LARGE_CONFIG: NTPUSceneConfig = {
  observer: NTPU_OBSERVER,
  scene: {
    modelPath: '/scenes/NTPU_large.glb',
    position: [0, 0, 0],
    scale: 1,
    rotation: [0, 0, 0],
  },
  uav: NTPU_UAV_CONFIG,
  camera: {
    initialPosition: [0, 600, 800],
    fov: 60,
    near: 0.1,
    far: 15000,
  },
};
