import { useRef } from 'react';
import type { SimFrame } from './types';

export type UeTrailPoint = readonly [number, number, number];
export type UeTrailHistory = ReadonlyArray<ReadonlyArray<UeTrailPoint>>;

export const UE_TRAIL_HISTORY_LIMIT = 30;

export function appendUeTrailHistory(
  history: UeTrailHistory,
  positions: ReadonlyArray<UeTrailPoint>,
  limit = UE_TRAIL_HISTORY_LIMIT,
): UeTrailHistory {
  const cappedLimit = Math.max(1, Math.trunc(limit));
  return positions.map((position, index) => {
    const previous = history[index] ?? [];
    return [...previous, position].slice(-cappedLimit);
  });
}

function toTrailPoints(
  perUePositions: SimFrame['perUePositions'],
): ReadonlyArray<UeTrailPoint> {
  return perUePositions.map((position) => [
    position.groundX,
    0,
    position.groundZ,
  ] as const);
}

export function useUeTrailHistory({
  enabled,
  perUePositions,
  resetKey,
}: {
  enabled: boolean;
  perUePositions: SimFrame['perUePositions'];
  resetKey?: string;
}): UeTrailHistory | undefined {
  const historyRef = useRef<UeTrailHistory>([]);
  const resetKeyRef = useRef<string | undefined>(resetKey);

  if (!enabled) {
    historyRef.current = [];
    resetKeyRef.current = resetKey;
    return undefined;
  }

  if (resetKeyRef.current !== resetKey) {
    historyRef.current = [];
    resetKeyRef.current = resetKey;
  }

  historyRef.current = appendUeTrailHistory(
    historyRef.current,
    toTrailPoints(perUePositions),
  );

  return historyRef.current;
}
