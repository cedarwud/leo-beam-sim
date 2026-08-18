#!/usr/bin/env python3
"""Cross-lane structural and content-contract checks for the V2 review deck."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import zipfile
from pathlib import Path

from lxml import etree


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
SLIDE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
LAYOUT_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
NOTES_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"

FORBIDDEN = ("學生", "老師", "講師", "你", "分鐘", "checksum", "ZIP test", "製作備註", "口語標語")
CREATION_ID = re.compile(
    r"(?i)(?:\b[0-9a-f]{16,}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\bsha(?:1|224|256|384|512)?\b)"
)


def xml(data: bytes) -> etree._Element:
    return etree.fromstring(data)


def rels_name(part: str) -> str:
    folder, base = posixpath.split(part)
    return posixpath.join(folder, "_rels", base + ".rels")


def resolve(part: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(part), target))


def text_of(root: etree._Element) -> str:
    return "\n".join(node.text or "" for node in root.findall(f".//{{{A_NS}}}t"))


def ordered_slides(archive: zipfile.ZipFile) -> list[str]:
    presentation = xml(archive.read("ppt/presentation.xml"))
    rels = xml(archive.read("ppt/_rels/presentation.xml.rels"))
    targets = {
        rel.get("Id"): resolve("ppt/presentation.xml", rel.get("Target", ""))
        for rel in rels.findall(f"{{{REL_NS}}}Relationship")
        if rel.get("Type") == SLIDE_REL
    }
    slide_list = presentation.find(f"{{{P_NS}}}sldIdLst")
    if slide_list is None:
        return []
    return [targets[node.get(f"{{{R_NS}}}id")] for node in slide_list]


def check(path: Path) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    min_font = 999.0
    notes_count = 0
    with zipfile.ZipFile(path) as archive:
        broken = archive.testzip()
        if broken:
            errors.append(f"ZIP CRC failure: {broken}")
        names = set(archive.namelist())
        slides = ordered_slides(archive)
        if not slides:
            errors.append("presentation has no ordered slides")
        for index, slide_part in enumerate(slides, start=1):
            if slide_part not in names:
                errors.append(f"slide {index}: missing part {slide_part}")
                continue
            root = xml(archive.read(slide_part))
            if root.find(f"{{{P_NS}}}bg") is not None:
                errors.append(f"slide {index}: author slide background present")
            slide_text = text_of(root)
            for term in FORBIDDEN:
                if term.lower() in slide_text.lower():
                    errors.append(f"slide {index}: forbidden visible term {term!r}")
            if CREATION_ID.search(slide_text):
                errors.append(f"slide {index}: visible creation identifier/checksum token")

            explicit_sizes = []
            for props in root.findall(f".//{{{A_NS}}}rPr") + root.findall(f".//{{{A_NS}}}defRPr"):
                size = props.get("sz")
                if size and size.isdigit():
                    explicit_sizes.append(int(size) / 100.0)
                latin = props.find(f"{{{A_NS}}}latin")
                east_asian = props.find(f"{{{A_NS}}}ea")
                if latin is not None and latin.get("typeface") not in (None, "Times New Roman"):
                    warnings.append(
                        f"slide {index}: explicit Latin font {latin.get('typeface')!r}"
                    )
                if east_asian is not None and east_asian.get("typeface") not in (None, "DFKai-SB", "標楷體"):
                    warnings.append(
                        f"slide {index}: explicit CJK font {east_asian.get('typeface')!r}"
                    )
            if explicit_sizes:
                min_font = min(min_font, min(explicit_sizes))
                if min(explicit_sizes) < 16:
                    errors.append(f"slide {index}: authored text below 16 pt ({min(explicit_sizes):g})")

            slide_rels = rels_name(slide_part)
            if slide_rels not in names:
                errors.append(f"slide {index}: missing relationships")
                continue
            rel_root = xml(archive.read(slide_rels))
            layout_targets = [
                resolve(slide_part, rel.get("Target", ""))
                for rel in rel_root.findall(f"{{{REL_NS}}}Relationship")
                if rel.get("Type") == LAYOUT_REL
            ]
            if layout_targets != ["ppt/slideLayouts/slideLayout2.xml"]:
                errors.append(f"slide {index}: layout targets {layout_targets!r}")
            note_targets = [
                resolve(slide_part, rel.get("Target", ""))
                for rel in rel_root.findall(f"{{{REL_NS}}}Relationship")
                if rel.get("Type") == NOTES_REL
            ]
            if len(note_targets) != 1 or note_targets[0] not in names:
                errors.append(f"slide {index}: invalid notes relationship {note_targets!r}")
                continue
            notes_count += 1
            note_root = xml(archive.read(note_targets[0]))
            note_text = text_of(note_root).replace("student_policy.py", "")
            if len(re.sub(r"\s+", "", note_text)) < 40:
                errors.append(f"slide {index}: speaker notes are too short or empty")
            for term in FORBIDDEN:
                if term.lower() in note_text.lower():
                    errors.append(f"slide {index}: forbidden notes term {term!r}")
            if CREATION_ID.search(note_text):
                errors.append(f"slide {index}: notes contain creation identifier/checksum token")

    return {
        "path": str(path),
        "status": "PASS" if not errors else "FAIL",
        "slides": len(slides),
        "notes": notes_count,
        "minimum_explicit_font_pt": None if min_font == 999.0 else min_font,
        "errors": errors,
        "warnings": sorted(set(warnings)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = check(args.pptx)
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
