/**
 * i18n string catalog (owner: agent-A).
 *
 * Register — the reader is an undergraduate meeting this screen for the first
 * time. Aim for concise, precise, textbook prose: understandable is not the
 * same as chatty. No baby talk, no filler analogies.
 *
 * Rules the copy follows:
 * - Parts of a formula are named `分子` / `分母` (numerator / denominator).
 *   Positional words — 上面/下面, 上半部/下半部, top/bottom/above/below — are
 *   never used to describe formula structure.
 * - Headings are nominal and specific ("SINR 的定義"), not sentence-shaped
 *   questions ("訊號品質是怎麼算出來的").
 * - Each string answers a student question directly:
 *     `param.*.label` / `.unit`   control chrome.
 *     `param.*.help`              what this quantity is, and where it sits in
 *                                 the formula.
 *     `param.*.effect`            what changes when I move it — cause, effect.
 *     `formula.*.caption`         the formula itself, with symbols and units.
 *     `kpi.*.help`                what this number means, and the expression
 *                                 it comes from.
 * - EN is a parallel student-friendly translation, not a literal
 *   retranslation of the Chinese, and uses numerator / denominator.
 *
 * `ZH_TW` is the source of truth for the key set. `EN` is typed as
 * `Record<I18nKey, string>` so TypeScript itself enforces that every ZH_TW
 * key has an EN counterpart (missing/extra keys are compile errors);
 * `strings.test.ts` re-checks this at runtime plus a few format invariants.
 */

