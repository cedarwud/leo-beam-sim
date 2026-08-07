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
    formulaExpr: <>S ∝ P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup></>,
    note: 'Use this page for per-beam transmit power before beam gain, path loss, and receiver gain are applied.',
  },
  {
    key: 'loss',
    // NOTATION RULE (owner, 2026-08-06): the three surfaces must line up —
    // the γ definition, this term chip, and the tunable parameters under it.
    // γ's numerator factor is written `H`, so the chip is `H`, full stop; the
    // page then SHOWS how its sliders build that H (`H = 10^(-L/10)`, then the
    // L stack). A chip that said `H(L)` named a symbol γ never uses.
    symbol: <>H</>,
    // The numerator factor is the linear channel GAIN H; what this page tunes is
    // the dB LOSS stack L. Naming the tab plain "Loss" contradicted its own
    // symbol and subtitle, so the term keeps both halves.
    title: 'Channel Gain / Path Loss',
    subtitle: 'Path gain and propagation loss terms.',
    formula: <>H ≈ 10<sup>-L/10</sup>, L = L<sub>fs</sub> + L<sub>g</sub> + L<sub>sc</sub> + L<sub>sf</sub></>,
    note: 'Use this page to study how carrier frequency and propagation assumptions move every received beam power.',
  },
  {
    key: 'beam',
    // NOTATION RULE (see the `H` term above): the chip carries the symbol γ
    // itself uses. γ multiplies by `G^T`; the bare θ the chip used to append is
    // the per-UE off-axis angle the runtime computes, never a control on this
    // page. How the sliders build G^T is shown on the page, by the section
    // formula G^T = G_t,max + G(θ) - L_scan.
    symbol: <>G<sup>T</sup></>,
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
    formulaExpr: <>S ∝ P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup></>,
    note: 'Use this page to tune the terminal-side gain without mixing it into transmit power or satellite beam gain.',
  },
  {
    key: 'interference',
    // NOTATION RULE (see `H`): γ's denominator reads I^a + I^b, so the chip does
    // too — the comma form named a pair γ never writes.
    symbol: <>I<sup>a</sup> + I<sup>b</sup></>,
    title: 'Interf.',
    subtitle: 'Co-channel interference grouping.',
    formula: <>Denominator interference is I<sup>a</sup> + I<sup>b</sup>, grouped by frequency reuse K.</>,
    formulaExpr: <>I = I<sup>a</sup> + I<sup>b</sup>, K = 1…7</>,
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
];

export const GAIN_MODEL_OPTIONS: ReadonlyArray<{ value: GainModel; label: string; detail: string }> = [
  { value: 'bessel-j1-j3', label: 'Bessel J1/J3', detail: 'Paper-shaped main lobe with stronger side-lobe roll-off.' },
  { value: 'bessel-j1', label: 'Bessel J1', detail: 'Single Bessel-term gain pattern; off-axis users are still attenuated.' },
  { value: 'flat', label: 'Flat Top', detail: 'Disables off-axis pattern loss for sensitivity checks.' },
];

export const FREQUENCY_REUSE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export const PATH_LOSS_LABELS: Record<PathLossComponent, { symbol: ReactNode; label: string; detail: string }> = {
  fspl: {
    symbol: <>L<sub>fs</sub></>,
    label: 'Free-space loss',
    detail: 'The dominant range- and frequency-dependent loss term.',
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
  }
}

/**
 * Plain-language version of each sub-tab's `note`. Same fallback mechanism as
 * the labels below: the English strings are the existing canonical copy.
 */
