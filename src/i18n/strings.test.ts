import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN, ZH_TW } from './strings';

test('EN and ZH_TW key sets are identical (bidirectional diff)', () => {
  const zhKeys = new Set(Object.keys(ZH_TW));
  const enKeys = new Set(Object.keys(EN));

  const missingInEn = [...zhKeys].filter(key => !enKeys.has(key)).sort();
  const missingInZh = [...enKeys].filter(key => !zhKeys.has(key)).sort();

  assert.deepEqual(missingInEn, [], `EN is missing keys present in ZH_TW: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInZh, [], `ZH_TW is missing keys present in EN: ${missingInZh.join(', ')}`);
  assert.equal(zhKeys.size, enKeys.size, 'ZH_TW and EN must have the same number of keys');
});

test('field-wide EE card copy has every key in both locale dictionaries', () => {
  const eeCardKeys = [
    'panel.overallEe.title',
    'panel.overallEe.divider',
    'panel.overallEe.help',
    'panel.ee.aggregation.label',
    'panel.ee.headline.help',
    'panel.ee.headline.unavailable',
    'panel.ee.mean',
    'panel.ee.servedAverage.label',
    'panel.ee.servedAverage.help',
    'panel.ee.coverageStep.help',
    'panel.ee.bandwidth.label',
    'panel.ee.bandwidth.help',
    'panel.ee.bandwidth.detail',
    'panel.ee.population.label',
    'panel.ee.population.help',
    'panel.ee.beamLoad.label',
    'panel.ee.beamLoad.help',
    'panel.ee.beamLoad.detail',
    'panel.ee.throughput.label',
    'panel.ee.throughput.help',
    'panel.ee.throughput.detail',
    'panel.ee.sinr.label',
    'panel.ee.sinr.help',
    'panel.ee.sinr.detail',
    'panel.ee.beamPower.label',
    'panel.ee.beamPower.help',
    'panel.ee.beamPower.detail',
    'panel.ee.perUePower.label',
    'panel.ee.perUePower.help',
    'panel.ee.perUePower.detail',
    'panel.ee.waiting.ueAssignments',
    'panel.ee.waiting.uePopulation',
    'panel.ee.waiting.frameValues',
    'panel.ee.waiting.servedSinr',
    'panel.ee.waiting.beamLoad',
    'panel.ee.detail.servedAssignments',
    'panel.ee.detail.coverageServed',
    'panel.ee.detail.served',
    'panel.ee.detail.unserved',
  ] as const;

  for (const key of eeCardKeys) {
    assert.ok(ZH_TW[key], `ZH_TW.${key} missing`);
    assert.ok(EN[key], `EN.${key} missing`);
  }

  assert.equal(ZH_TW['panel.overallEe.title'], '全場即時效率');
  assert.equal(EN['panel.ee.mean'], 'Mean');
  assert.equal(ZH_TW['common.unit.ue'], '位使用者');
  assert.equal(EN['common.unit.ue'], 'users');
});

test('no empty (or whitespace-only) string values in either dictionary', () => {
  for (const [key, value] of Object.entries(ZH_TW)) {
    assert.equal(typeof value, 'string', `ZH_TW.${key} must be a string`);
    assert.ok(value.trim().length > 0, `ZH_TW.${key} is empty`);
  }
  for (const [key, value] of Object.entries(EN)) {
    assert.equal(typeof value, 'string', `EN.${key} must be a string`);
    assert.ok(value.trim().length > 0, `EN.${key} is empty`);
  }
});

test('every key follows the param./tab./formula./kpi./panel./common. naming convention (CONTRACT §2)', () => {
  const pattern = /^(param|tab|formula|kpi|panel|common)\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/;
  const zhOffenders = Object.keys(ZH_TW).filter(key => !pattern.test(key));
  const enOffenders = Object.keys(EN).filter(key => !pattern.test(key));

  assert.deepEqual(zhOffenders, [], `ZH_TW keys violating naming convention: ${zhOffenders.join(', ')}`);
  assert.deepEqual(enOffenders, [], `EN keys violating naming convention: ${enOffenders.join(', ')}`);
});

test('param.* keys with a numeric range also expose a unit, except select-style controls', () => {
  // model / frequencyReuse are SelectControl-driven (no physical unit); every
  // other param.* key is NumericControl-driven and must carry .unit alongside
  // .label/.help/.effect.
  const selectOnlyParams = new Set(['model', 'frequencyReuse']);
  const paramKeys = Object.keys(ZH_TW).filter(key => key.startsWith('param.'));
  const paramNames = new Set(paramKeys.map(key => key.split('.')[1]));

  for (const name of paramNames) {
    assert.ok(ZH_TW[`param.${name}.label` as keyof typeof ZH_TW], `param.${name}.label missing`);
    assert.ok(ZH_TW[`param.${name}.help` as keyof typeof ZH_TW], `param.${name}.help missing`);
    assert.ok(ZH_TW[`param.${name}.effect` as keyof typeof ZH_TW], `param.${name}.effect missing`);
    if (!selectOnlyParams.has(name)) {
      assert.ok(ZH_TW[`param.${name}.unit` as keyof typeof ZH_TW], `param.${name}.unit missing`);
    }
  }
});

test('handover-energy copy teaches E_HO = count × per-handover cost, and never revives the "unmodelled" claim', () => {
  const zh = ZH_TW['kpi.handoverEnergy.help'];
  const en = EN['kpi.handoverEnergy.help'];

  // The model now computes this term (`computeHandoverEnergyJ`), so the copy
  // has to teach the identity rather than apologise for its absence.
  assert.match(zh, /E_HO\s*＝\s*換手次數\s*×\s*每次換手耗能/, 'zh must spell out E_HO = handover count × per-handover cost');
  assert.match(en, /E_HO = handover count × energy per handover/, 'en must spell out E_HO = handover count × per-handover cost');

  // E_HO is a term of the Run EE denominator, not a standalone curiosity.
  assert.match(zh, /總耗能/, 'zh must connect E_HO to total energy');
  assert.match(en, /total energy/i, 'en must connect E_HO to total energy');

  // A measured 0 is a legitimate reading of this model (no handover inside the
  // window, or the cost knob set to 0). The copy must say so, because the panel
  // renders that 0 as a number rather than as an em dash.
  assert.match(zh, /0/, 'zh must explain what a 0 means, since 0 is now displayable');
  assert.match(en, /\b0\b/, 'en must explain what a 0 means, since 0 is now displayable');

  // Regression guard: the pre-model wording claimed the cost was unmodelled.
  // That claim is now false and must never come back.
  assert.doesNotMatch(zh, /尚未納入/, 'zh must not claim handover energy is still unmodelled');
  assert.doesNotMatch(en, /not yet included/i, 'en must not claim handover energy is still unmodelled');
});

test('the per-handover cost knob is fully described in both locales', () => {
  // `energyPerHandoverJ` is the knob E_HO is built from; it needs the same
  // label/unit/help/effect quartet every other NumericControl param carries.
  for (const dict of [ZH_TW, EN] as const) {
    for (const suffix of ['label', 'unit', 'help', 'effect'] as const) {
      const key = `param.energyPerHandoverJ.${suffix}` as keyof typeof dict;
      assert.ok(dict[key], `param.energyPerHandoverJ.${suffix} missing`);
    }
  }
  assert.match(ZH_TW['param.energyPerHandoverJ.help'], /E_HO/);
  assert.match(EN['param.energyPerHandoverJ.help'], /E_HO/);
  assert.equal(ZH_TW['param.energyPerHandoverJ.unit'], 'J');
  assert.equal(EN['param.energyPerHandoverJ.unit'], 'J');
});

test('the ledger names both energy terms and the count they come from', () => {
  // The card shows radio energy + handover energy = total energy plus the
  // handover count; each of those four rows needs a catalog label and help.
  for (const dict of [ZH_TW, EN] as const) {
    for (const name of ['cumulativeEnergy', 'handoverEnergy', 'totalEnergy', 'handoverCount'] as const) {
      assert.ok(dict[`kpi.${name}.label` as keyof typeof dict], `kpi.${name}.label missing`);
      assert.ok(dict[`kpi.${name}.help` as keyof typeof dict], `kpi.${name}.help missing`);
    }
  }

  // Total energy must be presented as the sum of the two terms, so a student
  // can check the addition against the rows on screen.
  assert.match(ZH_TW['kpi.totalEnergy.help'], /Σ P_total·Δt\s*＋\s*換手能量 E_HO/);
  assert.match(EN['kpi.totalEnergy.help'], /Σ P_total·Δt \+ handover energy E_HO/);
});

test('EE copy teaches the formulas: Run EE as ΣMbit ÷ ΣJ, power train from dBm to W', () => {
  assert.match(ZH_TW['kpi.runEe.help'], /ΣMbit\s*÷\s*ΣJ/);
  assert.match(EN['kpi.runEe.help'], /ΣMbit\s*÷\s*ΣJ/);
  // ΣJ is no longer radio energy alone; the denominator has to name both terms
  // or the ratio the student is reading is not the one the model computes.
  assert.match(ZH_TW['kpi.runEe.help'], /分母[\s\S]*E_HO/);
  assert.match(EN['kpi.runEe.help'], /denominator[\s\S]*E_HO/i);
  assert.match(ZH_TW['formula.ee.caption'], /Mbit\/J/);
  assert.match(EN['formula.ee.caption'], /Mbit\/J/);

  // The dBm -> W -> PA -> total chain has to be spelled out somewhere the
  // student can see it, not left implicit.
  assert.match(ZH_TW['formula.power.caption'], /10\^\(P_tx\/10\)/);
  assert.match(EN['formula.power.caption'], /10\^\(P_tx\/10\)/);
  assert.match(ZH_TW['formula.power.caption'], /P_PA\s*＝\s*P_RF\s*÷\s*η_PA/);
  assert.match(EN['formula.power.caption'], /P_PA = P_RF ÷ η_PA/);
  assert.match(ZH_TW['formula.power.caption'], /P_total\s*＝\s*P_PA\s*\+\s*P_circuit/);
  assert.match(EN['formula.power.caption'], /P_total = P_PA \+ P_circuit/);

  assert.match(ZH_TW['formula.energy.caption'], /ΣJ\s*＝\s*Σ\s*P_total\(t\)·Δt/);
  assert.match(EN['formula.energy.caption'], /ΣJ = Σ P_total\(t\)·Δt/);
  assert.match(ZH_TW['formula.energy.caption'], /總耗能\s*＝\s*Σ P_total\(t\)·Δt\s*＋\s*E_HO/);
  assert.match(EN['formula.energy.caption'], /total energy = Σ P_total\(t\)·Δt \+ E_HO/);
  assert.match(ZH_TW['formula.throughput.caption'], /R\s*＝\s*\(B\s*÷\s*K\)·log₂\(1 \+ SINR\)/);
  assert.match(EN['formula.throughput.caption'], /R = \(B ÷ K\)·log₂\(1 \+ SINR\)/);
});

test('no self-justifying / developer-facing copy reaches the student', () => {
  // The copy explains what a number is and how it is computed. It never
  // argues with the reader about what it is *not*, and never leaks internal
  // engineering vocabulary.
  const bannedZh = /誠實|冒充|假裝|論文重現|不得|不可|SIMULATED TEACHING|SDD|Rule#|tier|hash/i;
  const bannedEn = /\bhonest\b|\bdishonest\b|impersonat|paper reproduction|SIMULATED TEACHING|\bSDD\b|Rule#|\btier\b|\bhash\b/i;

  for (const [key, value] of Object.entries(ZH_TW)) {
    assert.doesNotMatch(value, bannedZh, `ZH_TW.${key} contains self-justifying or internal copy: ${value}`);
  }
  for (const [key, value] of Object.entries(EN)) {
    assert.doesNotMatch(value, bannedEn, `EN.${key} contains self-justifying or internal copy: ${value}`);
  }
});

test('formula structure is described as numerator/denominator, never by screen position', () => {
  const positionalZh = /上面|下面|上半部|下半部|上方那|下方那/;
  const positionalEn = /\bthe top\b|\bthe bottom\b|\btop:\s|\bbottom:\s|\babove\b|\bbelow\b/i;

  for (const [key, value] of Object.entries(ZH_TW)) {
    assert.doesNotMatch(value, positionalZh, `ZH_TW.${key} describes a formula by position: ${value}`);
  }
  for (const [key, value] of Object.entries(EN)) {
    assert.doesNotMatch(value, positionalEn, `EN.${key} describes a formula by position: ${value}`);
  }

  // The SINR fraction copy is the place a student first meets the split, so
  // it has to name both parts explicitly.
  assert.match(ZH_TW['formula.sinr.fractionHint'], /分子/);
  assert.match(ZH_TW['formula.sinr.fractionHint'], /分母/);
  assert.match(EN['formula.sinr.fractionHint'], /Numerator/i);
  assert.match(EN['formula.sinr.fractionHint'], /Denominator/i);
  assert.match(ZH_TW['formula.sinr.symbolHelp'], /分子[\s\S]*分母/);
  assert.match(EN['formula.sinr.symbolHelp'], /numerator[\s\S]*denominator/i);
});

test('the retired card names never come back, and the accumulated row is named by what it accumulates', () => {
  // Owner rename 2026-08-06: 能源帳 → 耗能明細 (Energy ledger → Energy breakdown),
  // and the "另一種能源效率" framing is retired outright — the two card titles
  // (耗能明細 / 全場即時效率) carry the distinction themselves, so no string may
  // introduce one card as "a different version of" the other. Copy that still
  // points at a name the screen no longer shows sends the reader looking for a
  // card that does not exist.
  const retiredZh = /能源帳|另一種/;
  const retiredEn = /\bledger\b/i;

  for (const [key, value] of Object.entries(ZH_TW)) {
    assert.doesNotMatch(value, retiredZh, `ZH_TW.${key} still names a retired card: ${value}`);
  }
  for (const [key, value] of Object.entries(EN)) {
    assert.doesNotMatch(value, retiredEn, `EN.${key} still names a retired card: ${value}`);
  }

  // The row itself is named by the quantity — a whole-run accumulation — not by
  // the shorthand. `kpi.runEe.help` is free to introduce "Run EE" once as the
  // symbol, which is why only the label is pinned here.
  assert.equal(ZH_TW['kpi.runEe.label'], '整段累積效率');
  assert.equal(EN['kpi.runEe.label'], 'Run-accumulated EE');
});

test('the simulated-data marker is a short neutral tag, not a sentence', () => {
  // The user is wiring a real backend later; a single word is all the screen
  // needs, and the explanation must not be repeated inside help copy.
  assert.ok(ZH_TW['common.simulatedTeaching'].length <= 6, 'zh marker must stay a short tag');
  assert.ok(EN['common.simulatedTeaching'].length <= 20, 'en marker must stay a short tag');
  assert.doesNotMatch(ZH_TW['common.simulatedTeaching'], /[。，]/, 'zh marker must not be a sentence');
  assert.doesNotMatch(EN['common.simulatedTeaching'], /[.,]/, 'en marker must not be a sentence');
});

test('the read-only noise-floor label keeps the canonical EN term verbatim', () => {
  // ControlSections.tsx renders a duplicate canonical "Noise floor" caption
  // whenever the resolved label differs from that exact string.
  assert.equal(EN['kpi.noiseFloor.label'], 'Noise floor');
});

test('sanity: catalog is substantial (this task is primarily about building it out)', () => {
  assert.ok(Object.keys(ZH_TW).length >= 100, 'expected a large string catalog per the task scope');
});
