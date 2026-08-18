import assert from 'node:assert/strict';
import { getVisualLabClipContainRect } from './visualLabClipCompositor';

function assertClose(actual: number, expected: number, message: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);
}

// A 16:9 source is contained in the 1280x500 scene viewport.  Its height
// fills the viewport and the remaining horizontal space becomes symmetric
// letterbox padding rather than a horizontal stretch.
{
  const rect = getVisualLabClipContainRect(1920, 1080, 0, 82, 1280, 500);
  assertClose(rect.width, 8000 / 9, 'contained width');
  assertClose(rect.height, 500, 'contained height');
  assertClose(rect.x, 1760 / 9, 'left letterbox');
  assertClose(rect.y, 82, 'top coordinate');
}

// A portrait source is contained by width and remains centered vertically.
{
  const rect = getVisualLabClipContainRect(600, 900, 10, 20, 1280, 500);
  assertClose(rect.x, 483.3333333333333, 'portrait left coordinate');
  assertClose(rect.y, 20, 'portrait top coordinate');
  assertClose(rect.width, 333.3333333333333, 'portrait width');
  assertClose(rect.height, 500, 'portrait height');
}

// Invalid dimensions fail before drawImage can produce a distorted or empty
// frame, keeping the output contract explicit for callers.
assert.throws(
  () => getVisualLabClipContainRect(0, 1080, 0, 0, 1280, 500),
  /source canvas dimensions must be finite and positive/,
);

console.log('visual-lab clip compositor geometry tests passed');
