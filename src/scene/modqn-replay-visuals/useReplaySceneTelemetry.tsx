import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { ModqnReplaySceneVisualState } from '../modqnReplaySceneVisuals';
import { REPLAY_CANVAS_ATTRIBUTES } from './constants';
import { formatPoint } from './geometry';

function removeReplayCanvasAttributes(canvas: HTMLCanvasElement): void {
  for (const attribute of REPLAY_CANVAS_ATTRIBUTES) {
    canvas.removeAttribute(attribute);
  }
}

export function useReplaySceneTelemetry(
  visualState: ModqnReplaySceneVisualState | null,
  enabled = true,
): void {
  const gl = useThree(state => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    if (!enabled) {
      removeReplayCanvasAttributes(canvas);
      return () => removeReplayCanvasAttributes(canvas);
    }

    canvas.setAttribute(
      'data-modqn-replay-scene-layer',
      visualState === null ? 'fail-closed' : 'ready',
    );
    canvas.setAttribute('data-modqn-replay-scene-renderer', 'r3f-world-layer');

    if (visualState !== null) {
      canvas.setAttribute('data-modqn-replay-scene-source', visualState.source);
      canvas.setAttribute('data-modqn-replay-scene-geometry-source', visualState.geometrySource);
      canvas.setAttribute('data-modqn-replay-scene-event-kind', visualState.eventKind);
      canvas.setAttribute('data-modqn-replay-scene-selection-source', visualState.selectionSource);
      canvas.setAttribute('data-modqn-replay-scene-previous-beam', visualState.previous.producerBeamId);
      canvas.setAttribute('data-modqn-replay-scene-selected-beam', visualState.selected.producerBeamId);
      canvas.setAttribute('data-modqn-replay-scene-previous-position', formatPoint(visualState.previous.position));
      canvas.setAttribute('data-modqn-replay-scene-selected-position', formatPoint(visualState.selected.position));
      canvas.setAttribute('data-modqn-replay-scene-source-row', String(visualState.sourceRowNumber));
      canvas.setAttribute(
        'data-modqn-replay-producer-satellite-state-count',
        String(visualState.producerSatelliteStateCount),
      );
      canvas.setAttribute(
        'data-modqn-replay-rendered-satellite-state-count',
        String(visualState.renderedSatelliteStateCount),
      );
      canvas.setAttribute('data-modqn-replay-expected-satellite-count', String(visualState.expectedProducerSatelliteCount));
      canvas.setAttribute('data-modqn-replay-slot-decision-row-count', String(visualState.slotDecisionRowCount));
      canvas.setAttribute('data-modqn-replay-truth-level', visualState.truthAudit.highestSceneLevel);
      canvas.setAttribute('data-modqn-replay-source-gap-count', String(visualState.truthAudit.sourceGapCount));
    } else {
      for (const attribute of REPLAY_CANVAS_ATTRIBUTES) {
        if (
          attribute !== 'data-modqn-replay-scene-layer'
          && attribute !== 'data-modqn-replay-scene-renderer'
        ) {
          canvas.removeAttribute(attribute);
        }
      }
    }

    return () => removeReplayCanvasAttributes(canvas);
  }, [enabled, gl, visualState]);
}
