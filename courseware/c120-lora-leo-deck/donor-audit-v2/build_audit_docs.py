#!/usr/bin/env python3
"""Build the owner-facing donor triage documents from the extracted inventory."""

from __future__ import annotations

import csv
import difflib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INVENTORY = json.loads((ROOT / "slide-inventory.json").read_text(encoding="utf-8"))
DECKS = {deck["deck_id"]: deck for deck in INVENTORY["decks"] if "slides" in deck}
E2 = {slide["slide_no"]: slide for slide in DECKS["e2"]["slides"]}
DELIVERY = {slide["slide_no"]: slide for slide in DECKS["delivery-variant"]["slides"]}


DUPLICATE_GROUPS = {
    7: "DUP-TLE-07-98",
    98: "DUP-TLE-07-98",
    16: "DUP-POWER-16-17",
    17: "DUP-POWER-16-17",
    45: "DUP-T1-45-46",
    46: "DUP-T1-45-46",
    54: "DUP-T2-54-55",
    55: "DUP-T2-54-55",
    57: "DUP-T2-57-58",
    58: "DUP-T2-57-58",
    64: "DUP-T3-64-65",
    65: "DUP-T3-64-65",
    67: "DUP-T3-67-68",
    68: "DUP-T3-67-68",
    78: "DUP-T4-78-80",
    79: "DUP-T4-78-80",
    80: "DUP-T4-78-80",
    83: "DUP-T5-83-86",
    84: "DUP-T5-83-86",
    85: "DUP-T5-83-86",
    86: "DUP-T5-83-86",
    92: "DUP-T6-92-95",
    93: "DUP-T6-92-95",
    94: "DUP-T6-92-95",
    95: "DUP-T6-92-95",
}


def ranges(values: list[int]) -> str:
    values = sorted(values)
    if not values:
        return "—"
    chunks: list[str] = []
    start = previous = values[0]
    for value in values[1:]:
        if value == previous + 1:
            previous = value
            continue
        chunks.append(f"{start}–{previous}" if start != previous else str(start))
        start = previous = value
    chunks.append(f"{start}–{previous}" if start != previous else str(start))
    return ", ".join(chunks)


