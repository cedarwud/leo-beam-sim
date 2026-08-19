import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { GainModel, PathLossComponent } from '../../profiles/types';
import {
  SIMPLIFIED_EE_BEAM_INDEX,
  SIMPLIFIED_EE_LINK_INDEX,
} from './simplifiedEeSymbols';
import { InlineFormulaFraction } from './FormulaHeader';
import { LinkAngle, SystemAngleState } from './FormulaSymbols';
import type { TuningTab, TuningTabKey } from './types';

export const TUNING_TABS: readonly TuningTab[] = [
  {
    key: 'signal-power',
    symbol: <><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>,
    title: 'RF Output',
    subtitle: 'Angle-aware link RF power.',
    formula: <><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) = <i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t₀, θ⁰) · <InlineFormulaFraction numerator={<>G<sup>T</sup>(θ⁰)</>} denominator={<>G<sup>T</sup>(θ)</>} label="reference transmit gain divided by current transmit gain" /></>,
    formulaExpr: <><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) = <i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t₀, θ⁰) · <InlineFormulaFraction numerator={<>G<sup>T</sup>(θ⁰)</>} denominator={<>G<sup>T</sup>(θ)</>} label="reference transmit gain divided by current transmit gain" /></>,
    note: 'The link power is the RF power used by the SINR and throughput chain.',
  },
  {
    key: 'channel',
    symbol: <>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />)</>,
    title: 'Effective Channel',
    subtitle: 'Angle-aware effective channel used by the SINR numerator.',
    formula: <>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />)</>,
    formulaExpr: <>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />)</>,
    note: 'h_{u,s,v}(t,θ) is the effective channel used by the SINR numerator.',
  },
  {
    key: 'interference',
    symbol: <>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>,
    title: 'Interf.',
    subtitle: 'Total co-channel interference used by the SINR denominator.',
    formula: <>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>,
    formulaExpr: <>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>,
    note: 'Frequency grouping determines the total co-channel interference I_{u,s,v}(t,θ).',
  },
  {
    key: 'thermal-noise',
    symbol: <>σ²</>,
    title: 'Thermal Noise',
    subtitle: 'Denominator thermal-noise controls.',
    formula: <>σ²</>,
    formulaExpr: <>σ²</>,
    note: 'σ² is the interference-independent noise term in the SINR denominator.',
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
  const normalizedTab = normalizeTuningTabKey(activeTab);
  return TUNING_TABS.find(tab => tab.key === normalizedTab) ?? TUNING_TABS[0];
}

export function normalizeTuningTabKey(activeTab: TuningTabKey): TuningTabKey {
  if (activeTab === 'loss' || activeTab === 'beam' || activeTab === 'receiver-gain') {
    return 'channel';
  }
  return activeTab;
}
export function getFormulaTabAccent(tabKey: TuningTabKey): string {
  switch (tabKey) {
    case 'thermal-noise':
      return UI_TOKENS.color.semantic.noise;
    case 'interference':
      return '#ff8a6b';
    case 'channel':
    case 'loss':
    case 'receiver-gain':
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
    case 'channel':
    case 'loss':
    case 'beam':
    case 'receiver-gain':
      return 'Channel';
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
        zh: 'p_{u,s,v}(t,θ) 是 SINR 與速率使用的鏈路 RF 功率。',
        en: 'p_{u,s,v}(t,θ) is the link RF power used by SINR and throughput.',
      };
    case 'channel':
      return {
        key: 'tab.sub.channel.note',
        zh: '有效通道 h_{u,s,v}(t,θ) 收合傳播、接收端與離軸角 θ。',
        en: 'Effective channel h_{u,s,v}(t,θ) collects propagation, receive-side, and off-axis angle θ.',
      };
    case 'loss':
      return {
        key: 'tab.sub.loss.note',
        zh: '傳播、接收端與衰落因素會被收進有效通道 h_{u,s,v}(t,θ)。',
        en: 'Propagation, receive-side, and fading factors are collected into effective channel h_{u,s,v}(t,θ).',
      };
    case 'beam':
      return {
        key: 'tab.sub.beam.note',
        zh: 'G^T(θ) 將離軸角帶入有效通道。',
        en: 'G^T(θ) carries the off-axis angle into the effective channel.',
      };
    case 'receiver-gain':
      return {
        key: 'tab.sub.receiverGain.note',
        zh: '接收端增益納入 h_{u,s,v}(t,θ)，不在簡化主式中另列。',
        en: 'Receive-side gain is included in h_{u,s,v}(t,θ) and is not listed separately in the simplified main formula.',
      };
    case 'interference':
      return {
        key: 'tab.sub.interference.note',
        zh: '頻率分組決定哪些作用中波束共享頻率，進而形成 I_{u,s,v}(t,θ)。',
        en: 'Frequency grouping determines which active beams share a frequency and form I_{u,s,v}(t,θ).',
      };
    case 'thermal-noise':
      return {
        key: 'tab.sub.thermalNoise.note',
        zh: 'σ² 是 SINR 分母中與干擾無關的雜訊項。',
        en: 'σ² is the interference-independent noise term in the SINR denominator.',
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
    case 'channel':
      return { key: 'tab.sub.channel.label', zh: '有效通道', en: 'Channel' };
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
