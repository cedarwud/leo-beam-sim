Read `courseware/c120-lora-leo-deck/alt-skill-deck/dispatch-prompts/COMMON-V2-WRITER.md` completely and follow it.

Ownership:

- `courseware/c120-lora-leo-deck/alt-skill-deck/opening-v2/**`
- `courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-OPENING-V2-REVIEW.pptx`

Build a 10-12 slide visual-first course opening that appears before P001. This is an explanatory entry point, not a replacement for Part A authority pages. It must make the following immediately clear:

1. What LoRaEnergySim + Leo is: a packaged endpoint energy/service teaching simulator with a changing-service-window example, not a full satellite backend or digital twin.
2. What the package already implements: fixed scenarios, cross-platform setup/verify, package-local venv contract, bounded `student_policy.py`, deterministic runner, result artifact, replay, service and endpoint-energy evidence, identity gates, fallback, and claim ceilings.
3. What the experiments are for: change one policy mechanism, predict causal effects, run fixed evidence, and explain state/packet/service/endpoint-energy differences; not a KPI contest.
4. The complete workflow: obtain package -> setup/verify -> inspect observation -> edit marked block -> exact run -> locate `result.json` -> upload to `/course` -> replay -> compare -> save workbook.
5. What `student_policy.py` receives and returns; show a readable editable code-anatomy page that explains observation input, bounded constants/branches, and action output.
6. Precisely what can and cannot be edited.
7. How an exact run produces artifacts, with platform-correct commands split across pages if necessary.
8. How to upload `result.json` to `http://120.126.151.102:3000/course`.
9. What the website does: validates/imports, displays endpoint evidence, provides replay/ledger/workbook; it does not execute the Python runner and does not provide full-system energy.
10. How to interpret service first, then packet/state mechanism, then endpoint J/bit per J, while respecting simulated/non-live/non-measured boundaries.

Use source truth from the current checkout, the package README under `/home/u24/lora-energy-lab`, and handoff authorities. Use current `/course` screenshots when they directly support the page; otherwise use editable diagrams. Do not invent current UI or commands.
