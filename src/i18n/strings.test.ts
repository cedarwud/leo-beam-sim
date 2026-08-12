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

test('the read-only noise-floor label keeps the canonical EN term verbatim', () => {
  // ControlSections.tsx renders a duplicate canonical "Noise floor" caption
  // whenever the resolved label differs from that exact string.
  assert.equal(EN['kpi.noiseFloor.label'], 'Noise floor');
});

test('sanity: catalog is substantial (this task is primarily about building it out)', () => {
  assert.ok(Object.keys(ZH_TW).length >= 100, 'expected a large string catalog per the task scope');
});
