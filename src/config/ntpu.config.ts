export const NTPU_CONFIG = {
  observer: {
    name: 'Beijing Observer',
    latitude: 40,            // 度 (paper consensus: 40°N)
    longitude: 116,          // 度 (116°E)
    altitude: 0,             // 米
  },
  scene: {
    modelPath: '/scenes/NTPU.glb',
    position: [0, 0, 0] as [number, number, number],
    scale: 1,
    rotation: [0, 0, 0] as [number, number, number],
  },
  uav: {
    modelPath: '/models/uav.glb',
  },
  camera: {
    initialPosition: [0, 400, 500] as [number, number, number],
    fov: 60,
    near: 0.1,
    far: 10000,
  },
};