def base_decision(slide_no: int) -> tuple[str, str, str]:
    """Return disposition, reason, and proposed target role for e2 content."""
    if slide_no == 1:
        return (
            "RETIRE",
            "Satellite-first title cannot open the C120 smart-energy/IoT story; replace from zero.",
            "C120 opening slide: endpoint energy decision and course promise",
        )
    if slide_no == 2:
        return (
            "ADOPT",
            "Useful causal opener: service outcome changes as the link changes; rewrite around endpoint packet and energy consequences.",
            "Core 1–5: why endpoint sleep/process/TX/RX and delivery are energy decisions",
        )
    if slide_no == 3:
        return (
            "RETIRE",
            "Payload/platform specialist framing delays the IoT energy question; rewrite the bridge from endpoint state to observable evidence.",
            "C120 opening bridge, rebuilt without satellite-specialist framing",
        )
    if slide_no in (4, 5, 6):
        return (
            "ADOPT",
            "Changing-window and visibility diagrams provide a compact service example; relabel LEO as one example and connect the window to endpoint policy.",
            "Core 6–8: changing service window, transfer to IoT, and course route",
        )
    if slide_no in (7, 8, 9, 10):
        return (
            "APPENDIX",
            "TLE/SGP4/TEME provenance is optional source deepening; keep one concept per page and never require the derivation.",
            "Appendix APP-10–APP-12: selected TLE/SGP4/source lineage",
        )
    if slide_no == 11:
        return (
            "RETIRE",
            "Margin plot is a specialist handover explanation and repeats the service-window story; retain only a newly written policy counterexample if needed.",
            "Contingency counterexample: slow switching, rebuilt around policy evidence",
        )
    if slide_no == 12:
        return (
            "ADOPT",
            "The slow-switch versus ping-pong comparison is a useful falsifiable counterexample; replace legacy controls with current policy actions and results.",
            "Core 6–8 or contingency: service-window policy counterexample",
        )
    if slide_no in (13, 15):
        return (
            "APPENDIX",
            "SINR and dB vocabulary can support optional interpretation, but it is not the endpoint-energy learning core.",
            "Appendix APP-13–APP-15: optional quality/SINR/dB vocabulary",
        )
    if slide_no == 14:
        return (
            "ADOPT",
            "Separates throughput, power, and energy; rewrite units and examples for endpoint service and energy rather than legacy system EE.",
            "Core 17–21: model bridge from packet/service outcome to endpoint energy",
        )
    if slide_no == 16:
        return (
            "ADOPT",
            "Causal chain from delivered data through SINR and RF output to power and energy is useful; merge the duplicate 17 concept and replace values.",
            "Core 17–21: state/data → policy → service → power × time → energy",
        )
    if slide_no == 17:
        return (
            "RETIRE",
            "Near-duplicate of page 16; retain no separate page after the causal chain is rewritten for endpoint energy.",
            "Merged into Core 17–21 concept; no standalone page",
        )
    if slide_no == 18:
        return (
            "RETIRE",
            "Satellite geometry scene repeats the service-window topic without current runner evidence; rebuild only if a current scenario screenshot exists.",
            "C120 route visuals generated from the current scenario, not donor art",
        )
    if slide_no in (19, 20, 21):
        return (
            "ADOPT",
            "Same-window A/B, service reaction, and W→J accounting boundary form a useful evidence loop; rewrite around the bounded policy and endpoint ledger.",
            "Core 17–21: controlled comparison and endpoint energy accounting",
        )
    if 22 <= slide_no <= 35:
        return (
            "APPENDIX",
            "RF, PA, angle, system-boundary, and source-detail derivations are optional reference material; preserve at most one concept per page.",
            "Appendix APP-07–APP-15: selected units, quality, angle, and boundary detail",
        )
    if 36 <= slide_no <= 39:
        return (
            "ADOPT",
            "Fair A/B and control → intermediate state → observable evidence is directly reusable; replace old browser controls and screenshots with current policy runs.",
            "Core Labs A–C: fair baseline, candidate edit, prediction, evidence, debrief",
        )
    if 40 <= slide_no <= 69:
        return (
            "RETIRE",
            "Old T1–T3 buttons, observation tables, producer states, and session semantics are not the C120 runner/import contract.",
            "No target role; rebuild required with current runner and policy artifacts",
        )
    if 70 <= slide_no <= 75:
        return (
            "ADOPT",
            "Evidence qualification, accumulated quantities, and validity gates support the evidence clinic; rewrite all labels and data around endpoint replay.",
            "Core 63–66: evidence clinic and bounded claim interpretation",
        )
    if 76 <= slide_no <= 95:
        return (
            "RETIRE",
            "Old T4–T6 operations and legacy Run EE tables are not current C120 semantics and can relabel or overclaim energy evidence.",
            "No target role; replace with current Lab C and endpoint/system boundary",
        )
    if slide_no in (96, 97):
        return (
            "ADOPT",
            "Claim boundary and evidence-record structure are useful; rewrite to the current simulated endpoint-energy claim ceiling and provenance fields.",
            "Core 63–66: claim boundary, artifact record, and interpretation",
        )
    if 98 <= slide_no <= 110:
        return (
            "APPENDIX",
            "TLE/OMM/SGP4/TEME source detail is provenance deepening only; merge the alternate opening and keep the satellite example subordinate.",
            "Appendix APP-10–APP-12: selected TLE/SGP4/source lineage",
        )
    if slide_no in (111, 112):
        return (
            "APPENDIX",
            "Angle/SINR/PA detail may support instructor vocabulary, but must not become required derivation or core LEO instruction.",
            "Appendix APP-13–APP-15: optional quality and power vocabulary",
        )
    if slide_no == 113:
        return (
            "ADOPT",
            "Measured/derived/assumed/simulated classification protects the claim ceiling; rewrite it for the current endpoint artifact and source lineage.",
            "Core 63–66 or APP-16–APP-18: claim classification and provenance",
        )
    if slide_no == 114:
        return (
            "APPENDIX",
            "Source index is useful as a citation handoff, but every entry must be refreshed for the pinned course package and current claims.",
            "Appendix APP-16–APP-18: citations, licenses, glossary, claim classification",
        )
    raise AssertionError(slide_no)


