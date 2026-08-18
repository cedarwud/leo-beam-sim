// Right-panel (InfoPanel) help + copy helpers.
//
// Two jobs:
//
// 1. `PanelHelp` — a thin wrapper around the shared `HelpPopover` (owner:
//    agent-B, `src/ui/common/HelpPopover.tsx`) that defaults `placement` to
//    'right' (CONTRACT: the right sidebar always opens its popovers inward,
//    away from the window edge) and collapses the trigger's 44x44 hit box down
//    to ~18px of *layout* height with a negative vertical margin. The hit area
//    stays 44x44 for touch/a11y — only the row height it forces shrinks, so a
//    dense KPI row does not grow to 54px just because it gained a "?".
//    Horizontal margins are deliberately NOT collapsed: `validate:vc4a:duel-
//    card` asserts every descendant of the duel card stays inside the card's
//    horizontal box, and a negative side margin is exactly how you'd escape it.
//
// 2. `usePanelCopy` — `t()` for keys that already exist in the shared catalog
//    (`src/i18n/strings.ts`, owner: agent-A) plus `tx()` for right-panel copy
//    that has NO catalog key yet. `src/i18n/**` is not writable from here, so
//    the strings live in the local dictionaries below and are reported upward
//    as "keys to fold into the catalog". `tx` is locale-aware exactly like `t`
//    (zh-TW default, English when the locale toggle is flipped), so no string
//    added here is hardcoded to one language.
import type { ReactNode } from 'react';
import { useLocale } from '../../i18n';
import { UI_TOKENS } from '../../constants/uiTokens';
import { HelpPopover, type HelpPopoverProps } from '../common/HelpPopover';

/**
 * Right-panel copy that has no `src/i18n/strings.ts` key yet. Key names are
 * pre-shaped for the catalog (`panel.*`), so folding them in later is a move,
 * not a rewrite.
 *
 * NOTE on `panel.duel.title` / `panel.role.*`: the uppercase role tokens
 * (ACTIVE SERVING / PENDING TARGET / ...) and the literal "Beam duel" are
 * pinned as *visible text* by `validate:vc4a:duel-card`, `validate:phase7b:
 * sinr-display-ownership` and `validate:phase1a:recent-ho-ui`. They stay on
 * screen; these friendly titles are rendered *alongside* them as the primary,
 * student-facing label rather than replacing them.
 */