export function getFormulaTabNoteCopy(tabKey: TuningTabKey): {
  key: string;
  zh: string;
  en: string;
} {
  switch (tabKey) {
    case 'signal-power':
      return {
        key: 'tab.sub.signalPower.note',
        zh: '每波束發射功率 P_t，為分子鏈在天線增益、路徑損耗與接收增益之前的起始項。',
        en: 'Per-beam transmit power P_t, the first factor of the numerator, before beam gain, path loss, and receiver gain are applied.',
      };
    case 'loss':
      return {
        key: 'tab.sub.loss.note',
        zh: '路徑損耗與傳播假設：載波頻率與各損耗項共同決定每一道波束的接收功率。',
        en: 'Path loss and propagation assumptions: carrier frequency and the loss terms jointly set the received power of every beam.',
      };
    case 'beam':
      return {
        key: 'tab.sub.beam.note',
        zh: '波束寬度、可轉向角度與邊緣衰減，共同構成衛星端的 G^T 項。',
        en: 'Beamwidth, steering range, and edge-of-beam attenuation, which together form the satellite-side G^T term.',
      };
    case 'receiver-gain':
      return {
        key: 'tab.sub.receiverGain.note',
        zh: '地面終端天線增益 G^R，獨立於發射功率 P_t 與衛星天線增益 G^T。',
        en: 'Terminal antenna gain G^R, independent of transmit power P_t and satellite beam gain G^T.',
      };
    case 'interference':
      return {
        key: 'tab.sub.interference.note',
        zh: '頻率重複使用因子 K 決定同頻作用中波束的數量，即分母的同頻干擾強度。',
        en: 'The frequency-reuse factor K sets how many active beams share a frequency group, and therefore the co-channel interference in the denominator.',
      };
    case 'thermal-noise':
      return {
        key: 'tab.sub.thermalNoise.note',
        zh: '頻寬 B 與雜訊功率密度 N₀ 決定分母的熱雜訊底線 σ² = N₀B。',
        en: 'Bandwidth B and noise power density N₀ set the denominator thermal-noise floor σ² = N₀B.',
      };
  }
}

/**
 * Plain-language version of each beam gain-model option's one-line detail.
 */
export function getGainModelDetailCopy(model: GainModel): { key: string; zh: string; en: string } {
  switch (model) {
    case 'bessel-j1-j3':
      return {
        key: 'param.model.option.besselJ1J3',
        zh: '主瓣形狀依論文設定，旁瓣衰減較強。',
        en: 'Paper-shaped main lobe with stronger side-lobe roll-off.',
      };
    case 'bessel-j1':
      return {
        key: 'param.model.option.besselJ1',
        zh: '單一 Bessel 項的增益圖樣；偏離波束中心仍有衰減。',
        en: 'Single Bessel-term gain pattern; off-axis users are still attenuated.',
      };
    case 'flat':
      return {
        key: 'param.model.option.flat',
        zh: '停用離軸圖樣衰減，用於敏感度對照。',
        en: 'Disables off-axis pattern loss for sensitivity checks.',
      };
  }
}

/**
 * i18n key + plain-language fallbacks for the seven formula-term sub-tabs.
 * These keys are not in the catalog yet (see the report from agent-E); the
 * fallbacks keep the zh-TW view from showing English until they land.
 */
export function getFormulaTabLabelCopy(tabKey: TuningTabKey): {
  key: string;
  zh: string;
  en: string;
} {
  switch (tabKey) {
    case 'signal-power':
      return { key: 'tab.sub.signalPower.label', zh: '發射功率', en: 'Power' };
    case 'loss':
      return { key: 'tab.sub.loss.label', zh: '路徑損耗', en: 'Loss' };
    case 'beam':
      return { key: 'tab.sub.beam.label', zh: '波束形狀', en: 'Beam' };
    case 'receiver-gain':
      return { key: 'tab.sub.receiverGain.label', zh: '接收增益', en: 'Receiver' };
    case 'interference':
      return { key: 'tab.sub.interference.label', zh: '干擾', en: 'Interference' };
    case 'thermal-noise':
      return { key: 'tab.sub.thermalNoise.label', zh: '背景雜訊', en: 'Noise' };
  }
}
