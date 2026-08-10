import { Line } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { NTPU_CONFIG, type NTPUSceneConfig } from '@/config/ntpu.config';
import { BaseSceneLayout } from '@/scene/BaseSceneLayout';
import {
  C120_CLAIM_BOUNDARY,
  type C120ReplayFrame,
} from './contract';
import { useC120Locale } from './i18n';

export interface C120CourseSceneProps {
  readonly frame: C120ReplayFrame;
  readonly trajectoryTruthLabel: string;
}

const C120_SCENE_CONFIG: NTPUSceneConfig = {
  ...NTPU_CONFIG,
  camera: {
    ...NTPU_CONFIG.camera,
    initialPosition: [0, 560, 760],
    fov: 50,
  },
};

function tuple(position: readonly [number, number, number]): [number, number, number] {
  return [position[0], position[1], position[2]];
}

const C120_ZH_REPLAY_LABELS: Readonly<Record<string, string>> = {
  'anchor source at target time': '在指定時間定位衛星資料',
  'NTPU service window anchor': 'NTPU 衛星服務時段基準',
  'teaching-band:anchor': '教學連線帶：基準',
  'teaching-band:strong': '教學連線帶：良好',
  'teaching-band:medium': '教學連線帶：普通',
  'teaching-band:weak': '教學連線帶：偏弱',
  'teaching-band:offline': '教學連線帶：無連線',
  'active transfer': '資料傳送中',
  'sleep after burst': '快速傳送後休眠',
  'completed service': '服務已完成',
  'expired service': '服務已逾期',
  'tight window opens': '較短的服務時段開始',
  'qualified service complete': '符合條件的服務已完成',
  'lower energy but unqualified service': '能量較低，但服務未達條件',
  'deadline missed after early sleep': '太早休眠，因此錯過期限',
  'serving beam A': '目前使用波束 A',
  'serving beam B': '目前使用波束 B',
  'contact open': '可連線時段',
  'contact closed': '無法連線時段',
  'urgent sent': '緊急資料已送出',
  'urgent delivered': '緊急資料已送達',
  'bulk transfer': '大量資料傳送中',
  'schedule complete': '排程完成',
  'sleep between arrivals': '等待資料時休眠',
  'batch queued': '週期資料已排入批次',
  'periodic queued': '週期資料等待批次傳送',
  'batch transfer': '批次資料傳送中',
  'batch delivered': '批次資料已送達',
  'urgent missed': '緊急資料未在期限內送達',
  'revised schedule complete': '修正版排程完成',
  'decision-time features available': '只使用決策當下可取得的資料',
  'future outcome is not available': '未來結果在決策當下不可取得',
  'service protected': '服務條件受到保護',
  'prediction score chased': '只追逐預測分數',
  'score-prioritized action misses service': '優先追逐分數，卻錯過服務條件',
  'start pace candidate': '開始穩定節奏方案',
  'start balanced candidate': '開始平衡節奏方案',
  'start burst candidate': '開始快速傳送方案',
  'finish and sleep': '完成後休眠',
  'finish at balanced pace': '以平衡節奏完成',
  'sleep before final payload': '最後一批資料前先休眠',
  'finish before tighter deadline': '在較短期限前完成',
  'window closes before final payload': '最後一批資料前服務時段已結束',
  'burst ends before payload completes': '快速傳送結束，但資料尚未完成',
  'observe first quality event': '觀察第一個連線品質事件',
  'switch at first improvement': '品質一改善就切換',
  'switch after two stable events': '連續兩次穩定後切換',
  'switch only after clear separation': '差異明顯時才切換',
  'hold fixed contact': '保持固定可連線時段',
  'hold fixed outage': '保持固定中斷時段',
  'send urgent card': '傳送緊急資料卡',
  'send second urgent card': '傳送第二張緊急資料卡',
  'send bulk card': '傳送大量資料卡',
  'finish baseline': '完成基準排程',
  'wait for periodic card': '等待週期資料卡',
  'batch periodic card': '把週期資料卡加入批次',
  'flush batch': '送出批次資料',
  'flush periodic batch': '送出週期資料批次',
  'finish batched schedule': '完成批次排程',
  'send surprise urgent card': '傳送突發緊急資料卡',
  'freeze honest action': '凍結只使用當下資料的動作',
  'freeze leaky action': '凍結使用未來資訊的動作',
  'freeze action Q': '凍結動作 Q',
  'replay held-out action': '重播保留情境中的動作',
};

