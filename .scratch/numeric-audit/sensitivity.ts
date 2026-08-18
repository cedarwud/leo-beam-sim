import { computeCanonicalEe } from '../../src/analysis/canonicalEe';
import { buildCanonicalSevenCellScenario } from '../../src/simulator/canonicalSevenCellScenario';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../src/simulator/types';

const selectedLink = { distanceKm: 600, elevationDeg: 50 };

function metrics(parameters: SimulatorParameters, absolutePathLoss = false) {
  const scenario = buildCanonicalSevenCellScenario({ ...parameters, selectedLink, frameDurationS: 30 });
  const input = absolutePathLoss ? {
    ...scenario.input,
    frame: {
      ...scenario.input.frame,
      propagationGainUb: scenario.metadata.channelTermsUb.map(row => row.map(
        terms => (10 ** (-terms.pathLossDb / 10)) * parameters.channelGainScale,
      )),
    },
  } : scenario.input;
  const result = computeCanonicalEe(input);
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
  return {
    h00: input.frame.propagationGainUb[0]![0]!,
    noiseW: scenario.input.config.noisePowerW,
    gamma0: result.gammaReqB[0]!,
    pReqSumW: sum(result.power.pReqBW),
    pDlSumW: sum(result.power.pDlActualBW),
    eta0: result.power.paEfficiencyB[0]!,
    pSysW: result.power.systemPowerW,
    interference0W: result.throughput.interferenceUW[0]!,
    sinr0: result.throughput.sinrU[0]!,
    totalRateBps: result.throughput.totalRateBps,
    eeBitsPerJ: result.ee.systemEeBitsPerJ,
  };
}

const baseline = metrics({ ...DEFAULT_SIMULATOR_PARAMETERS });
console.log('baseline', baseline);
const physicalBaseline = metrics({ ...DEFAULT_SIMULATOR_PARAMETERS }, true);
console.log('absolute-path-loss baseline', physicalBaseline);

const variants: Readonly<Record<keyof SimulatorParameters, number>> = {
  beamPowerCapW: 0.001,
  satellitePowerCapW: 0.001,
  etaMax: 0.5,
  backoffDb: 8,
  rfcPowerW: 0.5,
  basebandPerSatelliteW: 0.5,
  frequencyReuse: 4,
  antennaNoiseTemperatureK: 250,
  noiseFigureDb: 2.5,
  noiseReferenceTemperatureK: 350,
  g0Linear: 3_000,
  theta3dbRad: 4.5 * Math.PI / 180,
  channelGainScale: 2,
  carrierFrequencyGHz: 25,
  atmosphericZenithLossDb: 0.5,
  scintillationScaleDb: 0.2,
  shadowFadingMarginDb: 4,
  receiveGainDbi: 40,
  minimumRateBps: 2_000_000,
  systemBandwidthHz: 750_000_000,
};

for (const [key, value] of Object.entries(variants) as Array<[keyof SimulatorParameters, number]>) {
  const changed = metrics({ ...DEFAULT_SIMULATOR_PARAMETERS, [key]: value });
  const deltas = Object.fromEntries(Object.entries(changed).map(([metric, metricValue]) => {
    const baseValue = baseline[metric as keyof typeof baseline];
    const relative = baseValue === 0 ? (metricValue === 0 ? 0 : Number.POSITIVE_INFINITY) : (metricValue - baseValue) / Math.abs(baseValue);
    return [metric, Number.isFinite(relative) ? Number(relative.toPrecision(4)) : relative];
  }));
  console.log(key, value, deltas);
}

console.log('absolute-path-loss sensitivity');
for (const [key, value] of Object.entries(variants) as Array<[keyof SimulatorParameters, number]>) {
  const changed = metrics({ ...DEFAULT_SIMULATOR_PARAMETERS, [key]: value }, true);
  const deltas = Object.fromEntries(Object.entries(changed).map(([metric, metricValue]) => {
    const baseValue = physicalBaseline[metric as keyof typeof physicalBaseline];
    const relative = baseValue === 0 ? (metricValue === 0 ? 0 : Number.POSITIVE_INFINITY) : (metricValue - baseValue) / Math.abs(baseValue);
    return [metric, Number.isFinite(relative) ? Number(relative.toPrecision(4)) : relative];
  }));
  console.log(key, value, deltas);
}
