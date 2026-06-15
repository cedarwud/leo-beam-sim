// MODQN tab consolidation S4 — Advanced setup drawer.
//
// The MODQN "Setup" power tools (TrainingForm / JobsPanel / omega-weight
// objective editor) were a second left-rail tab after S3. The north star is
// fewer visible controls, direct defaults, and low learning cost: the default
// MODQN surface should be the evidence/replay story, not a training/debug
// console. S4 moves the setup tools OUT of the left rail (which then collapses
// to the single Evidence / Replay tab) and behind an opt-in Advanced drawer, so
// the power surface is reachable but not in the default path.
//
// S5a also moves optional MODQN display-depth and decision-policy controls here.
// The drawer is now the single home for non-default MODQN operations; ControlBar
// remains a compact lane-owned toolbar instead of accumulating more branches.
//
// These three components are KEEP-ACTIVE (real live SSE training telemetry, real
// backend polling, the only ω EDIT surface) — they are not degenerate-data
// parked. The drawer relocates them; it does not gate or disable them. The
// drawer trigger is mounted by App.tsx in the left aside, gated on the MODQN
// lanes (`sceneLane !== 'sinr-live'`).
//
// G1-CONTROLBAR-ADV: the trigger + modal scrim + focus management now live in the
// shared AdvancedDrawerShell (the SINR-live lane uses the same shell for its own
// display/camera controls). This component keeps the MODQN content + its
// `advanced-setup` testid prefix, so the drawer DOM is byte-identical.
import { type ReactElement } from 'react';
import type { AppExperienceMode } from './appMode';
import type { RuntimeHandoverMode } from '../modqn/runtimeControls';
import type { ModqnVisualLayerPreset } from '../scene/modqnVisualLayers';
import type { SimState } from '../scene/types';
import { AdvancedDrawerShell } from './AdvancedDrawerShell';
import { ModqnAdvancedDisplayControls } from './modqn-controls/ModqnAdvancedDisplayControls';
import { TrainingForm } from './modqn-training/TrainingForm';
import { JobsPanel } from './modqn-training/JobsPanel';
import { ModqnObjectiveTab } from './ModqnObjectiveTab';
import { ModqnTopKDecisionPreview } from './ModqnTopKDecisionPreview';

interface AdvancedSetupDrawerProps {
  readonly appMode: AppExperienceMode;
  readonly handoverMode: RuntimeHandoverMode;
  readonly modqnVisualLayerPreset: ModqnVisualLayerPreset;
  readonly showDecisionPolicyControls: boolean;
  readonly simState: SimState;
  readonly onModqnVisualLayerPresetChange: (preset: ModqnVisualLayerPreset) => void;
  readonly onModqnDecisionPolicyChange: (mode: RuntimeHandoverMode) => void;
}

export function AdvancedSetupDrawer({
  appMode,
  handoverMode,
  modqnVisualLayerPreset,
  showDecisionPolicyControls,
  simState,
  onModqnVisualLayerPresetChange,
  onModqnDecisionPolicyChange,
}: AdvancedSetupDrawerProps): ReactElement {
  return (
    <AdvancedDrawerShell
      testIdPrefix="advanced-setup"
      triggerLabel="⚙ Advanced setup"
      triggerHint="display · policy · training · omega"
      dialogTitle="MODQN advanced setup"
      dialogAriaLabel="MODQN advanced setup"
      closeAriaLabel="Close advanced setup"
      // Non-modal inline disclosure (no full-screen scrim). The advanced tools
      // are degenerate-data power tools you rarely touch live, so dimming the
      // whole viewport added no value — the drawer now expands in-flow in the
      // left aside (same modality as the SINR-live lane), scene + timeline stay
      // live. Behavior-locked by validate:frontend:advanced-drawer-modality.
      modal={false}
    >
      <ModqnAdvancedDisplayControls
        handoverMode={handoverMode}
        modqnVisualLayerPreset={modqnVisualLayerPreset}
        showDecisionPolicyControls={showDecisionPolicyControls}
        onModqnVisualLayerPresetChange={onModqnVisualLayerPresetChange}
        onModqnDecisionPolicyChange={onModqnDecisionPolicyChange}
      />
      <TrainingForm appMode={appMode} />
      <JobsPanel appMode={appMode} />
      <ModqnObjectiveTab />
      {/* S-ADV-4: the relocated legacy Top-K decision preview (degenerate /
          empty on the baseline producer artifact) lives here, off the
          default Evidence rail. */}
      <ModqnTopKDecisionPreview simState={simState} />
    </AdvancedDrawerShell>
  );
}
