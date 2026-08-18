#!/usr/bin/env python3
"""Structural QA for the owned P108-P116 appendix export.

This checker deliberately uses only the Python standard library so it can run
in the authoring environment without LibreOffice or a third-party PPTX parser.
It validates the package graph and reads the authored slide/notes text back
from the OOXML parts.
"""

from __future__ import annotations

import json
import posixpath
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET


REPO_ROOT = Path(__file__).resolve().parents[5]
DECK_ROOT = REPO_ROOT / "courseware/c120-lora-leo-deck/alt-skill-deck"
OWNED_ROOT = DECK_ROOT / "appendix-v2-p108-p116"
PPTX_PATH = DECK_ROOT / "latest" / "LoRaEnergySim-LEO-ALT-APPENDIX-V2-P108-P116-REVIEW.pptx"
QA_ROOT = OWNED_ROOT / "qa"
REPORT_PATH = QA_ROOT / "structural-qa.json"
READBACK_PATH = QA_ROOT / "readback.txt"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"

P = f"{{{P_NS}}}"
A = f"{{{A_NS}}}"
REL = f"{{{PKG_REL_NS}}}"
CT = f"{{{CT_NS}}}"

SLIDE_RE = re.compile(r"^ppt/slides/slide(\d+)\.xml$")
NOTES_RE = re.compile(r"^ppt/notesSlides/notesSlide(\d+)\.xml$")
HEX64_RE = re.compile(r"(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])", re.I)

EXPECTED_SLIDES = [f"P{number}" for number in range(108, 117)]
EXPECTED_TITLES = [
    "節能判讀需要服務、工作量與能量",
    "可重建的證據紀錄",
    "證據來源分類",
    "端點與系統能量邊界",
    "策略至 Leo 匯入的血緣",
    "情境至比較紀錄的契約鏈",
    "來源、模型、假設與授權邊界",
    "控制機制遷移至其他 IoT 場域",
    "可重開、可反駁、可追溯的交接紀錄",
]
FORBIDDEN_TERMS = [
    "學生",
    "老师",
    "老師",
    "講師",
    "你",
    "分鐘",
    "SHA",
    "sha256",
    "checksum",
    "ZIP test",
    "production notes",
    "製作備註",
    "舊截圖",
    "不要縮成截圖",
    "只放必要欄位",
    "截圖安排",
    "版面",
    "Fit",
    "講稿提示",
    "教學提示",
    "可以回答",
    "能回答",
    "能指出",
    "能說出",
    "可教",
    "一顆小小的電池",
    "完成這堂課",
    "本頁不",
    "不代表結果變成",
    "不是舊截圖",
]


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_xml(zf: zipfile.ZipFile, name: str) -> ET.Element:
    return ET.fromstring(zf.read(name))


def extract_text(root: ET.Element) -> str:
    return "".join((node.text or "") for node in root.iter(f"{A}t"))


def extract_paragraphs(root: ET.Element) -> list[str]:
    paragraphs: list[str] = []
    for paragraph in root.iter(f"{A}p"):
        text = "".join((node.text or "") for node in paragraph.iter(f"{A}t"))
        if text:
            paragraphs.append(text)
    return paragraphs


def resolve_relationship_target(rels_name: str, target: str) -> str:
    """Resolve an OOXML relationship target against its source part."""

    if rels_name == "_rels/.rels":
        source_dir = ""
    else:
        rels_dir, rels_file = rels_name.rsplit("/", 1)
        source_dir = rels_dir[: -len("/_rels")] if rels_dir.endswith("/_rels") else rels_dir
        source_file = rels_file[: -len(".rels")] if rels_file.endswith(".rels") else rels_file
        source_part = posixpath.join(source_dir, source_file)
        source_dir = posixpath.dirname(source_part)
    return posixpath.normpath(posixpath.join(source_dir, target)).lstrip("/")


def add_issue(issues: list[str], message: str) -> None:
    issues.append(message)


