# NTPU oneweb real-TLE diagnostic report

- Search: 2026-05-19T00:00:00.000Z to 2026-08-17T00:00:00.000Z (exclusive)
- Coverage: 4320/4320 accepted; 0 rejected
- Event variants: 49661
- Unique serving changes: 24738
- Config digest: `7a6b52071c6f7be327c996e43d972421c592113c8fe9d2e5767e191f64541e3e`

### inter-handover

- Count: 329
- Candidate visible at pre-commit: 329/329
- Candidate visible at decision: 329/329
- Has qualification anchor: 329/329
- Max qualification ΔSINR ≥ offset: 329/329
- Candidate decision power-limited: 0/329
- Candidate decision elevation ≥45/60/75°: 329/60/9 of 329
- Minimum event elevation p25/median/max: 0.03 / 0.08 / 6.66°
- Max qualification ΔSINR p25/median/max: 3.38 / 3.39 / 5.06 dB
- Candidate residual visibility p25/median/max: 102 / 113 / 148 s

### forced-continuity

- Count: 24409
- Candidate visible at pre-commit: 24409/24409
- Candidate visible at decision: 24409/24409
- Has qualification anchor: 0/24409
- Max qualification ΔSINR ≥ offset: 0/24409
- Candidate decision power-limited: 0/24409
- Candidate decision elevation ≥45/60/75°: 23466/4357/311 of 24409
- Minimum event elevation p25/median/max: -1.22 / -0.77 / -0.00°
- Max qualification ΔSINR p25/median/max: n/a / n/a / n/a dB
- Candidate residual visibility p25/median/max: 64 / 89 / 241 s

## Forced-continuity near misses

| # | Trigger UTC | Pair | Max qualification ΔSINR (dB) | Min elevation (°) | Residual visibility (s) | Candidate power-limited |
|---:|---|---|---:|---:|---:|---|
| 1 | 2026-07-05T17:37:30.000Z | 54134 → 55813 | n/a | -0.00 | 16 | no |
| 2 | 2026-07-04T13:38:30.000Z | 54656 → 56052 | n/a | -0.00 | 63 | no |
| 3 | 2026-07-02T00:58:30.000Z | 54648 → 56716 | n/a | -0.00 | 115 | no |
| 4 | 2026-07-10T09:37:30.000Z | 50475 → 45448 | n/a | -0.00 | 131 | no |
| 5 | 2026-06-21T13:11:30.000Z | 48984 → 56065 | n/a | -0.00 | 219 | no |
| 6 | 2026-07-13T20:11:00.000Z | 47263 → 49107 | n/a | -0.00 | 68 | no |
| 7 | 2026-07-20T21:37:00.000Z | 55162 → 61609 | n/a | -0.00 | 118 | no |
| 8 | 2026-06-27T15:09:30.000Z | 48782 → 56078 | n/a | -0.00 | 36 | no |
| 9 | 2026-07-14T01:10:00.000Z | 48788 → 48789 | n/a | -0.00 | 153 | no |
| 10 | 2026-05-25T17:20:30.000Z | 48777 → 48770 | n/a | -0.00 | 83 | no |
| 11 | 2026-06-19T18:36:00.000Z | 49306 → 55809 | n/a | -0.00 | 75 | no |
| 12 | 2026-06-30T18:10:30.000Z | 55806 → 48075 | n/a | -0.00 | 132 | no |
| 13 | 2026-06-10T01:29:00.000Z | 61610 → 49000 | n/a | -0.00 | 17 | no |
| 14 | 2026-06-10T01:29:00.000Z | 61610 → 61607 | n/a | -0.00 | 90 | no |
| 15 | 2026-06-02T21:17:00.000Z | 49210 → 48046 | n/a | -0.00 | 11 | no |
| 16 | 2026-07-29T02:07:00.000Z | 49309 → 49305 | n/a | -0.00 | 84 | no |
| 17 | 2026-07-06T20:20:30.000Z | 47289 → 47281 | n/a | -0.00 | 103 | no |
| 18 | 2026-06-19T16:45:00.000Z | 56713 → 49204 | n/a | -0.00 | 83 | no |
| 19 | 2026-07-14T08:59:00.000Z | 55167 → 45445 | n/a | -0.00 | 172 | no |
| 20 | 2026-08-10T22:37:30.000Z | 54676 → 56075 | n/a | -0.00 | 78 | no |

This report is a projection of accepted canonical Event Atlas receipts. It does not recompute SINR, power, throughput, EE, visibility, or handover decisions.
