import { Html, Line, OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { ScientificExplanationArtifactPoint } from '../model';
import type { ScientificExplanationArtifactAvailableState } from '../route/scientificExplanationArtifactLoader';
import './ArtifactOrbitInspector.scss';

function utcLabel(value: string): string {
  return value.replace('T', ' ').replace('.000Z', ' UTC');
}

function pointVector(value: { readonly x: number; readonly y: number; readonly z: number }, scale: number): THREE.Vector3 {
  return new THREE.Vector3(value.x / scale, value.y / scale, value.z / scale);
}

function ArtifactOrbitCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(2.65, 1.85, 2.75);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 42;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

export function ArtifactOrbitScene({ point }: { readonly point: ScientificExplanationArtifactPoint }) {
  const scene = useMemo(() => {
    const ground = new THREE.Vector3(
      point.scene.groundPositionTemeKm.x,
      point.scene.groundPositionTemeKm.y,
      point.scene.groundPositionTemeKm.z,
    );
    const earthRadiusKm = Math.max(1, ground.length());
    const trajectory = point.scene.selectedTrajectory.map(sample => pointVector(sample.positionTemeKm, earthRadiusKm));
    const satellites = point.scene.satellites.map(satellite => ({
      ...satellite,
      position: pointVector(satellite.positionTemeKm, earthRadiusKm),
      velocity: new THREE.Vector3(
        satellite.velocityTemeKmPerSec.x,
        satellite.velocityTemeKmPerSec.y,
        satellite.velocityTemeKmPerSec.z,
      ).normalize(),
    }));
    const service = satellites.find(satellite => satellite.satelliteId === point.selectedSatelliteId) ?? null;
    const observer = ground.divideScalar(earthRadiusKm);
    const velocityEnd = service === null
      ? null
      : service.position.clone().add(service.velocity.clone().multiplyScalar(0.34));
    return { trajectory, satellites, service, observer, velocityEnd };
  }, [point]);

  return (
    <>
      <ArtifactOrbitCamera />
      <color attach="background" args={['#020807']} />
      <fog attach="fog" args={['#020807', 4.2, 8]} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[4, 5, 3]} intensity={2.2} color="#dffdf6" />
      <pointLight position={[-3, 1.5, -2]} intensity={3.5} color="#4cc8d8" />

      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#071b1a" emissive="#0b423c" emissiveIntensity={0.12} roughness={0.83} metalness={0.15} />
      </mesh>
      <mesh scale={1.006}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color="#347d73" wireframe transparent opacity={0.18} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#2db9a8" transparent opacity={0.035} side={THREE.BackSide} />
      </mesh>

      <Line points={scene.trajectory} color="#62d7d0" lineWidth={2.2} transparent opacity={0.78} />

      {scene.satellites.map(satellite => {
        const service = satellite.satelliteId === point.selectedSatelliteId;
        const candidate = satellite.role === 'candidate';
        const color = service ? '#f6c85f' : candidate ? '#58bfe0' : '#667c77';
        return (
          <group key={satellite.satelliteId} position={satellite.position}>
            <mesh>
              <sphereGeometry args={[service ? 0.055 : candidate ? 0.04 : 0.022, 18, 18]} />
              <meshBasicMaterial color={color} transparent opacity={service ? 1 : candidate ? 0.9 : 0.48} />
            </mesh>
            {(service || candidate) && (
              <Html center position={[0, service ? 0.12 : 0.09, 0]} className={`artifact-orbit-label ${candidate ? 'is-candidate' : 'is-service'}`}>
                <span>{service ? '服務衛星' : '候選衛星'} {satellite.satelliteId}</span>
              </Html>
            )}
          </group>
        );
      })}

      <group position={scene.observer}>
        <mesh>
          <sphereGeometry args={[0.038, 18, 18]} />
          <meshBasicMaterial color="#f6c85f" />
        </mesh>
        <Html center position={[0, 0.1, 0]} className="artifact-orbit-label is-observer">
          <span>NTPU 觀測點</span>
        </Html>
      </group>

      {scene.service !== null && (
        <Line points={[scene.observer, scene.service.position]} color="#f6c85f" lineWidth={1.5} dashed dashSize={0.04} gapSize={0.025} transparent opacity={0.68} />
      )}
      {scene.service !== null && scene.velocityEnd !== null && (
        <Line points={[scene.service.position, scene.velocityEnd]} color="#eefbf7" lineWidth={1.4} transparent opacity={0.72} />
      )}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.05}
        maxDistance={5.2}
        minPolarAngle={0.28}
        maxPolarAngle={Math.PI - 0.28}
      />
    </>
  );
}

export function ArtifactOrbitInspector({
  state,
  point,
  onClose,
}: {
  readonly state: ScientificExplanationArtifactAvailableState;
  readonly point: ScientificExplanationArtifactPoint;
  readonly onClose: () => void;
}) {
  const snapshotParts = state.source.snapshotPath.split('/');
  const snapshotName = snapshotParts[snapshotParts.length - 1] ?? state.source.snapshotPath;

  return (
    <section className="artifact-orbit-inspector" data-scene-layer="artifact-orbit-source" aria-labelledby="artifact-orbit-title">
      <div className="artifact-orbit-inspector__copy">
        <span>ARCHIVED TLE → LOCAL LINK</span>
        <h2 id="artifact-orbit-title">這一刻的鏈路，從哪一筆軌道資料開始？</h2>
        <p>拖曳可旋轉 TEME 軌道視角；關閉後回到相同時刻、衛星與 frame 的本地鏈路。</p>
      </div>

      <aside className="artifact-orbit-inspector__evidence" aria-label="目前軌道來源身分">
        <dl>
          <div><dt>資料檔</dt><dd>{snapshotName}</dd></div>
          <div><dt>目前 anchor</dt><dd>{utcLabel(point.instantUtc)}</dd></div>
          <div><dt>服務衛星／鏈路</dt><dd>{point.identity.satelliteId} ／ beam {point.identity.beamId} ／ {point.identity.userId}</dd></div>
          <div><dt>frame</dt><dd>{point.frameId}</dd></div>
        </dl>
      </aside>

      <ol className="artifact-orbit-inspector__chain" aria-label="從 TLE 到本地鏈路的轉換順序">
        <li className="is-visible"><span>01</span><strong>TLE record</strong><small>{state.source.constellation.toUpperCase()}</small></li>
        <li className="is-visible"><span>02</span><strong>SGP4 / TEME</strong><small>目前視圖</small></li>
        <li><span>03</span><strong>Earth-fixed</strong><small>座標轉換</small></li>
        <li><span>04</span><strong>NTPU topocentric</strong><small>觀測幾何</small></li>
        <li className="is-target"><span>05</span><strong>本地鏈路</strong><small>重新置中</small></li>
      </ol>

      <div className="artifact-orbit-inspector__boundary">
        <span>軌道視圖與本地鏈路保留同一 evidence 身分；轉場會重新置中與旋轉，不宣稱地理比例連續。</span>
        <button type="button" onClick={onClose}>回到本地鏈路</button>
      </div>
    </section>
  );
}
