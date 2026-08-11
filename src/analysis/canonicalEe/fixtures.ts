import type { CanonicalEeInput, CanonicalEeResult } from './types';

export interface CanonicalEeConformanceExpected {
  readonly transmitGainUb: readonly (readonly number[])[];
  readonly receivedPowerUbW: readonly (readonly number[])[];
  readonly gammaReqB: readonly number[];
  readonly pReqUW: readonly number[];
  readonly pReqBW: readonly number[];
  readonly pDlBeforeSatelliteCapBW: readonly number[];
  readonly pDlActualBW: readonly number[];
  readonly satelliteScaleB: readonly number[];
  readonly interferenceUW: readonly number[];
  readonly sinrU: readonly number[];
  readonly rateUBps: readonly number[];
  readonly etaPaB: readonly number[];
  readonly pPaBW: readonly number[];
  readonly pRfcBW: readonly number[];
  readonly pBbBW: readonly number[];
  readonly pEventBW: readonly number[];
  readonly pTotBW: readonly number[];
  readonly totalRateBps: number;
  readonly systemPowerW: number;
  readonly systemEeBitsPerJ: number;
  readonly r1UBitsPerJ: readonly number[];
  readonly qosMetU: readonly boolean[];
  readonly powerLimitedU: readonly boolean[];
}

export interface CanonicalEeConformanceFixture {
  readonly id: string;
  readonly input: CanonicalEeInput;
  readonly expected: CanonicalEeConformanceExpected;
}

const commonConfig = {
  noisePowerW: 1e-9,
  beamBandwidthHz: 1e6,
  minimumRateBps: 100_000,
  satellitePowerCapW: 3,
  g0Linear: 1,
  theta3dbRad: 0.05,
  rfcPowerW: 0.338,
  basebandPerSatelliteW: 0.2,
  frameDurationS: 1,
} as const;

