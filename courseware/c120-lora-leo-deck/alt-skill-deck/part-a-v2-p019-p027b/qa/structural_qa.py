#!/usr/bin/env python3
"""Structural and content QA for the owned P019–P027b PPTX."""

from __future__ import annotations

import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PPTX = ROOT.parent / "latest" / "LoRaEnergySim-LEO-ALT-PART-A-V2-P019-P027B-REVIEW.pptx"
SNAPSHOT = ROOT / "source-snapshot.json"
OUT = ROOT / "qa" / "structural-qa.json"

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}

FORBIDDEN = [
    "學生", "老師", "講師", "你", "分鐘", "SHA", "checksum", "ZIP test",
    "製作備註", "production notes", "舊截圖", "本頁不",
]


def rel_target(source: str, target: str) -> str:
    base = posixpath.dirname(source)
    return posixpath.normpath(posixpath.join(base, target)).lstrip("./")


def text_from(element) -> str:
    return "".join(element.itertext())


def read_rels(z: zipfile.ZipFile, rels_name: str) -> dict[str, tuple[str, str]]:
    root = ET.fromstring(z.read(rels_name))
    result = {}
    for rel in root.findall("pr:Relationship", NS):
        result[rel.attrib["Id"]] = (rel.attrib["Type"], rel.attrib["Target"])
    return result


def source_part_from_rels(rels_name: str) -> str:
    """Map an OOXML relationship part to the part it describes."""
    if rels_name == "_rels/.rels":
        return ""
    stem = rels_name[:-5]  # remove .rels
    marker = "/_rels/"
    if marker not in stem:
        raise ValueError(f"unexpected relationships part: {rels_name}")
    return stem.replace(marker, "/", 1)


def slide_text_and_sizes(root):
    texts = []
    sizes = []
    font_errors = []
    shape_names = {}
    for shape in root.findall(".//p:sp", NS):
        c_nv = shape.find("p:nvSpPr/p:cNvPr", NS)
        name = c_nv.attrib.get("name", "") if c_nv is not None else ""
        shape_names[id(shape)] = name
        text = "".join(t.text or "" for t in shape.findall(".//a:t", NS))
        if text:
            texts.append(text)
        if name.startswith("Content Placeholder"):
            continue
        for run in shape.findall(".//a:r", NS):
            run_prop = run.find("a:rPr", NS)
            if run_prop is None:
                font_errors.append({"shape": name, "issue": "missing run properties"})
                continue
            latin = run_prop.find("a:latin", NS)
            ea = run_prop.find("a:ea", NS)
            if latin is None or latin.attrib.get("typeface") != "Times New Roman":
                font_errors.append({"shape": name, "issue": "latin font", "value": latin.attrib.get("typeface") if latin is not None else None})
            if ea is None or ea.attrib.get("typeface") != "標楷體":
                font_errors.append({"shape": name, "issue": "CJK font", "value": ea.attrib.get("typeface") if ea is not None else None})
        for run_prop in shape.findall(".//a:rPr", NS):
            if "sz" in run_prop.attrib:
                sizes.append((int(run_prop.attrib["sz"]) / 100, name, text[:80]))
    return texts, sizes, font_errors