def peer_rows() -> dict[int, dict[str, object]]:
    result: dict[int, dict[str, object]] = {}
    for slide_no in range(1, 115):
        left = E2[slide_no]
        right = DELIVERY[slide_no]
        text_similarity = difflib.SequenceMatcher(
            None, left["normalized_text"], right["normalized_text"]
        ).ratio()
        result[slide_no] = {
            "text_similarity": round(text_similarity, 4),
            "exact_visible": left["visible_text_sha256"] == right["visible_text_sha256"],
            "exact_normalized": left["normalized_text_sha256"] == right["normalized_text_sha256"],
            "exact_xml": left["slide_xml_sha256"] == right["slide_xml_sha256"],
        }
    return result


PEERS = peer_rows()


def cluster(slide_no: int) -> str:
    return DUPLICATE_GROUPS.get(slide_no, f"PAIR-S{slide_no:03d}")


def visual_evidence(slide_no: int) -> str:
    peer = PEERS[slide_no]
    if peer["exact_xml"]:
        return "EXACT_TEXT_AND_XML_HASH + rendered contact-sheet review"
    if slide_no in DUPLICATE_GROUPS:
        return (
            f"SEMANTIC_DUP_REVIEW + rendered contact-sheet review; peer visible-text similarity "
            f"{peer['text_similarity']:.4f}"
        )
    return (
        f"CORRESPONDING_PAGE_REVIEW + rendered contact-sheet review; peer visible-text similarity "
        f"{peer['text_similarity']:.4f}"
    )


def make_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for deck_id, slides in (("e2", E2), ("delivery-variant", DELIVERY)):
        for slide_no in range(1, 115):
            slide = slides[slide_no]
            disposition, reason, target_role = base_decision(slide_no)
            if deck_id == "delivery-variant":
                if disposition == "ADOPT":
                    disposition = "APPENDIX"
                    reason = (
                        "Delivery variant is visual/provenance comparison only; e2 owns the content/notes adoption. "
                        + reason
                    )
                    target_role = "Visual comparison reference only; " + target_role
                elif disposition == "APPENDIX":
                    reason = (
                        "Delivery variant has no speaker notes and is visual/provenance comparison only; "
                        + reason
                    )
                    target_role = "Visual comparison reference only; " + target_role
                else:
                    reason = "Delivery variant is not an independent content source; " + reason
            peer = PEERS[slide_no]
            rows.append(
                {
                    "source_deck": deck_id,
                    "source_path": slide["source_path"],
                    "source_sha256": slide["source_sha256"],
                    "source_page": slide_no,
                    "title": slide["title"],
                    "duplicate_cluster": cluster(slide_no),
                    "disposition": disposition,
                    "concrete_reason": reason,
                    "evidence_status": (
                        f"{visual_evidence(slide_no)}; "
                        + ("notes present" if slide["notes_nonempty"] else "no speaker notes")
                    ),
                    "proposed_target_chapter_page_role": target_role,
                    "peer_page": slide_no,
                    "peer_text_similarity": peer["text_similarity"],
                    "peer_exact_visible_text_hash": peer["exact_visible"],
                    "peer_exact_normalized_text_hash": peer["exact_normalized"],
                    "peer_exact_slide_xml_hash": peer["exact_xml"],
                    "visible_text_sha256": slide["visible_text_sha256"],
                    "normalized_text_sha256": slide["normalized_text_sha256"],
                    "notes_sha256": slide["notes_sha256"] or "",
                    "media_count": slide["media_count"],
                    "layout_name": slide["layout"]["name"],
                }
            )
    return rows


