# Server path and verification overrides

These server facts override local absolute paths in the shared writer prompts:

- Repository root: `/home/sat/leo-beam-sim`
- Exact template: `/home/sat/pptx-wrap/assets/templates/educate.pptx`
- pptx-wrap skill: `/home/sat/pptx-wrap/SKILL.md`
- pptx host skill: `/home/sat/.codex/skills/pptx/SKILL.md`
- Read-only LoRaEnergySim package reference: `/home/sat/lora-energy-lab-reference`
- Approved V2 preview and source: under `/home/sat/leo-beam-sim/courseware/c120-lora-leo-deck/alt-skill-deck/`

Do not use any `/home/u24/...` path on the server. Resolve every such reference through this table.

The server currently has no LibreOffice executable. Build the editable PPTX, run ZIP/relationship/recursive XML/font/notes/forbidden-language checks, and render only if an available installed renderer is discovered without installing software. Record visual rendering and Microsoft PowerPoint reopen as deferred to the controller environment; do not claim them as passed.

All work remains non-heavy presentation implementation. Do not commit or push. Do not modify existing dirty source files outside the task-owned `alt-skill-deck` lane.