/** Frozen values exported by the canonical Python runtime's v1 vectors. */
export const CANONICAL_EE_CONFORMANCE_FIXTURES: readonly CanonicalEeConformanceFixture[] = [
  {
    id: 'fixed_load_on_axis',
    input: {
      config: { ...commonConfig, beamPowerCapW: [2] },
      frame: {
        thetaRadUb: [[0]],
        propagationGainUb: [[1e-6]],
        receiveGainUb: [[1]],
        servingBeamU: [0],
        beamActiveB: [true],
        beamLoadB: [1],
        beamSatelliteB: [0],
        beamColorB: [0],
        laggedInterferenceUW: [0],
      },
    },
    expected: {
      transmitGainUb: [[1]],
      receivedPowerUbW: [[7.177346253629314e-11]],
      gammaReqB: [0.07177346253629313],
      pReqUW: [7.177346253629314e-5],
      pReqBW: [7.177346253629314e-5],
      pDlBeforeSatelliteCapBW: [7.177346253629314e-5],
      pDlActualBW: [7.177346253629314e-5],
      satelliteScaleB: [1],
      interferenceUW: [0],
      sinrU: [0.07177346253629313],
      rateUBps: [99_999.99999999996],
      etaPaB: [0.0011790575283569256],
      pPaBW: [0.060873588277166574],
      pRfcBW: [0.338],
      pBbBW: [0.2],
      pEventBW: [0],
      pTotBW: [0.5988735882771666],
      totalRateBps: 99_999.99999999996,
      systemPowerW: 0.5988735882771666,
      systemEeBitsPerJ: 166_980.14732571348,
      r1UBitsPerJ: [166_980.14732571348],
      qosMetU: [false],
      powerLimitedU: [false],
    },
  },
  {
    id: 'fixed_load_off_axis',
    input: {
      config: { ...commonConfig, beamPowerCapW: [2] },
      frame: {
        thetaRadUb: [[0.02]],
        propagationGainUb: [[1e-6]],
        receiveGainUb: [[1]],
        servingBeamU: [0],
        beamActiveB: [true],
        beamLoadB: [1],
        beamSatelliteB: [0],
        beamColorB: [0],
        laggedInterferenceUW: [0],
      },
    },
    expected: {
      transmitGainUb: [[0.8977387946685164]],
      receivedPowerUbW: [[7.177346253629314e-11]],
      gammaReqB: [0.07177346253629313],
      pReqUW: [7.994916000348963e-5],
      pReqBW: [7.994916000348963e-5],
      pDlBeforeSatelliteCapBW: [7.994916000348963e-5],
      pDlActualBW: [7.994916000348963e-5],
      satelliteScaleB: [1],
      interferenceUW: [0],
      sinrU: [0.07177346253629313],
      rateUBps: [99_999.99999999996],
      etaPaB: [0.0012443999903962181],
      pPaBW: [0.06424715575418298],
      pRfcBW: [0.338],
      pBbBW: [0.2],
      pEventBW: [0],
      pTotBW: [0.602247155754183],
      totalRateBps: 99_999.99999999996,
      systemPowerW: 0.602247155754183,
      systemEeBitsPerJ: 166_044.7858400789,
      r1UBitsPerJ: [166_044.7858400789],
      qosMetU: [false],
      powerLimitedU: [false],
    },
  },
  {
    id: 'coupled_interference',
    input: {
      config: { ...commonConfig, beamPowerCapW: [2, 2] },
      frame: {
        thetaRadUb: [[0, 0], [0, 0]],
        propagationGainUb: [[1e-6, 1e-7], [1e-7, 1e-6]],
        receiveGainUb: [[1, 1], [1, 1]],
        servingBeamU: [0, 1],
        beamActiveB: [true, true],
        beamLoadB: [1, 1],
        beamSatelliteB: [0, 1],
        beamColorB: [0, 0],
        laggedInterferenceUW: [0, 1e-6],
      },
    },
    expected: {
      transmitGainUb: [[1, 1], [1, 1]],
      receivedPowerUbW: [[7.177346253629314e-11, 7.184523599882942e-9], [7.177346253629313e-12, 7.184523599882943e-8]],
      gammaReqB: [0.07177346253629313, 0.07177346253629313],
      pReqUW: [7.177346253629314e-5, 0.07184523599882943],
      pReqBW: [7.177346253629314e-5, 0.07184523599882943],
      pDlBeforeSatelliteCapBW: [7.177346253629314e-5, 0.07184523599882943],
      pDlActualBW: [7.177346253629314e-5, 0.07184523599882943],
      satelliteScaleB: [1, 1],
      interferenceUW: [7.184523599882942e-9, 7.177346253623684e-12],
      sinrU: [0.008769412374511286, 71.33325254591024],
      rateUBps: [12_596.436444287641, 6_176_587.120409778],
      etaPaB: [0.0011790575283569256, 0.037303710697869155],
      pPaBW: [0.060873588277166574, 1.9259541384694832],
      pRfcBW: [0.338, 0.338],
      pBbBW: [0.2, 0.2],
      pEventBW: [0, 0],
      pTotBW: [0.5988735882771666, 2.463954138469483],
      totalRateBps: 6_189_183.5568540655,
      systemPowerW: 3.06282772674665,
      systemEeBitsPerJ: 2_020_741.6508626966,
      r1UBitsPerJ: [4_112.681994578793, 2_016_628.968868118],
      qosMetU: [false, true],
      powerLimitedU: [false, false],
    },
  },
] as const;

export const CANONICAL_EE_EVALUATION_FIXTURE = Object.freeze({
  stepThroughputsBps: [10, 20],
  stepConsumedPowerW: [2, 8],
  stepDurationSec: [1, 3],
  expectedDeliveredBits: 70,
  expectedConsumedEnergyJ: 26,
  expectedEnergyEfficiencyBitsPerJ: 70 / 26,
});

/** Keep the fixture's result type visible to consumers writing parity tools. */
export type CanonicalEeFixtureResult = CanonicalEeResult;
