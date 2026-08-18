# S3 direct route and clean-first-frame receipt

Status: **PASS**  
Base HEAD: `61d68ccd0cf8bf2315c114bced2739b80981dcea`  
Route: `http://127.0.0.1:3000/explain`

## Delivered boundary

- `/explain` is a direct-only lazy route; no homepage or simulator navigation entry was added.
- The first frame contains only a neutral stage, one verified-source token, the accepted entry question, and one affordance.
- Catalog, snapshot, TLE SHA, completed geometry-run identity, analysis frames, and the complete scientific evidence resolver must all pass before the source is labeled or values are shown.
- Pending and refused states use a generic unverified source label. Refusal shows neither stale values nor a synthetic fallback.
- Evidence, lesson, presentation, and capture state remain separate. Any future checkpoint key is constrained to `leo-beam-sim:/explain/:`.
- The reveal is the bounded `angle-response-teaching-v1 / a1-orient` entry action; S4 spatial method-chain rendering is not claimed.

## Verification

Passed on current bytes:

```bash
npm run test:explain
npm run lint
npm run build
```

Fresh browser validation on port `3000` confirmed:

- normal load reaches `data-evidence-state="available"`;
- the clean first frame and accepted evidence ledger render without browser errors or warnings;
- three consecutive reloads each reached `available`;
- a forced catalog HTTP 503 reached `refused`, leaked no `ONEWEB` label or accepted date, showed no old values, and recovered to `available` after the route was removed;
- `/` remains isolated because `App.tsx` contains no `/explain` route or navigation entry.

Current visual artifact:

- `.playwright-cli/page-2026-08-14T14-38-30-412Z.png`

The only normal-console message is the React DevTools informational notice. The production build retains the pre-existing large-chunk warning; it is not introduced by this route.

## Review

- Fresh-context S3 route/code review: **PASS**.
- Fresh-browser desktop and `390 × 844` responsive review: **PASS**.
- Primary-controller port-`3000` available/refusal/recovery replay: **PASS**.

No commit or push was performed.
