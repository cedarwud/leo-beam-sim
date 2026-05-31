# SDD: Interactive Showcase Timeline & Playback Controls

## Status

**Draft** — 2026-05-31. Technical specifications and implementation roadmap for introducing a sleek, glassmorphic bottom timeline bar with full play/pause, speed multipliers, step forward/backward, and continuous range scrubbing for both `live-sim` and `artifact-replay` modes.

---

## 1. Context & Objectives

Currently, `leo-beam-sim` has basic playback options (Play/Pause button and 1x-20x Speed slider) situated inside the side `ControlBar`. However, it lacks a standard, linear **Timeline Scrubber** that allows users to seek to specific points in time. 

Without a timeline:
1. Users cannot easily scrub back to re-observe a brief, critical handover transition.
2. Observing specific events requires waiting for the simulation to cycle naturally or restarting the entire simulation.
3. The offline `artifact-replay` mode has a stateful `ShowcaseReplayController` with full seek capabilities, but there is no UI component to control it.

### Objectives:
- **Interactive Scrubber**: Drag or click a continuous timeline bar to jump (seek) to any timestamp.
- **Playback Controls**: Standard control buttons: Play/Pause (`▶`/`⏸`), Step Backward 10s (`⏪`), Step Forward 10s (`⏩`), Jump to Start (`⏮`), Jump to End (`⏭`).
- **Speed Presets**: Fast speed selection buttons (e.g., `1x`, `2x`, `5x`, `10x`, `20x`).
- **Unified Time Domain**: Seamless operation across both `live-sim` mode (0s to 1200s trajectory cache) and `artifact-replay` mode (bound to the pre-recorded timeline duration).
- **Aesthetic Excellence**: A premium, floating glassmorphic timeline bar situated at the bottom-center of the viewport, styled with CSS variables and glowing neon accents.

---

## 2. Technical Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                        App.tsx                         │
│  Owns playback state & mounts the floating Timeline   │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼ (artifact-replay mode)         ▼ (live-sim mode)
┌────────────────────────────────┐    ┌────────────────────────────────┐
│   ShowcaseReplayController     │    │        useSimulation.ts        │
│  - Mapped to pre-recorded time │    │  - Mapped to simTimeSec        │
│  - Call controller.seek(tSec)  │    │  - Updates runtimeStateRef     │
│  - Seek updates frame index    │    │  - Resets HandoverManagers     │
└────────────────────────────────┘    └────────────────────────────────┘
```

### A. The Timeline Component (`src/ui/TimelineBar.tsx`)
We will create a dedicated `TimelineBar` component that accepts:
- `currentTimeSec`: Current playback time in seconds.
- `durationSec`: Total duration of the current run (1200s for `live-sim` mode, or `artifact.timeline` length for `artifact-replay` mode).
- `paused`: Current play/pause state.
- `speed`: Current playback speed.
- `onTogglePause`: Play/Pause action callback.
- `onSeek`: Seeking callback (receives `targetTimeSec`).
- `onSpeedChange`: Speed update callback.

### B. Live-Simulation Reset Logic (State Invariance & Safety)
In `live-sim` mode, the `HandoverManager` state is stateful and keeps historical data (such as hysteresis, ping-pong timers, and trigger durations). 
- **The Seek Rule**: When seeking to a new time in `live-sim` mode, the `HandoverManager` and all secondary UE handover managers **MUST be reset** (`hoManager.reset()`). This prevents old signal history or trigger states from corrupting the new timeline position.
- `useSimulation` already implements a `resetToReplayStartFrame` that does exactly this. We will expose an explicit seeking method or leverage the existing dependency updates to reset and step to the target time instantly.

---

## 3. Detailed Component Spec

### A. UI Layout (`src/ui/TimelineBar.tsx`)
The JSX tree of the timeline bar will be structured as:
```tsx
<div className="leo-timeline-bar">
  <div className="leo-timeline-bar__controls">
    <button onClick={() => onSeek(0)}>⏮</button>
    <button onClick={() => onSeek(Math.max(0, currentTime - 10))}>⏪</button>
    <button onClick={onTogglePause}>{paused ? '▶' : '⏸'}</button>
    <button onClick={() => onSeek(Math.min(duration, currentTime + 10))}>⏩</button>
    <button onClick={() => onSeek(duration)}>⏭</button>
  </div>
  
  <div className="leo-timeline-bar__scrubber-container">
    <span className="leo-timeline-bar__time">{formatTime(currentTimeSec)}</span>
    <input 
      type="range"
      min={0}
      max={durationSec}
      step={0.1}
      value={currentTimeSec}
      onChange={(e) => onSeek(Number(e.target.value))}
      className="leo-timeline-bar__slider"
    />
    <span className="leo-timeline-bar__time">{formatTime(durationSec)}</span>
  </div>
  
  <div className="leo-timeline-bar__speed-presets">
    {[1, 2, 5, 10, 20].map(s => (
      <button 
        key={s} 
        onClick={() => onSpeedChange(s)}
        className={speed === s ? 'active' : ''}
      >
        {s}x
      </button>
    ))}
  </div>
