# V3 formula-to-consumer manifest

- Status: **WORKING**
- Rule: a formula is not considered delivered merely because a utility or test
  exists. The named consumer must read the same source, preserve scope/status,
  and pass its own test or browser gate.

| Quantity / contract | Authoritative source | Intended V3 consumer | Current status | Claim boundary |
|---|---|---|---|---|
| Per-beam `P_tot(s,v)` | `project/src/teaching/beamshiftCanonicalEe.ts` | Canonical section in the right teaching card; help/detail view | PRODUCER V1 REJECTED; V2 REPAIR ACTIVE | V1 incorrectly used constant `eta_max`, lacked an exact active-serving-beam versus candidate-probe cross-check, and had no per-beam UE load split. Non-serving `illuminatedBeams` rows are render/candidate probes in this lane and are not charged. ADR-003 partial-payload boundary only. |
| `P_sys=sum_(s,v) P_tot(s,v)` | Same producer plus `canonicalEnergyEfficiency.ts` sum/domain checks | `App.tsx` -> `InfoPanel.tsx` -> `TeachingEnergyCard.tsx`; formula row in `EnergyTab.tsx` | UI WIRING PENDING | Never substitute teaching `P_total` or the 3 W knob. |
| Per-user `R_u` | Live SINR-cell truth, live bandwidth/reuse, producer rate mapping | Canonical card contribution detail and T1-T6 observations | V2 REPAIR ACTIVE | Beam bandwidth is `B/reuse`; each UE receives that beam bandwidth divided by its assigned beam load. Absence/outage and invalid SINR remain distinct. |
| `r_{1,u}=R_u/P_sys` | `canonicalEnergyEfficiency.ts` via BeamShift producer | Canonical card identity section; lab explanation | PURE TEST PASS; consumer pending | Additive system-EE contribution, not per-user physical power. |
| `sum_u r_{1,u}=EE_inst` | Same | Visible identity PASS/FAIL/status plus tests | PURE TEST PASS; UI pending | Must preserve `sumIdentity` and explicit zero-activity status. |
| `EE_inst=sum_u R_u/P_sys` | Same | Canonical card instantaneous row; deck p04 | PURE TEST PASS; live values pending | Mbit/J for the ADR partial-payload boundary. |
| `EE_eval=sum_t sum_u R_u dt / sum_t P_sys dt` | `BeamshiftCanonicalEeAccumulator` and canonical ratio-of-sums core | Canonical card time-window row; reset/seek path; T1-T6 | PRODUCER TESTING; UI pending | Not `mean_t(EE_inst)` and not a mean of per-user ratios. |
| Zero-activity / invalid domain | Canonical core and BeamShift producer typed errors/status | Canonical status row, identity row, browser recovery behavior | PURE TEST PASS; UI pending | zero/zero is explicit zero-activity; invalid/negative or positive-rate/zero-power fails closed. |
| Teaching `P_total=P_PA+P_circuit` | `project/src/teaching/energyModel.ts` | Non-canonical formula/control rows in `EnergyTab.tsx`; teaching breakdown card | MODEL 22/22 PASS; UI scope review pending | Simulated teaching total only. The default `circuitPowerW=3 W` is not ADR power. |
| Teaching run EE `sum R dt/(sum P_total dt+E_HO)` | `project/src/teaching/energyLedger.ts` | Non-canonical teaching run section and controlled A/B labs | LEDGER 50/50 PASS; browser pending | Single teaching chain with handover-energy term; not ADR `EE_eval`. |
| 3 W parameter restoration | `DEFAULT_ENERGY_TUNING` plus App/UI reset wiring | Energy tab button/action and T1-T6 reset/start instructions | SOURCE TEST PASS; browser pending | Restores the teaching knob. It remains separate from “restart measurement,” which clears observation windows without changing parameters. |
| Legacy coverage-weighted mean-of-ratios | `project/src/utils/paperEnergyEfficiency.ts` | **No V3 classroom-visible consumer** | REMOVED FROM `InfoPanel`; browser pending | Historical/non-canonical diagnostic; old 596.92 anchor must not appear in V3 classroom delivery. |
| Legacy R1 link calculator | `project/src/utils/energyEfficiency.ts` | No current production consumer; tests only | N/A for V3 classroom | Do not present as system EE or ADR closure evidence. |
| Deck p02 power boundary | `deck/native/p01_05.py` + rendered ADR formula asset | p02 checkpoint | CANDIDATE; owner pending | Partial payload vs whole-satellite boundary and deterministic/empirical closure distinction. |
| Deck p04 causal/EE formulas | Same | p04 checkpoint | CANDIDATE; controller final rerun pending | Shows `R_u`, `P_sys`, `EE_inst`, and ratio-of-sums `EE_eval`. |
| Deck p05 3 W scope | Same | p05 checkpoint | CANDIDATE; owner pending | Explicitly denies equivalence to `P_RFC`, `P_BB`, or fixed canonical `P_sys`. |

## Required final evidence

1. Exact source-to-consumer reachability for every non-N/A row.
2. Focused unit tests plus project typecheck and production build.
3. Clean-build browser dry-run that follows the final T1-T6 guide without
   reading source code.
4. Screenshots showing the canonical status/identity, 3 W restoration, and the
   absence of the legacy Chapter-5 headline.
5. Controller and owner visual gates for every five-slide checkpoint.
