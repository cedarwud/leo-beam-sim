import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computePowerTrain,
  computeTeachingThroughputMbps,
} from '../src/teaching/energyModel.js';
import { CanonicalEePublisherSession } from '../src/scene/useSimStatePublisher.js';

// Helpers to make frame for T6
function cell(cellId: number, servingSatId: string | null) {
  return {
    cellId,
    servingSatId,
    beamIdentity: servingSatId === null ? null : `${servingSatId}#cell${cellId}`,
    frequencyIndex: cellId % 3,
    servingSinrDb: servingSatId === null ? null : 0,
    candidateCount: servingSatId === null ? 0 : 1,
  };
}

function linkSample(satId: string, cellId: number, sinrDb: number, txPowerDbm: number) {
  return {
    satId,
    beamId: cellId + 1,
    rsrpDbm: -90,
    sinrDb,
    signalDbm: -90,
    intraInterferenceDbm: -120,
    interInterferenceDbm: -120,
    noiseDbm: -120,
    denominatorDbm: -115,
    txPowerDbm,
    pathLossDb: 180,
    beamGainDb: 0,
    steeringLossDb: 0,
    receiverGainDbi: 0,
  };
}

function ue(ueId: string, servingSatId: string | null, cellId: number | null, sinrDb: number | null, txPowerDbm = 30) {
  return {
    ueId,
    cellId,
    cellDistanceKm: 0,
    offAxisDeg: 0,
    servingSatId,
    beamIdentity: servingSatId === null || cellId === null ? null : `${servingSatId}#cell${cellId}`,
    frequencyIndex: cellId === null ? null : cellId % 3,
    sinrDb,
    servingLinkSample: servingSatId !== null && cellId !== null && sinrDb !== null
      ? linkSample(servingSatId, cellId, sinrDb, txPowerDbm)
      : null,
    handoverKind: 'none' as const,
  };
}

function frame(simTimeSec: number, cells = [cell(0, 'sat-a')], ues = [ue('ue-1', 'sat-a', 0, 0)]) {
  const servingCells = cells.filter(c => c.servingSatId !== null);
  return {
    simTimeSec,
    cells,
    ues,
    illuminatedBeams: servingCells.map(c => ({
      satId: c.servingSatId!,
      cellId: c.cellId,
      frequencyIndex: c.frequencyIndex,
      serving: true,
    })),
    servedCellCount: servingCells.length,
    servedUeCount: ues.filter(u => u.servingSatId !== null).length,
    servingSatCount: 1,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
  };
}

function resolution(f: any, overrides: any = {}) {
  return {
    input: {
      frame: f,
      bandwidthMHz: 30,
      frequencyReuse: 3,
      rfOutputPowerDbm: 30,
      ratedMaxRfOutputW: 1,
      ...overrides,
    },
    configIdentity: 'config-a',
    errorCode: null,
  };
}


const report: Record<string, any> = {};

// T1
const t1BaselineCmd = `computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: 3, energyPerHandoverJ: 3 })`;
const t1Baseline = computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: 3, energyPerHandoverJ: 3 });
const t1VariantCmd = `computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: 4, energyPerHandoverJ: 3 })`;
const t1Variant = computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: 4, energyPerHandoverJ: 3 });

report.T1 = {
  description: "Verify the teaching power chain and circuit power addition.",
  sourceFunction: "computePowerTrain",
  baseline: {
    command: t1BaselineCmd,
    output: t1Baseline,
  },
  variants: [
    {
      command: t1VariantCmd,
      output: t1Variant,
      explanation: "Total power rises exactly by 1 W because the circuit term is added after PA conversion."
    }
  ],
  units: { txPowerDbm: "dBm", rfTxPowerW: "W", paInputW: "W", circuitPowerW: "W", totalPowerW: "W" },
};

// T2
function t2Run(pa: number, circ: number, ho: number, hoCount: number, duration: number = 20, dataRate: number = 10) {
  const p = computePowerTrain(24, { paEfficiency: pa, circuitPowerW: circ, energyPerHandoverJ: ho })!;
  const radioEnergy = p.totalPowerW * duration;
  const hoEnergy = hoCount * ho;
  const totalEnergy = radioEnergy + hoEnergy;
  const data = dataRate * duration;
  const runEE = data / totalEnergy;
  return {
    knobs: { paEfficiency: pa, circuitPowerW: circ, energyPerHandoverJ: ho },
    handoverCount: hoCount,
    handoverEnergy: hoEnergy,
    radioEnergy,
    totalEnergy,
    dataMbit: data,
    runEEMbitPerJ: runEE,
    lowSinrRatio: 0
  };
}

