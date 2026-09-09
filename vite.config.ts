import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
function showcaseArtifactStaticServer(): Plugin {
  return {
    name: 'leo-beam-sim:showcase-artifact-static-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url === '/showcase-artifacts/visual-showcase-v1.json') {
          // FIX-2 (render-truth): the pinned producer artifact is the real 89s
          // baseline MODQN multi-UE replay regenerated 2026-06-03 via
          // `modqn-export --replay-slot-count 90` + `modqn-visual-showcase`
          // (ntn-sim-core validate:visual-showcase:artifact OK, 4 sats / 100 UEs
          // / 90 frames, evidenceStatus=baseline). The earlier phase-01h-mp5
          // path was only a 10s CLI smoke and never satisfied the 60-120s
          // visual-showcase-v1 window contract.
          const filePath = '/home/u24/papers/modqn-paper-reproduction/artifacts/visual-showcase-v1-baseline-89s-2026-06-03/visual-showcase-v1.json';
          fs.stat(filePath, (err, stat) => {
            if (!err && stat.isFile()) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store');
              res.setHeader('X-Showcase-Artifact-Source', 'producer-pinned');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
            // The pinned producer artifact is absent in this checkout. Fall back
            // to the repo-local loader so `npm run dev` can still show the
            // artifact-replay dashboard/flowchart. The loader may resolve a REAL
            // external artifact (VISUAL_SHOWCASE_ARTIFACT_PATH) or the synthetic
            // validator fixture, so derive the FIX-1 honesty header from the
            // loader's resolved source instead of hardcoding it — otherwise the
            // header would lie about an env-provided / regenerated real artifact
            // and the consumer badge would wrongly call it synthetic. Only the
            // canonical pinned path earns 'producer-pinned'; any other operator
            // override is surfaced as a non-pinned external source (§3 says an
            // unvalidated external artifact must not silently pass as proof).
            server
              .ssrLoadModule('/scripts/visualShowcaseValidatorFixture.ts')
              .then(mod => {
                const { artifact, source } = (mod as {
                  loadValidatorVisualShowcaseArtifact: () => {
                    artifact: unknown;
                    source: { kind: 'external' | 'synthetic'; isPinnedTrigger: boolean };
                  };
                }).loadValidatorVisualShowcaseArtifact();
                const artifactSourceHeader =
                  source.kind === 'synthetic'
                    ? 'synthetic-fixture-fallback'
                    : source.isPinnedTrigger
                      ? 'producer-pinned'
                      : 'external-artifact-path';
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('X-Showcase-Artifact-Source', artifactSourceHeader);
                res.end(JSON.stringify(artifact));
              })
              .catch((fallbackError: unknown) => {
                res.statusCode = 404;
                res.end(`Showcase artifact not found; synthetic fallback failed: ${String(fallbackError)}`);
              });
          });
          return;
        }

        return next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), showcaseArtifactStaticServer()],
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
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Split ONLY the framework-agnostic three.js engine (the heaviest dep,
          // imports no React). The React render stack (react/react-dom/scheduler)
          // and its R3F bindings (@react-three/fiber + drei, which read React
          // internals like useLayoutEffect at module-init) MUST stay together in
          // one chunk — splitting React away from its consumers caused a cross-
          // chunk init race ("Cannot read properties of undefined (useLayoutEffect)")
          // that crashed the prod build while dev (unbundled) worked.
          if (id.includes('/three/')) {
            return 'vendor-three';
          }
          return 'vendor';
        },
      },
    },
  },
});