</div>
```

### B. Styling Specification (`src/styles/_timeline-bar.scss`)
- **Glassmorphism**: 
  - `background: rgba(6, 18, 28, 0.82);`
  - `backdrop-filter: blur(12px);`
  - `border: 1px solid rgba(137, 205, 255, 0.2);`
  - `box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);`
- **Slider Bar**: A glowing cyan/neon-green track representing the elapsed progress, with a sleek, circular white handle (`thumb`) that pulses or glows on hover.

---

## 4. Implementation Phased Slices

### Slice T1: Scrubber UI Component & Styles
- Implement `src/ui/TimelineBar.tsx` and styling file `src/styles/_timeline-bar.scss`.
- Include standard `formatTime` helper (converts seconds to `MM:SS` format).
- Wire custom SCSS stylesheet into `src/styles/main.scss`.

### Slice T2: Integration in Artifact-Replay Mode
- Connect `TimelineBar` to the state inside `App.tsx` when `sceneSource === 'artifact-replay'`.
- Map `currentTimeSec` to `currentTimeSec` state from the `replayController` listener.
- Mapped `onSeek` calls to `replayController.seek(targetSec)`.
- Ensure continuous Playwright DOM dataset sync (e.g., updating the slider element's test attributes so E2E selectors can click/scrub).

### Slice T3: Integration in Live-Simulation Mode
- Update `useSimulation.ts` to support external seeking.
- Expose `onSeek` in the simulation loop. Seeking triggers:
  1. Setting `runtimeStateRef.current.simTimeSec = targetSec`.
  2. Calling `resetAllHoManagers()` and `resetMobilityStates()`.
  3. Forcing a re-render tick via `setVersion(v => v + 1)`.
- In `App.tsx`, maintain the local elapsed time and wire the slider `onSeek` callback to this simulation reset cycle.

### Slice T4: Final Visual QA & Telemetry Validation
- Add timeline metadata to `gl.domElement.dataset` or `document.body` dataset for test assertions.
- Write a dedicated validator: `scripts/validate-timeline-scrubbing.tsx` that ensures time updates propagate and trigger state machine resets.
- Run the full linter and suite validators.

---

## 5. Verification & Acceptance Checklist

To ensure absolute rigor, the new timeline feature must pass the following checks:
1. **Reset Integrity**: Seeking backwards in `live-sim` mode must immediately clear serving histories, preventing ghost handover events.
2. **Bounds Safety**: Seeking must clamp to `[0, durationSec]`.
3. **No performance regressions**: Sliding the timeline must be lightweight, causing no React state thrashing in Three.js renders.
4. **E2E Smoke Tests**: Linter and scene lane governance validators pass successfully.