def write_dedup_table(rows: list[dict[str, object]]) -> None:
    path = ROOT / "dedup-table.csv"
    fields = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def inventory_md() -> str:
    e2 = DECKS["e2"]
    delivery = DECKS["delivery-variant"]
    all_slides = [slide for deck in DECKS.values() for slide in deck["slides"]]
    exact_pairs = sum(1 for n in PEERS.values() if n["exact_visible"])
    exact_xml_pairs = sum(1 for n in PEERS.values() if n["exact_xml"])
    high_similarity = sum(1 for n in PEERS.values() if n["text_similarity"] >= 0.99)
    low_similarity = min(n["text_similarity"] for n in PEERS.values())
    e2_media = sum(slide["media_count"] for slide in e2["slides"])
    delivery_media = sum(slide["media_count"] for slide in delivery["slides"])
    return f"""# BeamShift donor audit v2

Status: `READ-ONLY AUDIT COMPLETE / SOURCE DECKS UNMODIFIED`

## Scope and authority

This audit covers exactly two named BeamShift donors and writes only this
`donor-audit-v2/` directory. The C120 authority is separate from donor
evidence: `docs/decisions/ADR-004-c120-course-packaged-loraenergysim-leo.md`,
`docs/sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md`, and
`docs/handoff/C120-LORA-LEO-NEXT-CONTROLLER-2026-08-10.md`. They define
LoRaEnergySim as the direct smart-energy/IoT teaching core and LEO as a
changing-service-window example only. Donor pages do not override that
boundary, the endpoint/system energy split, the current runner contract, or the
claim ceiling.

## Exact source provenance

| Donor ID | Exact path | Bytes | SHA-256 | Slides | Notes | Layout | Source role |
|---|---|---:|---|---:|---:|---|---|
| `e2` | `{e2['source_path']}` | {e2['source_bytes']:,} | `{e2['source_sha256']}` | {e2['slide_count']} | {e2['notes_nonempty_count']}/{e2['slide_count']} non-empty | {e2['slide_width_inches']} × {e2['slide_height_inches']} in, 16:9 | content and notes donor |
| `delivery-variant` | `{delivery['source_path']}` | {delivery['source_bytes']:,} | `{delivery['source_sha256']}` | {delivery['slide_count']} | {delivery['notes_nonempty_count']}/{delivery['slide_count']} non-empty | {delivery['slide_width_inches']} × {delivery['slide_height_inches']} in, 16:9 | visual/provenance comparison only |

The second path exists and is readable. No missing-source placeholder is
needed. The exact file hashes above are from `sha256sum`; slide counts and
notes/layout counts are from OOXML extraction.

## Extracted evidence

`slide-inventory.json` is the loss-minimizing per-page record. Each page has:

- title and body text in shape order;
- the actual notes-body text (not image/slide-number placeholders), notes hash,
  and notes-presence flag;
- visible-text and normalized-text SHA-256 hashes;
- direct `ppt/slides/slideN.xml` and relationship hashes;
- layout name/type, layout/master part names, slide dimensions, shape counts,
  shape type counts, text boxes, tables, positions, and text hashes;
- embedded PNG media relationship names, content types, byte sizes, and media
  SHA-256 values.

`slide-inventory.csv` is the flattened title/body/notes/layout/media view.
`dedup-candidates.csv` retains exact and high-similarity cross-page candidates.

Re-derived counts:

| Evidence | `e2` | delivery variant |
|---|---:|---:|
| non-empty speaker notes | {e2['notes_nonempty_count']}/{e2['slide_count']} | {delivery['notes_nonempty_count']}/{delivery['slide_count']} |
| slides containing embedded PNG relationships | {sum(slide['media_count'] > 0 for slide in e2['slides'])} | {sum(slide['media_count'] > 0 for slide in delivery['slides'])} |
| embedded PNG relationship count | {e2_media} | {delivery_media} |
| unique direct slide XML hashes | {e2['slide_xml_hashes_unique']} | {delivery['slide_xml_hashes_unique']} |

## Rendering and visual review

Both decks converted successfully to 114-page PDFs with the PPTX skill's
LibreOffice helper. PDF page size was `960.009 × 540 pt`; renders were made at
96 dpi (1281 × 720 pixels, as rounded by Poppler) with `pdftoppm`. The complete per-page PNG renders
are under `renders/e2/` and `renders/delivery/`; PDF intermediates are under
`renders/e2-pdf/` and `renders/delivery-pdf/`. Six labelled contact sheets per
deck are under `contact-sheets/`.

The contact sheets show the same 114-page chapter order and design family. The
delivery variant changes formulas, shape ordering, some labels, and selected
visual details; it is not byte-identical to `e2` and has no notes. Render
inspection supports semantic correspondence and duplicate-cluster decisions;
it does not establish owner acceptance or scientific validity.

## Hash and dedup findings

- Every title matches its same-number peer: 114/114.
- Exactly {exact_pairs}/114 same-number pairs have identical visible-text and
  normalized-text hashes; this is page 1. Exactly {exact_xml_pairs}/114 pairs
  also share the same direct slide XML hash.
- {high_similarity}/114 same-number pairs have normalized visible-text
  similarity at or above 0.99; the remaining pairs range from
  {low_similarity:.4f} upward and differ by formulas, shape-text order, or
  small wording/layout edits. A similarity score is evidence of correspondence,
  not permission to copy.
- Within-deck semantic duplicate clusters confirmed by text/title/layout and
  contact-sheet review are `7/98`, `16/17`, `45/46`, `54/55`, `57/58`,
  `64/65`, `67/68`, `78–80`, `83–86`, and `92–95`.

The full 228-row disposition record is `dedup-table.csv`. It assigns every
source page `ADOPT`, `APPENDIX`, or `RETIRE`; the delivery variant never owns
content/notes adoption because its authority role is visual comparison only.

## Reproducibility commands

```text
sha256sum /home/u24/papers/beamshift/e2.pptx \\
  /home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx
python courseware/c120-lora-leo-deck/donor-audit-v2/extract_pptx_inventory.py \\
  --output courseware/c120-lora-leo-deck/donor-audit-v2
python /home/u24/.codex/skills/pptx/scripts/office/soffice.py --headless \\
  --convert-to pdf --outdir .../renders/e2-pdf /home/u24/papers/beamshift/e2.pptx
python /home/u24/.codex/skills/pptx/scripts/office/soffice.py --headless \\
  --convert-to pdf --outdir .../renders/delivery-pdf /home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx
pdftoppm -png -r 96 <pdf> <owned-render-prefix>
python courseware/c120-lora-leo-deck/donor-audit-v2/make_contact_sheets.py \\
  --root courseware/c120-lora-leo-deck/donor-audit-v2
python courseware/c120-lora-leo-deck/donor-audit-v2/build_audit_docs.py
```

## Limitations and fail-closed boundary

The audit can prove current file bytes, OOXML contents, notes presence,
rendered appearance, and the stated hash/similarity evidence. It cannot prove
the original authoring history, upstream licensing beyond the repository's
own declarations, current scientific validity of donor formulas/values, or
that a donor screenshot is current C120 evidence. If either named path becomes
missing or unreadable on rerun, the extraction script records `MISSING` and no
invented page rows are allowed.

All adoption is topic-level only. Current C120 commands, `student_policy.py`
line numbers, result artifacts, endpoint replay, browser screenshots, and
claim labels must be generated from the current course package before any
page is promoted. No donor page is classroom acceptance evidence.
"""


