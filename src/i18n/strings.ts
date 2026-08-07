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
 * The energy chain the copy walks through, end to end:
 *   P_RF     = 10^(P_tx/10) / 1000             dBm -> W
 *   P_PA     = P_RF / eta_PA                   W
 *   P_total  = P_PA + P_circuit                W
 *   R        = (B / K) * log2(1 + SINR)        bit/s
 *   SumMbit  = Sum over t of R(t) * dt         Mbit
 *   SumJ     = Sum over t of P_total(t) * dt   J
 *   EE       = SumMbit / SumJ                  Mbit/J
 *
 * `ZH_TW` is the source of truth for the key set. `EN` is typed as
 * `Record<I18nKey, string>` so TypeScript itself enforces that every ZH_TW
 * key has an EN counterpart (missing/extra keys are compile errors);
 * `strings.test.ts` re-checks this at runtime plus a few format invariants.
 */

export const ZH_TW = {
  // ---------------------------------------------------------------------
  // param.* — SINR tuning parameters (src/ui/SignalTuningPanel.tsx,
  // src/signalTuning.ts) plus the two EE/energy tuning parameters
  // (src/teaching/energyModel.ts EnergyTuningState).
  // ---------------------------------------------------------------------

  'param.maxTxPowerDbm.label': '衛星發射功率',
  'param.maxTxPowerDbm.unit': 'dBm',
  'param.maxTxPowerDbm.help':
    '衛星每道波束送出的訊號強度，以 dBm 表示。它決定 SINR 分子中的接收訊號功率；換算成瓦為 P_RF ＝ 10^(P_tx/10) ÷ 1000。',
  'param.maxTxPowerDbm.effect':
    '調高：分子的接收訊號功率上升，SINR 提高，耗電同步增加。同頻的其他波束一併變強時，分母的干擾項也會變大，因此 SINR 的淨改善會被部分抵銷。',

  'param.ueAntennaMaxGainDbi.label': '地面接收天線增益',
  'param.ueAntennaMaxGainDbi.unit': 'dBi',
  'param.ueAntennaMaxGainDbi.help':
    '使用者裝置（手機／終端機）天線的接收增益 G^R，代表它把入射電波轉換成可用訊號功率的能力。',
  'param.ueAntennaMaxGainDbi.effect':
    '調高：接收端訊號功率提高，serving 與 candidate 的 SINR 一起上升。衛星端的發射功率與波束間的干擾量維持不變。',

  'param.bandwidthMHz.label': '頻道頻寬',
  'param.bandwidthMHz.unit': 'MHz',
  'param.bandwidthMHz.help':
    '這條無線電頻道的頻寬 B。它同時出現在兩處：吞吐量公式 R ＝ (B ÷ K)·log₂(1+SINR) 中 B/K 的分子，以及 SINR 分母的熱雜訊項 σ² ＝ N₀·B。',
  'param.bandwidthMHz.effect':
    '調寬：分母的熱雜訊 σ² 等比例變大，其他條件不變時 SINR 下降；但 B/K 這個乘數同時變大。最終吞吐量取決於兩者的淨效果。',

  'param.noisePsdDbmHz.label': '雜訊功率密度',
  'param.noisePsdDbmHz.unit': 'dBm/Hz',
  'param.noisePsdDbmHz.help':
    '雜訊功率密度 N₀，即每赫茲頻寬中的雜訊功率，源自接收機的熱雜訊。它與頻寬相乘後構成 SINR 分母的雜訊項 σ² ＝ N₀·B。',
  'param.noisePsdDbmHz.effect':
    '調高（數值變得比較不負）：分母的雜訊項 σ² 變大，SINR 下降；接收訊號本來就弱的連線降幅最明顯。',

  'param.frequencyGHz.label': '載波頻率',
  'param.frequencyGHz.unit': 'GHz',
  'param.frequencyGHz.help':
    '訊號使用的載波頻率 f。自由空間損耗 Lfs 隨頻率平方成長，因此頻率越高，同樣距離下的路徑損耗越大。',
  'param.frequencyGHz.effect':
    '調高：自由空間損耗 Lfs 增加，相同距離下分子的接收訊號功率下降，SINR 隨之下降。',

  'param.atmosphericZenithLossDb.label': '大氣吸收損耗（天頂值）',
  'param.atmosphericZenithLossDb.unit': 'dB',
  'param.atmosphericZenithLossDb.help':
    '訊號穿越大氣層時被氣體分子吸收的損耗 Lg，以衛星位於天頂時的數值為基準。仰角越低，訊號在大氣中的路徑越長，實際損耗越大。',
  'param.atmosphericZenithLossDb.effect':
    '調高：損耗項 Lg 變大，分子的接收訊號功率下降，SINR 隨之下降；低仰角連線的降幅大於高仰角連線。',

  'param.scintillationScaleDb.label': '閃爍衰落幅度',
  'param.scintillationScaleDb.unit': 'dB',
  'param.scintillationScaleDb.help':
    '大氣亂流造成的訊號隨機起伏，此處以一個與仰角相關的餘裕值 Lsc 表示其平均振幅。',
  'param.scintillationScaleDb.effect':
    '調高：損耗項 Lsc 變大，分子的接收訊號功率下降，SINR 隨之下降，對應訊號較不穩定的環境。',

  'param.shadowFadingMarginDb.label': '陰影衰落餘裕',
  'param.shadowFadingMarginDb.unit': 'dB',
  'param.shadowFadingMarginDb.help':
    '訊號被建築物、地形等障礙物遮蔽而額外損失的功率，此處以固定餘裕值 Lsf 表示。',
  'param.shadowFadingMarginDb.effect':
    '調高：損耗項 Lsf 變大，分子的接收訊號功率下降，SINR 隨之下降，對應遮蔽較嚴重的環境。',

  'param.tr38811NlosClutterLossDb.label': '非視距雜波損耗（TR 38.811）',
  'param.tr38811NlosClutterLossDb.unit': 'dB',
  'param.tr38811NlosClutterLossDb.help':
    '在非視距（NLoS）條件下，訊號被建築物、樹木等雜物額外吸收的損耗 Lcl。僅作用於 TR 38.811 公式家族中被判定為 NLoS 的取樣點。',
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

  'param.model.label': '波束增益模型',
  'param.model.help':
    '決定增益隨偏離波束中心角度衰減的函數形狀。Bessel J1/J3、Bessel J1、Flat Top 對應不同的天線孔徑假設。',
  'param.model.effect':
    '切換模型會改變離軸衰減的速率，影響波束邊緣使用者的 SINR；波束中心的最大增益維持不變。',

  'param.maxSteeringAngleDeg.label': '最大波束轉向角',
  'param.maxSteeringAngleDeg.unit': '度',
  'param.maxSteeringAngleDeg.help':
    '波束相對衛星星下點可偏轉的最大角度，決定它能服務到多遠的地面使用者。',
  'param.maxSteeringAngleDeg.effect':
    '調大：可用的候選波束增加，但偏轉角接近上限的波束承受更大的轉向損耗（scan loss）。',

  'param.scanLossAtMaxSteeringDb.label': '最大轉向損耗',
  'param.scanLossAtMaxSteeringDb.unit': 'dB',
  'param.scanLossAtMaxSteeringDb.help':
    '波束偏轉至最大角度時，因偏離天線最佳指向而額外產生的增益損失。',
  'param.scanLossAtMaxSteeringDb.effect':
    '調高：偏轉角越大的波束損失越多增益，原本排名較前的候選波束可能因此退出最佳選擇。',

  'param.frequencyReuse.label': '頻率重複使用係數 K',
  'param.frequencyReuse.help':
    '頻率重複使用係數 K 把作用中的波束分成 K 組，僅同組波束之間產生同頻干擾。K 同時是吞吐量公式 R ＝ (B ÷ K)·log₂(1+SINR) 中 B/K 的分母。',
  'param.frequencyReuse.effect':
    '調小（例如 K=1）：所有波束共用同一頻率，分母的干擾項最大，SINR 下降、換手更難完成。調大：同頻干擾減少、SINR 上升，但每道波束可用的頻寬 B/K 隨之縮小，吞吐量未必同步提高。',

  'param.paEfficiency.label': '功率放大器效率 η_PA',
  'param.paEfficiency.unit': '比例（0–1，無單位）',
  'param.paEfficiency.help':
    '功率放大器（PA）把輸入電功率轉換為射頻輸出功率的效率 η_PA，範圍 0 至 1。η_PA ＝ 0.4 表示每輸出 1 W 射頻功率需輸入 2.5 W 電功率，其餘轉為熱能。',
  'param.paEfficiency.effect':
    '效率越低，相同發射功率所需的輸入功率越大（P_PA ＝ P_RF ÷ η_PA），總功率上升、EE 下降；調高則相反，相同的訊號強度只需較少的電功率。',

  'param.circuitPowerW.label': '電路功率 P_circuit',
  'param.circuitPowerW.unit': 'W',
  'param.circuitPowerW.help':
    '功率放大器以外，衛星維持運作所需的固定電功率 P_circuit（處理器、冷卻與其他電路）。它與發射功率及傳輸量無關，直接加入總功率：P_total ＝ P_PA + P_circuit。',
  'param.circuitPowerW.effect':
    '調高：總功率整體上移一個固定量，瞬時 EE 與整段累積效率同步下降，吞吐量低的時段降幅最明顯；調低則相反。',

  'param.energyPerHandoverJ.label': '每次換手耗能 e_HO',
  'param.energyPerHandoverJ.unit': 'J',
  'param.energyPerHandoverJ.help':
    '完成一次換手所額外消耗的能量 e_HO：量測與回報、決策訊令往返、以及在新波束上重新建立連線的處理成本。它與換手次數相乘即為整段區間的換手能量 E_HO ＝ 換手次數 × e_HO，與無線電能量相加後構成總耗能。',
  'param.energyPerHandoverJ.effect':
    '調高：每次換手在總耗能中的份量加重，整段累積效率的分母變大、數值下降，乒乓效應（連線在兩者之間反覆切換）的代價因此看得見；調低則換手趨近免費。設為 0 表示不計換手能量，耗能明細退回只計無線電能量的形式。',

  // ---------------------------------------------------------------------
  // tab.* — top-level left-panel tabs and their panel headings.
  // ---------------------------------------------------------------------

  'tab.sinr.label': 'SINR 訊號與干擾雜訊比',
  'tab.sinr.heading': 'SINR 的定義',
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
    'γ 即 SINR。分子 P_t · H · G^T · G^R 是發射功率經過通道衰減與收發天線增益之後，實際送達接收端的訊號功率；分母 I^a + I^b + σ² 是同一時刻的同頻干擾功率與熱雜訊功率之和。比值越大，訊號相對於干擾與雜訊越強。',
  'formula.throughput.caption':
    '吞吐量由 Shannon 公式決定：R ＝ (B ÷ K)·log₂(1 + SINR)。B 為頻道頻寬、K 為頻率重複使用係數，B 位於分子、K 位於分母，因此每道波束實際可用的頻寬為 B/K。SINR 每提高一倍，log₂ 項只增加 1，故單靠提升功率的邊際效益遞減。',
  'formula.energy.caption':
    '能量是功率對時間的累積：每個時間步消耗 P_total × Δt 焦耳，逐步加總即為累積耗能 ΣJ ＝ Σ P_total(t)·Δt。以相同方式累積各步送出的資料量，即得累積傳輸量 ΣMbit ＝ Σ R(t)·Δt。此外每次換手另計一份固定能量，總耗能 ＝ Σ P_total(t)·Δt ＋ E_HO。',
  'formula.power.caption':
    '發射功率先由 dBm 換算為瓦：P_RF ＝ 10^(P_tx/10) ÷ 1000。功率放大器每輸出 1 W 射頻功率需輸入 1/η_PA W 電功率，故 P_PA ＝ P_RF ÷ η_PA。再加上固定的電路功耗，即為此刻的系統總功率 P_total ＝ P_PA + P_circuit，單位為瓦（W）。',
  'formula.ee.caption':
    '能源效率 EE 是一個比值：分子為送出的資料量，分母為消耗的能量，單位 Mbit/J，代表每一焦耳能量可傳送多少 Mbit 資料，數值越大越省電。瞬時 EE 取此刻的 R ÷ P_total；整段累積效率取整段時間的 ΣMbit ÷ ΣJ。',

  // ---------------------------------------------------------------------
  // kpi.* — right-side info panel readouts (src/ui/InfoPanel.tsx,
  // src/ui/info-panel/DuelCard.tsx, src/ui/info-panel/EnergyEfficiencyCard.tsx,
  // src/ui/info-panel/TeachingEnergyCard.tsx) and the read-only noise floor
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
    '雜訊底線 σ² ＝ 雜訊功率密度 N₀ × 頻寬 B，是 SINR 分母中與干擾無關、恆定存在的一項。此數值由目前參數計算得出，為唯讀。',

  'kpi.rfTxPower.label': '無線電發射功率',
  'kpi.rfTxPower.help':
    '設定的發射功率由 dBm 換算為瓦：P_RF ＝ 10^(P_tx/10) ÷ 1000，即實際饋入天線並輻射出去的射頻功率。',

  'kpi.paInputPower.label': 'PA 輸入功率',
  'kpi.paInputPower.help':
    '功率放大器為產生上述射頻輸出所需的輸入電功率：P_PA ＝ P_RF ÷ η_PA。效率越低，此值高於 P_RF 越多，差額轉為熱能。',

  'kpi.circuitPower.label': '電路功率',
  'kpi.circuitPower.help':
    '功率放大器以外，維持衛星運作所需的固定電功率 P_circuit。它不隨傳輸量變動，是每一時刻都要負擔的基本開銷。',

  'kpi.totalPower.label': '總功率',
  'kpi.totalPower.help':
    '此刻衛星消耗的總電功率：P_total ＝ P_PA + P_circuit，單位為瓦（W）。將各時刻的 P_total 對時間累積，即得累積耗能。',

  'kpi.throughput.label': '吞吐量',
  'kpi.throughput.help':
    '此刻連線可承載的資料速率，由 Shannon 公式依頻寬與 SINR 計算：R ＝ (B ÷ K)·log₂(1 + SINR)，B 為頻寬、K 為頻率重複使用係數。單位為 Mbit/s。',

  'kpi.cumulativeDeliveredData.label': '累積傳輸資料量',
  'kpi.cumulativeDeliveredData.help':
    '自當前量測視窗開始累積送出的資料總量：ΣMbit ＝ Σ R(t)·Δt，即各時間步的吞吐量乘上該步的時間長度後加總，單位為 Mbit。',

  'kpi.cumulativeEnergy.label': '累積耗能',
  'kpi.cumulativeEnergy.help':
    '自當前量測視窗開始累積消耗的能量總量：ΣJ ＝ Σ P_total(t)·Δt，即各時間步的總功率乘上該步的時間長度後加總，單位為焦耳（J）。',

  'kpi.instantaneousEe.label': '瞬時能源效率',
  'kpi.instantaneousEe.help':
    '此刻的吞吐量除以此刻的總功率：R ÷ P_total，單位 Mbit/J。它隨 SINR 與功率設定即時變動，用於觀察單一參數調整當下的效果。',

  'kpi.totalEnergy.label': '總耗能',
  'kpi.totalEnergy.help':
    '此累積區間消耗的能量總計：總耗能 ＝ 無線電能量 Σ P_total·Δt ＋ 換手能量 E_HO，單位為焦耳（J）。它是整段累積效率的分母。',

  'kpi.runEe.label': '整段累積效率',
  'kpi.runEe.help':
    '整段累積效率（Run EE）＝ 整段時間送出的總資料量 ÷ 整段時間消耗的總能量（ΣMbit ÷ ΣJ），單位 Mbit/J，代表每一焦耳能量可傳送多少 Mbit 資料。分母 ΣJ 即總耗能，為無線電能量 Σ P_total·Δt 與換手能量 E_HO 之和。累積區間越長，數值越穩定。',

  'kpi.handoverEnergy.label': '換手耗能',
  'kpi.handoverEnergy.help':
    '此累積區間內所有換手所消耗的能量：E_HO ＝ 換手次數 × 每次換手耗能 e_HO，單位為焦耳（J）。e_HO 為可調參數，設為 0 即不計此項。E_HO 與無線電能量 Σ P_total·Δt 相加後構成總耗能，也就是整段累積效率的分母；區間內未發生換手時 E_HO 為 0。',

  'kpi.coverage.label': '覆蓋率',
  'kpi.coverage.help':
    '目前畫面中具有服務連線的使用者，占全部使用者的比例。',

  'kpi.servedUeCount.label': '被服務的使用者數',
  'kpi.servedUeCount.help':
    '目前有波束提供服務、收得到訊號的使用者裝置數量。',

  // ---------------------------------------------------------------------
  // panel.* — shared right-panel copy for the field-wide EE card.
  // ---------------------------------------------------------------------

  'panel.overallEe.title': '全場即時效率',
  'panel.overallEe.divider':
    '耗能明細為主角連線的整段累積；全場即時效率為全場所有使用者的當下平均，功率取自波束負載模型。',
  'panel.overallEe.help':
    '全場即時效率固定於單一時刻，對該時刻所有使用者的能源效率取覆蓋率加權平均，單位 bit/J。其功率來自論文的波束負載模型，不受功率調整滑桿影響。',

  'panel.ee.aggregation.label': '能源效率聚合',
  'panel.ee.headline.help':
    '此刻所有使用者能源效率的覆蓋率加權平均，屬單一時刻的橫斷面統計量。整段時間的 ΣMbit ÷ ΣJ 由耗能明細的整段累積效率表示。',
  'panel.ee.headline.unavailable': '全場即時效率尚無可用數值',
  'panel.ee.mean': '平均',
  'panel.ee.servedAverage.label': '被服務使用者的平均 EE',
  'panel.ee.servedAverage.help': '僅計入有波束提供服務的使用者，取其能源效率的平均值。未被服務的使用者不列入此平均。',
  'panel.ee.coverageStep.help': '以覆蓋率對被服務使用者的平均 EE 加權後，即為全場即時效率。覆蓋率越低，未被服務的使用者比例越高，全場即時效率越低。',
  'panel.ee.bandwidth.label': '計算 EE 時用的頻寬',
  'panel.ee.bandwidth.help': '計算吞吐量時假設每個連線可用的頻寬。頻寬越大，相同訊號品質下可傳送的資料量越多。',
  'panel.ee.bandwidth.detail': '用於 EE 計算',
  'panel.ee.population.label': '使用者總數',
  'panel.ee.population.help': '此場景中的使用者裝置總數，以及其中被服務與未被服務的數量。',
  'panel.ee.beamLoad.label': '每道波束上的使用者數',
  'panel.ee.beamLoad.help': '平均每一道作用中的波束所服務的使用者數。同一道波束上的使用者越多，每位使用者分得的資源越少。',
  'panel.ee.beamLoad.detail': '在作用中的波束上量測',
  'panel.ee.throughput.label': '被服務使用者的吞吐量',
  'panel.ee.throughput.help': '被服務使用者每秒接收資料量的平均值，為能源效率算式的分子。',
  'panel.ee.throughput.detail': 'EE 分子 R_u',
  'panel.ee.sinr.label': '被服務使用者的訊號品質',
  'panel.ee.sinr.help': '被服務使用者的平均訊號品質，單位為 dB。',
  'panel.ee.sinr.detail': '在已服務使用者上量測',
  'panel.ee.beamPower.label': '每道波束的功率',
  'panel.ee.beamPower.help': '平均每一道波束消耗的功率，單位為瓦。模型中波束所服務的使用者越多，配給該波束的功率越高。',
  'panel.ee.beamPower.detail': '取決於負載的每道波束原始功率',
  'panel.ee.perUePower.label': '每個使用者分攤到的功率',
  'panel.ee.perUePower.help': '一道波束的功率平均分配給其所服務的使用者後，每位使用者分攤到的瓦數，為能源效率算式的分母。',
  'panel.ee.perUePower.detail': '每道波束原始功率 ÷ U_s,v',
  'panel.ee.waiting.ueAssignments': '等待使用者分配結果',
  'panel.ee.waiting.uePopulation': '等待使用者總數',
  'panel.ee.waiting.frameValues': '等待本幀數值',
  'panel.ee.waiting.servedSinr': '等待已服務使用者的 SINR',
  'panel.ee.waiting.beamLoad': '等待波束負載',
  'panel.ee.detail.servedAssignments': '位使用者已取得服務',
  'panel.ee.detail.coverageServed': '位使用者已取得服務',
  'panel.ee.detail.served': '已取得服務',
  'panel.ee.detail.unserved': '尚未取得服務',

  // ---------------------------------------------------------------------
  // common.* — shared chrome copy and reusable unit labels.
  // ---------------------------------------------------------------------

  'common.reset': '重設',
  'common.close': '關閉',
  'common.help': '說明',
  'common.simulatedTeaching': '模擬資料',
  'common.derived': '推算值',
  'common.absent': '尚未納入',
  'common.details': '詳細說明',
  
  'panel.energy.teachingKnobTitle': '教學參數：單一連線功率模型',
  'panel.energy.canonicalTitle': '標準系統能源效率',
  'panel.energy.teachingKnobHelp': '此模型僅供教學，探索發射功率、放大器效率與吞吐量之間的關係；P_total 與 Run EE 屬 non-canonical scope，不是標準系統的 P_sys 或 EE_eval。',
  'panel.energy.teachingScopeNote': '此區顯示單一連線的功率鏈與本次量測時間窗的累積效率。',
  'panel.energyComparison.title': 'T5 實際資料功率減降反證',
  'panel.energyComparison.subtitle': '以 50 dBm 與 35 dBm 的相同量測時長比較實際資料；兩次原始起訖時間會保留供核對，服務關卡未通過時不宣稱節能。',
  'panel.energyComparison.matchedDurationHint': '基準窗口為 {seconds} 秒；請讓 35 dBm 也累積約 {seconds} 秒再擷取。',
  'panel.energyComparison.baseline': '基準',
  'panel.energyComparison.candidate': '候選',
  'panel.energyComparison.captureBaseline': '擷取基準快照',
  'panel.energyComparison.replaceBaseline': '替換基準快照',
  'panel.energyComparison.captureCandidate': '擷取候選快照',
  'panel.energyComparison.replaceCandidate': '替換候選快照',
  'panel.energyComparison.clear': '清除兩組快照',
  'panel.energyComparison.notCaptured': '尚未擷取',
  'panel.energyComparison.frozen': '已凍結',
  'panel.energyComparison.dataInsufficient': '—／資料不足',
  'panel.energyComparison.pass': 'PASS',
  'panel.energyComparison.fail': 'FAIL',
  'panel.energyComparison.percentagePoints': '個百分點',
  'panel.energyComparison.lowSinrLabel': '低 SINR 比例（< {threshold} {unit}）',
  'panel.energyComparison.gate.energySaving': '正向節能',
  'panel.energyComparison.gate.dataRetention': '累積傳輸資料量比值 ≥',
  'panel.energyComparison.gate.lowSinr': '低 SINR 比例增加 ≤',
  'panel.energyComparison.gate.runEe': '整段累積效率比值 ≥',
  'panel.energyComparison.overall': '四項關卡 AND',
  'panel.energyComparison.settingsChanged': '場景或設定已變更，請重新開始量測。',
  'panel.energyComparison.contextMismatch': '場景或設定不一致',
  'panel.energyComparison.windowMismatch': '量測窗口不一致',
  'panel.energyComparison.dataInsufficientNote': '資料不足；請先完成兩組快照與有效量測窗口。',
  'panel.energyComparison.failClosedNote': '只有兩組快照可比較且四項關卡都有有效結果時，才會顯示 PASS 或 FAIL。',
  'panel.energyComparison.disabled.notLiveSinr': '僅限即時 SINR 場景。',
  'panel.energyComparison.disabled.timelineRunning': '請先暫停時間軸。',
  'panel.energyComparison.disabled.wrongPower': '目前發射功率不符合此快照的目標值。',
  'panel.energyComparison.disabled.contextMismatch': '場景或設定已變更，請重新開始量測。',
  'panel.energyComparison.disabled.invalidWindow': '量測窗口尚未形成有效的起訖時間。',
  'panel.energyComparison.disabled.missingReadout': '必要讀值不足，無法凍結快照。',
  'panel.energyComparison.disabled.noSnapshots': '目前沒有可清除的快照。',
  'panel.energyComparison.rawLoad': '服務波束負載 U',
  'panel.energyComparison.rawSinr': '即時 SINR',
  'panel.energyComparison.rawThroughput': '即時吞吐量',
  'panel.energyComparison.rawServiceStatus': '服務狀態',
  'panel.energyComparison.rawServiceIdentity': '服務身份',
  'panel.energyComparison.rawProducerStatus': 'Producer 狀態',
  'panel.energy.t3Title': 'T3 固定條件 B/K 比較',
  'panel.energy.t3Source': '資料來源',
  'panel.energy.t3FixedInputs': '固定輸入',
  'panel.energy.t3Bandwidth': '頻寬 B',
  'panel.energy.t3BandwidthHelp': 'T3 只改變並讀取頻寬 B；U 固定為 1，SINR 固定為 0 dB。',
  'panel.energy.t3Reuse': '頻率重用 K',
  'panel.energy.t3ReuseHelp': 'T3 只改變並讀取整數頻率重用 K；不把發射功率列入此比較。',
  'panel.energy.t3AllocatedBandwidth': '配置頻寬 B/K',
  'panel.energy.t3AllocatedBandwidthHelp': '固定 U=1 時，每位使用者的配置頻寬為 B/K。',
  'panel.energy.t3Rate': '固定條件速率',
  'panel.energy.t3RateHelp': '固定 SINR=0 dB、U=1 後，以 B/K 計算的 deterministic fixture 速率。',
  'panel.energy.t3Data': '固定條件資料量',
  'panel.energy.t3DataHelp': '固定條件速率乘以有效量測時間；尚無正量測窗口時保留空白。',
  'panel.energy.t3Status': 'Fixture 狀態',
  'panel.energy.t3Identity': 'Fixture identity',
  'panel.energy.canonicalFrameTime': 'Producer 幀時間',
  'panel.energy.canonicalFrameTimeHelp': 'canonical producer 最近一個有效幀的模擬時間。',
  'panel.energy.canonicalActualRf': '實際 RF 輸出',
  'panel.energy.canonicalActualRfHelp': '由 producer 的實際 RF dBm 轉換出的瓦特；不等同於額定上限。',
  'panel.energy.canonicalRatedRf': '額定 RF 上限',
  'panel.energy.canonicalRatedRfHelp': '由 governed profile 提供的額定 RF 最大值，與實際輸出分欄。',
  'panel.energy.canonicalSampleWindow': '累積取樣窗口',
  'panel.energy.canonicalSampleWindowHelp': 'baseline 尚未有正時間樣本時顯示 baseline；有樣本時顯示樣本數。',
  'panel.energy.canonicalBaseline': 'baseline',
  'panel.energy.canonicalEvaluationData': '累積資料 ΣRΔt',
  'panel.energy.canonicalEvaluationDataHelp': 'canonical ratio-of-sums 的累積資料量。',
  'panel.energy.canonicalEvaluationEnergy': '累積能量 ΣP_sysΔt',
  'panel.energy.canonicalEvaluationEnergyHelp': 'canonical ratio-of-sums 的累積系統能量。',
  'panel.energy.canonicalEvaluationWindow': 'EE_eval 窗口',
  'panel.energy.canonicalEvaluationWindowHelp': 'EE_eval 使用的 producer 模擬時間起訖；baseline 時沒有可宣稱窗口。',
  'panel.energy.canonicalServingBeam': '服務波束 identity',
  'panel.energy.canonicalServingBeamHelp': '最近幀可用的服務 sat#cell identity；缺值維持空白。',
  'panel.energy.canonicalHelp': '標準 partial-payload 系統能源效率。由 canonical producer 提供系統功率、每位使用者貢獻、加總 identity 與整段時間的比例和（ratio-of-sums）效率；缺值維持待接線，不轉成零。',
  'panel.energy.canonicalScopeNote': 'partial-payload scope；此區顯示 producer status、Σ_u r_{1,u} = EE_inst identity 與 EE_eval。P_sys 不使用 3 W 教學旋鈕。',
  'panel.energy.canonicalStatus.label': 'Producer 狀態',
  'panel.energy.canonicalStatus.pending': '待接線 PENDING',
  'panel.energy.canonicalStatus.valid': '有效 VALID',
  'panel.energy.canonicalStatus.zeroActivity': '零活動 ZERO-ACTIVITY',
  'panel.energy.canonicalStatus.invalid': '無效 INVALID',
  'panel.energy.canonicalError.label': '錯誤碼',
  'panel.energy.canonicalUsers.title': '每位使用者的標準詳情',
  'panel.energy.canonicalUsers.note': '每個 r_{1,u} 是使用共享系統功率計出的加總 Mbit/J 貢獻，不是使用者實際的物理發射功率。',
  'panel.energy.canonicalUsers.empty': '目前幀沒有使用者',
  'panel.energy.canonicalUsers.unavailable': '目前沒有可用的每位使用者資料',
  'panel.energy.canonicalUsers.ue': 'UE',
  'panel.energy.canonicalUsers.status': '狀態',
  'panel.energy.canonicalUsers.satellite': '服務衛星',
  'panel.energy.canonicalUsers.cell': '服務小區',
  'panel.energy.canonicalUsers.beam': '服務波束',
  'panel.energy.canonicalUsers.load': '波束負載 U',
  'panel.energy.canonicalUsers.bandwidth': '配給頻寬',
  'panel.energy.canonicalUsers.sinr': '即時 SINR',
  'panel.energy.canonicalUsers.rate': '速率 R_u',
  'panel.energy.canonicalUserStatus.served': '已服務 SERVED',
  'panel.energy.canonicalUserStatus.outage': '訊號中斷 OUTAGE',
  'panel.energy.canonicalUserStatus.unserved': '未服務 UNSERVED',
  'panel.energy.canonicalIdentity.label': '加總 identity Σ_u r_{1,u} = EE_inst',
  'panel.energy.canonicalIdentity.pending': '待驗證 PENDING',
  'panel.energy.canonicalIdentity.pass': '通過 PASS',
  'panel.energy.canonicalIdentity.fail': '失敗 FAIL',
  'kpi.systemPowerW.label': '系統總功率 P_sys',
  'kpi.systemPowerW.help': '標準系統功率 P_sys，定義 partial-payload 負載功率的邊界，單位為瓦特（W）。',
  'kpi.eeInstMbitPerJ.label': '瞬時能源效率 EE_inst',
  'kpi.eeInstMbitPerJ.help': '瞬時效率 EE_inst = Σ_u R_u / P_sys，單位 Mbit/J。',
  'kpi.contributionSumMbitPerJ.label': '加總驗證 Σ_u r_{1,u}',
  'kpi.contributionSumMbitPerJ.help': '個別使用者的能源效率貢獻總和 Σ_u r_{1,u}，必須等於 EE_inst。',
  'kpi.eeEvalMbitPerJ.label': '比例和效率 EE_eval',
  'kpi.eeEvalMbitPerJ.help': '累積的比例和（ratio-of-sums）能源效率 EE_eval = (Σ_t Σ_u R_u Δt) / (Σ_t P_sys Δt)。零吞吐量配上零功率將安全回傳零活動狀態（zero-activity）。',
  'kpi.perUserContribution.label': '每位使用者加總貢獻 r_{1,u}',
  'kpi.perUserContribution.empty': '目前幀沒有使用者',
  'common.min': '最小',
  'common.max': '最大',
  'common.on': '開',
  'common.off': '關',
  'common.showOtherHandoverUes': '顯示其他換手中的 UE',

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

  'panel.energy.reset.label': '重新開始量測',
  'panel.energy.reset.help': '僅清除當前的量測視窗累積值並重新開始累積，而模擬時間、場景、播放速度與所有參數設定皆維持不變。',
  'panel.energy.restoreDefaults.label': '恢復能源參數預設',
  'panel.energy.restoreDefaults.help': '將 η_PA、P_circuit 與 e_HO 恢復為能源模型預設值；此動作與只清除量測窗口的「重新開始量測」分開。',
};

