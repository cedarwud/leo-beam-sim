#!/usr/bin/env python3
"""Recursive ZIP/XML/content QA for the opening writer lane."""

from __future__ import annotations

import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / "LoRaEnergySim-LEO-ALT-OPENING-V2-REVIEW.pptx"
REPORT = ROOT / "qa" / "structural-qa.json"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
REL_TAG = f"{{{REL_NS}}}Relationship"

FORBIDDEN = [
    "學生", "老師", "講師", "你", "分鐘", "SHA", "checksum", "ZIP test",
    "production notes", "舊截圖", "截圖安排", "版面", "Fit", "投影片應放",
    "講稿提示", "能回答", "能指出", "能說出", "可以回答", "可教",
]
PLACEHOLDER_RE = re.compile(r"lorem|ipsum|xxxx|click to add|this slide", re.I)


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def part_text(root: ET.Element) -> str:
    return "".join(node.text or "" for node in root.iter(f"{{{A_NS}}}t"))


def rel_target(source_part: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def parse_xml(archive: zipfile.ZipFile, name: str) -> ET.Element:
    return ET.fromstring(archive.read(name))


def check() -> dict:
    failures: list[str] = []
    warnings: list[str] = []
    report: dict = {
        "output": str(OUTPUT),
        "template": "/home/u24/pptx-wrap/assets/templates/educate.pptx",
        "checks": {},
    }
    if not OUTPUT.exists():
        report["status"] = "FAIL"
        report["checks"]["output_exists"] = False
        report["failures"] = [f"missing output: {OUTPUT}"]
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return report
    report["checks"]["output_exists"] = True

    with zipfile.ZipFile(OUTPUT) as archive:
        bad_member = archive.testzip()
        report["checks"]["zip_integrity"] = bad_member is None
        if bad_member is not None:
            failures.append(f"ZIP CRC failure: {bad_member}")

        names = set(archive.namelist())
        required_parts = {"[Content_Types].xml", "ppt/presentation.xml"}
        missing = sorted(required_parts - names)
        report["checks"]["required_parts"] = {"missing": missing, "pass": not missing}
        failures.extend(f"missing required part: {name}" for name in missing)

        slide_names = sorted(
            (name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda value: int(re.search(r"(\d+)", value).group(1)),
        )
        notes_names = sorted(
            (name for name in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)),
            key=lambda value: int(re.search(r"(\d+)", value).group(1)),
        )
        report["slide_count"] = len(slide_names)
        report["notes_count"] = len(notes_names)
        report["checks"]["slide_count"] = len(slide_names) == 16
        report["checks"]["notes_count"] = len(notes_names) == 16
        if len(slide_names) != 16:
            failures.append(f"expected 16 slides, found {len(slide_names)}")
        if len(notes_names) != 16:
            failures.append(f"expected 16 notes slides, found {len(notes_names)}")

        slide_xml_roots: dict[str, ET.Element] = {}
        notes_xml_roots: dict[str, ET.Element] = {}
        text_parts: list[str] = []
        slide_backgrounds: list[str] = []
        layout_targets: list[str] = []
        relationship_failures: list[str] = []
        recursive_xml_pass = True

        for slide_name in slide_names:
            try:
                root = parse_xml(archive, slide_name)
                slide_xml_roots[slide_name] = root
                text_parts.append(part_text(root))
                if local_name(root.tag) != "sld":
                    failures.append(f"{slide_name}: root is {local_name(root.tag)}, expected sld")
                if root.find(f"./{{{P_NS}}}cSld") is None:
                    failures.append(f"{slide_name}: missing cSld")
                if root.find(f"./{{{P_NS}}}cSld/{{{P_NS}}}bg") is not None:
                    slide_backgrounds.append(slide_name)
            except (ET.ParseError, KeyError) as exc:
                recursive_xml_pass = False
                failures.append(f"slide XML parse failure {slide_name}: {exc}")

            rel_name = f"ppt/slides/_rels/{Path(slide_name).name}.rels"
            if rel_name not in names:
                recursive_xml_pass = False
                failures.append(f"missing slide relationship part: {rel_name}")
                continue
            try:
                rel_root = parse_xml(archive, rel_name)
            except (ET.ParseError, KeyError) as exc:
                recursive_xml_pass = False
                failures.append(f"relationship XML parse failure {rel_name}: {exc}")
                continue
            for rel in rel_root.findall(REL_TAG):
                target = rel.get("Target", "")
                if rel.get("TargetMode") == "External":
                    continue
                target_part = rel_target(slide_name, target)
                if target_part not in names:
                    relationship_failures.append(f"{rel_name}: {target} -> {target_part} missing")
                if rel.get("Type", "").endswith("/slideLayout"):
                    layout_targets.append(target)

        for notes_name in notes_names:
            try:
                root = parse_xml(archive, notes_name)
                notes_xml_roots[notes_name] = root
                text_parts.append(part_text(root))
                if local_name(root.tag) != "notes":
                    failures.append(f"{notes_name}: root is {local_name(root.tag)}, expected notes")
            except (ET.ParseError, KeyError) as exc:
                recursive_xml_pass = False
                failures.append(f"notes XML parse failure {notes_name}: {exc}")
            rel_name = f"ppt/notesSlides/_rels/{Path(notes_name).name}.rels"
            if rel_name not in names:
                recursive_xml_pass = False
                failures.append(f"missing notes relationship part: {rel_name}")
                continue
            try:
                rel_root = parse_xml(archive, rel_name)
            except (ET.ParseError, KeyError) as exc:
                recursive_xml_pass = False
                failures.append(f"notes relationship XML parse failure {rel_name}: {exc}")
                continue
            for rel in rel_root.findall(REL_TAG):
                if rel.get("TargetMode") == "External":
                    continue
                target = rel.get("Target", "")
                target_part = rel_target(notes_name, target)
                if target_part not in names:
                    relationship_failures.append(f"{rel_name}: {target} -> {target_part} missing")

        report["checks"]["recursive_xml_parse"] = recursive_xml_pass and not relationship_failures
        report["checks"]["relationship_targets"] = {
            "pass": not relationship_failures,
            "failures": relationship_failures,
        }
        failures.extend(relationship_failures)
        report["slide_layout_targets"] = sorted(set(layout_targets))
        report["checks"]["all_slide_layout2"] = bool(layout_targets) and all(
            target.endswith("slideLayout2.xml") for target in layout_targets
        )
        if not report["checks"]["all_slide_layout2"]:
            failures.append(f"slide layout targets are not layout2 only: {sorted(set(layout_targets))}")
        report["slide_backgrounds"] = slide_backgrounds
        report["checks"]["no_authored_slide_background"] = not slide_backgrounds
        failures.extend(f"authored slide background found: {name}" for name in slide_backgrounds)

        creation_ids: list[str] = []
        for name in names:
            if not (name.endswith(".xml") or name.endswith(".rels")):
                continue
            try:
                root = parse_xml(archive, name)
            except (ET.ParseError, KeyError):
                continue
            for node in root.iter():
                if local_name(node.tag) == "creationId":
                    value = node.get("id") or node.get("val") or ""
                    creation_ids.append(f"{name}:{value}")
        creation_values = [value.rsplit(":", 1)[-1] for value in creation_ids]
        duplicates = sorted({value for value in creation_values if creation_values.count(value) > 1})
        report["creation_ids"] = creation_ids
        report["checks"]["creation_ids_unique"] = not duplicates
        report["duplicate_creation_ids"] = duplicates
        if duplicates:
            failures.append(f"duplicate creation IDs: {duplicates}")

        authored_sizes: list[float] = []
        title_sizes: list[float] = []
        for name, root in slide_xml_roots.items():
            for node in root.iter():
                if local_name(node.tag) not in {"rPr", "defRPr", "endParaRPr"}:
                    continue
                if node.get("sz") is None:
                    continue
                size = int(node.get("sz")) / 100
                authored_sizes.append(size)
            title_shape = None
            for shape in root.iter(f"{{{P_NS}}}sp"):
                texts = [node.text or "" for node in shape.iter(f"{{{A_NS}}}t")]
                if any(text.startswith("O") for text in texts):
                    title_shape = shape
                    break
            if title_shape is not None:
                for node in title_shape.iter():
                    if local_name(node.tag) in {"rPr", "defRPr", "endParaRPr"} and node.get("sz"):
                        title_sizes.append(int(node.get("sz")) / 100)
        minimum_size = min(authored_sizes) if authored_sizes else None
        report["minimum_authored_font_pt"] = minimum_size
        report["title_font_sizes_pt"] = sorted(set(title_sizes))
        report["checks"]["font_floor"] = minimum_size is not None and minimum_size >= 16
        report["checks"]["title_floor"] = bool(title_sizes) and min(title_sizes) >= 28
        if minimum_size is None or minimum_size < 16:
            failures.append(f"authored font floor below 16pt: {minimum_size}")
        if not title_sizes or min(title_sizes) < 28:
            failures.append(f"title font floor below 28pt: {sorted(set(title_sizes))}")

        full_text = "\n".join(text_parts)
        forbidden_hits = sorted({term for term in FORBIDDEN if term in full_text})
        placeholder_hits = sorted(set(PLACEHOLDER_RE.findall(full_text)))
        report["forbidden_hits"] = forbidden_hits
        report["placeholder_hits"] = placeholder_hits
        report["checks"]["forbidden_language"] = not forbidden_hits
        report["checks"]["no_placeholders"] = not placeholder_hits
        failures.extend(f"forbidden language: {term}" for term in forbidden_hits)
        failures.extend(f"placeholder text: {term}" for term in placeholder_hits)

        notes_text = {
            name: part_text(root) for name, root in notes_xml_roots.items()
        }
        empty_notes = sorted(name for name, text in notes_text.items() if len(text.strip()) < 120)
        report["empty_or_short_notes"] = empty_notes
        report["checks"]["notes_are_readable"] = not empty_notes
        failures.extend(f"short speaker notes: {name}" for name in empty_notes)

        slide_text = {
            name: part_text(root) for name, root in slide_xml_roots.items()
        }
        report["slide_titles"] = [
            next((text for text in text.split("\n") if text.startswith("O")), "")
            for _, text in sorted(slide_text.items())
        ]
        report["checks"]["opening_page_ids"] = len(report["slide_titles"]) == 16 and all(
            title.startswith("O") for title in report["slide_titles"]
        )
        if not report["checks"]["opening_page_ids"]:
            failures.append("opening titles do not contain O page IDs")

    report["failures"] = failures
    report["warnings"] = warnings
    report["status"] = "PASS" if not failures else "FAIL"
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    result = check()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["status"] == "PASS" else 1)
