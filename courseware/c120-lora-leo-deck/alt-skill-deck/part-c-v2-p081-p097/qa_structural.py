#!/usr/bin/env python3
"""Structural QA for the owned Part C V2 PPTX lane."""

from __future__ import annotations

import json
import os
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
DEFAULT_PPTX = ROOT.parent / "latest" / "LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW.pptx"
PPTX = Path(os.environ.get("C120_OUTPUT", str(DEFAULT_PPTX))).resolve()
REPORT = Path(os.environ.get("C120_STRUCTURAL_REPORT", str(ROOT / "qa-structural.json"))).resolve()
NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
P = f"{{{NS_P}}}"
A = f"{{{NS_A}}}"

FORBIDDEN = [
    "學生",
    "老師",
    "講師",
    "你",
    "分鐘",
    "checksum",
    "ZIP test",
    "製作備註",
    "production notes",
    "旧截图",
]


def xml_root(data: bytes, name: str) -> ET.Element:
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise RuntimeError(f"invalid XML: {name}: {exc}") from exc


def rel_target(part: str, target: str) -> str:
    base = posixpath.dirname(part)
    return posixpath.normpath(posixpath.join(base, target)).lstrip("/")


def rels_for(archive: zipfile.ZipFile, part: str) -> list[ET.Element]:
    rels_name = posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")
    if rels_name not in archive.namelist():
        return []
    root = xml_root(archive.read(rels_name), rels_name)
    return list(root.findall(f"{{{NS_R}}}Relationship"))


def text_of(root: ET.Element) -> str:
    return "".join(node.text or "" for node in root.iter(f"{A}t"))


def slide_number(name: str) -> int:
    return int(re.search(r"(\d+)", name).group(1))


def run() -> dict:
    report: dict = {
        "output": str(PPTX),
        "zip_integrity": False,
        "slide_count": 0,
        "notes_count": 0,
        "layout_targets": [],
        "all_layout2": False,
        "slide_background_count": 0,
        "recursive_xml_errors": [],
        "relationship_errors": [],
        "creation_id_count": 0,
        "creation_ids_unique": True,
        "minimum_authored_font_pt": None,
        "font_contract_errors": [],
        "forbidden_hits": [],
        "placeholder_hits": [],
        "notes_short": [],
        "status": "FAIL",
    }
    if not PPTX.is_file():
        report["recursive_xml_errors"].append(f"missing PPTX: {PPTX}")
        return report

    with zipfile.ZipFile(PPTX) as archive:
        report["zip_integrity"] = archive.testzip() is None
        names = set(archive.namelist())
        slide_names = sorted(
            (n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
            key=slide_number,
        )
        notes_names = sorted(
            (n for n in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", n)),
            key=slide_number,
        )
        report["slide_count"] = len(slide_names)
        report["notes_count"] = len(notes_names)
        all_text: list[str] = []
        slide_texts: list[tuple[str, str]] = []
        creation_ids: list[str] = []
        font_sizes: list[float] = []

        if "[Content_Types].xml" not in names:
            report["recursive_xml_errors"].append("missing [Content_Types].xml")
        else:
            xml_root(archive.read("[Content_Types].xml"), "[Content_Types].xml")

        for name in slide_names + notes_names:
            try:
                root = xml_root(archive.read(name), name)
            except RuntimeError as exc:
                report["recursive_xml_errors"].append(str(exc))
                continue
            expected = f"{P}notes" if "/notesSlides/" in name else f"{P}sld"
            if root.tag != expected:
                report["recursive_xml_errors"].append(f"{name}: root is {root.tag}, expected {expected}")
            if root.find(f"{P}cSld") is None or root.find(f"{P}cSld/{P}spTree") is None:
                report["recursive_xml_errors"].append(f"{name}: missing cSld/spTree")
            all_text.append(text_of(root))
            if "/slides/" in name:
                slide_texts.append((name, text_of(root)))
            for node in root.iter():
                local = node.tag.rsplit("}", 1)[-1]
                if local == "creationId":
                    creation_ids.append(node.get("id") or node.get("val") or "")
                # defRPr is inherited placeholder/default styling; authored
                # runs carry explicit rPr/endParaRPr values.
                if local in {"rPr", "endParaRPr"} and node.get("sz"):
                    try:
                        font_sizes.append(int(node.get("sz")) / 100)
                    except ValueError:
                        report["font_contract_errors"].append(f"{name}: nonnumeric font size {node.get('sz')}")

            for rel in rels_for(archive, name):
                target = rel.get("Target", "")
                if rel.get("TargetMode") == "External":
                    continue
                resolved = rel_target(name, target)
                if resolved not in names:
                    report["relationship_errors"].append(f"{name}: missing target {target} -> {resolved}")

        for name in slide_names:
            root = xml_root(archive.read(name), name)
            if root.find(f"{P}cSld/{P}bg") is not None:
                report["slide_background_count"] += 1
            layout_targets = []
            for rel in rels_for(archive, name):
                if rel.get("Type", "").endswith("/slideLayout"):
                    layout_targets.append(rel.get("Target", ""))
            report["layout_targets"].extend(layout_targets)
            if layout_targets != ["../slideLayouts/slideLayout2.xml"]:
                report["relationship_errors"].append(f"{name}: layout targets {layout_targets}")

        report["layout_targets"] = sorted(set(report["layout_targets"]))
        report["all_layout2"] = bool(report["layout_targets"]) and all(
            target.endswith("slideLayout2.xml") for target in report["layout_targets"]
        )
        report["creation_id_count"] = len(creation_ids)
        report["creation_ids_unique"] = len(creation_ids) == len(set(creation_ids))
        if font_sizes:
            report["minimum_authored_font_pt"] = min(font_sizes)
            if report["minimum_authored_font_pt"] < 16:
                report["font_contract_errors"].append(
                    f"minimum authored XML font is {report['minimum_authored_font_pt']} pt; required 16 pt"
                )

        joined = "\n".join(all_text)
        report["forbidden_hits"] = sorted({term for term in FORBIDDEN if term.lower() in joined.lower()})
        report["placeholder_hits"] = sorted({term for term in ["Click to edit", "Lorem ipsum", "TODO"] if term.lower() in joined.lower()})
        note_text = []
        for name in notes_names:
            note_root = xml_root(archive.read(name), name)
            note_text.append(text_of(note_root))
        report["notes_short"] = [f"notesSlide{i + 1}" for i, value in enumerate(note_text) if len(value.strip()) < 120]

        readback_lines = [f"PPTX: {PPTX}", f"slides={len(slide_texts)}", f"notes={len(note_text)}", ""]
        for index, (name, slide_text) in enumerate(slide_texts, start=1):
            readback_lines.append(f"slide {index}: {name}")
            readback_lines.append(slide_text)
            readback_lines.append(f"notes {index}: {note_text[index - 1] if index - 1 < len(note_text) else ''}")
            readback_lines.append("")
        (ROOT / "readback.txt").write_text("\n".join(readback_lines), encoding="utf-8")

    checks = [
        report["zip_integrity"],
        report["slide_count"] == 17,
        report["notes_count"] == 17,
        report["all_layout2"],
        report["slide_background_count"] == 0,
        report["creation_ids_unique"],
        not report["recursive_xml_errors"],
        not report["relationship_errors"],
        not report["font_contract_errors"],
        not report["forbidden_hits"],
        not report["placeholder_hits"],
        not report["notes_short"],
    ]
    report["status"] = "PASS" if all(checks) else "FAIL"
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["status"] == "PASS" else 1)