export const ZH_TW = {
  // ---------------------------------------------------------------------
  // param.* — SINR tuning parameters (src/ui/SignalTuningPanel.tsx and
  // src/signalTuning.ts).
  // ---------------------------------------------------------------------

  'param.maxTxPowerDbm.label': '衛星發射功率',
  'param.maxTxPowerDbm.unit': 'dBm',
  'param.maxTxPowerDbm.help':
    '衛星波束的 RF 輸出設定，以 dBm 表示；它會影響 SINR 分子使用的鏈路功率 p_{u,s,v}(t, θ)。',
  'param.maxTxPowerDbm.effect':
    '調高：分子的接收訊號功率上升，SINR 提高，耗電同步增加。同頻的其他波束一併變強時，分母的干擾項也會變大，因此 SINR 的淨改善會被部分抵銷。',

  'param.ueAntennaMaxGainDbi.label': '地面接收天線增益',
  'param.ueAntennaMaxGainDbi.unit': 'dBi',
  'param.ueAntennaMaxGainDbi.help':
    '使用者裝置的接收增益；此因素納入非角度鏈路因子 H_{u,s,v}(t)，不在簡化 SINR 主式中另列。',
  'param.ueAntennaMaxGainDbi.effect':
    '調高：接收端訊號功率提高，serving 與 candidate 的 SINR 一起上升。衛星端的發射功率與波束間的干擾量維持不變。',

  'param.bandwidthMHz.label': '頻道頻寬',
  'param.bandwidthMHz.unit': 'MHz',
  'param.bandwidthMHz.help':
    '這條無線電頻道的頻寬 B^w；它會影響鏈路速率 R_{u,s,v}(t, θ) 與接收雜訊 σ²。',
  'param.bandwidthMHz.effect':
    '調寬：接收雜訊 σ² 會增加，SINR 可能下降；同時單一波束的 B^w 增加，鏈路速率也會受到影響。',

  'param.noisePsdDbmHz.label': '雜訊功率密度',
  'param.noisePsdDbmHz.unit': 'dBm/Hz',
  'param.noisePsdDbmHz.help':
    '每赫茲頻寬中的接收雜訊強度；它是形成 SINR 分母雜訊項 σ² 的輸入。',
  'param.noisePsdDbmHz.effect':
    '調高（數值變得比較不負）：分母的雜訊項 σ² 變大，SINR 下降；接收訊號本來就弱的連線降幅最明顯。',

  'param.frequencyGHz.label': '載波頻率',
  'param.frequencyGHz.unit': 'GHz',
  'param.frequencyGHz.help':
    '訊號使用的載波頻率；頻率越高，非角度鏈路因子 H_{u,s,v}(t) 通常越弱。',
  'param.frequencyGHz.effect':
    '調高：非角度鏈路因子 H_{u,s,v}(t) 可能降低，分子的訊號功率與 SINR 也會下降。',

  'param.atmosphericZenithLossDb.label': '大氣吸收損耗（天頂值）',
  'param.atmosphericZenithLossDb.unit': 'dB',
  'param.atmosphericZenithLossDb.help':
    '訊號穿越大氣層時的吸收損耗；它會被收進非角度鏈路因子 H_{u,s,v}(t)。',
  'param.atmosphericZenithLossDb.effect':
    '調高：非角度鏈路因子 H_{u,s,v}(t) 變弱，分子的訊號功率與 SINR 隨之下降；低仰角連線通常更敏感。',

  'param.scintillationScaleDb.label': '閃爍衰落幅度',
  'param.scintillationScaleDb.unit': 'dB',
  'param.scintillationScaleDb.help':
    '大氣亂流造成的訊號起伏；此因素會被收進非角度鏈路因子 H_{u,s,v}(t)。',
  'param.scintillationScaleDb.effect':
    '調高：非角度鏈路因子 H_{u,s,v}(t) 變弱，分子的訊號功率與 SINR 隨之下降，代表更不穩定的訊號環境。',

  'param.shadowFadingMarginDb.label': '陰影衰落餘裕',
  'param.shadowFadingMarginDb.unit': 'dB',
  'param.shadowFadingMarginDb.help':
    '訊號被建築物、地形等障礙物遮蔽而產生的額外損失；此因素會被收進非角度鏈路因子 H_{u,s,v}(t)。',
  'param.shadowFadingMarginDb.effect':
    '調高：非角度鏈路因子 H_{u,s,v}(t) 變弱，分子的訊號功率與 SINR 隨之下降，代表遮蔽較嚴重的環境。',

  'param.tr38811NlosClutterLossDb.label': '非視距雜波損耗（TR 38.811）',
  'param.tr38811NlosClutterLossDb.unit': 'dB',
  'param.tr38811NlosClutterLossDb.help':
    '在非視距（NLoS）條件下，訊號被建築物、樹木等雜物額外吸收的損耗；它會被收進非角度鏈路因子 H_{u,s,v}(t)。',
  'param.tr38811NlosClutterLossDb.effect':
    '調高：被判定為 NLoS 的取樣點分子訊號功率下降、SINR 下降；判定為 LoS（視距）的取樣點維持原值。',

  'param.maxGainDbi.label': '衛星波束最大增益',
  'param.maxGainDbi.unit': 'dBi',
  'param.maxGainDbi.help':
    '衛星天線在波束中心方向的最大增益 G^T，決定該波束把功率集中到什麼程度。',
  'param.maxGainDbi.effect':
    '調高：波束中心的訊號功率上升，該波束覆蓋範圍內所有使用者的 SINR 分子同步提高；同頻鄰近波束的增益一併上升，分母的干擾項也會變大。',

  'param.beamwidth3dBDeg.label': '波束寬度（3 dB）',
  'param.beamwidth3dBDeg.unit': '度',
  'param.beamwidth3dBDeg.help':
    '波束主瓣的 3 dB 涵蓋角度。角度越窄，功率集中於越小的地面區域；角度越寬，涵蓋範圍越大而功率密度越低。',
  'param.beamwidth3dBDeg.effect':
    '調窄：波束中心增益提高、地面覆蓋範圍縮小；調寬則相反。變更後波束佈局會重新計算，進行中的換手倒數重新開始。',

  'param.frequencyReuse.label': '頻率重用群組數',
  'param.frequencyReuse.help':
    '將作用中的波束分成指定數量的頻率重用群組；同組波束才會形成同頻干擾。',
  'param.frequencyReuse.effect':
    '調小：共享頻率的波束增加，同頻干擾可能變大。調大：同頻干擾減少，但單一波束的可用頻寬也會重新分配。',

  // ---------------------------------------------------------------------
  // tab.* — top-level left-panel tabs and their panel headings.
  // ---------------------------------------------------------------------

  'tab.sinr.label': 'SINR 訊號與干擾雜訊比',
  'tab.sinr.heading': 'SINR 公式',
  'tab.energy.label': '能源效率',

  // ---------------------------------------------------------------------
  // formula.* — captions shown alongside each tab's formula. Formula parts
  // are named 分子 / 分母, never by screen position.
  // ---------------------------------------------------------------------

  'formula.sinr.caption':
    'SINR 是一個比值：分子為服務波束送達接收端的訊號功率，分母為同頻其他波束的干擾功率與背景雜訊功率之和。SINR 越高，代表訊號相對於干擾與雜訊越強；換手決策即是比較 serving 與 candidate 兩者的 SINR。',
  'formula.sinr.fractionHint':
    '分子：服務波束送達的訊號功率。分母：同頻干擾功率與背景雜訊功率之和。',
  'formula.sinr.symbolHelp':
    'γ_{u,s,v}(t, θ) 即 SINR。分子使用鏈路功率 p_{u,s,v}(t, θ)、非角度鏈路因子 H_{u,s,v}(t) 與發射增益 Gᵀ(θ)；分母使用總干擾 I_{u,s,v}(t, θ) 與接收雜訊 σ²。比值越大，訊號相對於干擾與雜訊越強。',
  // ---------------------------------------------------------------------
  // kpi.* — right-side info panel readouts (src/ui/InfoPanel.tsx,
  // src/ui/info-panel/DuelCard.tsx) and the read-only noise floor
  // (src/ui/signal-tuning/ControlSections.tsx).
  // ---------------------------------------------------------------------

  'kpi.servingSinr.label': '服務波束 SINR',
  'kpi.servingSinr.help':
    '目前服務波束在使用者端量得的 SINR。數值越高，訊號相對於干擾與雜訊越強，連線越不容易中斷。',

  'kpi.candidateSinr.label': '候選波束 SINR',
  'kpi.candidateSinr.help':
    '若改由鄰近的候選波束提供服務，使用者端會量到的 SINR。它與服務波束的數值相比較，作為換手決策的依據。',

  'kpi.sinrDelta.label': 'SINR 差值 ΔSINR',
  'kpi.sinrDelta.help':
    '候選波束與服務波束的 SINR 差值，單位 dB。差值必須超過設定的遲滯門檻才會啟動換手，避免兩者接近時反覆切換。',

  'kpi.servingIdentity.label': '服務中的衛星／波束',
  'kpi.servingIdentity.help':
    '目前提供服務的衛星與波束編號。換手完成時，此處的編號隨之更新。',

  'kpi.pendingTarget.label': '換手預備目標',
  'kpi.pendingTarget.help':
    '系統正在評估、準備接手的下一個波束。它必須維持足夠的 SINR 直到倒數結束，才會成為新的服務連線。',

  'kpi.tttProgress.label': '換手倒數（TTT）',
  'kpi.tttProgress.help':
    'Time-To-Trigger：候選波束的 SINR 超過門檻後，必須連續維持這段時間才會觸發換手，用以濾除短暫的訊號起伏。',

  'kpi.handoverCount.label': '換手次數',
  'kpi.handoverCount.help':
    '自模擬開始至今，服務連線在波束或衛星之間切換的總次數。',

  'kpi.elevation.label': '仰角',
  'kpi.elevation.help':
    '自使用者位置觀測衛星的仰角（0° 為地平線，90° 為天頂）。仰角越高，訊號穿越的大氣路徑越短，路徑損耗越小。',

  'kpi.range.label': '距離',
  'kpi.range.help':
    '使用者與衛星之間的直線距離。距離越遠，自由空間損耗越大。',

  'kpi.noiseFloor.label': '雜訊底線',
  'kpi.noiseFloor.help':
    '雜訊底線 σ² 是 SINR 分母中與同頻干擾無關的接收雜訊功率，由目前設定形成。',

  'kpi.instantaneousEe.label': '瞬時能源效率',
  'kpi.instantaneousEe.help':
    '此刻所有服務鏈路的總吞吐量與共同系統總功率 P^N(t, θ) 的比值，顯示每焦耳可傳送的資料量。',

  'kpi.coverage.label': '覆蓋率',
  'kpi.coverage.help':
    '目前畫面中具有服務連線的使用者，占全部使用者的比例。',

  'kpi.servedUeCount.label': '被服務的使用者數',
  'kpi.servedUeCount.help':
    '目前有波束提供服務、收得到訊號的使用者裝置數量。',

  // ---------------------------------------------------------------------
  // panel.* — shared right-panel copy for the field-wide EE card.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // common.* — shared chrome copy and reusable unit labels.
  // ---------------------------------------------------------------------

  'common.reset': '重設',
  'common.close': '關閉',
  'common.help': '說明',
  'common.derived': '推算值',
  'common.absent': '尚未納入',
  'common.details': '詳細說明',
  
  'common.min': '最小',
  'common.max': '最大',
  'common.on': '開',
  'common.off': '關',
  'common.showOtherHandoverUes': '顯示其他換手中的 UE',
  'common.scope.primaryUe': '主要 UE',
  'common.scope.system': '系統',
  'common.scope.beamAggregate': '波束聚合',

  'common.unit.dbm': 'dBm',
  'common.unit.dbi': 'dBi',
  'common.unit.db': 'dB',
  'common.unit.mhz': 'MHz',
  'common.unit.ghz': 'GHz',
  'common.unit.watt': 'W',
  'common.unit.ue': '位使用者',
  'common.unit.joule': 'J',
  'common.unit.mbps': 'Mbit/s',
  'common.unit.mbitPerJoule': 'Mbit/J',
  'common.unit.second': 's',
  'common.unit.km': 'km',
  'common.unit.deg': '°',
  'common.unit.percent': '%',

};