def summary_md(rows: list[dict[str, object]]) -> str:
    counts = Counter((row["source_deck"], row["disposition"]) for row in rows)
    overall = Counter(row["disposition"] for row in rows)
    grouped: dict[tuple[str, str], list[int]] = defaultdict(list)
    for row in rows:
        grouped[(str(row["source_deck"]), str(row["disposition"]))].append(int(row["source_page"]))
    lines = [
        "# Donor disposition summary",
        "",
        "Status: `OWNER-READABLE TRIAGE / DONOR SOURCES UNMODIFIED`",
        "",
        "`e2` is the only content/notes donor. The delivery variant is a visual and provenance comparison and therefore cannot independently supply adopted narration or notes.",
        "",
        "## Totals",
        "",
        "| Source | ADOPT | APPENDIX | RETIRE | Total |",
        "|---|---:|---:|---:|---:|",
    ]
    for source in ("e2", "delivery-variant"):
        lines.append(
            f"| `{source}` | {counts[(source, 'ADOPT')]} | {counts[(source, 'APPENDIX')]} | {counts[(source, 'RETIRE')]} | {sum(counts[(source, d)] for d in ('ADOPT', 'APPENDIX', 'RETIRE'))} |"
        )
    lines.append(
        f"| **All donor pages** | **{overall['ADOPT']}** | **{overall['APPENDIX']}** | **{overall['RETIRE']}** | **{sum(overall.values())}** |"
    )
    lines += [
        "",
        "## e2 disposition ranges",
        "",
        "| Disposition | Pages | Count | Owner meaning |",
        "|---|---|---:|---|",
    ]
    meanings = {
        "ADOPT": "Topic/causal structure may enter the current deck only after rewrite with current runner evidence.",
        "APPENDIX": "Optional source or vocabulary deepening; one concept per page, never required for the main route.",
        "RETIRE": "Do not carry page semantics or old workflow; rebuild from the C120 authority if the idea remains useful.",
    }
    for disposition in ("ADOPT", "APPENDIX", "RETIRE"):
        vals = grouped[("e2", disposition)]
        lines.append(f"| `{disposition}` | {ranges(vals)} | {len(vals)} | {meanings[disposition]} |")
    lines += [
        "",
        "## Duplicate clusters to collapse",
        "",
        "| Cluster | Pages in each donor | Treatment |",
        "|---|---|---|",
        "| `DUP-TLE-07-98` | 7 and 98 | Keep one TLE opening only; the other is visual/text duplicate material. |",
        "| `DUP-POWER-16-17` | 16 and 17 | Keep one throughput/power/energy concept; page 17 has no standalone role. |",
        "| `DUP-T1-45-46` | 45 and 46 | Retire blank/readout pair as old T1 workflow. |",
        "| `DUP-T2-54-55` | 54 and 55 | Retire blank/readout pair as old T2 workflow. |",
        "| `DUP-T2-57-58` | 57 and 58 | Retire blank/readout pair as old T2 workflow. |",
        "| `DUP-T3-64-65` | 64 and 65 | Retire blank/readout pair as old T3 workflow. |",
        "| `DUP-T3-67-68` | 67 and 68 | Retire blank/readout pair as old T3 workflow. |",
        "| `DUP-T4-78-80` | 78–80 | Retire old T4 control/readout/result sequence. |",
        "| `DUP-T5-83-86` | 83–86 | Retire old T5 control/readout/result sequence. |",
        "| `DUP-T6-92-95` | 92–95 | Retire old T6 and legacy Run EE sequence. |",
    ]
    lines += [
        "",
        "## Decision guardrails",
        "",
        "- `ADOPT` means a topic donor, never an unchanged page, formula, number, screenshot, command, or claim.",
        "- `APPENDIX` means optional reference only. It must not make LEO the course core or turn endpoint energy into canonical/system energy.",
        "- `RETIRE` is a fail-closed disposition for old workflow, specialist framing, duplicate capacity, or unqualified evidence.",
        "- The target deck remains a 98–116-page C120 LoRaEnergySim package; page capacity is not a reason to retain filler.",
    ]
    return "\n".join(lines) + "\n"


