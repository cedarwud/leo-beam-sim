/**
 * ShowcaseReplayController — minimal stateful cursor over a loaded
 * `VisualShowcaseArtifact` timeline.
 *
 * P1a+b scope: cursor skeleton only.
 *   - `currentFrameIndex()`
 *   - `seek(tSec)`
 *   - `play()` / `pause()`
 *   - `setPlaybackSpeed(n)`
 *   - `subscribe(cb)`
 *
 * Explicitly OUT of scope for P1a+b (deferred to P3):
 *   - actual `useFrame`-driven advance loop (no react-three-fiber dependency
 *     here — leave the controller framework-agnostic)
 *   - world-space interpolation between samples
 *
 * Rationale (SDD §9 P3 row):
 *   P3 will add the timeline advance loop; the interpolation MUST happen in
 *   world space after `coordToWorld`, never in raw `positionEcefKm` space
 *   (re-applying the ECI proxy assumption to synthesised intermediate
 *   positions would invent geometry — R1 violation).
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`.
 *   - No react / three.js / @react-three imports — keep this pure TS so the
 *     controller is testable without a renderer.
 */

import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';

export type ShowcasePlaybackState = 'paused' | 'playing';

export interface ShowcaseControllerSnapshot {
  readonly frameIndex: number;
  readonly tSec: number;
  readonly state: ShowcasePlaybackState;
  readonly playbackSpeed: number;
}

export type ShowcaseControllerSubscriber = (snap: ShowcaseControllerSnapshot) => void;

/**
 * Minimal cursor over the artifact's `timeline`. Stateful but framework-free.
 *
 * Subscribers are called synchronously after any state mutation.
 *
 * TODO P3: add `tick(deltaSec)` (or `advanceTo(tSec)`) for the playback loop.
 * The advance MUST clamp to `artifact.timeline[].tSec` discrete samples in
 * P1a+b mode (no interpolation here); world-space interpolation lives in the
 * renderer or a separate `InterpolatedSceneFrame` adapter added in P3.
 */
export class ShowcaseReplayController {
  private readonly artifact: VisualShowcaseArtifact;
  private readonly timesSec: readonly number[];
  private cursorIndex: number;
  private state: ShowcasePlaybackState;
  private playbackSpeed: number;
  private subs: Set<ShowcaseControllerSubscriber>;

  constructor(artifact: VisualShowcaseArtifact) {
    if (artifact.timeline.length === 0) {
      throw new Error('[ShowcaseReplayController] artifact.timeline is empty');
    }
    this.artifact = artifact;
    this.timesSec = artifact.timebase.timesSec ?? artifact.timeline.map((f) => f.tSec);
    if (this.timesSec.length !== artifact.timeline.length) {
      throw new Error(
        '[ShowcaseReplayController] timebase.timesSec length ' +
          `(${this.timesSec.length}) does not match timeline length ` +
          `(${artifact.timeline.length})`,
      );
    }
    this.cursorIndex = 0;
    this.state = 'paused';
    this.playbackSpeed = artifact.scenario.defaultPlaybackSpeed || 1;
    this.subs = new Set();
  }

  /** Current frame index (0-based). */
  currentFrameIndex(): number {
    return this.cursorIndex;
  }

  /** Current frame timestamp in seconds. */
  currentTSec(): number {
    return this.timesSec[this.cursorIndex];
  }

  /** Total number of frames. */
  totalFrames(): number {
    return this.artifact.timeline.length;
  }

  /**
   * Seek to the nearest frame whose `tSec` ≤ `tSec`. Clamps to the timeline.
   */
  seek(tSec: number): void {
    if (!Number.isFinite(tSec)) {
      throw new Error(`[ShowcaseReplayController] seek tSec=${tSec} is not finite`);
    }
    const clamped = Math.max(
      this.timesSec[0],
      Math.min(this.timesSec[this.timesSec.length - 1], tSec),
    );
    let idx = 0;
    // Linear scan; replace with binary search if timelines grow beyond ~1k samples.
    for (let i = 0; i < this.timesSec.length; i++) {
      if (this.timesSec[i] <= clamped) idx = i;
      else break;
    }
    if (idx !== this.cursorIndex) {
      this.cursorIndex = idx;
      this.notify();
    }
  }

  /**
   * Seek directly by frame index.
   */
  seekToFrame(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.timesSec.length) {
      throw new Error(`[ShowcaseReplayController] seekToFrame index=${index} out of bounds`);
    }
    if (index !== this.cursorIndex) {
      this.cursorIndex = index;
      this.notify();
    }
  }

  /** Transition to `'playing'`. No-op if already playing. */
  play(): void {
    if (this.state !== 'playing') {
      this.state = 'playing';
      this.notify();
    }
  }

  /** Transition to `'paused'`. No-op if already paused. */
  pause(): void {
    if (this.state !== 'paused') {
      this.state = 'paused';
      this.notify();
    }
  }

  /** Set playback-speed multiplier (positive). */
  setPlaybackSpeed(n: number): void {
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`[ShowcaseReplayController] playback speed must be positive finite, got ${n}`);
    }
    if (n !== this.playbackSpeed) {
      this.playbackSpeed = n;
      this.notify();
    }
  }

  /** Subscribe to controller state changes. Returns an unsubscribe fn. */
  subscribe(cb: ShowcaseControllerSubscriber): () => void {
    this.subs.add(cb);
    // Replay current snapshot immediately so subscribers don't have to seed
    // their own state from a separate call.
    cb(this.snapshot());
    return () => {
      this.subs.delete(cb);
    };
  }

  snapshot(): ShowcaseControllerSnapshot {
    return {
      frameIndex: this.cursorIndex,
      tSec: this.timesSec[this.cursorIndex],
      state: this.state,
      playbackSpeed: this.playbackSpeed,
    };
  }

  private notify(): void {
    const snap = this.snapshot();
    for (const sub of this.subs) sub(snap);
  }
}
