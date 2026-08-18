#!/usr/bin/env python3
"""Merge authored fragments into a confirmed ppt-master native fill plan."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


FORBIDDEN = "學生"
ACTION_FIELDS = ("DO｜", "WHY｜", "MECHANISM｜", "EXPECT｜", "INTERPRET｜")
VALID_STATES = {"AUTHORITY", "DONOR-REWRITE", "PLACEHOLDER", "OWNER"}


def display(value: object) -> str:
    """Remove Markdown-only code markers from native PowerPoint text."""

    return str(value).replace("`", "")


def load_fragments(paths: list[Path]) -> list[dict[str, object]]:
    pages: list[dict[str, object]] = []
    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError(f"{path}: root must be a JSON array")
        pages.extend(data)
    return pages


def validate_pages(pages: list[dict[str, object]]) -> list[dict[str, object]]:
    pages.sort(key=lambda item: int(item["page"]))
    numbers = [int(item["page"]) for item in pages]
    if numbers != list(range(1, 109)):
        raise ValueError(f"expected pages 1..108 exactly once; got {numbers}")

    for item in pages:
        page = int(item["page"])
        for field in ("title", "notes", "authority", "state", "purpose"):
            if not str(item.get(field, "")).strip():
                raise ValueError(f"page {page}: missing {field}")
        if page == 1:
            if not str(item.get("subtitle", "")).strip():
                raise ValueError("page 1: missing subtitle")
        elif not str(item.get("body", "")).strip():
            raise ValueError(f"page {page}: missing body")
        if item["state"] not in VALID_STATES:
            raise ValueError(f"page {page}: invalid state {item['state']!r}")

        searchable = json.dumps(item, ensure_ascii=False)
        if FORBIDDEN in searchable:
            raise ValueError(f"page {page}: forbidden exact word {FORBIDDEN!r}")
        if "\\(" in searchable or "\\)" in searchable:
            raise ValueError(
                f"page {page}: use editable raw LaTeX after 'LaTeX：' without display delimiters"
            )

        body = str(item.get("body", ""))
        if bool(item.get("action_contract")):
            missing = [field for field in ACTION_FIELDS if field not in body]
            if missing:
                raise ValueError(f"page {page}: action contract missing {missing}")
        nonempty_lines = [line for line in body.splitlines() if line.strip()]
        if len(nonempty_lines) > 9:
            raise ValueError(f"page {page}: body has {len(nonempty_lines)} non-empty lines")
    return pages


def build_plan(pages: list[dict[str, object]], source_pptx: Path) -> dict[str, object]:
    slides: list[dict[str, object]] = []
    for item in pages:
        page = int(item["page"])
        if page == 1:
            replacements = [
                {"slot_id": "s01_sh2", "text": display(item["title"])},
                {"slot_id": "s01_sh3", "text": display(item["subtitle"])},
            ]
            source_slide = 1
            layout_pattern = "native educate cover"
        else:
            replacements = [
                {"slot_id": "s02_sh2", "text": display(item["title"])},
                {"slot_id": "s02_sh3", "text": display(item["body"])},
                {"slot_id": "s02_sh4", "text": display(item["authority"])},
            ]
            source_slide = 2
            layout_pattern = "native educate title and body"
        slides.append(
            {
                "source_slide": source_slide,
                "purpose": str(item["purpose"]),
                "layout_rationale": {
                    "layout_pattern": layout_pattern,
                    "why_fit": "One dominant editable typographic visual in the original template placeholder.",
                    "risk": "Render QA is required; unfrozen evidence stays an explicit placeholder.",
                },
                "replacements": replacements,
                "notes": display(item["notes"]),
                "table_edits": [],
                "chart_edits": [],
            }
        )
    return {
        "schema": "template_fill_pptx_plan.v1",
        "status": "confirmed",
        "source_pptx": str(source_pptx.resolve()),
        "accepted_warnings": [
            "s02_sh3 is the native 12.486 by 5.677 inch body placeholder misclassified as label_candidate; render QA governs capacity"
        ],
        "slides": slides,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-pptx", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("fragments", nargs="+", type=Path)
    args = parser.parse_args()

    pages = validate_pages(load_fragments(args.fragments))
    plan = build_plan(pages, args.source_pptx)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(plan, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"full-deck plan: pages={len(pages)} -> {args.output}")


if __name__ == "__main__":
    main()