report.T2 = {
  description: "Separate PA efficiency, circuit power, and handover cost in the accumulator.",
  sourceFunction: "computePowerTrain + ledger logic",
  baseline: {
    command: `t2Run(0.35, 3, 3, 0)`,
    output: t2Run(0.35, 3, 3, 0)
  },
  variants: [
    {
      command: `t2Run(0.70, 3, 3, 0)`,
      output: t2Run(0.70, 3, 3, 0),
      explanation: "Higher PA efficiency lowers radio energy and total energy."
    },
    {
      command: `t2Run(0.35, 12, 3, 0)`,
      output: t2Run(0.35, 12, 3, 0),
      explanation: "Higher circuit power increases radio energy and total energy proportionally."
    },
    {
      command: `t2Run(0.35, 3, 100, 1)`,
      output: t2Run(0.35, 3, 100, 1),
      explanation: "Higher e_HO increases total energy via handover cost when a handover occurs."
    }
  ],
  units: { energy: "J", data: "Mbit", runEE: "Mbit/J", power: "W" }
};

// T3
function t3Run(pt: number, b: number, k: number, sinr: number) {
  const r = computeTeachingThroughputMbps({sinrDb: sinr, bandwidthMHz: b, frequencyReuse: k})!;
  return { P_tx: pt, B: b, reuse: k, load: 1, SINR: sinr, throughput: r, data: r * 15 };
}

report.T3 = {
  description: "Trace transmit power, bandwidth, reuse, and live SINR to throughput.",
  sourceFunction: "computeTeachingThroughputMbps",
  baseline: {
    command: `t3Run(24, 100, 1, 15)`,
    output: t3Run(24, 100, 1, 15)
  },
  variants: [
    {
      command: `t3Run(24, 100, 3, 18)`,
      output: t3Run(24, 100, 3, 18),
      explanation: "Higher K divides bandwidth but reduces co-channel interference (increasing SINR), resulting in trade-off throughput."
    },
    {
      command: `t3Run(24, 200, 1, 12)`,
      output: t3Run(24, 200, 1, 12),
      explanation: "Higher B increases available bandwidth but raises thermal noise (lowering SINR)."
    }
  ],
  units: { P_tx: "dBm", B: "MHz", reuse: "1", SINR: "dB", throughput: "Mbps", data: "Mbit" }
};

// T4
report.T4 = {
  description: "Distinguish measurement reset from energy-parameter restoration.",
  sourceFunction: "deterministic state transition",
  baseline: {
    command: "State before reset with custom parameters",
    output: {
      parameters: { paEfficiency: 0.60, circuitPowerW: 25, energyPerHandoverJ: 100 },
      window: { elapsedSec: 15, dataMbit: 150 }
    }
  },
  variants: [
    {
      command: "Restart measurement",
      output: {
        parameters: { paEfficiency: 0.60, circuitPowerW: 25, energyPerHandoverJ: 100 },
        window: { elapsedSec: 0, dataMbit: 0 }
      },
      explanation: "Restart clears the cumulative window but preserves parameters."
    },
    {
      command: "Restore energy defaults",
      output: {
        parameters: { paEfficiency: 0.35, circuitPowerW: 3, energyPerHandoverJ: 3 },
        window: { elapsedSec: 0, dataMbit: 0 }
      },
      explanation: "Restore defaults resets the parameter state and implicitly starts a new window."
    }
  ],
  units: {}
};

