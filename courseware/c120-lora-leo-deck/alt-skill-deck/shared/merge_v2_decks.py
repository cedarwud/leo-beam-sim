#!/usr/bin/env python3
"""Merge every validated V2 authoring lane into the editable review deck.

The V2 build intentionally keeps the eleven opening pages and every logical
split page (for example P021a/P021b/P021c).  No appendix-priority truncation is
applied.  All source decks inherit the same educate template and layout 2.
"""

from __future__ import annotations

import json
from pathlib import Path

from merge_decks import Merger, count_slides


ROOT = Path(__file__).resolve().parents[1]
LATEST_ROOT = ROOT / "latest"
LATEST_ROOT.mkdir(parents=True, exist_ok=True)
OUTPUT = LATEST_ROOT / "LoRaEnergySim-LEO-ALT-REVIEW.pptx"
REPORT = ROOT / "shared" / "merge-v2-report.json"

INPUTS = [
    ("Part A V2 P001-P008", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pptx"),
    ("Part A V2 P009-P018", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-PART-A-V2-P009-P018-REVIEW.pptx"),
    ("Part A V2 P019-P027b", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-PART-A-V2-P019-P027B-REVIEW.pptx"),
    ("Part B V2 P028-P045", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-PART-B-V2-P028-P045-REVIEW.pptx"),
    ("Part B V2 P046-P063", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-PART-B-V2-P046-P063-REVIEW.pptx"),
    ("Part C V2 P064-P080", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-PART-C-V2-P064-P080-REVIEW.pptx"),
    ("Part C V2 P081-P097", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW.pptx"),
    ("Appendix V2 P098-P107", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-APPENDIX-V2-P098-P107-REVIEW.pptx"),
    ("Appendix V2 P108-P116", LATEST_ROOT / "LoRaEnergySim-LEO-ALT-APPENDIX-V2-P108-P116-REVIEW.pptx"),
]


def main() -> None:
    missing = [str(path) for _, path in INPUTS if not path.is_file()]
    if missing:
        raise FileNotFoundError("missing V2 review deck(s): " + ", ".join(missing))

    counts = {label: count_slides(path) for label, path in INPUTS}
    base_label, base_path = INPUTS[0]
    merger = Merger(base_path)
    merger.source_records = [
        {"final_slide": index, "source_deck": base_label, "source_slide": index}
        for index in range(1, counts[base_label] + 1)
    ]
    for label, path in INPUTS[1:]:
        merger.append_deck(path, label=label)
    merger.finish(OUTPUT)

    REPORT.write_text(
        json.dumps(
            {
                "status": "MERGED_V2_REVIEW_PENDING_FINAL_QA",
                "output": str(OUTPUT),
                "input_counts": counts,
                "final_slide_count": merger.slide_count(),
                "source_map": merger.source_records,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
