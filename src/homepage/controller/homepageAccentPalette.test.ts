import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOMEPAGE_PRIMARY_UE_MARKER_COLOR,
  HOMEPAGE_PRIMARY_UE_MARKER_EMISSIVE,
} from './homepageAccentPalette';

test('homepage protagonist accent is not a red fallback', () => {
  assert.equal(
    /#(?:ff3333|ff1111|ff0000|f00)/i.test(
      `${HOMEPAGE_PRIMARY_UE_MARKER_COLOR}${HOMEPAGE_PRIMARY_UE_MARKER_EMISSIVE}`,
    ),
    false,
  );
});
