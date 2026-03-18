export const NTPU_CONFIG = {
  observer: {
    name: 'National Taipei University',
    latitude: 24.9441667,    // 度
    longitude: 121.3713889,  // 度
    altitude: 50,            // 米
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