const LOCAL_ZH: Record<string, string> = {
  'panel.duel.title': '波束對決 Beam duel',
  'panel.duel.help': '服務連線與候選連線的即時比較。左欄為目前的服務連線，右欄為候選連線，中欄為換手判準：候選與服務的 SINR 差值、遲滯門檻與觸發計時。三者共同決定換手是否成立。',

  'panel.role.activeServing': '目前連線',
  'panel.role.hoSource': '前一個連線',
  'panel.role.pendingTarget': '換手預備目標',
  'panel.role.hoTarget': '換手後的目標',
  'panel.role.bestCandidate': '最佳候選',
  'panel.role.comparison': '對照連線',

  'panel.caption.serving': '目前提供服務的連線。',
  'panel.caption.previousSource': '換手前提供服務的連線。',
  'panel.caption.pending': '已進入觸發計時、準備接手的連線。',
  'panel.caption.recentTarget': '剛完成換手的目標連線。',
  'panel.caption.recentTargetServing': '剛完成換手的目標連線，目前已在提供服務。',
  'panel.caption.candidate': '訊號品質最佳的備選連線。',
  'panel.caption.none': '目前沒有可供比較的連線。',

  'panel.field.signalQuality': '訊號品質',
  'panel.field.elevation': '仰角',
  'panel.field.range': '距離',
  'panel.field.handoverCount': '換手次數',
  'panel.field.handoverCount.unit': '次',

  'panel.handoverOffset.label': '換手安全門檻',
  'panel.handoverOffset.help': '候選連線的 SINR 高出目前連線的最小 dB 值，達到此值後才啟動換手判斷。門檻過小時連線會在兩顆衛星之間反覆切換（乒乓效應），過大時則延後離開品質已下降的連線。',

  'panel.formulaTerms.title': '訊號品質公式各項',
  'panel.formulaTerms.help': '訊號品質公式的逐項拆解，分子與分母各自列出其組成項與合成結果。',
  'panel.formulaTerms.result': '公式結果 γ',
  'panel.formulaTerms.status.live': '本幀的計算結果。',
  'panel.formulaTerms.status.latched': '最後一次成功計算的數值。',
  'panel.formulaTerms.status.stale': '參數已變更，等待下一幀重新計算。',
  'panel.formulaTerms.status.waiting': '尚未取得實體服務連線。',

  'panel.formulaTerms.numerator': '分子：接收訊號功率',
  'panel.formulaTerms.numerator.help': '分子為服務波束實際送達接收端的訊號功率：發射功率加上發射天線增益與接收天線增益，再扣除路徑損耗與掃描損耗。各項均以 dB 尺度加減。',
  'panel.formulaTerms.numeratorHint': '發射功率 ＋ 發射增益 ＋ 接收增益 － 路徑損耗 － 掃描損耗 ＝ 接收訊號功率',
  'panel.formulaTerms.denominator': '分母：干擾與雜訊',
  'panel.formulaTerms.denominator.help': '分母為同一時刻與訊號競爭的功率總和：同衛星其他同頻波束的干擾、其他衛星的干擾，以及接收機熱雜訊。三項以線性功率相加後再換算回 dBm。',
  'panel.formulaTerms.denominatorHint': '同衛星干擾 ＋ 跨衛星干擾 ＋ 熱雜訊 ＝ 分母總和',
  'panel.formulaTerms.resultHint': 'γ ＝ 分子 ÷ 分母',

  'panel.formulaTerms.signalTotal.label': '接收訊號功率',
  'panel.formulaTerms.signalTotal.help': '發射功率、發射天線增益與接收天線增益之和扣除路徑損耗與掃描損耗後，於接收端量得的訊號功率，即 γ 的分子。',
  'panel.formulaTerms.txPower.label': '發射功率',
  'panel.formulaTerms.txPower.help': '此波束的實際輻射功率，以 dBm 表示。',
  'panel.formulaTerms.txGain.label': '發射天線增益',
  'panel.formulaTerms.txGain.help': '發射天線將能量集中於指定方向所取得的增益。指向越接近波束中心，增益越高。',
  'panel.formulaTerms.rxGain.label': '接收天線增益',
  'panel.formulaTerms.rxGain.help': '接收天線的增益。孔徑越大，增益越高。',
  'panel.formulaTerms.pathLoss.label': '路徑損耗',
  'panel.formulaTerms.pathLoss.help': '訊號自衛星傳播至接收端所損失的功率，含自由空間損耗與大氣相關各項。距離越遠、頻率越高，損耗越大。此項自分子扣除。',
  'panel.formulaTerms.scanLoss.label': '掃描損耗',
  'panel.formulaTerms.scanLoss.help': '波束偏離天線最佳指向所額外損失的增益。偏轉角越接近上限，損耗越大。此項自分子扣除。',
  'panel.formulaTerms.intraInterference.label': '同衛星干擾',
  'panel.formulaTerms.intraInterference.help': '同一顆衛星上其他同頻波束落在此接收端的功率總和，為分母的第一項。',
  'panel.formulaTerms.interInterference.label': '跨衛星干擾',
  'panel.formulaTerms.interInterference.help': '其他衛星的同頻波束落在此接收端的功率總和，為分母的第二項。',
  'panel.formulaTerms.noise.label': '熱雜訊',
  'panel.formulaTerms.noise.help': '接收機的熱雜訊功率 σ² 與干擾無關，會和總干擾 I 一起形成 SINR 分母。',
  'panel.formulaTerms.denominatorTotal.label': '分母總和',
  'panel.formulaTerms.denominatorTotal.help': '同衛星干擾、跨衛星干擾與熱雜訊三項的功率總和，即 γ 的分母。',

  'panel.absent.tag': '尚未納入',
  'panel.absent.hint': '顯示 — 表示此模型未計算該項，其值為未知而非零。',
};

