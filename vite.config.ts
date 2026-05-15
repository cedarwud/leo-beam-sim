import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// MODQN ω-Handover S2 — dev-server static-file middleware that serves the
// producer's frozen replay bundle (a 1-satellite 7-beam MODQN artifact) from
// its absolute filesystem location to the browser via
// `/modqn-bundles/<basename>/...`. This is the runtime-fetch path that
// replaces the in-bundle hard-coded MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL
// shell model in App.tsx. See docs/modqn-omega-handover-sdd.md §9.3.
//
// Boundary: bundle bytes are immutable per CLAUDE.md §3. The middleware
// streams files read-only; it never writes.
const MODQN_BUNDLE_FS_PATH =
  '/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1';
const MODQN_BUNDLE_ROUTE_PREFIX = '/modqn-bundles/';

function modqnBundleStaticServer(): Plugin {
  return {
    name: 'leo-beam-sim:modqn-bundle-static-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(MODQN_BUNDLE_ROUTE_PREFIX)) return next();
        const remainder = url.slice(MODQN_BUNDLE_ROUTE_PREFIX.length);
        const slash = remainder.indexOf('/');
        if (slash === -1) return next();
        const basename = remainder.slice(0, slash);
        const relative = remainder.slice(slash + 1).split('?')[0] ?? '';
        const expectedBasename = path.basename(MODQN_BUNDLE_FS_PATH);
        if (basename !== expectedBasename) {
          res.statusCode = 404;
          res.end(`Unknown MODQN bundle basename: ${basename}`);
          return;
        }
        if (relative.includes('..')) {
          res.statusCode = 400;
          res.end('Path traversal not allowed');
          return;
        }
        const filePath = path.join(MODQN_BUNDLE_FS_PATH, relative);
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) {
            res.statusCode = 404;
            res.end(`MODQN bundle surface not found: ${relative}`);
            return;
          }
          const contentType = relative.endsWith('.json')
            ? 'application/json'
            : relative.endsWith('.jsonl')
              ? 'application/x-ndjson'
              : 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'no-store');
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), modqnBundleStaticServer()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