function replayLabel(value: string, locale: 'zh-Hant' | 'en'): string {
  return locale === 'zh-Hant' ? (C120_ZH_REPLAY_LABELS[value] ?? value) : value;
}

function ReplayOverlay({ frame }: Pick<C120CourseSceneProps, 'frame'>) {
  const satellite = tuple(frame.scene.satellitePosition);
  const beam = tuple(frame.scene.beamPosition);
  const observer = tuple(frame.scene.observerPosition);
  const serviceColor = frame.evidence.servicePass ? '#4fd6c2' : '#f59e72';

  return (
    <group>
      <mesh position={satellite}>
        <sphereGeometry args={[22, 20, 12]} />
        <meshStandardMaterial color="#a5c9f5" emissive="#15395b" emissiveIntensity={0.72} />
      </mesh>
      <mesh position={beam} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[44, 20, 4, 8]} />
        <meshStandardMaterial color={serviceColor} transparent opacity={0.68} emissive={serviceColor} emissiveIntensity={0.4} />
      </mesh>
      {frame.scene.visible && (
        <Line points={[satellite, beam, observer]} color={serviceColor} lineWidth={2} transparent opacity={0.9} />
      )}
      <mesh position={observer}>
        <sphereGeometry args={[11, 16, 8]} />
        <meshStandardMaterial color="#f6cf78" emissive="#5a3d12" emissiveIntensity={0.78} />
      </mesh>
    </group>
  );
}

export function C120CourseScene({ frame, trajectoryTruthLabel }: C120CourseSceneProps) {
  const { locale, text } = useC120Locale();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <section
      className="c120-scene"
      data-testid="c120-scene"
      data-scenario-id={frame.identity.scenarioId}
      data-frame-id={frame.identity.frameId}
      data-replay-input-id={frame.identity.replayInputId}
      data-claim-boundary={C120_CLAIM_BOUNDARY}
      data-trajectory-truth={trajectoryTruthLabel}
      lang={locale}
      aria-label={text(`C-120 模擬 NTPU 結果畫面 ${frame.identity.frameId}`, `C-120 simulated NTPU replay frame ${frame.identity.frameId}`)}
    >
      <div className="c120-scene__caption">
        <span aria-hidden="true" />
        <strong>{text('NTPU 結果預覽', 'NTPU REPLAY PREVIEW')}</strong>
        <small className="c120-scene__truth">{trajectoryTruthLabel}</small>
        <small>{frame.identity.surface} / {frame.identity.frameId}</small>
      </div>
      <Canvas
        frameloop="demand"
        dpr={1}
        shadows={false}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        fallback={(
          <div className="c120-scene-fallback" role="alert">
            <strong>{text('這個瀏覽器無法顯示 3D 結果畫面。', 'The 3D result view is unavailable in this browser.')}</strong>
            <p>{text('你仍可用下方同步的數值完成課程。這張圖只幫你看見變化，不會計算課程證據。', 'You can still complete the course with the synchronized values below. This view helps you see the change; course evidence is calculated elsewhere.')}</p>
            <small>{C120_CLAIM_BOUNDARY}</small>
          </div>
        )}
      >
        <BaseSceneLayout sceneConfig={C120_SCENE_CONFIG} controlsRef={controlsRef}>
          <ReplayOverlay frame={frame} />
        </BaseSceneLayout>
      </Canvas>
      <div className="c120-scene__readout" aria-live="off">
        <span>{frame.evidence.servicePass ? text('服務達標 ✓', 'SERVICE PASS ✓') : text('服務未達標 ✕', 'SERVICE FAIL ✕')}</span>
        <strong>{text('目前狀態', 'Current state')}：{replayLabel(frame.stateLabel, locale)}</strong>
        <small>{text('動作', 'Action')}：{replayLabel(frame.actionLabel, locale)} / {text('連線品質', 'Link quality')}：{replayLabel(frame.qualityLabel, locale)}</small>
      </div>
      <p className="c120-surface-claim">{C120_CLAIM_BOUNDARY}</p>
    </section>
  );
}
