#!/usr/bin/env python3
"""Recursive structural QA for the owned Appendix V2 PPTX."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

EXPECTED_PAGE_IDS = [f"P{n:03d}" for n in range(98, 108)]
FORBIDDEN = [
    "學生", "老師", "講師", "你", "分鐘", "SHA", "checksum", "ZIP test",
    "製作備註", "Fit", "版面", "投影片應放", "講稿提示", "舊截圖",
    "不要縮成截圖", "請", "一顆小小的電池", "完成這堂課", "談省電",
    "能回答", "能指出", "能說出", "可以回答", "可教", "不代表結果變成",
]


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def part_from_rels(rel_name: str) -> PurePosixPath:
    rel = PurePosixPath(rel_name)
    return rel.parent.parent / rel.name[:-5]


def resolve_target(source_part: PurePosixPath, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(str((source_part.parent / PurePosixPath(target)).as_posix()))


def xml_text(root: ET.Element) -> str:
    return "".join(node.text or "" for node in root.iter() if local(node.tag) in {"t", "text"})


def run(path: Path) -> dict:
    report: dict = {
        "output": str(path),
        "zip_integrity": False,
        "xml_parts_checked": 0,
        "xml_parse_errors": [],
        "relationship_targets_checked": 0,
        "relationship_target_errors": [],
        "slide_count": 0,
        "notes_count": 0,
        "notes_nonempty": 0,
        "slide_layout_relationships": [],
        "all_slides_layout2": False,
        "slide_background_count": 0,
        "creation_ids": [],
        "creation_ids_unique": True,
        "slide_cnvpr_duplicate_ids": [],
        "font_sizes_pt": [],
        "minimum_authored_font_pt": None,
        "font_below_16_pt": [],
        "font_below_18_pt": [],
        "forbidden_hits": [],
        "page_ids": [],
        "native_office_math_count": 0,
        "picture_count": 0,
        "slides_with_math": [],
        "notes_relationships_checked": 0,
    }

    with zipfile.ZipFile(path) as archive:
        report["zip_integrity"] = archive.testzip() is None
        names = set(archive.namelist())
        all_xml = sorted(name for name in names if name.endswith((".xml", ".rels")))
        parsed: dict[str, ET.Element] = {}
        for name in all_xml:
            try:
                parsed[name] = ET.fromstring(archive.read(name))
                report["xml_parts_checked"] += 1
            except ET.ParseError as exc:
                report["xml_parse_errors"].append({"part": name, "error": str(exc)})

        for rel_name in sorted(name for name in names if name.endswith(".rels")):
            root = parsed.get(rel_name)
            if root is None:
                continue
            source = part_from_rels(rel_name)
            for rel in root.findall(f"{{{REL_NS}}}Relationship"):
                target = rel.get("Target", "")
                if rel.get("TargetMode") == "External":
                    continue
                report["relationship_targets_checked"] += 1
                target_name = resolve_target(source, target)
                if target_name not in names:
                    report["relationship_target_errors"].append({
                        "rels": rel_name, "target": target, "resolved": target_name,
                    })

        slide_names = sorted(
            name for name in names
            if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
        )
        note_names = sorted(
            name for name in names
            if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)
        )
        report["slide_count"] = len(slide_names)
        report["notes_count"] = len(note_names)

        visible_parts: list[str] = []
        notes_parts: list[str] = []
        all_creation_ids: list[str] = []
        font_sizes: list[float] = []
        for slide_name in slide_names:
            root = parsed[slide_name]
            visible_parts.append(xml_text(root))
            if root.find(f"./{{{P_NS}}}cSld/{{{P_NS}}}bg") is not None:
                report["slide_background_count"] += 1
            math_count = len(root.findall(f".//{{{M_NS}}}oMath"))
            if math_count:
                report["slides_with_math"].append({"slide": slide_name, "omath": math_count})
                report["native_office_math_count"] += math_count
            report["picture_count"] += len(root.findall(f".//{{{P_NS}}}pic"))
            ids: list[str] = []
            for node in root.iter():
                if local(node.tag) == "creationId":
                    value = node.get("id") or node.get("val") or ""
                    all_creation_ids.append(value)
                if local(node.tag) == "cNvPr":
                    value = node.get("id") or ""
                    if value:
                        ids.append(value)
                if local(node.tag) in {"rPr", "defRPr", "endParaRPr"} and node.get("sz"):
                    try:
                        font_sizes.append(int(node.get("sz")) / 100)
                    except ValueError:
                        pass
            duplicates = sorted({value for value in ids if ids.count(value) > 1})
            if duplicates:
                report["slide_cnvpr_duplicate_ids"].append({"slide": slide_name, "ids": duplicates})

            rel_name = f"ppt/slides/_rels/{PurePosixPath(slide_name).name}.rels"
            rel_root = parsed.get(rel_name)
            if rel_root is not None:
                targets = [
                    rel.get("Target", "")
                    for rel in rel_root.findall(f"{{{REL_NS}}}Relationship")
                    if rel.get("Type", "").endswith("/slideLayout")
                ]
                report["slide_layout_relationships"].append({"slide": slide_name, "targets": targets})

        for note_name in note_names:
            root = parsed[note_name]
            text = xml_text(root).strip()
            if text:
                report["notes_nonempty"] += 1
            notes_parts.append(text)

        for rel_name in sorted(name for name in names if name.startswith("ppt/notesSlides/_rels/") and name.endswith(".rels")):
            if rel_name in parsed:
                report["notes_relationships_checked"] += 1

        report["creation_ids"] = all_creation_ids
        report["creation_ids_unique"] = len(all_creation_ids) == len(set(all_creation_ids))
        report["font_sizes_pt"] = sorted(font_sizes)
        report["minimum_authored_font_pt"] = min(font_sizes) if font_sizes else None
        report["font_below_16_pt"] = sorted(value for value in font_sizes if value < 16)
        report["font_below_18_pt"] = sorted(value for value in font_sizes if value < 18)
        combined_text = "\n".join(visible_parts + notes_parts)
        report["forbidden_hits"] = sorted({term for term in FORBIDDEN if term in combined_text})
        report["page_ids"] = sorted(set(re.findall(r"P\d{3}", combined_text)))

    report["all_slides_layout2"] = (
        len(report["slide_layout_relationships"]) == 10
        and all(
            len(item["targets"]) == 1 and item["targets"][0].endswith("slideLayout2.xml")
            for item in report["slide_layout_relationships"]
        )
    )
    report["status"] = "PASS" if all([
        report["zip_integrity"],
        not report["xml_parse_errors"],
        not report["relationship_target_errors"],
        report["slide_count"] == 10,
        report["notes_count"] == 10,
        report["notes_nonempty"] == 10,
        report["all_slides_layout2"],
        report["slide_background_count"] == 0,
        report["creation_ids_unique"],
        not report["slide_cnvpr_duplicate_ids"],
        not report["forbidden_hits"],
        report["page_ids"] == EXPECTED_PAGE_IDS,
        report["native_office_math_count"] == 1,
        report["picture_count"] == 0,
        not report["font_below_16_pt"],
    ]) else "FAIL"
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = run(args.pptx)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
