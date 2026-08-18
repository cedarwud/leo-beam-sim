# Scientific explanation UI prototype

Question: can one lightweight front-end page make the relationship among
off-axis geometry, requested/actual RF power, throughput, system power, and
instantaneous EE visually understandable before canonical runtime integration?

Completion criterion: `/prototype/scientific-explain` opens without data
loading; changing `theta`, `R_min`, or the RF cap immediately updates the
central scene, the visible causal chain, and the result ledger while the page
remains explicitly labelled as illustrative non-canonical demo data.

Mutation boundary:

- `src/main.tsx`
- `src/prototype/scientific-explain/ScientificExplainPrototype.tsx`
- `src/prototype/scientific-explain/ScientificExplainPrototype.scss`
- this specification

Stop after the isolated demo route builds and renders. Do not connect TLE,
canonical EE, handover traces, persistence, backend services, or homepage
navigation.
