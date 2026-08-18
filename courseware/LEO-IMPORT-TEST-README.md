# Leo import test artifacts

## Fresh run that currently imports successfully

- Upload file: `leo-import-test-fresh-run-A-baseline-site-compatible.json`
- Paired replay: `leo-import-test-fresh-run-A-baseline-site-compatible-endpoint-replay.json`
- Browser evidence: `leo-import-test-fresh-run-A-baseline-site-compatible-browser-pass.yml`
- Result file SHA-256: `c1ffd950dc125dead19dfc807d2b4c77e8be31e4bee3b30d29d960c2c55d0b6e`
- Run ID: `sha256:b7917abc4e57e236b69dc8f8ecd45f5111b47da4efe5cfeb9a893b840d413000`
- Provenance: `artifact_source: student-run`

This result was produced on the Ubuntu server from a clean temporary copy of
the runner currently bundled by the public `/course` application. Setup used
Python 3.11.15 and returned `READY`; the exact run command was:

```sh
bash course.sh run --lab A --case baseline
```

The result was then uploaded to
`http://120.126.151.102:4191/course?view=lab-a` and the browser reported:

```text
已完整匯入 A/baseline
```

## Fresh run from the renamed current package

- Result: `lora-energy-lab-fresh-run-A-baseline-result.json`
- Paired replay: `lora-energy-lab-fresh-run-A-baseline-endpoint-replay.json`
- Provenance: `artifact_source: student-run`
- Run ID: `sha256:e0c3827c2a2479962e5a97aa6f86b00ad1795634f951a2c02a6aa57007bb3bf4`

This is also a real fresh execution of the deterministic software, but the
current public importer rejects its newer schema at
`$.scenario_anchor_sha256`. It is retained to reproduce the compatibility
gap.

## Claim boundary

Both fresh runs are software-generated deterministic simulated teaching data.
They are not live network data and not device measurements.