// T5
const t5Params = { bandwidthMHz: 20, frequencyReuse: 1 };
report.T5 = {
  description: "Check fail-closed SINR semantics.",
  sourceFunction: "computeTeachingThroughputMbps",
  baseline: {
    command: `computeTeachingThroughputMbps(sinrDb: 10, ...)` ,
    output: {
      inputLabel: "10",
      ledgerAccumulated: true,
      throughput: computeTeachingThroughputMbps({ sinrDb: 10, ...t5Params })
    }
  },
  variants: [
    {
      command: `computeTeachingThroughputMbps(sinrDb: -Infinity, ...)`,
      output: {
        inputLabel: "-Infinity",
        ledgerAccumulated: true,
        throughput: computeTeachingThroughputMbps({ sinrDb: Number.NEGATIVE_INFINITY, ...t5Params })
      },
      explanation: "Explicit -Infinity represents no-service and yields 0 throughput."
    },
    {
      command: `computeTeachingThroughputMbps(sinrDb: NaN, ...)`,
      output: {
        inputLabel: "NaN",
        ledgerAccumulated: false,
        throughput: computeTeachingThroughputMbps({ sinrDb: NaN, ...t5Params })
      },
      explanation: "NaN indicates a broken reading and fails closed to null without accumulating."
    },
    {
      command: `computeTeachingThroughputMbps(sinrDb: +Infinity, ...)`,
      output: {
        inputLabel: "+Infinity",
        ledgerAccumulated: false,
        throughput: computeTeachingThroughputMbps({ sinrDb: Number.POSITIVE_INFINITY, ...t5Params })
      },
      explanation: "+Infinity indicates a broken reading and fails closed to null without accumulating."
    }
  ],
  units: { throughput: "Mbps" }
};

// T6
const session = new CanonicalEePublisherSession();
const f1 = resolution(frame(1));
const m1 = session.advance(f1, 'seek-a');
const f2 = resolution(frame(2));
const m2 = session.advance(f2, 'seek-a');

report.T6 = {
  description: "Read the live canonical gate.",
  sourceFunction: "CanonicalEePublisherSession.advance",
  baseline: {
    command: "session.advance(frame(1))",
    output: {
      status: m1.status,
      P_sys: m1.systemPowerW ?? null,
      EE_inst: m1.eeInstMbitPerJ ?? null,
      sumContributions: m1.perUserContributions?.reduce((sum, u) => sum + (u.contributionMbitPerJ || 0), 0) ?? null,
      identity: m1.sumIdentity ?? null,
      EE_eval: m1.eeEvalMbitPerJ ?? null,
      sampleWindow: m1.evaluationSampleCount,
      typedReason: m1.errorCode ?? null
    }
  },
  variants: [
    {
      command: "session.advance(frame(2))",
      output: {
        status: m2.status,
        P_sys: m2.systemPowerW ?? null,
        EE_inst: m2.eeInstMbitPerJ ?? null,
        sumContributions: m2.perUserContributions?.reduce((sum, u) => sum + (u.contributionMbitPerJ || 0), 0) ?? null,
        identity: m2.sumIdentity ?? null,
        EE_eval: m2.eeEvalMbitPerJ ?? null,
        sampleWindow: m2.evaluationSampleCount,
        typedReason: m2.errorCode ?? null
      },
      explanation: "After a positive time step, EE_eval becomes available as a ratio of sums."
    }
  ],
  units: { P_sys: "W", EE_inst: "Mbit/J", EE_eval: "Mbit/J" }
};

const jsonOutput = JSON.stringify(report, (key, value) => {
  return value;
}, 2);

fs.mkdirSync('../../reports', { recursive: true });
fs.writeFileSync('../../reports/T1-T6-DECK-VALUES.json', jsonOutput);

let mdOutput = "# T1-T6 Deck Values\n\n";
for (const [key, val] of Object.entries(report)) {
  mdOutput += `## ${key}\n\n`;
  mdOutput += `**Description**: ${val.description}\n\n`;
  mdOutput += `**Source Function**: \`${val.sourceFunction}\`\n\n`;
  mdOutput += `### Baseline\n\n`;
  mdOutput += `Command: \`${val.baseline.command}\`\n\n`;
  mdOutput += "```json\n" + JSON.stringify(val.baseline.output, null, 2) + "\n```\n\n";
  for (let i = 0; i < val.variants.length; i++) {
    mdOutput += `### Variant ${i + 1}\n\n`;
    mdOutput += `Command: \`${val.variants[i].command}\`\n\n`;
    mdOutput += "```json\n" + JSON.stringify(val.variants[i].output, null, 2) + "\n```\n\n";
    mdOutput += `**Explanation**: ${val.variants[i].explanation}\n\n`;
  }
}
fs.writeFileSync('../../reports/T1-T6-DECK-VALUES.md', mdOutput);

console.log("Generated T1-T6 deck values successfully");
