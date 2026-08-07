/**
 * Honesty boundary for the teaching energy / EE model (CONTRACT §1, §4).
 *
 * This is a *separate* boundary from `src/app/liveClaimBoundary.ts` — that
 * one describes the live-sim SINR/EE story surfaced through
 * `ClaimBoundaryBanner`. This one is scoped specifically to the teaching
 * power-train + energy-ledger numbers produced by `energyModel.ts` /
 * `energyLedger.ts`. Do not merge the two lists, and do not edit
 * `liveClaimBoundary.ts` from here — it belongs to a different owner.
 */

export const TEACHING_CLAIM_LABEL = 'SIMULATED TEACHING';
export const TEACHING_ABSENT_DASH = '—';

/**
 * What the teaching energy/EE numbers are legitimately allowed to claim.
 * Every claim here is a directly-computed derived quantity, never a
 * real-hardware measurement and never a claim about handover behavior.
 */
export const TEACHING_ALLOWED_CLAIMS: readonly string[] = [
  '由目前 SINR 導出的教學吞吐量（Shannon 上限模型，非實測網路吞吐量）',
  '教學用功率鏈拆解：RF 發射功率 → PA 輸入功率 → 加上電路功耗 → 總功率',
  'Σ P_total · Δt 的累積無線電能量（教學功率鏈模型，非實測耗電）',
  'E_HO = 換手次數 × 每次換手能量成本 e_HO（e_HO 為可調教學參數，非實測值）',
  'E_total = Σ P_total · Δt + E_HO 的累積總能量',
  'Σ Mbit / E_total 的 run-level 教學能源效率（唯一合法的 run-level EE 定義）',
  '累積區間為「從上次改動任一影響能源的參數到現在」',
];

/**
 * What the teaching energy/EE numbers must never be presented as. Any UI
 * consuming this module's output must actively avoid implying these.
 */
export const TEACHING_FORBIDDEN_CLAIMS: readonly string[] = [
  '真實衛星耗電',
  '論文重現',
  '換手本身節省能源',
  '已驗證的節能換手演算法',
  '真實網路吞吐量測量',
  '逐點 mean(throughput/power) 冒充的 run-level EE',
  '每次換手能量成本 e_HO 為實測或論文標定值',
  '未標明累積區間的 Σ 讀數',
];

/**
 * What the handover-energy term is. Neutral statement of the model, for any UI
 * surfacing `E_HO`.
 *
 * `E_HO = 換手次數 × e_HO`, where `e_HO` is the user-adjustable
 * `energyPerHandoverJ` knob. A displayed `0` here means the window contains no
 * handover events, or `e_HO` is set to 0 — both are values this model actually
 * produced. Only a `null` renders as `TEACHING_ABSENT_DASH`.
 */
export const HANDOVER_ENERGY_MODEL_NOTE =
  '換手能量 E_HO = 累積區間內的換手次數 × 每次換手能量成本 e_HO。e_HO 是可調的教學參數，預設 3 J；它不是實測值，也不是論文標定值。';

/**
 * @deprecated Handover energy is now modelled — see
 * {@link HANDOVER_ENERGY_MODEL_NOTE}. This constant remains only so that UI not
 * yet migrated keeps compiling, and now carries the narrower statement that
 * still applies: an em dash in the `E_HO` field means this particular reading
 * failed closed, not that the quantity is unmodelled.
 */
export const HANDOVER_ENERGY_ABSENT_NOTE =
  '換手能量顯示為 — 時，代表本次讀數未取得可信的 E_HO 值（成本參數或換手次數不可用）。E_HO 為 0 則代表累積區間內沒有換手事件，或 e_HO 設為 0。';
