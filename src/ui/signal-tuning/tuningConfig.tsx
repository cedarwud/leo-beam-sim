import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { GainModel, PathLossComponent } from '../../profiles/types';
import type { TuningTab, TuningTabKey } from './types';

export const TUNING_TABS: readonly TuningTab[] = [
  {
    key: 'signal-power',
    symbol: <>P<sub>t</sub></>,
    title: 'Transmit Power',
    subtitle: 'Per-beam transmit power.',
    formula: <>P<sub>t</sub> starts the desired-signal numerator.</>,
    note: 'Use this page for per-beam transmit power before beam gain, path loss, and receiver gain are applied.',
  },
  {
    key: 'loss',
    symbol: <>H(L)</>,
    title: 'Loss',
    subtitle: 'Path gain and propagation loss terms.',
    formula: <>H ≈ 10<sup>-L/10</sup>, L = L<sub>fs</sub> + L<sub>g</sub> + L<sub>sc</sub> + L<sub>sf</sub></>,
    note: 'Use this page to study how carrier frequency and propagation assumptions move every received beam power.',
  },
  {
    key: 'beam',
    symbol: <>G<sup>T</sup>(θ)</>,
    title: 'Transmit Gain',
    subtitle: 'Satellite beam gain and scan loss.',
    formula: <>G<sup>T</sup> = G<sub>t,max</sub> + G(θ) - L<sub>scan</sub></>,
    note: 'Use this page when beam shape, steering reach, or edge-of-beam attenuation is the question.',
  },
  {
    key: 'receiver-gain',
    symbol: <>G<sup>R</sup></>,
    title: 'Receiver Gain',
    subtitle: 'Receive-side numerator gain.',
    formula: <>G<sup>R</sup> is the receive-side gain in the desired-signal numerator.</>,
    note: 'Use this page to tune the terminal-side gain without mixing it into transmit power or satellite beam gain.',
  },
  {
    key: 'interference',
    symbol: <>I<sup>a</sup>, I<sup>b</sup></>,
    title: 'Interf.',
    subtitle: 'Co-channel interference grouping.',
    formula: <>Denominator interference is I<sup>a</sup> + I<sup>b</sup>, grouped by frequency reuse K.</>,
    note: 'Use this page to make the scene harsher or cleaner by changing how many active beams reuse the same frequency.',
  },
  {
    key: 'thermal-noise',
    symbol: <>σ²</>,
    title: 'Thermal Noise',
    subtitle: 'Denominator thermal-noise controls.',
    formula: <>σ² = N<sub>0</sub>B</>,
    note: 'Use this page for bandwidth and noise density terms that raise the denominator noise floor.',
  },
  {
    key: 'topology',
    symbol: <>N<sub>sat</sub></>,
    title: 'Topology',
    subtitle: 'Simulation Setting for constellation shape.',
    formula: <>Simulation Setting</>,
    note: 'Use this page for live-scene topology overrides that restart simulation state instead of changing the SINR formula.',
    tabClass: 'simulation-setting',
  },
];

export const GAIN_MODEL_OPTIONS: ReadonlyArray<{ value: GainModel; label: string; detail: string }> = [
  { value: 'bessel-j1-j3', label: 'Bessel J1/J3', detail: 'Paper-shaped main lobe with stronger side-lobe roll-off.' },
  { value: 'bessel-j1', label: 'Bessel J1', detail: 'Simpler Bessel pattern; still attenuates off-axis users.' },
  { value: 'flat', label: 'Flat Top', detail: 'Disables off-axis pattern loss for sensitivity checks.' },
];

export const FREQUENCY_REUSE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export const PATH_LOSS_LABELS: Record<PathLossComponent, { symbol: ReactNode; label: string; detail: string }> = {
  fspl: {
    symbol: <>L<sub>fs</sub></>,
    label: 'Free-space loss',
    detail: 'Dominant range and frequency loss. Usually stays on for physical runs.',
  },
  atmospheric: {
    symbol: <>L<sub>g</sub></>,
    label: 'Gas absorption',
    detail: 'Adds elevation-dependent atmospheric absorption.',
  },
  scintillation: {
    symbol: <>L<sub>sc</sub></>,
    label: 'Scintillation',
    detail: 'Adds a small elevation-dependent fading margin.',
  },
  'shadow-fading': {
    symbol: <>L<sub>sf</sub></>,
    label: 'Shadow fading',
    detail: 'Adds the deterministic shadow-fading margin used by this simulator.',
  },
};

export function getActiveTabConfig(activeTab: TuningTabKey): TuningTab {
  return TUNING_TABS.find(tab => tab.key === activeTab) ?? TUNING_TABS[0];
}
export function getFormulaTabAccent(tabKey: TuningTabKey): string {
  switch (tabKey) {
    case 'thermal-noise':
      return UI_TOKENS.color.semantic.noise;
    case 'interference':
      return '#ff8a6b';
    case 'loss':
      return UI_TOKENS.color.semantic.loss;
    case 'receiver-gain':
      return UI_TOKENS.color.semantic.fixed;
    case 'beam':
      return UI_TOKENS.color.semantic.beam;
    case 'signal-power':
      return UI_TOKENS.color.semantic.tuning;
    case 'topology':
      return UI_TOKENS.color.semantic.fixed;
  }
}

export function getFormulaTabShortLabel(tabKey: TuningTabKey): string {
  switch (tabKey) {
    case 'signal-power':
      return 'Power';
    case 'loss':
      return 'Loss';
    case 'beam':
      return 'Beam';
    case 'receiver-gain':
      return 'Receiver';
    case 'interference':
      return 'Interf.';
    case 'thermal-noise':
      return 'Noise';
    case 'topology':
      return 'Topology';
  }
}
