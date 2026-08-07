# T1-T6 Deck Values

## T1

**Description**: Verify the teaching power chain and circuit power addition.

**Source Function**: `computePowerTrain`

### Baseline

Command: `computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: 3, energyPerHandoverJ: 3 })`

```json
{
  "txPowerDbm": 24,
  "rfTxPowerW": 0.25118864315095796,
  "paInputW": 0.7176818375741656,
  "circuitPowerW": 3,
  "totalPowerW": 3.7176818375741654
}
```

### Variant 1

Command: `computePowerTrain(24, { paEfficiency: 0.35, circuitPowerW: 4, energyPerHandoverJ: 3 })`

```json
{
  "txPowerDbm": 24,
  "rfTxPowerW": 0.25118864315095796,
  "paInputW": 0.7176818375741656,
  "circuitPowerW": 4,
  "totalPowerW": 4.717681837574165
}
```

**Explanation**: Total power rises exactly by 1 W because the circuit term is added after PA conversion.

## T2

**Description**: Separate PA efficiency, circuit power, and handover cost in the accumulator.

**Source Function**: `computePowerTrain + ledger logic`

### Baseline

Command: `t2Run(0.35, 3, 3, 0)`

```json
{
  "knobs": {
    "paEfficiency": 0.35,
    "circuitPowerW": 3,
    "energyPerHandoverJ": 3
  },
  "handoverCount": 0,
  "handoverEnergy": 0,
  "radioEnergy": 74.35363675148331,
  "totalEnergy": 74.35363675148331,
  "dataMbit": 200,
  "runEEMbitPerJ": 2.6898482540735995,
  "lowSinrRatio": 0
}
```

### Variant 1

Command: `t2Run(0.70, 3, 3, 0)`

```json
{
  "knobs": {
    "paEfficiency": 0.7,
    "circuitPowerW": 3,
    "energyPerHandoverJ": 3
  },
  "handoverCount": 0,
  "handoverEnergy": 0,
  "radioEnergy": 67.17681837574165,
  "totalEnergy": 67.17681837574165,
  "dataMbit": 200,
  "runEEMbitPerJ": 2.9772175109773045,
  "lowSinrRatio": 0
}
```

**Explanation**: Higher PA efficiency lowers radio energy and total energy.

### Variant 2

Command: `t2Run(0.35, 12, 3, 0)`

```json
{
  "knobs": {
    "paEfficiency": 0.35,
    "circuitPowerW": 12,
    "energyPerHandoverJ": 3
  },
  "handoverCount": 0,
  "handoverEnergy": 0,
  "radioEnergy": 254.3536367514833,
  "totalEnergy": 254.3536367514833,
  "dataMbit": 200,
  "runEEMbitPerJ": 0.7863068228720094,
  "lowSinrRatio": 0
}
```

**Explanation**: Higher circuit power increases radio energy and total energy proportionally.

### Variant 3

Command: `t2Run(0.35, 3, 100, 1)`

```json
{
  "knobs": {
    "paEfficiency": 0.35,
    "circuitPowerW": 3,
    "energyPerHandoverJ": 100
  },
  "handoverCount": 1,
  "handoverEnergy": 100,
  "radioEnergy": 74.35363675148331,
  "totalEnergy": 174.3536367514833,
  "dataMbit": 200,
  "runEEMbitPerJ": 1.147093939228076,
  "lowSinrRatio": 0
}
```

**Explanation**: Higher e_HO increases total energy via handover cost when a handover occurs.

## T3

**Description**: Trace transmit power, bandwidth, reuse, and live SINR to throughput.

**Source Function**: `computeTeachingThroughputMbps`

### Baseline

Command: `t3Run(24, 100, 1, 15)`

```json
{
  "P_tx": 24,
  "B": 100,
  "reuse": 1,
  "load": 1,
  "SINR": 15,
  "throughput": 502.78076733505196,
  "data": 7541.71151002578
}
```

### Variant 1

Command: `t3Run(24, 100, 3, 18)`

