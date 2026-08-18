# C-120 V2 server authoring kit

This directory carries the approved visual method to the Ubuntu presentation server.

Authoritative references remain in the synchronized repository. The approved visual checkpoint is:

`courseware/c120-lora-leo-deck/alt-skill-deck/LoRaEnergySim-LEO-ALT-PART-A-V2-PREVIEW.pptx`

The corresponding editable builder is:

`courseware/c120-lora-leo-deck/alt-skill-deck/part-a-v2/build_preview.py`

Server path differences and the deferred-render boundary are recorded in `SERVER-OVERRIDES.md`. The `launch-prompts/` files route seven non-overlapping writers. `dispatch_tmux.sh` creates the controller-owned tmux session `pptx` and one window per writer.

The server produces independent root-level PPTX chunks and owned source/QA directories. Final LibreOffice rendering, Microsoft PowerPoint reopen acceptance, and deck merging return to the current presentation environment.

