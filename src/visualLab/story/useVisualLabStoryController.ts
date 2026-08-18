import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { LabSnapshot } from '../session';
import {
  createVisualLabStoryController,
  type VisualLabStoryController,
} from './visualLabStoryController';

/**
 * React adapter over the framework-free story controller.  The controller
 * identity remains stable while session publications rebind its immutable
 * read model; no interval, animation frame, or session seek is hidden here.
 */
export function useVisualLabStoryController(
  snapshot: LabSnapshot,
): VisualLabStoryController {
  const controllerRef = useRef<VisualLabStoryController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createVisualLabStoryController(snapshot);
  }
  const controller = controllerRef.current;
  // Rebinding publishes controller state, so it must happen after React has
  // committed the session snapshot rather than while the route is rendering.
  useEffect(() => {
    controller.updateSnapshot(snapshot);
  }, [controller, snapshot]);
  useSyncExternalStore(
    listener => controller.subscribe(listener),
    () => controller.state(),
    () => controller.state(),
  );
  return controller;
}

/** State-only convenience for routes that do not need to retain the facade. */
export function useVisualLabStoryState(snapshot: LabSnapshot) {
  return useVisualLabStoryController(snapshot).state();
}