def qa() -> dict:
    checks: dict[str, object] = {}
    failures: list[str] = []
    if not PPTX.exists():
        raise SystemExit(f"missing PPTX: {PPTX}")
    with zipfile.ZipFile(PPTX) as z:
        checks["zip_test"] = z.testzip() is None
        if not checks["zip_test"]:
            failures.append("zip test failed")
        names = set(z.namelist())

        xml_errors = []
        all_text = []
        all_sizes = []
        font_contract_errors = []
        creation_id_duplicates = []
        direct_backgrounds = []
        for name in sorted(n for n in names if n.endswith(".xml") or n.endswith(".rels")):
            try:
                root = ET.fromstring(z.read(name))
            except ET.ParseError as exc:
                xml_errors.append(f"{name}: {exc}")
                continue
            if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                texts, sizes, fonts = slide_text_and_sizes(root)
                all_text.extend(texts)
                all_sizes.extend(sizes)
                if fonts:
                    font_contract_errors.extend({"part": name, **item} for item in fonts)
                if root.find("p:cSld/p:bg", NS) is not None:
                    direct_backgrounds.append(name)
            if name.startswith("ppt/notesSlides/notesSlide") and name.endswith(".xml"):
                all_text.extend("".join(t.text or "" for t in root.findall(".//a:t", NS)))
            ids = [node.attrib.get("id") for node in root.findall(".//p:cNvPr", NS) if node.attrib.get("id")]
            duplicates = sorted({item for item in ids if ids.count(item) > 1})
            if duplicates:
                creation_id_duplicates.append({"part": name, "ids": duplicates})
        checks["xml_parse"] = not xml_errors
        checks["xml_errors"] = xml_errors
        if xml_errors:
            failures.append("recursive XML parse failure")

        rel_errors = []
        for rels_name in sorted(n for n in names if n.endswith(".rels")):
            source = source_part_from_rels(rels_name)
            for rel_id, (_typ, target) in read_rels(z, rels_name).items():
                if target.startswith(("http:", "https:", "mailto:")):
                    continue
                target_name = rel_target(source, target)
                if target_name not in names:
                    rel_errors.append(f"{rels_name}:{rel_id}->{target_name}")
        checks["relationship_targets"] = not rel_errors
        checks["relationship_errors"] = rel_errors
        if rel_errors:
            failures.append("relationship target missing")

        content_type_errors = []
        ct_root = ET.fromstring(z.read("[Content_Types].xml"))
        for override in ct_root.findall("ct:Override", NS):
            target = override.attrib["PartName"].lstrip("/")
            if target not in names:
                content_type_errors.append(target)
        checks["content_types"] = not content_type_errors
        checks["content_type_errors"] = content_type_errors
        if content_type_errors:
            failures.append("content type target missing")

        pres_root = ET.fromstring(z.read("ppt/presentation.xml"))
        pres_rels = read_rels(z, "ppt/_rels/presentation.xml.rels")
        slide_ids = pres_root.findall("p:sldIdLst/p:sldId", NS)
        slide_targets = []
        for slide_id in slide_ids:
            rid = slide_id.attrib.get("{%s}id" % NS["r"])
            if rid not in pres_rels:
                failures.append(f"presentation relationship missing: {rid}")
                continue
            slide_targets.append(rel_target("ppt/presentation.xml", pres_rels[rid][1]))
        slide_names = [f"ppt/slides/slide{index}.xml" for index in range(1, 16)]
        notes_names = sorted(n for n in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", n))
        checks["slide_count"] = len(slide_ids)
        checks["notes_count"] = len(notes_names)
        checks["slide_targets"] = slide_targets
        if len(slide_ids) != 15 or len(slide_names) != 15:
            failures.append("expected 15 authored slides")
        if len(notes_names) != 15:
            failures.append("expected 15 notes slides")
        if slide_targets != slide_names:
            failures.append("presentation slide targets do not match slide parts")

        layout_errors = []
        notes_errors = []
        empty_notes = []
        title_texts = []
        for index in range(1, 16):
            slide_name = f"ppt/slides/slide{index}.xml"
            rels_name = f"ppt/slides/_rels/slide{index}.xml.rels"
            rels = read_rels(z, rels_name)
            layout = [target for typ, target in rels.values() if typ.endswith("/slideLayout")]
            if layout != ["../slideLayouts/slideLayout2.xml"]:
                layout_errors.append({"slide": index, "layout": layout})
            note_targets = [target for typ, target in rels.values() if typ.endswith("/notesSlide")]
            if note_targets != [f"../notesSlides/notesSlide{index}.xml"]:
                notes_errors.append({"slide": index, "notes": note_targets})
            slide_root = ET.fromstring(z.read(slide_name))
            title_text = ""
            for shape in slide_root.findall(".//p:sp", NS):
                placeholder = shape.find("p:nvSpPr/p:nvPr/p:ph", NS)
                if placeholder is not None and placeholder.attrib.get("type") == "title":
                    title_text = "".join(t.text or "" for t in shape.findall(".//a:t", NS))
                    break
            title_texts.append(title_text)
            note_root = ET.fromstring(z.read(f"ppt/notesSlides/notesSlide{index}.xml"))
            note_text = "".join(t.text or "" for t in note_root.findall(".//a:t", NS)).strip()
            if not note_text:
                empty_notes.append(index)
        checks["layout2_only"] = not layout_errors
        checks["layout_errors"] = layout_errors
        checks["notes_relationships"] = not notes_errors
        checks["notes_relationship_errors"] = notes_errors
        checks["empty_notes"] = empty_notes
        checks["titles"] = title_texts
        if layout_errors:
            failures.append("not all slides point to slideLayout2.xml")
        if notes_errors:
            failures.append("notes relationship mismatch")
        if empty_notes:
            failures.append("empty notes slide")

        checks["direct_slide_backgrounds"] = direct_backgrounds
        if direct_backgrounds:
            failures.append("authored slide background present")

        checks["duplicate_creation_ids"] = creation_id_duplicates
        if creation_id_duplicates:
            failures.append("duplicate creation IDs")

        min_size = min((item[0] for item in all_sizes), default=999)
        under_floor = [item for item in all_sizes if item[0] < 16]
        checks["minimum_authored_font_pt"] = min_size
        checks["font_floor_16pt"] = not under_floor
        checks["font_floor_violations"] = under_floor
        if under_floor:
            failures.append("authored text below 16pt")

        checks["font_contract_errors"] = font_contract_errors
        checks["font_contract_clean"] = not font_contract_errors
        if font_contract_errors:
            failures.append("authored text font contract mismatch")

        text_blob = "\n".join(all_text)
        forbidden_hits = {term: text_blob.lower().count(term.lower()) for term in FORBIDDEN if term.lower() in text_blob.lower()}
        checks["forbidden_language_hits"] = forbidden_hits
        checks["forbidden_language_clean"] = not forbidden_hits
        if forbidden_hits:
            failures.append("forbidden language present")

    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    # Visible title bars are intentionally ID-free for the classroom.  Preserve
    # the authoritative source order internally while checking that no Pxxx ID
    # leaks into a visible title.
    expected_ids = [slide["title"].split("｜", 1)[0] for slide in snapshot["slides"]]
    visible_id_hits = [title for title in title_texts if re.match(r"^P\d+[a-z]?｜", title)]
    checks["source_title_alignment"] = len(title_texts) == len(expected_ids) and all(title.strip() for title in title_texts)
    checks["title_ids"] = expected_ids
    checks["visible_titles_id_free"] = not visible_id_hits
    checks["visible_title_id_hits"] = visible_id_hits
    if not checks["source_title_alignment"]:
        failures.append("visible title count/order differs from authoritative source")
    if visible_id_hits:
        failures.append("visible title contains a Pxxx ID")

    checks["all_checks_pass"] = not failures
    checks["failures"] = failures
    OUT.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return checks


if __name__ == "__main__":
    report = qa()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report["all_checks_pass"] else 1)
