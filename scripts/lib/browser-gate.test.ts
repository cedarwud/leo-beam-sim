import assert from 'node:assert/strict';

import { isAppBootstrapHtml } from './browser-gate.ts';

const appHtml = `<!DOCTYPE html>
<html><head><title>LEO Beam Sim</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;

assert.equal(isAppBootstrapHtml(appHtml), true, 'the real app bootstrap must be accepted');
assert.equal(isAppBootstrapHtml('<html><body></body></html>'), false, 'a blank page must be rejected');
assert.equal(
  isAppBootstrapHtml('<html><head><title>LEO Beam Sim</title></head><body><div id="root"></div><h1>Server error</h1></body></html>'),
  false,
  'an error page with a copied title must be rejected',
);

console.log('browser-gate bootstrap contract test passed');
