#!/usr/bin/env python3
"""Audit the merged ALT review presentation in logical slide order."""

from __future__ import annotations

import json
import posixpath
import re
import zipfile
from pathlib import Path

from lxml import etree


HERE = Path(__file__).resolve().parent
DECK = HERE.parents[2] / "LoRaEnergySim-LEO-ALT-REVIEW.pptx"
REPORT = HERE / "final-audit.json"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"

FORBIDDEN = re.compile(
    r"學生|老師|講師|你|分鐘|SHA-?256|checksum|ZIP[ -]?test|"
    r"固定五問|製作備註|講稿提示|舊截圖",
    re.IGNORECASE,
)
ALLOWED_FONTS = {"Times New Roman", "標楷體", "Cambria Math"}


def parse(payload: bytes) -> etree._Element:
    return etree.fromstring(payload)


def rels_name(part: str) -> str:
    folder, base = posixpath.split(part)
    return posixpath.join(folder, "_rels", base + ".rels")


def normalize_target(source_part: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def relationships(archive: zipfile.ZipFile, part: str) -> list[etree._Element]:
    name = rels_name(part)
    if name not in archive.namelist():
        return []
    root = parse(archive.read(name))
    return root.findall(f"{{{REL_NS}}}Relationship")


def logical_slides(archive: zipfile.ZipFile) -> list[str]:
    presentation = parse(archive.read("ppt/presentation.xml"))
    rels = parse(archive.read("ppt/_rels/presentation.xml.rels"))
    rid_to_target = {
        rel.get("Id", ""): normalize_target("ppt/presentation.xml", rel.get("Target", ""))
        for rel in rels.findall(f"{{{REL_NS}}}Relationship")
        if rel.get("Type", "").endswith("/slide")
    }
    slide_list = presentation.find(f"{{{P_NS}}}sldIdLst")
    if slide_list is None:
        return []
    return [rid_to_target[node.get(f"{{{R_NS}}}id", "")] for node in slide_list]


def text_of(root: etree._Element) -> str:
    return "\n".join(value for value in root.xpath("//a:t/text()", namespaces={"a": A_NS}) if value)


def main() -> None:
    failures: list[str] = []
    forbidden_hits: list[dict[str, object]] = []
    font_counts: dict[str, int] = {}
    size_counts: dict[int, int] = {}
    titles: list[str] = []
    formula_slides: list[int] = []
    notes_nonempty = 0
    background_slides: list[int] = []
    layout2_slides: list[int] = []
    broken_targets: list[dict[str, str]] = []

    with zipfile.ZipFile(DECK) as archive:
        names = set(archive.namelist())
        slides = logical_slides(archive)
        if len(slides) != 116:
            failures.append(f"logical slide count is {len(slides)}, expected 116")
        if len(set(slides)) != len(slides):
            failures.append("presentation slide list contains duplicate targets")

        for logical_number, slide_part in enumerate(slides, start=1):
            slide = parse(archive.read(slide_part))
            all_text = text_of(slide)
            titles.append(next((line for line in all_text.splitlines() if line.strip()), ""))
            if slide.find(f"{{{P_NS}}}cSld/{{{P_NS}}}bg") is not None:
                background_slides.append(logical_number)
            if slide.xpath("//m:oMath | //m:oMathPara", namespaces={"m": M_NS}):
                formula_slides.append(logical_number)

            for node in slide.xpath("//*[@typeface]"):
                face = node.get("typeface", "")
                font_counts[face] = font_counts.get(face, 0) + 1
            for node in slide.xpath("//*[@sz]"):
                value = node.get("sz", "")
                if value.isdigit():
                    points_100 = int(value)
                    size_counts[points_100] = size_counts.get(points_100, 0) + 1

            for match in FORBIDDEN.finditer(all_text):
                forbidden_hits.append({
                    "scope": "visible",
                    "slide": logical_number,
                    "term": match.group(0),
                })

            slide_rels = relationships(archive, slide_part)
            layout_targets = [
                normalize_target(slide_part, rel.get("Target", ""))
                for rel in slide_rels
                if rel.get("Type", "").endswith("/slideLayout")
            ]
            if layout_targets == ["ppt/slideLayouts/slideLayout2.xml"]:
                layout2_slides.append(logical_number)
            else:
                failures.append(f"slide {logical_number} layout targets: {layout_targets}")

            note_targets = [
                normalize_target(slide_part, rel.get("Target", ""))
                for rel in slide_rels
                if rel.get("Type", "").endswith("/notesSlide")
            ]
            if len(note_targets) != 1:
                failures.append(f"slide {logical_number} notes targets: {note_targets}")
            else:
                note_part = note_targets[0]
                note = parse(archive.read(note_part))
                note_text = text_of(note)
                if note_text.strip():
                    notes_nonempty += 1
                for match in FORBIDDEN.finditer(note_text):
                    forbidden_hits.append({
                        "scope": "notes",
                        "slide": logical_number,
                        "term": match.group(0),
                    })

        for rels_part in (name for name in names if name.endswith(".rels")):
            owner_dir, rels_file = posixpath.split(rels_part)
            if not owner_dir.endswith("/_rels"):
                continue
            owner_folder = owner_dir[:-6]
            owner_name = rels_file[:-5]
            owner_part = posixpath.join(owner_folder, owner_name)
            rel_root = parse(archive.read(rels_part))
            for rel in rel_root.findall(f"{{{REL_NS}}}Relationship"):
                if rel.get("TargetMode") == "External":
                    continue
                target = normalize_target(owner_part, rel.get("Target", ""))
                if target not in names:
                    broken_targets.append({"owner": owner_part, "target": target})

    minimum_size = min(size_counts, default=0)
    unexpected_fonts = sorted(face for face in font_counts if face not in ALLOWED_FONTS)
    if notes_nonempty != 116:
        failures.append(f"nonempty notes count is {notes_nonempty}, expected 116")
    if background_slides:
        failures.append(f"slide-level backgrounds found on {background_slides}")
    if formula_slides != [39, 40]:
        failures.append(f"native Office Math appears on {formula_slides}, expected [39, 40]")
    if minimum_size < 1600:
        failures.append(f"minimum authored size is {minimum_size / 100:.1f} pt")
    if unexpected_fonts:
        failures.append(f"unexpected authored fonts: {unexpected_fonts}")
    if forbidden_hits:
        failures.append(f"forbidden language hits: {len(forbidden_hits)}")
    if broken_targets:
        failures.append(f"broken internal relationship targets: {len(broken_targets)}")

    report = {
        "status": "PASS" if not failures else "FAIL",
        "deck": str(DECK),
        "logical_slide_count": len(titles),
        "unique_slide_targets": len(set(slides)),
        "nonempty_speaker_notes": notes_nonempty,
        "layout2_slide_count": len(layout2_slides),
        "layout1_slide_count": 0,
        "slide_level_background_count": len(background_slides),
        "native_office_math_slides": formula_slides,
        "minimum_authored_font_pt": minimum_size / 100,
        "font_counts": dict(sorted(font_counts.items())),
        "unexpected_fonts": unexpected_fonts,
        "forbidden_language_hits": forbidden_hits,
        "broken_internal_relationships": broken_targets,
        "logical_titles": titles,
        "failures": failures,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in (
        "status", "logical_slide_count", "nonempty_speaker_notes",
        "layout2_slide_count", "native_office_math_slides",
        "minimum_authored_font_pt", "unexpected_fonts", "failures",
    )}, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