export type I18nKey = keyof typeof ZH_TW;

export const EN: Record<I18nKey, string> = {
  // ---------------------------------------------------------------------
  // param.*
  // ---------------------------------------------------------------------

  'param.maxTxPowerDbm.label': 'Satellite transmit power',
  'param.maxTxPowerDbm.unit': 'dBm',
  'param.maxTxPowerDbm.help':
    'The satellite beam RF-output setting, in dBm; it affects the link power p_{u,s,v}(t, θ) shown in the SINR numerator.',
  'param.maxTxPowerDbm.effect':
    'Raise it: received signal power in the numerator rises, SINR improves, and power draw rises with it. When other co-channel beams rise as well, the interference term in the denominator grows too, so part of the SINR gain is offset.',

  'param.ueAntennaMaxGainDbi.label': 'Ground receiver gain',
  'param.ueAntennaMaxGainDbi.unit': 'dBi',
  'param.ueAntennaMaxGainDbi.help':
    'The user-device receive gain; it is included in the non-angle channel factor H_{u,s,v}(t) and is not a separate factor in the simplified SINR formula.',
  'param.ueAntennaMaxGainDbi.effect':
    'Raise it: received signal power increases, so serving and candidate SINR rise together. Satellite transmit power and inter-beam interference are unchanged.',

  'param.bandwidthMHz.label': 'Channel bandwidth',
  'param.bandwidthMHz.unit': 'MHz',
  'param.bandwidthMHz.help':
    'The bandwidth B^w of this radio channel; it affects the link rate R_{u,s,v}(t, θ) and receiver noise σ².',
  'param.bandwidthMHz.effect':
    'Widen it: receiver noise σ² rises and SINR may fall, while the single-beam B^w also rises and changes the link rate.',

  'param.noisePsdDbmHz.label': 'Noise power density',
  'param.noisePsdDbmHz.unit': 'dBm/Hz',
  'param.noisePsdDbmHz.help':
    'The receiver-noise intensity per hertz of bandwidth; it is an input to the SINR denominator noise term σ².',
  'param.noisePsdDbmHz.effect':
    'Raise it (make it less negative): the noise term σ² in the denominator grows and SINR falls, with the largest drop on links whose received signal is already weak.',

  'param.frequencyGHz.label': 'Carrier frequency',
  'param.frequencyGHz.unit': 'GHz',
  'param.frequencyGHz.help':
    'The carrier frequency of the signal; increasing it usually weakens the non-angle channel factor H_{u,s,v}(t).',
  'param.frequencyGHz.effect':
    'Raise it: the non-angle channel factor H_{u,s,v}(t) may weaken, reducing numerator signal power and SINR.',

  'param.atmosphericZenithLossDb.label': 'Atmospheric absorption (zenith)',
  'param.atmosphericZenithLossDb.unit': 'dB',
  'param.atmosphericZenithLossDb.help':
    'Signal absorption while crossing the atmosphere; it is included in the non-angle channel factor H_{u,s,v}(t).',
  'param.atmosphericZenithLossDb.effect':
    'Raise it: the non-angle channel factor H_{u,s,v}(t) weakens, reducing numerator signal power and SINR; low-elevation links are usually more sensitive.',

  'param.scintillationScaleDb.label': 'Scintillation fading margin',
  'param.scintillationScaleDb.unit': 'dB',
  'param.scintillationScaleDb.help':
    'Signal fluctuation caused by atmospheric turbulence; it is included in the non-angle channel factor H_{u,s,v}(t).',
  'param.scintillationScaleDb.effect':
    'Raise it: the non-angle channel factor H_{u,s,v}(t) weakens, reducing numerator signal power and SINR and representing a less stable signal environment.',

  'param.shadowFadingMarginDb.label': 'Shadow fading margin',
  'param.shadowFadingMarginDb.unit': 'dB',
  'param.shadowFadingMarginDb.help':
    'Additional loss when buildings, terrain, or similar obstacles block the path; it is included in the non-angle channel factor H_{u,s,v}(t).',
  'param.shadowFadingMarginDb.effect':
    'Raise it: the non-angle channel factor H_{u,s,v}(t) weakens, reducing numerator signal power and SINR and representing a more obstructed environment.',

  'param.tr38811NlosClutterLossDb.label': 'NLoS clutter loss (TR 38.811)',
  'param.tr38811NlosClutterLossDb.unit': 'dB',
  'param.tr38811NlosClutterLossDb.help':
    'Additional loss from buildings, trees, and similar clutter under non-line-of-sight (NLoS) conditions; it is included in H_{u,s,v}(t).',
  'param.tr38811NlosClutterLossDb.effect':
    'Raise it: for samples classified NLoS, numerator signal power falls and SINR drops; samples classified LoS keep their existing values.',

  'param.maxGainDbi.label': 'Max satellite beam gain',
  'param.maxGainDbi.unit': 'dBi',
  'param.maxGainDbi.help':
    'The peak gain G^T of the satellite antenna along the beam-center direction, setting how tightly that beam concentrates power.',
  'param.maxGainDbi.effect':
    'Raise it: beam-center signal power rises and the SINR numerator improves for every user under that beam. Co-channel neighboring beams gain as well, so the interference term in the denominator grows too.',

  'param.beamwidth3dBDeg.label': 'Beam width (3 dB)',
  'param.beamwidth3dBDeg.unit': 'degrees',
  'param.beamwidth3dBDeg.help':
    "The 3 dB coverage angle of the beam's main lobe. A narrower angle concentrates power into a smaller ground area; a wider angle covers more ground at a lower power density.",
  'param.beamwidth3dBDeg.effect':
    'Narrow it: beam-center gain rises and the ground footprint shrinks; widen it and the reverse happens. Either change recomputes the beam layout and restarts any handover countdown in progress.',

  'param.frequencyReuse.label': 'Frequency-reuse group count',
  'param.frequencyReuse.help':
    'Divides active beams into the selected number of frequency-reuse groups; only beams in the same group form co-channel interference.',
  'param.frequencyReuse.effect':
    'Lower it: more beams share a frequency, so co-channel interference may rise. Raise it: co-channel interference falls, while single-beam bandwidth is redistributed.',

  // ---------------------------------------------------------------------
  // tab.*
  // ---------------------------------------------------------------------

  'tab.sinr.label': 'SINR (signal-to-interference-plus-noise ratio)',
  'tab.sinr.heading': 'SINR formula',
  'tab.energy.label': 'Energy Efficiency',

  // ---------------------------------------------------------------------
  // formula.*
  // ---------------------------------------------------------------------

  'formula.sinr.caption':
    'SINR is a ratio: the numerator is the signal power the serving beam delivers to the receiver, and the denominator is the interference power from other co-channel beams plus the background noise power. A higher SINR means the signal is stronger relative to interference and noise; a handover decision compares the serving and candidate SINR.',
  'formula.sinr.fractionHint':
    'Numerator: the signal power delivered by the serving beam. Denominator: co-channel interference power plus background noise power.',
  'formula.sinr.symbolHelp':
    'γ_{u,s,v}(t, θ) is SINR. The numerator uses link power p_{u,s,v}(t, θ), non-angle channel factor H_{u,s,v}(t), and transmit gain Gᵀ(θ); the denominator uses total interference I_{u,s,v}(t, θ) and receiver noise σ². A larger ratio means a stronger signal relative to interference and noise.',
  // ---------------------------------------------------------------------
  // kpi.*
  // ---------------------------------------------------------------------

  'kpi.servingSinr.label': 'Serving beam SINR',
  'kpi.servingSinr.help':
    'The SINR measured at the user for the beam currently serving them. The higher the value, the stronger the signal relative to interference and noise, and the less likely the link is to drop.',

  'kpi.candidateSinr.label': 'Candidate beam SINR',
  'kpi.candidateSinr.help':
    'The SINR the user would measure if the neighboring candidate beam took over service. It is compared against the serving beam value as the basis for the handover decision.',

  'kpi.sinrDelta.label': 'SINR difference ΔSINR',
  'kpi.sinrDelta.help':
    'The SINR difference between the candidate and serving beams, in dB. The difference must exceed the configured hysteresis threshold before a handover starts, which prevents repeated switching when the two are close.',

  'kpi.servingIdentity.label': 'Serving satellite / beam',
  'kpi.servingIdentity.help':
    'The satellite and beam ID currently providing service. This ID updates as soon as a handover completes.',

  'kpi.pendingTarget.label': 'Pending handover target',
  'kpi.pendingTarget.help':
    'The next beam the system is evaluating as a replacement. It must hold sufficient SINR until the countdown ends before it becomes the new serving link.',

  'kpi.tttProgress.label': 'Handover countdown (TTT)',
  'kpi.tttProgress.help':
    'Time-To-Trigger: once the candidate beam SINR clears the threshold, it must hold for this duration before a handover fires, which filters out brief fluctuations in the signal.',

  'kpi.handoverCount.label': 'Handover count',
  'kpi.handoverCount.help':
    'The total number of times the serving link has switched between beams or satellites since the run started.',

  'kpi.elevation.label': 'Elevation angle',
  'kpi.elevation.help':
    "The elevation of the satellite as observed from the user's position (0° at the horizon, 90° at zenith). Higher elevation means a shorter path through the atmosphere and less path loss.",

  'kpi.range.label': 'Slant range',
  'kpi.range.help':
    'The straight-line distance between the user and the satellite. The greater the distance, the larger the free-space loss.',

  'kpi.noiseFloor.label': 'Noise floor',
  'kpi.noiseFloor.help':
    'The noise floor σ² is the receiver-noise term in the SINR denominator and is independent of co-channel interference. It is formed from the current settings.',

  'kpi.instantaneousEe.label': 'Instantaneous EE',
  'kpi.instantaneousEe.help':
    'The ratio of total served-link throughput to common system power P^N(t, θ) in this frame, showing how much data is delivered per joule.',

  'kpi.coverage.label': 'Coverage',
  'kpi.coverage.help':
    'The proportion of all users in the current frame that have a serving link.',

  'kpi.servedUeCount.label': 'Served UE count',
  'kpi.servedUeCount.help':
    'The number of user devices currently served by a beam and receiving a signal.',



  // ---------------------------------------------------------------------
  // panel.*
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // common.*
  // ---------------------------------------------------------------------

  'common.reset': 'Reset',
  'common.close': 'Close',
  'common.help': 'Help',
  'common.derived': 'Derived',
  'common.absent': 'Not included yet',
  'common.details': 'Details',
  'common.min': 'Min',
  'common.max': 'Max',
  'common.on': 'ON',
  'common.off': 'OFF',
  'common.showOtherHandoverUes': 'Show other UEs in handover',
  'common.scope.primaryUe': 'Primary UE',
  'common.scope.system': 'System',
  'common.scope.beamAggregate': 'Beam aggregate',

  'common.unit.dbm': 'dBm',
  'common.unit.dbi': 'dBi',
  'common.unit.db': 'dB',
  'common.unit.mhz': 'MHz',
  'common.unit.ghz': 'GHz',
  'common.unit.watt': 'W',
  'common.unit.ue': 'users',
  'common.unit.joule': 'J',
  'common.unit.mbps': 'Mbit/s',
  'common.unit.mbitPerJoule': 'Mbit/J',
  'common.unit.second': 's',
  'common.unit.km': 'km',
  'common.unit.deg': '°',
  'common.unit.percent': '%',

};