const LOCAL_EN: Record<string, string> = {
  'panel.duel.title': 'Beam duel',
  'panel.duel.help': 'A live comparison of the serving link and the candidate link. The left column is the current serving link, the right column the candidate, and the centre column the handover criteria: the SINR difference between candidate and serving, the hysteresis margin, and the trigger timer. Together they determine whether a handover occurs.',

  'panel.role.activeServing': 'Current link',
  'panel.role.hoSource': 'Previous link',
  'panel.role.pendingTarget': 'Pending target',
  'panel.role.hoTarget': 'Handover target',
  'panel.role.bestCandidate': 'Best candidate',
  'panel.role.comparison': 'Comparison',

  'panel.caption.serving': 'The link currently providing service.',
  'panel.caption.previousSource': 'The link that provided service before the handover.',
  'panel.caption.pending': 'The link in the trigger countdown, preparing to take over.',
  'panel.caption.recentTarget': 'The target link of the handover just completed.',
  'panel.caption.recentTargetServing': 'The target link of the handover just completed; it is now providing service.',
  'panel.caption.candidate': 'The alternative link with the best signal quality.',
  'panel.caption.none': 'No link is available for comparison.',

  'panel.field.signalQuality': 'Signal quality',
  'panel.field.elevation': 'Elevation',
  'panel.field.range': 'Distance',
  'panel.field.handoverCount': 'Handover count',
  'panel.field.handoverCount.unit': 'x',

  'panel.handoverOffset.label': 'Switching safety margin',
  'panel.handoverOffset.help': 'The minimum margin, in dB, by which the candidate SINR must exceed the current link before the handover decision starts. Too small a margin makes the link alternate between two satellites (the ping-pong effect); too large a margin delays leaving a link whose quality has already degraded.',

  'panel.formulaTerms.title': 'Signal-quality formula terms',
  'panel.formulaTerms.help': 'A term-by-term breakdown of the signal-quality formula: the numerator and the denominator each list their component terms and the value they combine into.',
  'panel.formulaTerms.result': 'Formula result γ',
  'panel.formulaTerms.status.live': 'Values from the current frame.',
  'panel.formulaTerms.status.latched': 'The last successfully computed values.',
  'panel.formulaTerms.status.stale': 'A setting changed; waiting for the next recomputed frame.',
  'panel.formulaTerms.status.waiting': 'No physical serving link yet.',

  'panel.formulaTerms.numerator': 'Numerator: received signal power',
  'panel.formulaTerms.numerator.help': 'The numerator is the signal power the serving beam actually delivers to the receiver: transmit power plus the transmit and receive antenna gains, less path loss and scan loss. Every term adds or subtracts on the dB scale.',
  'panel.formulaTerms.numeratorHint': 'transmit power + transmit gain + receive gain − path loss − scan loss = received signal power',
  'panel.formulaTerms.denominator': 'Denominator: interference and noise',
  'panel.formulaTerms.denominator.help': 'The denominator is the power competing with the signal at that same instant: interference from other co-channel beams on the same satellite, interference from other satellites, and receiver thermal noise. The three add as linear powers before converting back to dBm.',
  'panel.formulaTerms.denominatorHint': 'intra-satellite interference + inter-satellite interference + thermal noise = denominator total',
  'panel.formulaTerms.resultHint': 'γ = numerator ÷ denominator',

  'panel.formulaTerms.signalTotal.label': 'Received signal power',
  'panel.formulaTerms.signalTotal.help': 'The sum of transmit power, transmit antenna gain and receive antenna gain, less path loss and scan loss — the signal power measured at the receiver, and the numerator of γ.',
  'panel.formulaTerms.txPower.label': 'Transmit power',
  'panel.formulaTerms.txPower.help': 'The power this beam actually radiates, expressed in dBm.',
  'panel.formulaTerms.txGain.label': 'Transmit antenna gain',
  'panel.formulaTerms.txGain.help': 'The gain obtained from the transmit antenna concentrating its energy in a given direction. The closer the pointing is to beam centre, the higher the gain.',
  'panel.formulaTerms.rxGain.label': 'Receive antenna gain',
  'panel.formulaTerms.rxGain.help': 'The gain of the receiving antenna. A larger aperture gives a higher gain.',
  'panel.formulaTerms.pathLoss.label': 'Path loss',
  'panel.formulaTerms.pathLoss.help': 'The power the signal loses travelling from the satellite to the receiver, covering free-space loss and the atmospheric terms. Greater distance and higher frequency both raise it. It is subtracted from the numerator.',
  'panel.formulaTerms.scanLoss.label': 'Scan loss',
  'panel.formulaTerms.scanLoss.help': "The extra gain a beam gives up by pointing away from the antenna's optimal direction. The closer the steering angle is to its limit, the larger the loss. It is subtracted from the numerator.",
  'panel.formulaTerms.intraInterference.label': 'Intra-satellite interference',
  'panel.formulaTerms.intraInterference.help': 'The combined power that other co-channel beams on the same satellite deliver to this receiver — the first term of the denominator.',
  'panel.formulaTerms.interInterference.label': 'Inter-satellite interference',
  'panel.formulaTerms.interInterference.help': 'The combined power that co-channel beams on other satellites deliver to this receiver — the second term of the denominator.',
  'panel.formulaTerms.noise.label': 'Thermal noise',
  'panel.formulaTerms.noise.help': 'Receiver thermal noise power σ² is independent of interference and joins total interference I in the SINR denominator.',
  'panel.formulaTerms.denominatorTotal.label': 'Denominator total',
  'panel.formulaTerms.denominatorTotal.help': 'The summed power of intra-satellite interference, inter-satellite interference and thermal noise — the denominator of γ.',

  'panel.absent.tag': 'Not included yet',
  'panel.absent.hint': 'A dash means this model does not compute the quantity: the value is unknown rather than zero.',
};

