import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { PathLossComponent } from '../../profiles/types';
import {
  SIMPLIFIED_EE_LINK_INDEX,
} from './simplifiedEeSymbols';
import { LinkAngle, LinkInterference, Theta3db } from './FormulaSymbols';
import type { TuningTab, TuningTabKey } from './types';

export const TUNING_TABS: readonly TuningTab[] = [
  {
    key: 'signal-power',
    symbol: <><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>,
    title: 'RF Output',
    subtitle: 'Angle-aware link RF power p(t, θ, θ₃dB).',
    formula: <><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>,
    formulaExpr: <><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>,
    note: 'The angle-aware link power p(t, θ, θ₃dB) is the RF power used by the SINR and throughput chain.',
  },
  {
    key: 'channel',
    symbol: <>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>,
    title: 'Channel',
    subtitle: 'One-layer H(t) expansion: path loss + receive gain.',
    formula: <>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>,
    formulaExpr: <>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>,
    note: 'H_{u,s,v}(t) is the linear factor built from L_{u,s,v}(t) and G^R_{u,s,v}(t).',
  },
  {
    key: 'beam',
    symbol: <>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>,
    title: 'Transmit Gain',
    subtitle: 'One-layer gain expansion G^T(θ, θ₃dB) = G₀F(θ, θ₃dB).',
    formula: <>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>,
    formulaExpr: <>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>,
    note: 'G^T(θ_{u,s,v}, θ₃dB) = G₀F(θ_{u,s,v}, θ₃dB), with F the HOBS Eq.(3) J₁/J₃ pattern, unity at beam centre.',
  },
  {
    key: 'interference',
    symbol: <LinkInterference />,
    title: 'Interf.',
    subtitle: 'Frequency-reuse groups determine which active beams share frequencies and affect interference; adjusting group count controls how co-channel beams are distributed.',
    formula: <LinkInterference />,
    formulaExpr: <LinkInterference />,
    note: 'Frequency-reuse groups determine which active beams share frequencies and affect interference; adjusting group count controls how co-channel beams are distributed.',
  },
  {
    key: 'thermal-noise',
    symbol: <>σ²</>,
    title: 'Thermal Noise',
    subtitle: 'Denominator thermal-noise controls.',
    formula: <>σ² = B<sup>w</sup> · <i>N</i><sub>0</sub></>,
    formulaExpr: <>σ² = B<sup>w</sup> · <i>N</i><sub>0</sub></>,
    note: 'σ² = B^w · N_0 is the receiver noise power in the SINR denominator; B^w is the available beam bandwidth and N_0 is the noise power spectral density.',
  },
];

export const FREQUENCY_REUSE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export const PATH_LOSS_LABELS: Record<PathLossComponent, { symbol: ReactNode; label: string; detail: string }> = {
  fspl: {
    symbol: <>L<sub>f</sub></>,
    label: 'Free-space loss',
    detail: 'The dominant range- and frequency-dependent loss term.',
  },
  atmospheric: {
    symbol: <>L<sub>g</sub></>,
    label: 'Gas absorption',
    detail: 'Adds elevation-dependent atmospheric absorption.',
  },
  scintillation: {
    symbol: <>L<sub>c</sub></>,
    label: 'Scintillation',
    detail: 'Adds a small elevation-dependent fading margin.',
  },
  'shadow-fading': {
    symbol: <>L<sub>s</sub></>,
    label: 'Shadow fading',
    detail: 'Adds the deterministic shadow-fading margin used by this simulator.',
  },
};

export function getActiveTabConfig(activeTab: TuningTabKey): TuningTab {
  const normalizedTab = normalizeTuningTabKey(activeTab);
  return TUNING_TABS.find(tab => tab.key === normalizedTab) ?? TUNING_TABS[0];
}

export function normalizeTuningTabKey(activeTab: TuningTabKey): TuningTabKey {
  if (activeTab === 'loss' || activeTab === 'receiver-gain') {
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
      return UI_TOKENS.color.semantic.loss;
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
    case 'receiver-gain':
      return 'Channel';
    case 'beam':
      return 'Transmit gain';
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
        zh: 'p_{u,s,v}(t,θ_{u,s,v},θ_{3dB}) 是選定 UE-link 的實際 RF 發射功率。',
        en: 'p_{u,s,v}(t,θ_{u,s,v},θ₃dB) is the actual RF transmit power of the selected UE-link.',
      };
    case 'channel':
      return {
        key: 'tab.sub.channel.note',
        zh: 'H_{u,s,v}(t) 以路徑損耗與接收增益做一層展開。',
        en: 'H_{u,s,v}(t) has a one-layer expansion for path loss and receive gain.',
      };
    case 'loss':
      return {
        key: 'tab.sub.loss.note',
        zh: 'L_f、L_g、L_c 與 L_s 組成 H_{u,s,v}(t) 的路徑損耗層。',
        en: 'L_f, L_g, L_c, and L_s form the path-loss layer of H_{u,s,v}(t).',
      };
    case 'beam':
      return {
        key: 'tab.sub.beam.note',
        zh: 'Gᵀ(θ_{u,s,v},θ₃dB) = G₀F(θ_{u,s,v}, θ₃dB)，F 是 HOBS 式 (3) 的 J₁/J₃ 型樣，波束中心為 1。',
        en: 'Gᵀ(θ_{u,s,v},θ₃dB) = G₀F(θ_{u,s,v}, θ₃dB), with F the HOBS Eq.(3) J₁/J₃ pattern, unity at beam centre.',
      };
    case 'receiver-gain':
      return {
        key: 'tab.sub.receiverGain.note',
        zh: 'G^R_{u,s,v}(t) 是 H_{u,s,v}(t) 一層展開中的接收增益因子。',
        en: 'G^R_{u,s,v}(t) is the receive-gain factor in the one-layer H_{u,s,v}(t) expansion.',
      };
    case 'interference':
      return {
        key: 'tab.sub.interference.note',
        zh: '頻率重用群組會決定哪些作用中波束使用同頻並影響干擾；調整群組數可控制共用頻率的波束數量以抑制同頻干擾。',
        en: 'Frequency-reuse groups determine which active beams share frequencies and affect interference; adjusting group count controls how co-channel beams are distributed.',
      };
    case 'thermal-noise':
      return {
        key: 'tab.sub.thermalNoise.note',
        zh: 'σ² = B^w · N_0 是 SINR 分母中與干擾無關的接收端雜訊功率；下方控制可調整波束頻寬 B^w 與雜訊功率密度 N_0。',
        en: 'σ² = B^w · N_0 is the interference-independent receiver noise power in the SINR denominator; the controls below adjust beam bandwidth B^w and noise power spectral density N_0.',
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
      return { key: 'tab.sub.beam.label', zh: '發射增益', en: 'Transmit gain' };
    case 'receiver-gain':
      return { key: 'tab.sub.receiverGain.label', zh: '接收增益', en: 'Receiver' };
    case 'interference':
      return { key: 'tab.sub.interference.label', zh: '干擾', en: 'Interference' };
    case 'thermal-noise':
      return { key: 'tab.sub.thermalNoise.label', zh: '背景雜訊', en: 'Noise' };
  }
}
