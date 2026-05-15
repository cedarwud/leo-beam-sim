import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  resolveBeamPulseOpacity,
  type BeamPulseKind,
  type BeamVisualRole,
} from '../constants/beamRoleTokens';

interface BeamPulseTarget {
  material: THREE.MeshBasicMaterial;
  baseOpacity: number;
  pulse: BeamPulseKind;
  visualRole: BeamVisualRole;
  roleEnteredAtSec: number;
}

export type RegisterPulseTarget = (
  key: string,
  target: Omit<BeamPulseTarget, 'roleEnteredAtSec'> | null,
) => void;

const beamPulseTargets = new Map<string, BeamPulseTarget>();
let beamPulseClockSec = 0;

export const registerPulseTarget: RegisterPulseTarget = (key, target) => {
  if (!target) {
    beamPulseTargets.delete(key);
    return;
  }

  const existing = beamPulseTargets.get(key);
  beamPulseTargets.set(key, {
    ...target,
    roleEnteredAtSec: existing?.visualRole === target.visualRole
      ? existing.roleEnteredAtSec
      : beamPulseClockSec,
  });
};

export function BeamPulseClock({ reducedMotion = false }: { reducedMotion?: boolean }) {
  useFrame(({ clock }) => {
    const elapsedSec = clock.getElapsedTime();
    beamPulseClockSec = elapsedSec;

    for (const target of beamPulseTargets.values()) {
      target.material.opacity = resolveBeamPulseOpacity({
        baseOpacity: target.baseOpacity,
        pulse: target.pulse,
        elapsedSec,
        roleAgeSec: elapsedSec - target.roleEnteredAtSec,
        reducedMotion,
      });
    }
  });

  return null;
}