export type I18nKey = keyof typeof ZH_TW;

export const EN: Record<I18nKey, string> = {
  // ---------------------------------------------------------------------
  // param.*
  // ---------------------------------------------------------------------

  'param.maxTxPowerDbm.label': 'Satellite transmit power',
  'param.maxTxPowerDbm.unit': 'dBm',
  'param.maxTxPowerDbm.help':
    'The signal strength each satellite beam transmits, in dBm. It sets the received signal power in the SINR numerator; in watts, P_RF = 10^(P_tx/10) ÷ 1000.',
  'param.maxTxPowerDbm.effect':
    'Raise it: received signal power in the numerator rises, SINR improves, and power draw rises with it. When other co-channel beams rise as well, the interference term in the denominator grows too, so part of the SINR gain is offset.',

  'param.ueAntennaMaxGainDbi.label': 'Ground receiver gain',
  'param.ueAntennaMaxGainDbi.unit': 'dBi',
  'param.ueAntennaMaxGainDbi.help':
    "The receive gain G^R of the user device's antenna — how well it converts the incident wave into usable signal power.",
  'param.ueAntennaMaxGainDbi.effect':
    'Raise it: received signal power increases, so serving and candidate SINR rise together. Satellite transmit power and inter-beam interference are unchanged.',

  'param.bandwidthMHz.label': 'Channel bandwidth',
  'param.bandwidthMHz.unit': 'MHz',
  'param.bandwidthMHz.help':
    'The bandwidth B of this radio channel. It appears in two places: as the numerator of B/K in the throughput formula R = (B ÷ K)·log₂(1+SINR), and in the thermal noise term of the SINR denominator, σ² = N₀·B.',
  'param.bandwidthMHz.effect':
    'Widen it: thermal noise σ² in the denominator grows proportionally, so SINR falls if nothing else changes — but the B/K multiplier grows at the same time. Where throughput lands depends on the net of the two.',

  'param.noisePsdDbmHz.label': 'Noise power density',
  'param.noisePsdDbmHz.unit': 'dBm/Hz',
  'param.noisePsdDbmHz.help':
    'Noise power density N₀ — the noise power in each hertz of bandwidth, originating as thermal noise in the receiver. Multiplied by bandwidth it forms the noise term of the SINR denominator, σ² = N₀·B.',
  'param.noisePsdDbmHz.effect':
    'Raise it (make it less negative): the noise term σ² in the denominator grows and SINR falls, with the largest drop on links whose received signal is already weak.',

  'param.frequencyGHz.label': 'Carrier frequency',
  'param.frequencyGHz.unit': 'GHz',
  'param.frequencyGHz.help':
    'The carrier frequency f the signal rides on. Free-space loss Lfs grows with the square of frequency, so a higher carrier means more path loss over the same distance.',
  'param.frequencyGHz.effect':
    'Raise it: free-space loss Lfs increases, the received signal power in the numerator falls at the same distance, and SINR drops with it.',

  'param.atmosphericZenithLossDb.label': 'Atmospheric absorption (zenith)',
  'param.atmosphericZenithLossDb.unit': 'dB',
  'param.atmosphericZenithLossDb.help':
    'The loss Lg from gas molecules absorbing the signal as it crosses the atmosphere, referenced to the satellite at zenith. At lower elevation the path through the atmosphere is longer, so the actual loss is greater.',
  'param.atmosphericZenithLossDb.effect':
    'Raise it: the loss term Lg grows, received signal power in the numerator falls, and SINR drops — more steeply for low-elevation links than high-elevation ones.',

  'param.scintillationScaleDb.label': 'Scintillation fading margin',
  'param.scintillationScaleDb.unit': 'dB',
  'param.scintillationScaleDb.help':
    'Random fluctuation of the signal caused by atmospheric turbulence, represented here by an elevation-dependent margin Lsc standing for its average amplitude.',
  'param.scintillationScaleDb.effect':
    'Raise it: the loss term Lsc grows, received signal power in the numerator falls, and SINR drops — corresponding to a less stable signal environment.',

  'param.shadowFadingMarginDb.label': 'Shadow fading margin',
  'param.shadowFadingMarginDb.unit': 'dB',
  'param.shadowFadingMarginDb.help':
    'Power lost when buildings, terrain, or similar obstacles block the path, represented here by a fixed margin Lsf.',
  'param.shadowFadingMarginDb.effect':
    'Raise it: the loss term Lsf grows, received signal power in the numerator falls, and SINR drops — corresponding to a more heavily obstructed environment.',

  'param.tr38811NlosClutterLossDb.label': 'NLoS clutter loss (TR 38.811)',
  'param.tr38811NlosClutterLossDb.unit': 'dB',
  'param.tr38811NlosClutterLossDb.help':
    'The additional loss Lcl absorbed by clutter such as buildings and trees under non-line-of-sight (NLoS) conditions. It applies only to samples classified NLoS in the TR 38.811 formula family.',
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

  'param.model.label': 'Beam gain model',
  'param.model.help':
    'Sets the shape of the function by which gain rolls off with angle away from beam center. Bessel J1/J3, Bessel J1, and Flat Top correspond to different antenna-aperture assumptions.',
  'param.model.effect':
    'Switching models changes the rate of off-axis roll-off, which affects SINR for users near the beam edge. Peak gain at beam center is unchanged.',

  'param.maxSteeringAngleDeg.label': 'Max beam steering angle',
  'param.maxSteeringAngleDeg.unit': 'degrees',
  'param.maxSteeringAngleDeg.help':
    "The largest angle a beam may steer away from the satellite's nadir point, which sets how distant a ground user it can serve.",
  'param.maxSteeringAngleDeg.effect':
    'Increase it: more candidate beams remain available, but beams steered near the limit pay a larger scan-loss penalty.',

  'param.scanLossAtMaxSteeringDb.label': 'Max scan loss',
  'param.scanLossAtMaxSteeringDb.unit': 'dB',
  'param.scanLossAtMaxSteeringDb.help':
    "The additional gain loss a beam incurs at maximum steering angle, from pointing away from the antenna's optimal direction.",
  'param.scanLossAtMaxSteeringDb.effect':
    'Raise it: beams at larger steering angles lose more gain, which can drop a previously top-ranked candidate beam out of contention.',

  'param.frequencyReuse.label': 'Frequency reuse factor K',
  'param.frequencyReuse.help':
    'The frequency reuse factor K divides the active beams into K groups, so only beams within the same group interfere with each other. K is also the denominator of B/K in the throughput formula R = (B ÷ K)·log₂(1+SINR).',
  'param.frequencyReuse.effect':
    'Lower it (e.g. K=1): every beam shares one frequency, the interference term in the denominator is at its largest, SINR falls and handovers are harder to complete. Raise it: co-channel interference drops and SINR rises, but the bandwidth B/K available to each beam shrinks, so throughput does not necessarily follow.',

  'param.paEfficiency.label': 'PA efficiency η_PA',
  'param.paEfficiency.unit': 'ratio (0–1, unitless)',
  'param.paEfficiency.help':
    'The efficiency η_PA with which the power amplifier converts input electrical power into RF output power, on a scale of 0 to 1. At η_PA = 0.4, each 1 W of RF output requires 2.5 W of input power; the remainder becomes heat.',
  'param.paEfficiency.effect':
    'The lower the efficiency, the more input power the same transmit power requires (P_PA = P_RF ÷ η_PA), so total power rises and EE falls. Raise it and the same signal strength costs less electrical power.',

  'param.circuitPowerW.label': 'Circuit power P_circuit',
  'param.circuitPowerW.unit': 'W',
  'param.circuitPowerW.help':
    'The fixed electrical power P_circuit the satellite needs to stay operating outside the amplifier (processors, cooling, supporting circuits). It is independent of transmit power and traffic and adds directly into total power: P_total = P_PA + P_circuit.',
  'param.circuitPowerW.effect':
    'Raise it: total power shifts up by a fixed amount, so instantaneous EE and run-accumulated EE both fall — most steeply during low-throughput stretches. Lower it and the reverse happens.',

  'param.energyPerHandoverJ.label': 'Energy per handover e_HO',
  'param.energyPerHandoverJ.unit': 'J',
  'param.energyPerHandoverJ.help':
    'The extra energy e_HO one completed handover costs: measurement and reporting, the signalling exchange that carries the decision, and re-establishing the link on the new beam. Multiplied by the number of handovers it gives the handover energy for the window, E_HO = handover count × e_HO, which adds to radio energy to form total energy.',
  'param.energyPerHandoverJ.effect':
    'Raise it: each handover weighs more in total energy, the run-accumulated EE denominator grows and the value falls, which makes the cost of ping-ponging (a link switching back and forth between two options) visible. Lower it and handovers approach being free. Set it to 0 to charge no handover energy at all, and the energy breakdown reduces to its radio-only form.',

  // ---------------------------------------------------------------------
  // tab.*
  // ---------------------------------------------------------------------

  'tab.sinr.label': 'SINR (signal-to-interference-plus-noise ratio)',
  'tab.sinr.heading': 'Definition of SINR',
  'tab.energy.label': 'Energy Efficiency',

  // ---------------------------------------------------------------------
  // formula.*
  // ---------------------------------------------------------------------

  'formula.sinr.caption':
    'SINR is a ratio: the numerator is the signal power the serving beam delivers to the receiver, and the denominator is the interference power from other co-channel beams plus the background noise power. A higher SINR means the signal is stronger relative to interference and noise; a handover decision compares the serving and candidate SINR.',
  'formula.sinr.fractionHint':
    'Numerator: the signal power delivered by the serving beam. Denominator: co-channel interference power plus background noise power.',
  'formula.sinr.symbolHelp':
    'γ is the SINR. The numerator P_t · H · G^T · G^R is the transmit power after channel loss and the transmit and receive antenna gains — the signal power that actually reaches the receiver. The denominator I^a + I^b + σ² is the co-channel interference power plus thermal noise power at that same instant. The larger the ratio, the stronger the signal relative to interference and noise.',
  'formula.throughput.caption':
    'Throughput follows the Shannon formula: R = (B ÷ K)·log₂(1 + SINR). B is the channel bandwidth and K the frequency reuse factor — B in the numerator, K in the denominator — so the bandwidth actually available to each beam is B/K. Doubling SINR adds only 1 to the log₂ term, which is why raising power alone yields diminishing returns.',
  'formula.energy.caption':
    'Energy is power accumulated over time: each step consumes P_total × Δt joules, and summing the steps gives cumulative energy ΣJ = Σ P_total(t)·Δt. Accumulating the data sent in each step the same way gives cumulative delivered data ΣMbit = Σ R(t)·Δt. Each handover additionally costs a fixed amount, so total energy = Σ P_total(t)·Δt + E_HO.',
  'formula.power.caption':
    'Transmit power converts from dBm to watts first: P_RF = 10^(P_tx/10) ÷ 1000. The power amplifier requires 1/η_PA watts of input for each watt of RF output, so P_PA = P_RF ÷ η_PA. Adding the fixed circuit draw gives the system total for this instant: P_total = P_PA + P_circuit, in watts (W).',
  'formula.ee.caption':
    'Energy efficiency EE is a ratio: the numerator is the data delivered, the denominator is the energy consumed, in Mbit/J — how many megabits each joule of energy can carry. The larger the value, the less power the same data costs. Instantaneous EE takes R ÷ P_total at this moment; run-accumulated EE takes ΣMbit ÷ ΣJ over the whole run.',

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
    'The noise floor σ² = noise power density N₀ × bandwidth B. It is the term of the SINR denominator that is present regardless of interference. This value is computed from the current settings and is read-only.',

  'kpi.rfTxPower.label': 'RF transmit power',
  'kpi.rfTxPower.help':
    'The configured transmit power converted from dBm to watts: P_RF = 10^(P_tx/10) ÷ 1000 — the RF power actually fed to the antenna and radiated.',

  'kpi.paInputPower.label': 'PA input power',
  'kpi.paInputPower.help':
    'The input electrical power the amplifier requires to produce that RF output: P_PA = P_RF ÷ η_PA. The lower the efficiency, the more P_PA exceeds P_RF, and the difference becomes heat.',

  'kpi.circuitPower.label': 'Circuit power',
  'kpi.circuitPower.help':
    'The fixed electrical power P_circuit needed to keep the satellite operating outside the amplifier. It does not vary with traffic; it is the baseline cost carried at every instant.',

  'kpi.totalPower.label': 'Total power',
  'kpi.totalPower.help':
    'The total electrical power the satellite consumes at this instant: P_total = P_PA + P_circuit, in watts (W). Accumulating P_total over time gives cumulative energy.',

  'kpi.throughput.label': 'Throughput',
  'kpi.throughput.help':
    'The data rate the link can carry at this instant, computed from bandwidth and SINR via the Shannon formula: R = (B ÷ K)·log₂(1 + SINR), where B is bandwidth and K the frequency reuse factor. Units are Mbit/s.',

  'kpi.cumulativeDeliveredData.label': 'Cumulative delivered data',
  'kpi.cumulativeDeliveredData.help':
    "The total data delivered since the current measurement window started: ΣMbit = Σ R(t)·Δt — each step's throughput multiplied by that step's duration, summed, in megabits (Mbit).",

  'kpi.cumulativeEnergy.label': 'Cumulative energy',
  'kpi.cumulativeEnergy.help':
    "The total energy consumed since the current measurement window started: ΣJ = Σ P_total(t)·Δt — each step's total power multiplied by that step's duration, summed, in joules (J).",

  'kpi.instantaneousEe.label': 'Instantaneous EE',
  'kpi.instantaneousEe.help':
    "This instant's throughput divided by this instant's total power: R ÷ P_total, in Mbit/J. It responds immediately to SINR and power settings, which makes it useful for observing the effect of a single parameter change.",

  'kpi.totalEnergy.label': 'Total energy',
  'kpi.totalEnergy.help':
    'All energy consumed across this accumulation window: total energy = radio energy Σ P_total·Δt + handover energy E_HO, in joules (J). It is the denominator of run-accumulated EE.',

  'kpi.runEe.label': 'Run-accumulated EE',
  'kpi.runEe.help':
    'Run-accumulated EE (Run EE) = the total data delivered over the whole run ÷ the total energy consumed over the whole run (ΣMbit ÷ ΣJ), in Mbit/J — how many megabits each joule of energy can carry. The denominator ΣJ is total energy: radio energy Σ P_total·Δt plus handover energy E_HO. The longer the accumulation window, the steadier the value.',

  'kpi.handoverEnergy.label': 'Handover energy',
  'kpi.handoverEnergy.help':
    'The energy every handover in this accumulation window costs: E_HO = handover count × energy per handover e_HO, in joules (J). e_HO is an adjustable parameter; set it to 0 and the term is not charged. E_HO adds to radio energy Σ P_total·Δt to form total energy, the denominator of run-accumulated EE; when no handover occurs inside the window, E_HO is 0.',

  'kpi.coverage.label': 'Coverage',
  'kpi.coverage.help':
    'The proportion of all users in the current frame that have a serving link.',

  'kpi.servedUeCount.label': 'Served UE count',
  'kpi.servedUeCount.help':
    'The number of user devices currently served by a beam and receiving a signal.',

  'panel.energy.teachingKnobTitle': 'Single-link Power Model (Teaching Knob)',
  'panel.energy.canonicalTitle': 'Canonical System EE',
  'panel.energy.teachingKnobHelp': 'This single-link power chain is a teaching tool for the relationships between P_tx, P_PA, and throughput; P_total and Run EE are a non-canonical scope, not canonical system P_sys or EE_eval.',
  'panel.energy.teachingScopeNote': 'This section shows the power chain for one link and its accumulated efficiency over the current measurement window.',
  'panel.energyComparison.title': 'T5 Actual-data power-reduction falsifier',
  'panel.energyComparison.subtitle': 'Compare actual data over matched durations at 50 dBm and 35 dBm; raw start/end times remain auditable, and no energy-saving claim survives failed service gates.',
  'panel.energyComparison.matchedDurationHint': 'Baseline duration: {seconds} s. Run 35 dBm for about the same duration before capturing.',
  'panel.energyComparison.baseline': 'Baseline',
  'panel.energyComparison.candidate': 'Candidate',
  'panel.energyComparison.captureBaseline': 'Capture baseline snapshot',
  'panel.energyComparison.replaceBaseline': 'Replace baseline snapshot',
  'panel.energyComparison.captureCandidate': 'Capture candidate snapshot',
  'panel.energyComparison.replaceCandidate': 'Replace candidate snapshot',
  'panel.energyComparison.clear': 'Clear both snapshots',
  'panel.energyComparison.notCaptured': 'Not captured',
  'panel.energyComparison.frozen': 'Frozen',
  'panel.energyComparison.dataInsufficient': '—／Insufficient data',
  'panel.energyComparison.pass': 'PASS',
  'panel.energyComparison.fail': 'FAIL',
  'panel.energyComparison.percentagePoints': 'pp',
  'panel.energyComparison.lowSinrLabel': 'Low-SINR ratio (< {threshold} {unit})',
  'panel.energyComparison.gate.energySaving': 'Positive energy saving',
  'panel.energyComparison.gate.dataRetention': 'Delivered-data ratio ≥',
  'panel.energyComparison.gate.lowSinr': 'Low-SINR increase ≤',
  'panel.energyComparison.gate.runEe': 'Run-EE ratio ≥',
  'panel.energyComparison.overall': 'Four-gate AND',
  'panel.energyComparison.settingsChanged': 'The scene or settings changed; restart the measurement.',
  'panel.energyComparison.contextMismatch': 'Scene or settings mismatch',
  'panel.energyComparison.windowMismatch': 'Measurement-window mismatch',
  'panel.energyComparison.dataInsufficientNote': 'Insufficient data; capture both snapshots from a valid measurement window.',
  'panel.energyComparison.failClosedNote': 'PASS or FAIL appears only when both snapshots are comparable and every gate has a valid result.',
  'panel.energyComparison.disabled.notLiveSinr': 'Capture is available only in the live SINR scene.',
  'panel.energyComparison.disabled.timelineRunning': 'Pause the timeline before capturing.',
  'panel.energyComparison.disabled.wrongPower': 'The current transmit power does not match this snapshot target.',
  'panel.energyComparison.disabled.contextMismatch': 'The scene or settings changed; restart the measurement.',
  'panel.energyComparison.disabled.invalidWindow': 'A valid measurement-window start and end are not available yet.',
  'panel.energyComparison.disabled.missingReadout': 'Required readouts are missing; the snapshot cannot be frozen.',
  'panel.energyComparison.disabled.noSnapshots': 'There are no stored snapshots to clear.',
  'panel.energyComparison.rawLoad': 'Serving beam load U',
  'panel.energyComparison.rawSinr': 'Live SINR',
  'panel.energyComparison.rawThroughput': 'Live throughput',
  'panel.energyComparison.rawServiceStatus': 'Service status',
  'panel.energyComparison.rawServiceIdentity': 'Service identity',
  'panel.energyComparison.rawProducerStatus': 'Producer status',
  'panel.energy.t3Title': 'T3 fixed-condition B/K comparison',
  'panel.energy.t3Source': 'Source',
  'panel.energy.t3FixedInputs': 'Fixed inputs',
  'panel.energy.t3Bandwidth': 'Bandwidth B',
  'panel.energy.t3BandwidthHelp': 'T3 changes and reads bandwidth B only; U is fixed at 1 and SINR is fixed at 0 dB.',
  'panel.energy.t3Reuse': 'Frequency reuse K',
  'panel.energy.t3ReuseHelp': 'T3 changes and reads integer frequency reuse K only; transmit power is not part of this comparison.',
  'panel.energy.t3AllocatedBandwidth': 'Allocated bandwidth B/K',
  'panel.energy.t3AllocatedBandwidthHelp': 'With U=1 fixed, each user receives B/K bandwidth.',
  'panel.energy.t3Rate': 'Fixed-condition rate',
  'panel.energy.t3RateHelp': 'Deterministic-fixture rate computed from B/K at fixed SINR=0 dB and U=1.',
  'panel.energy.t3Data': 'Fixed-condition data',
  'panel.energy.t3DataHelp': 'Fixed-condition rate times valid measurement time; absent until a positive window exists.',
  'panel.energy.t3Status': 'Fixture status',
  'panel.energy.t3Identity': 'Fixture identity',
  'panel.energy.canonicalFrameTime': 'Producer frame time',
  'panel.energy.canonicalFrameTimeHelp': 'Simulation time of the latest valid canonical producer frame.',
  'panel.energy.canonicalActualRf': 'Actual RF output',
  'panel.energy.canonicalActualRfHelp': 'Actual producer RF dBm converted to watts; it is not the rated limit.',
  'panel.energy.canonicalRatedRf': 'Rated RF limit',
  'panel.energy.canonicalRatedRfHelp': 'Governed profile rated maximum RF output, displayed separately from actual output.',
  'panel.energy.canonicalSampleWindow': 'Accumulated sample window',
  'panel.energy.canonicalSampleWindowHelp': 'Shows baseline before any positive-duration sample, then the producer sample count.',
  'panel.energy.canonicalBaseline': 'baseline',
  'panel.energy.canonicalEvaluationData': 'Accumulated data ΣRΔt',
  'panel.energy.canonicalEvaluationDataHelp': 'Accumulated data used by canonical ratio-of-sums evaluation.',
  'panel.energy.canonicalEvaluationEnergy': 'Accumulated energy ΣP_sysΔt',
  'panel.energy.canonicalEvaluationEnergyHelp': 'Accumulated system energy used by canonical ratio-of-sums evaluation.',
  'panel.energy.canonicalEvaluationWindow': 'EE_eval window',
  'panel.energy.canonicalEvaluationWindowHelp': 'Producer simulation-time bounds used by EE_eval; absent on baseline.',
  'panel.energy.canonicalServingBeam': 'Serving beam identity',
  'panel.energy.canonicalServingBeamHelp': 'Available serving sat#cell identity from the latest frame; absent when unavailable.',
  'panel.energy.canonicalHelp': 'Canonical partial-payload system energy efficiency. The canonical producer supplies system power, per-user contributions, the additive identity, and ratio-of-sums EE; missing values stay pending rather than becoming zero.',
  'panel.energy.canonicalScopeNote': 'Partial-payload scope; this section reports producer status, the Σ_u r_{1,u} = EE_inst identity, and EE_eval. P_sys never uses the 3 W teaching knob.',
  'panel.energy.canonicalStatus.label': 'Producer status',
  'panel.energy.canonicalStatus.pending': 'PENDING',
  'panel.energy.canonicalStatus.valid': 'VALID',
  'panel.energy.canonicalStatus.zeroActivity': 'ZERO-ACTIVITY',
  'panel.energy.canonicalStatus.invalid': 'INVALID',
  'panel.energy.canonicalError.label': 'Error code',
  'panel.energy.canonicalUsers.title': 'Canonical per-user detail',
  'panel.energy.canonicalUsers.note': 'Each r_{1,u} is an additive Mbit/J contribution using shared system power; it is not physical per-user transmit power.',
  'panel.energy.canonicalUsers.empty': 'No users in the current frame',
  'panel.energy.canonicalUsers.unavailable': 'No per-user data is available yet',
  'panel.energy.canonicalUsers.ue': 'UE',
  'panel.energy.canonicalUsers.status': 'Status',
  'panel.energy.canonicalUsers.satellite': 'Serving satellite',
  'panel.energy.canonicalUsers.cell': 'Serving cell',
  'panel.energy.canonicalUsers.beam': 'Serving beam',
  'panel.energy.canonicalUsers.load': 'Beam load U',
  'panel.energy.canonicalUsers.bandwidth': 'Allocated bandwidth',
  'panel.energy.canonicalUsers.sinr': 'Live SINR',
  'panel.energy.canonicalUsers.rate': 'Rate R_u',
  'panel.energy.canonicalUserStatus.served': 'SERVED',
  'panel.energy.canonicalUserStatus.outage': 'OUTAGE',
  'panel.energy.canonicalUserStatus.unserved': 'UNSERVED',
  'panel.energy.canonicalIdentity.label': 'Sum identity Σ_u r_{1,u} = EE_inst',
  'panel.energy.canonicalIdentity.pending': 'PENDING',
  'panel.energy.canonicalIdentity.pass': 'PASS',
  'panel.energy.canonicalIdentity.fail': 'FAIL',
  'kpi.systemPowerW.label': 'System Power P_sys',
  'kpi.systemPowerW.help': 'Canonical system power P_sys in watts, defining the partial payload-power boundary.',
  'kpi.eeInstMbitPerJ.label': 'Instantaneous EE (EE_inst)',
  'kpi.eeInstMbitPerJ.help': 'EE_inst = Σ_u R_u / P_sys in Mbit/J.',
  'kpi.contributionSumMbitPerJ.label': 'Additive sum Σ_u r_{1,u}',
  'kpi.contributionSumMbitPerJ.help': 'Sum of individual EE contributions r_{1,u} = R_u / P_sys. Must equal EE_inst.',
  'kpi.eeEvalMbitPerJ.label': 'Ratio-of-sums EE (EE_eval)',
  'kpi.eeEvalMbitPerJ.help': 'EE_eval = (Σ_t Σ_u R_u Δt) / (Σ_t P_sys Δt). Zero throughput with zero power fails closed to zero-activity.',
  'kpi.perUserContribution.label': 'Additive per-user contribution r_{1,u}',
  'kpi.perUserContribution.empty': 'No users in the current frame',


  // ---------------------------------------------------------------------
  // panel.*
  // ---------------------------------------------------------------------

  'panel.overallEe.title': 'Field-wide instantaneous EE',
  'panel.overallEe.divider':
    'The energy breakdown accumulates over the whole run for the primary link; field-wide instantaneous EE averages across every user at this instant, with power taken from the beam-load model.',
  'panel.overallEe.help':
    "Field-wide instantaneous EE fixes a single instant and takes the coverage-weighted average of every user's energy efficiency at that instant, in bit/J. Its power comes from the paper's beam-load model and does not respond to the power sliders.",

  'panel.ee.aggregation.label': 'Energy-efficiency aggregation',
  'panel.ee.headline.help':
    'The coverage-weighted average energy efficiency across all users at this instant — a single-instant cross-section statistic. The whole-run ΣMbit ÷ ΣJ is reported as run-accumulated EE in the energy breakdown.',
  'panel.ee.headline.unavailable': 'Field-wide instantaneous EE is unavailable',
  'panel.ee.mean': 'Mean',
  'panel.ee.servedAverage.label': 'Mean EE of served users',
  'panel.ee.servedAverage.help': 'Averages only the users a beam is providing service to. Users with no service are excluded from this average.',
  'panel.ee.coverageStep.help': 'The mean EE of served users, weighted by coverage, gives the field-wide instantaneous EE. The lower the coverage, the larger the share of users receiving no service, and the lower that value becomes.',
  'panel.ee.bandwidth.label': 'Bandwidth assumed by this metric',
  'panel.ee.bandwidth.help': 'The bandwidth each link is assumed to receive when throughput is computed. A larger bandwidth carries more data at the same signal quality.',
  'panel.ee.bandwidth.detail': 'Used in EE',
  'panel.ee.population.label': 'Total users',
  'panel.ee.population.help': 'The number of user devices in this scene, together with the served and unserved counts.',
  'panel.ee.beamLoad.label': 'Users per beam',
  'panel.ee.beamLoad.help': 'The average number of users served by each active beam. The more users share a beam, the fewer resources each one receives.',
  'panel.ee.beamLoad.detail': 'Measured across active beams',
  'panel.ee.throughput.label': 'Throughput of served users',
  'panel.ee.throughput.help': 'The average data rate received by a served user — the numerator of the energy-efficiency ratio.',
  'panel.ee.throughput.detail': 'EE numerator R_u',
  'panel.ee.sinr.label': 'Signal quality of served users',
  'panel.ee.sinr.help': 'The average signal quality, in dB, of the users receiving service.',
  'panel.ee.sinr.detail': 'Measured across served users',
  'panel.ee.beamPower.label': 'Power per beam',
  'panel.ee.beamPower.help': 'The average power an active beam consumes, in watts. In the model, the more users a beam serves, the more power it is allocated.',
  'panel.ee.beamPower.detail': 'Load-dependent raw power per beam',
  'panel.ee.perUePower.label': 'Power share per user',
  'panel.ee.perUePower.help': "A beam's power divided evenly among the users it serves — the denominator of the energy-efficiency ratio.",
  'panel.ee.perUePower.detail': 'Raw beam power ÷ U_s,v',
  'panel.ee.waiting.ueAssignments': 'Waiting for user assignments',
  'panel.ee.waiting.uePopulation': 'Waiting for the user population',
  'panel.ee.waiting.frameValues': 'Waiting for frame values',
  'panel.ee.waiting.servedSinr': 'Waiting for served-user SINR',
  'panel.ee.waiting.beamLoad': 'Waiting for beam load',
  'panel.ee.detail.servedAssignments': 'served users',
  'panel.ee.detail.coverageServed': 'users served',
  'panel.ee.detail.served': 'served',
  'panel.ee.detail.unserved': 'unserved',

  // ---------------------------------------------------------------------
  // common.*
  // ---------------------------------------------------------------------

  'common.reset': 'Reset',
  'common.close': 'Close',
  'common.help': 'Help',
  'common.simulatedTeaching': 'Simulated',
  'common.derived': 'Derived',
  'common.absent': 'Not included yet',
  'common.details': 'Details',
  'common.min': 'Min',
  'common.max': 'Max',
  'common.on': 'ON',
  'common.off': 'OFF',
  'common.showOtherHandoverUes': 'Show other UEs in handover',

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

  'panel.energy.reset.label': 'Restart measurement',
  'panel.energy.reset.help': 'Clears only the cumulative measurement window and restarts accumulation; simulation time, scene, playback speed, and all parameter settings are preserved.',
  'panel.energy.restoreDefaults.label': 'Restore energy defaults',
  'panel.energy.restoreDefaults.help': 'Restores η_PA, P_circuit, and e_HO to the energy-model defaults; this is separate from Restart measurement, which only clears the measurement window.',
};