def main() -> int:
    issues: list[str] = []
    warnings: list[str] = []
    report: dict[str, object] = {
        "status": "FAIL",
        "pptx": str(PPTX_PATH),
        "owned_root": str(OWNED_ROOT),
        "checks": {},
        "issues": issues,
        "warnings": warnings,
    }
    readback: list[str] = []

    if not PPTX_PATH.exists():
        add_issue(issues, f"missing PPTX: {PPTX_PATH}")
        QA_ROOT.mkdir(parents=True, exist_ok=True)
        report["checks"] = {"zip_integrity": False}
        REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        READBACK_PATH.write_text("No package was available for readback.\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    with zipfile.ZipFile(PPTX_PATH) as zf:
        names = set(zf.namelist())
        bad_member = zf.testzip()
        report["file_size_bytes"] = PPTX_PATH.stat().st_size
        report["checks"]["zip_integrity"] = bad_member is None
        if bad_member is not None:
            add_issue(issues, f"ZIP CRC failure: {bad_member}")

        xml_errors: list[str] = []
        parsed_xml: dict[str, ET.Element] = {}
        for name in sorted(names):
            if not (name.endswith(".xml") or name.endswith(".rels")):
                continue
            try:
                parsed_xml[name] = parse_xml(zf, name)
            except ET.ParseError as exc:
                xml_errors.append(f"{name}: {exc}")
        report["checks"]["recursive_xml_parse"] = not xml_errors
        report["xml_parts_checked"] = len(parsed_xml)
        if xml_errors:
            issues.extend(xml_errors)

        slide_parts = sorted(
            (name for name in names if SLIDE_RE.match(name)),
            key=lambda name: int(SLIDE_RE.match(name).group(1)),  # type: ignore[union-attr]
        )
        notes_parts = sorted(
            (name for name in names if NOTES_RE.match(name)),
            key=lambda name: int(NOTES_RE.match(name).group(1)),  # type: ignore[union-attr]
        )
        report["slide_count"] = len(slide_parts)
        report["notes_count"] = len(notes_parts)
        report["checks"]["slide_notes_symmetry"] = len(slide_parts) == 9 and len(notes_parts) == 9
        if len(slide_parts) != 9:
            add_issue(issues, f"expected 9 slide parts, found {len(slide_parts)}")
        if len(notes_parts) != 9:
            add_issue(issues, f"expected 9 notes parts, found {len(notes_parts)}")

        presentation_ok = False
        if "ppt/presentation.xml" in parsed_xml:
            presentation = parsed_xml["ppt/presentation.xml"]
            slide_id_list = presentation.find(f"{P}sldIdLst")
            slide_ids = [] if slide_id_list is None else slide_id_list.findall(f"{P}sldId")
            presentation_ok = len(slide_ids) == 9
            report["presentation_slide_id_count"] = len(slide_ids)
            if not presentation_ok:
                add_issue(issues, f"presentation.xml contains {len(slide_ids)} slide IDs, expected 9")
        else:
            add_issue(issues, "missing ppt/presentation.xml")
        report["checks"]["presentation_slide_ids"] = presentation_ok

        layout_relationships: dict[str, list[str]] = {}
        relationship_errors: list[str] = []
        relationship_count = 0
        for rels_name, rel_root in sorted(parsed_xml.items()):
            if not rels_name.endswith(".rels"):
                continue
            for rel in rel_root.findall(f"{REL}Relationship"):
                relationship_count += 1
                target_mode = rel.attrib.get("TargetMode", "")
                target = rel.attrib.get("Target", "")
                if target_mode.lower() == "external":
                    continue
                resolved = resolve_relationship_target(rels_name, target)
                if resolved not in names:
                    relationship_errors.append(f"{rels_name}: missing target {target} -> {resolved}")
                if rel.attrib.get("Type", "").endswith("/slideLayout"):
                    layout_relationships[rels_name] = layout_relationships.get(rels_name, []) + [resolved]
        report["relationship_count"] = relationship_count
        report["checks"]["relationship_targets"] = not relationship_errors
        if relationship_errors:
            issues.extend(relationship_errors)

        slide_layout_ok = True
        for slide_name in slide_parts:
            number = SLIDE_RE.match(slide_name).group(1)  # type: ignore[union-attr]
            rels_name = f"ppt/slides/_rels/slide{number}.xml.rels"
            targets = layout_relationships.get(rels_name, [])
            if targets != ["ppt/slideLayouts/slideLayout2.xml"]:
                slide_layout_ok = False
                add_issue(issues, f"{slide_name}: layout relationship is {targets}, expected layout2 only")
        report["slide_layout_targets"] = layout_relationships
        report["checks"]["all_slides_use_layout2"] = slide_layout_ok

        content_type_ok = True
        if "[Content_Types].xml" in parsed_xml:
            content_types = parsed_xml["[Content_Types].xml"]
            overrides = [node.attrib.get("PartName", "") for node in content_types.findall(f"{CT}Override")]
            duplicates = sorted(part for part, count in Counter(overrides).items() if count > 1)
            report["content_type_override_count"] = len(overrides)
            report["content_type_duplicate_overrides"] = duplicates
            content_type_ok = not duplicates
            if duplicates:
                add_issue(issues, f"duplicate content-type overrides: {duplicates}")
            expected_overrides = {
                f"/ppt/slides/slide{idx}.xml" for idx in range(1, 10)
            } | {f"/ppt/notesSlides/notesSlide{idx}.xml" for idx in range(1, 10)}
            missing_overrides = sorted(expected_overrides - set(overrides))
            report["content_type_missing_slide_note_overrides"] = missing_overrides
            if missing_overrides:
                content_type_ok = False
                add_issue(issues, f"missing slide/notes content-type overrides: {missing_overrides}")
        else:
            content_type_ok = False
            add_issue(issues, "missing [Content_Types].xml")
        report["checks"]["content_types"] = content_type_ok

        slide_shape_ok = True
        notes_shape_ok = True
        authored_backgrounds: list[str] = []
        duplicate_cnvpr: dict[str, list[str]] = {}
        creation_ids: list[tuple[str, str]] = []
        all_slide_text: dict[str, str] = {}
        all_notes_text: dict[str, str] = {}
        all_slide_paragraphs: dict[str, list[str]] = {}
        all_notes_paragraphs: dict[str, list[str]] = {}

        for slide_name in slide_parts:
            root = parsed_xml.get(slide_name)
            if root is None:
                slide_shape_ok = False
                add_issue(issues, f"missing parsed slide root: {slide_name}")
                continue
            if local_name(root.tag) != "sld" or root.find(f"{P}cSld") is None or root.find(f"{P}cSld/{P}spTree") is None:
                slide_shape_ok = False
                add_issue(issues, f"{slide_name}: missing sld/cSld/spTree structure")
            if root.find(f".//{P}bg") is not None:
                authored_backgrounds.append(slide_name)
            all_slide_text[slide_name] = extract_text(root)
            all_slide_paragraphs[slide_name] = extract_paragraphs(root)
            ids = [node.attrib.get("id", "") for node in root.iter(f"{P}cNvPr")]
            repeated = sorted(value for value, count in Counter(ids).items() if value and count > 1)
            if repeated:
                duplicate_cnvpr[slide_name] = repeated
            for node in root.iter():
                if local_name(node.tag) == "creationId":
                    value = node.attrib.get("id") or node.attrib.get("val") or ""
                    if value:
                        creation_ids.append((slide_name, value))

        for notes_name in notes_parts:
            root = parsed_xml.get(notes_name)
            if root is None:
                notes_shape_ok = False
                add_issue(issues, f"missing parsed notes root: {notes_name}")
                continue
            if local_name(root.tag) != "notes" or root.find(f"{P}cSld") is None or root.find(f"{P}cSld/{P}spTree") is None:
                notes_shape_ok = False
                add_issue(issues, f"{notes_name}: missing notes/cSld/spTree structure")
            all_notes_text[notes_name] = extract_text(root)
            all_notes_paragraphs[notes_name] = extract_paragraphs(root)

        report["authored_backgrounds"] = authored_backgrounds
        report["checks"]["no_authored_slide_backgrounds"] = not authored_backgrounds
        if authored_backgrounds:
            issues.append(f"authored slide backgrounds found: {authored_backgrounds}")
        report["duplicate_cnvpr_ids"] = duplicate_cnvpr
        report["checks"]["unique_cnvpr_ids_per_slide"] = not duplicate_cnvpr
        if duplicate_cnvpr:
            issues.append(f"duplicate cNvPr IDs within slides: {duplicate_cnvpr}")
        creation_values = [value for _, value in creation_ids]
        duplicate_creation_ids = sorted(value for value, count in Counter(creation_values).items() if count > 1)
        report["creation_id_count"] = len(creation_ids)
        report["duplicate_creation_ids"] = duplicate_creation_ids
        report["checks"]["unique_creation_ids"] = not duplicate_creation_ids
        if duplicate_creation_ids:
            issues.append(f"duplicate creation IDs: {duplicate_creation_ids}")
        report["checks"]["slide_shape_structure"] = slide_shape_ok
        report["checks"]["notes_shape_structure"] = notes_shape_ok

        expected_titles_ok = True
        notes_length_ok = True
        for index, expected_title in enumerate(EXPECTED_TITLES, start=1):
            slide_name = f"ppt/slides/slide{index}.xml"
            notes_name = f"ppt/notesSlides/notesSlide{index}.xml"
            notes_text = all_notes_text.get(notes_name, "")
            paragraphs = all_slide_paragraphs.get(slide_name, [])
            if not paragraphs or paragraphs[0] != expected_title:
                expected_titles_ok = False
                actual_title = paragraphs[0] if paragraphs else "<missing>"
                add_issue(issues, f"{slide_name}: title is {actual_title!r}, expected {expected_title!r}")
            if len(notes_text.strip()) < 80:
                notes_length_ok = False
                add_issue(issues, f"{notes_name}: narration is unexpectedly short ({len(notes_text.strip())} chars)")
        report["checks"]["slide_titles"] = expected_titles_ok
        report["checks"]["notes_are_substantive"] = notes_length_ok
        report["notes_character_lengths"] = {
            name: len(text.strip()) for name, text in all_notes_text.items()
        }

        slide_text_blob = "\n".join(all_slide_text.values())
        notes_text_blob = "\n".join(all_notes_text.values())
        forbidden_hits = {
            term: [name for name, text in {**all_slide_text, **all_notes_text}.items() if term in text]
            for term in FORBIDDEN_TERMS
        }
        forbidden_hits = {term: locations for term, locations in forbidden_hits.items() if locations}
        forbidden_hits["64_hex_identifier"] = [
            name
            for name, text in {**all_slide_text, **all_notes_text}.items()
            if HEX64_RE.search(text)
        ]
        forbidden_hits = {term: locations for term, locations in forbidden_hits.items() if locations}
        report["forbidden_hits"] = forbidden_hits
        report["checks"]["forbidden_language_scan"] = not forbidden_hits
        if forbidden_hits:
            issues.append(f"forbidden-language hits: {forbidden_hits}")

        font_sizes: list[int] = []
        font_faces: Counter[str] = Counter()
        skipped_placeholder_shapes = 0
        for slide_name in slide_parts:
            root = parsed_xml.get(slide_name)
            if root is None:
                continue
            for shape in root.findall(f".//{P}sp"):
                if shape.find(f".//{P}ph") is not None:
                    skipped_placeholder_shapes += 1
                    continue
                for node in shape.iter():
                    if node.tag in {f"{A}rPr", f"{A}defRPr", f"{A}endParaRPr"}:
                        raw_size = node.attrib.get("sz")
                        if raw_size and raw_size.isdigit():
                            font_sizes.append(int(raw_size))
                        for child in node:
                            if child.tag in {f"{A}latin", f"{A}ea", f"{A}cs"} and child.attrib.get("typeface"):
                                font_faces[child.attrib["typeface"]] += 1
        min_font_size = min(font_sizes) if font_sizes else None
        report["font_size_hundredths_pt_min"] = min_font_size
        report["font_size_hundredths_pt_max"] = max(font_sizes) if font_sizes else None
        report["font_faces"] = dict(font_faces)
        report["font_shapes_skipping_placeholders"] = skipped_placeholder_shapes
        font_floor_ok = min_font_size is not None and min_font_size >= 1600
        report["checks"]["authored_font_floor_16pt"] = font_floor_ok
        if not font_floor_ok:
            add_issue(issues, f"authored font floor is {min_font_size}, expected at least 1600 hundredths pt")

        # Check authored shape transforms remain inside the 13.3333 x 7.5 inch page.
        # A small rounding tolerance accommodates EMU conversion in PPTXGenJS.
        page_w, page_h, tolerance = 12192000, 6858000, 2000
        geometry_errors: list[str] = []
        for slide_name in slide_parts:
            root = parsed_xml.get(slide_name)
            if root is None:
                continue
            for xfrm in root.findall(f".//{A}xfrm"):
                off = xfrm.find(f"{A}off")
                ext = xfrm.find(f"{A}ext")
                if off is None or ext is None:
                    continue
                try:
                    x, y = int(off.attrib.get("x", "0")), int(off.attrib.get("y", "0"))
                    cx, cy = int(ext.attrib.get("cx", "0")), int(ext.attrib.get("cy", "0"))
                except ValueError:
                    continue
                if x < -tolerance or y < -tolerance or x + cx > page_w + tolerance or y + cy > page_h + tolerance:
                    geometry_errors.append(f"{slide_name}: xfrm ({x},{y},{cx},{cy}) outside page")
        report["geometry_errors"] = geometry_errors
        report["checks"]["shape_geometry_within_page"] = not geometry_errors
        if geometry_errors:
            issues.extend(geometry_errors)

        source_map_path = OWNED_ROOT / "source-map.json"
        source_map_ok = False
        if source_map_path.exists():
            try:
                source_map = json.loads(source_map_path.read_text(encoding="utf-8"))
                if isinstance(source_map, list):
                    keys = [entry.get("page_id") for entry in source_map if isinstance(entry, dict)]
                elif isinstance(source_map, dict):
                    entries = source_map.get("slides", source_map)
                    keys = list(entries.keys()) if isinstance(entries, dict) else []
                else:
                    keys = []
                source_map_ok = keys == EXPECTED_SLIDES or set(keys) == set(EXPECTED_SLIDES)
                report["source_map_keys"] = keys
            except (OSError, json.JSONDecodeError) as exc:
                add_issue(issues, f"source-map.json unreadable: {exc}")
        else:
            add_issue(issues, f"missing source map: {source_map_path}")
        report["checks"]["source_map_covers_p108_p116"] = source_map_ok
        if not source_map_ok:
            add_issue(issues, "source-map.json does not cover exactly P108-P116")

        for index in range(1, 10):
            slide_name = f"ppt/slides/slide{index}.xml"
            notes_name = f"ppt/notesSlides/notesSlide{index}.xml"
            readback.append(f"[{EXPECTED_SLIDES[index - 1]}] {slide_name}")
            readback.extend(all_slide_paragraphs.get(slide_name, []))
            readback.append(f"NOTES {notes_name}")
            readback.extend(all_notes_paragraphs.get(notes_name, []))
            readback.append("")

    report["status"] = "PASS" if not issues else "FAIL"
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    READBACK_PATH.write_text("\n".join(readback) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    sys.exit(main())