export interface PanelCopy {
  readonly locale: string;
  /** Shared catalog lookup (`src/i18n/strings.ts`). */
  readonly t: (key: string) => string;
  /** Right-panel local copy that has no catalog key yet. Falls back zh-TW → key. */
  readonly tx: (key: string) => string;
}

export function usePanelCopy(): PanelCopy {
  const { locale, t } = useLocale();
  const tx = (key: string): string => {
    const dict = locale === 'en' ? LOCAL_EN : LOCAL_ZH;
    return dict[key] ?? LOCAL_ZH[key] ?? key;
  };
  return { locale, t, tx };
}

/**
 * Right-panel "?" trigger. Same component and same a11y contract as the left
 * panel's, only pre-configured for this side of the screen.
 *
 * `order` lets callers keep label/value text adjacent in the DOM while placing
 * the help trigger at the visual edge of the row.
 */
export function PanelHelp({
  order,
  placement = 'right',
  ...help
}: HelpPopoverProps & { readonly order?: number }): ReactNode {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // Collapses the 44px hit box to ~18px of layout height. Hit area and
        // focus ring are untouched; only the row height it would force shrinks.
        margin: '-13px 0',
        flexShrink: 0,
        order,
      }}
    >
      <HelpPopover placement={placement} {...help} />
    </span>
  );
}

/** Small caption-weight field label used across the right panel's KPI rows. */
export const PANEL_FIELD_LABEL_STYLE = {
  minWidth: 0,
  color: UI_TOKENS.color.text.secondary,
  fontSize: UI_TOKENS.type.size.tiny,
  fontWeight: UI_TOKENS.type.weight.strong,
  lineHeight: 1.2,
} as const;

/** `—`-first numeric style: tabular figures so stacked readings line up. */
export const PANEL_VALUE_STYLE = {
  color: UI_TOKENS.color.text.primary,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  textAlign: 'right',
} as const;
