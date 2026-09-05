import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ANGLE_AWARE_BEAM_POWER_CAP_W, ANGLE_AWARE_SEGMENT_START_POWER_W } from './angle-aware-ee';
import { loadProfile } from '../../profiles';

/**
 * Authoritative values for the two power models, asserted as LITERALS.
 *
 * Every other test of these constants imports them and asserts derived
 * behaviour, which is correct for protecting the maths but means a change to
 * the constant itself moves the expectation with it and nothing fails. That
 * gap is not hypothetical here: routing the candidate SINR admission gate
 * through the angle-aware power model instead of the profile-rated one made
 * `sinr{pass=0, fail=91074}` over a 10-minute window -- no candidate was ever
 * admissible and the EE handover authority could not fire at all -- and no
 * check anywhere went red (fixed in d558881).
 *
 * The two numbers below are ~17.8 dB apart. That distance is the whole reason
 * the confusion was catastrophic rather than cosmetic, so it is asserted too.
 */
const AUTHORITATIVE_ANGLE_AWARE_BEAM_POWER_CAP_W = 1.65;
const AUTHORITATIVE_PROFILE_MAX_TX_POWER_DBM = 50;

test('the angle-aware EE power cap is 1.65 W, asserted independently of the constant', () => {
  assert.equal(ANGLE_AWARE_BEAM_POWER_CAP_W, AUTHORITATIVE_ANGLE_AWARE_BEAM_POWER_CAP_W);
  assert.equal(ANGLE_AWARE_SEGMENT_START_POWER_W, AUTHORITATIVE_ANGLE_AWARE_BEAM_POWER_CAP_W / 2);
});

test('the profile RF rating is 50 dBm, and the two power models stay ~17.8 dB apart', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  assert.equal(profile.channel.maxTxPowerDbm, AUTHORITATIVE_PROFILE_MAX_TX_POWER_DBM);

  const angleAwareDbm = 10 * Math.log10(AUTHORITATIVE_ANGLE_AWARE_BEAM_POWER_CAP_W * 1000);
  const gapDb = AUTHORITATIVE_PROFILE_MAX_TX_POWER_DBM - angleAwareDbm;
  assert.ok(
    gapDb > 17 && gapDb < 18.5,
    `the EE counterfactual sits ${gapDb.toFixed(2)} dB under the rated power; if this gap has moved, `
    + 'the reasoning in d558881 about why feeding it to the admission gate was catastrophic needs re-checking',
  );
});

test('the angle-aware model is an EE counterfactual, not an RF rating', () => {
  // Stated as an executable fact because the confusion between the two is what
  // the regression was. The cap is far below any real transmit rating; if it
  // ever approaches one, someone has changed what this constant means.
  assert.ok(
    ANGLE_AWARE_BEAM_POWER_CAP_W < 10,
    'a beam power cap in the tens of watts would no longer be a Joules-per-bit accounting figure',
  );
});