def insertion_md() -> str:
    return """# C120 donor insertion map

Status: `TOPIC-LEVEL INSERTIONS ONLY / CURRENT CONTENT MUST BE REGENERATED`

The authority sequence is the C120 LoRaEnergySim endpoint-energy loop. LEO is
used only as a changing-service-window example. The donor paths below are
provenance references, not current course authority; every insertion requires
new titles, narration, notes, values, screenshots, and claim labels.

## Interleave only these useful ideas

| Enter in the new sequence | Donor material | Rewrite requirement | Donor visual/diagram that may be reused as a reference | Must not imply |
|---|---|---|---|---|
| Core 1–5 opening | e2 pages 2, delivery page 2 | Rewrite from link-first to endpoint state → packet/service → energy; use current LoRaEnergySim runner language. | Four-step causal boxes can inspire a new endpoint-energy chain. | LEO or satellite engineering is the learning destination. |
| Core 6–8 example bridge | e2 pages 4–6 and 12 | Rewrite the service-window and slow-switch counterexample around one current scenario and a bounded policy action. | Moving-window line diagram and slow-switch/ping-pong timeline as redraw references. | A donor handover algorithm, old session state, or satellite-only objective is current. |
| Core 17–21 model bridge | e2 pages 14, 16, 19–21; merge page 17 | Rewrite throughput, power, W, J, delivered bits, service, and endpoint energy with current units and boundary. | Causal flow boxes and A/B accounting layout; redraw all formulas/values. | Donor whole-system EE or legacy browser values are endpoint truth. |
| Labs A–C comparison grammar | e2 pages 36–39 | Rewrite fair A/B and control → intermediate state → observable evidence for `student_policy.py` and current runner artifacts. | Control/evidence chain and comparison composition; replace every screenshot and table. | Old T1–T6 buttons, producer tables, or session semantics survive. |
| Evidence clinic Core 63–66 | e2 pages 70–75 and 96–97 | Rewrite evidence qualification, accumulated quantities, provenance, and claim ceiling with endpoint replay fields. | Classification cards and evidence-record layout; use current artifact screenshots only. | One attractive energy number proves saving, measurement, or canonical parity. |
| Claim classification Core 63–66 or APP-16–18 | e2 page 113 | Rewrite measured/derived/assumed/simulated labels for the current course package. | Four-category classification motif only. | Simulated teaching data becomes measured or live evidence. |
| APP-10–12 provenance | e2 pages 7–10 and 98–110; collapse 7/98 | Select a single TLE/SGP4/source-lineage explanation and mark it optional. | TLE black source block and one provenance chain may be redrawn after source/licence review. | A satellite-specialist derivation is required to complete an IoT energy lab. |
| APP-07–09 and APP-13–15 vocabulary | e2 pages 13, 15, 22–35, 111–112 | Keep at most one concept per page; replace formulas and numbers with current, bounded examples. | Simple unit/quality/angle/power diagrams as inspiration; prefer fresh native figures. | SINR, PA, angle, or RF detail defines the course objective or endpoint/system boundary. |
| APP-16–18 source handoff | e2 page 114 | Refresh citations, licences, glossary, and source/model/assumption lineage against the pinned package. | Source-index table structure only. | Donor file history is current package provenance. |

## Explicit non-insertions

Do not interleave e2 pages 1, 3, 11, 18, 40–69, or 76–95 as current pages.
They are satellite-first framing, old controls, old observation/session
semantics, legacy Run EE, or duplicate blank/readout material. The delivery
variant has no speaker notes and is visual/provenance comparison only; it may
help a designer compare composition but is not a content source.

Do not use donor media as current evidence. The extraction found embedded PNG
relationships, but an embedded image does not establish its source, current
scenario identity, licence, or scientific validity. Reuse requires owner and
licence review; otherwise redraw in the current `educate.pptx` original
background/colour system, without adding a new background fill.

## Provenance separation

- **C120 authority:** ADR-004, the integration SDD, and the next-controller
  handoff define the direct LoRaEnergySim smart-energy/IoT purpose, endpoint
  accounting boundary, exact course sequence, and LEO example boundary.
- **Donor evidence:** `e2.pptx` SHA-256
  `60ba796c908387cdfe06c2b82e592bcce3205e2472c42566467bbbd89dcad024` is the
  content/notes donor; the delivery variant SHA-256
  `7dbdc23e17d7a3c6dc8d6ed76823100da6aa7f14512a8128201a42c59f5ddd34` is the
  visual/provenance comparison.
- **Current page evidence:** setup receipts, `student_policy.py` line
  numbers, runner results, endpoint replay, screenshots, and speaker notes
  must come from the current C120 package. None is supplied by these donors.

The insertion map is intentionally sparse: a donor concept enters only when it
changes an explanation, prediction, recovery path, evidence interpretation, or
optional provenance branch in the new 98–116-page deck.
"""


def main() -> None:
    rows = make_rows()
    write_dedup_table(rows)
    (ROOT / "inventory.md").write_text(inventory_md(), encoding="utf-8")
    (ROOT / "adopt-appendix-retire.md").write_text(summary_md(rows), encoding="utf-8")
    (ROOT / "insertion-map.md").write_text(insertion_md(), encoding="utf-8")


if __name__ == "__main__":
    main()
