import assert from 'node:assert/strict';
import {
  formatCompactNumber,
  formatEnergy,
  formatEnergyEfficiency,
  formatEngineering,
  formatFrequency,
  formatPower,
  formatRate,
  formatWithUnit,
} from './formatters';

assert.equal(formatPower(2), '2 W');
assert.equal(formatPower(0.001), '1 mW');
assert.equal(formatPower(0.000001), '1 µW');
assert.equal(formatPower(1_000), '1 kW');
assert.equal(formatPower(1_000_000), '1 MW');
assert.equal(formatPower(999.6), '1 kW');
assert.equal(formatRate(100_000), '100 kbit/s');
assert.equal(formatFrequency(1_000_000), '1 MHz');
assert.equal(formatEnergy(0.0000025), '2.5 µJ');
assert.equal(formatEnergyEfficiency(12_345), '12.3 kbit/J');
assert.equal(formatCompactNumber(1e-8, 'linear'), '1 × 10⁻⁸ linear');
assert.equal(formatCompactNumber(999_999, 'ratio'), '1 × 10⁶ ratio');
assert.equal(formatCompactNumber(1.2345, 'ratio', 4), '1.235 ratio');
assert.equal(formatWithUnit(Number.NaN, 'W'), '—');
assert.equal(formatEngineering(null, 'W'), '—');

for (const output of [
  formatPower(1e-9),
  formatRate(1e9),
  formatEnergy(1e-6),
  formatCompactNumber(1e-8, 'linear'),
]) {
  assert.doesNotMatch(output, /e[+-]?\d/i, `unexpected JavaScript exponent notation: ${output}`);
}

console.log('signal-tuning unit formatters use engineering prefixes and typographic exponents.');
