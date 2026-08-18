#!/usr/bin/env python3
"""Export aligned Markdown speaker notes from a fill plan or content fragments."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def from_plan(path: Path) -> list[tuple[int, str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows: list[tuple[int, str, str]] = []
    for page, slide in enumerate(data["slides"], start=1):
        title = ""
        for replacement in slide["replacements"]:
            if replacement["slot_id"] in {"s01_sh2", "s02_sh2"}:
                title = replacement["text"]
                break
        rows.append((page, title, slide["notes"]))
    return rows


def from_fragments(paths: list[Path]) -> list[tuple[int, str, str]]:
    pages: list[dict[str, object]] = []
    for path in paths:
        pages.extend(json.loads(path.read_text(encoding="utf-8")))
    pages.sort(key=lambda item: int(item["page"]))
    return [
        (int(item["page"]), str(item["title"]), str(item["notes"]))
        for item in pages
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--plan", type=Path)
    source.add_argument("--fragments", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--deck-title", required=True)
    args = parser.parse_args()

    rows = from_plan(args.plan) if args.plan else from_fragments(args.fragments)
    lines = [f"# {args.deck_title}", ""]
    for page, title, notes in rows:
        lines.extend([f"## S{page:03d} — {title}", "", notes.replace("`", ""), ""])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"speaker notes: {len(rows)} slides -> {args.output}")


if __name__ == "__main__":
    main()
