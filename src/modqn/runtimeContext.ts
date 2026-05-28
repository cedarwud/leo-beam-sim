import {
  createContext,
  createElement,
  useMemo,
  type ReactNode,
} from 'react';
import type { ModqnReplayEnvelope } from './replay-bundle/replay-state';
import {
  DEFAULT_RUNTIME_HANDOVER_MODE,
  MODQN_PAPER_FAITHFUL_OMEGA,
  type RuntimeHandoverMode,
  type RuntimeOmegaState,
} from './runtimeControls';

export interface ModqnHandoverModeContextValue {
  readonly mode: RuntimeHandoverMode;
  readonly setMode: (next: RuntimeHandoverMode) => void;
  readonly omegaActive: RuntimeOmegaState;
  readonly onOmegaActiveChange: (next: RuntimeOmegaState) => void;
  readonly rescalarizeFallbackCount: number;
  readonly incrementRescalarizeFallback: () => void;
}

export const DEFAULT_MODQN_HANDOVER_MODE_CONTEXT: ModqnHandoverModeContextValue = {
  mode: DEFAULT_RUNTIME_HANDOVER_MODE,
  setMode: () => { /* no-op for headless/test mounts that do not provide context */ },
  omegaActive: MODQN_PAPER_FAITHFUL_OMEGA,
  onOmegaActiveChange: () => { /* no-op */ },
  rescalarizeFallbackCount: 0,
  incrementRescalarizeFallback: () => { /* no-op */ },
};

export const ModqnHandoverModeContext = createContext<ModqnHandoverModeContextValue>(
  DEFAULT_MODQN_HANDOVER_MODE_CONTEXT,
);

export interface ModqnHandoverModeProviderProps {
  readonly mode: RuntimeHandoverMode;
  readonly setMode: (next: RuntimeHandoverMode) => void;
  readonly omegaActive: RuntimeOmegaState;
  readonly onOmegaActiveChange: (next: RuntimeOmegaState) => void;
  readonly rescalarizeFallbackCount: number;
  readonly incrementRescalarizeFallback: () => void;
  readonly children: ReactNode;
}

export function ModqnHandoverModeProvider({
  mode,
  setMode,
  omegaActive,
  onOmegaActiveChange,
  rescalarizeFallbackCount,
  incrementRescalarizeFallback,
  children,
}: ModqnHandoverModeProviderProps) {
  const value = useMemo(
    () => ({
      mode,
      setMode,
      omegaActive,
      onOmegaActiveChange,
      rescalarizeFallbackCount,
      incrementRescalarizeFallback,
    }),
    [mode, setMode, omegaActive, onOmegaActiveChange, rescalarizeFallbackCount, incrementRescalarizeFallback],
  );
  return createElement(ModqnHandoverModeContext.Provider, { value }, children);
}

export interface ModqnEnvelopeContextValue {
  readonly envelope: ModqnReplayEnvelope | null;
  readonly slotOffset: number;
}

const DEFAULT_ENVELOPE_CONTEXT: ModqnEnvelopeContextValue = {
  envelope: null,
  slotOffset: 0,
};

export const ModqnEnvelopeContext = createContext<ModqnEnvelopeContextValue>(
  DEFAULT_ENVELOPE_CONTEXT,
);

export interface ModqnEnvelopeProviderProps {
  readonly envelope: ModqnReplayEnvelope | null;
  readonly slotOffset?: number;
  readonly children: ReactNode;
}

export function ModqnEnvelopeProvider({
  envelope,
  slotOffset = 0,
  children,
}: ModqnEnvelopeProviderProps) {
  const value = useMemo(
    () => ({ envelope, slotOffset }),
    [envelope, slotOffset],
  );
  return createElement(
    ModqnEnvelopeContext.Provider,
    { value },
    children,
  );
}