```json
{
  "P_tx": 24,
  "B": 100,
  "reuse": 3,
  "load": 1,
  "SINR": 18,
  "throughput": 200.07188146673266,
  "data": 3001.07822200099
}
```

**Explanation**: Higher K divides bandwidth but reduces co-channel interference (increasing SINR), resulting in trade-off throughput.

### Variant 2

Command: `t3Run(24, 200, 1, 12)`

```json
{
  "P_tx": 24,
  "B": 200,
  "reuse": 1,
  "load": 1,
  "SINR": 12,
  "throughput": 814.9170469810853,
  "data": 12223.755704716279
}
```

**Explanation**: Higher B increases available bandwidth but raises thermal noise (lowering SINR).

## T4

**Description**: Distinguish measurement reset from energy-parameter restoration.

**Source Function**: `deterministic state transition`

### Baseline

Command: `State before reset with custom parameters`

```json
{
  "parameters": {
    "paEfficiency": 0.6,
    "circuitPowerW": 25,
    "energyPerHandoverJ": 100
  },
  "window": {
    "elapsedSec": 15,
    "dataMbit": 150
  }
}
```

### Variant 1

Command: `Restart measurement`

```json
{
  "parameters": {
    "paEfficiency": 0.6,
    "circuitPowerW": 25,
    "energyPerHandoverJ": 100
  },
  "window": {
    "elapsedSec": 0,
    "dataMbit": 0
  }
}
```

**Explanation**: Restart clears the cumulative window but preserves parameters.

### Variant 2

Command: `Restore energy defaults`

```json
{
  "parameters": {
    "paEfficiency": 0.35,
    "circuitPowerW": 3,
    "energyPerHandoverJ": 3
  },
  "window": {
    "elapsedSec": 0,
    "dataMbit": 0
  }
}
```

**Explanation**: Restore defaults resets the parameter state and implicitly starts a new window.

## T5

**Description**: Check fail-closed SINR semantics.

**Source Function**: `computeTeachingThroughputMbps`

### Baseline

Command: `computeTeachingThroughputMbps(sinrDb: 10, ...)`

```json
{
  "inputLabel": "10",
  "ledgerAccumulated": true,
  "throughput": 69.18863237274594
}
```

### Variant 1

Command: `computeTeachingThroughputMbps(sinrDb: -Infinity, ...)`

```json
{
  "inputLabel": "-Infinity",
  "ledgerAccumulated": true,
  "throughput": 0
}
```

**Explanation**: Explicit -Infinity represents no-service and yields 0 throughput.

### Variant 2

Command: `computeTeachingThroughputMbps(sinrDb: NaN, ...)`

```json
{
  "inputLabel": "NaN",
  "ledgerAccumulated": false,
  "throughput": null
}
```

**Explanation**: NaN indicates a broken reading and fails closed to null without accumulating.

### Variant 3

Command: `computeTeachingThroughputMbps(sinrDb: +Infinity, ...)`

```json
{
  "inputLabel": "+Infinity",
  "ledgerAccumulated": false,
  "throughput": null
}
```

**Explanation**: +Infinity indicates a broken reading and fails closed to null without accumulating.

## T6

**Description**: Read the live canonical gate.

**Source Function**: `CanonicalEePublisherSession.advance`

### Baseline

Command: `session.advance(frame(1))`

```json
{
  "status": "valid",
  "P_sys": 5.618798314396923,
  "EE_inst": 1.7797399800553833,
  "sumContributions": 1.7797399800553833,
  "identity": true,
  "EE_eval": null,
  "sampleWindow": 0,
  "typedReason": null
}
```

### Variant 1

Command: `session.advance(frame(2))`

```json
{
  "status": "valid",
  "P_sys": 5.618798314396923,
  "EE_inst": 1.7797399800553833,
  "sumContributions": 1.7797399800553833,
  "identity": true,
  "EE_eval": 1.7797399800553833,
  "sampleWindow": 1,
  "typedReason": null
}
```

**Explanation**: After a positive time step, EE_eval becomes available as a ratio of sums.

