import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';
import { formatBeamLabel, formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import {
  resolveHandoverToastState,
  type HandoverToastState,
} from './handoverToastState';

interface Props {
  frame: NormalizedSceneFrame;
  interTriggerSec: number;
}

function formatEndpoint(satId: string | null, beamId: number | null): string {
  return `${formatSatelliteLabel(satId)} ${formatBeamLabel(beamId)}`;
}

function formatToastPath(state: HandoverToastState): string {
  if (state.kind === 'intra' && state.sourceSatId === state.targetSatId) {
    return `${formatSatelliteLabel(state.sourceSatId)} ${formatBeamLabel(state.sourceBeamId)} -> ${formatBeamLabel(state.targetBeamId)}`;
  }

  return `${formatEndpoint(state.sourceSatId, state.sourceBeamId)} -> ${formatEndpoint(state.targetSatId, state.targetBeamId)}`;
}

export function HandoverToastOverlay({ frame, interTriggerSec }: Props) {
  const { gl } = useThree();
  const wallClockNowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
  const toast = resolveHandoverToastState(frame, interTriggerSec, wallClockNowMs);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.dataset.handoverToastActive = toast ? '1' : '0';
    canvas.dataset.handoverToastKind = toast?.kind ?? '';
    canvas.dataset.handoverToastProgress = toast?.progressRatio.toFixed(4) ?? '';

    return () => {
      canvas.dataset.handoverToastActive = '0';
      canvas.dataset.handoverToastKind = '';
      canvas.dataset.handoverToastProgress = '';
    };
  }, [gl.domElement, toast?.kind, toast?.progressRatio]);

  if (!toast) return null;

  const label = toast.kind === 'intra' ? 'Intra handover' : 'Inter handover';
  const progressLabel = `${toast.progressSec.toFixed(1)} / ${toast.targetSec.toFixed(1)} s`;

  return (
    <Html
      fullscreen
      zIndexRange={[95, 95]}
      style={{ pointerEvents: 'none' }}
    >
      <div className="leo-handover-toast-layer" aria-live="polite">
        <div
          className="leo-handover-toast"
          role="status"
          data-testid="handover-toast"
          data-handover-toast-kind={toast.kind}
        >
          <span className="leo-handover-toast__label">{label}</span>
          <span className="leo-handover-toast__path">{formatToastPath(toast)}</span>
          <span className="leo-handover-toast__progress">{progressLabel}</span>
        </div>
      </div>
    </Html>
  );
}
