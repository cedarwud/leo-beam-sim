#!/usr/bin/env python3
"""Normalize the owner font contract without touching native backgrounds.

This is an OOXML-only text-style pass. It deliberately does not create shapes,
fills, masters, layouts, images, or slide backgrounds.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
XML = "http://www.w3.org/XML/1998/namespace"
NS = {"a": A, "p": P}

LATIN_FONT = "Times New Roman"
EAST_ASIA_FONT = "標楷體"
TITLE_SIZE = "2800"  # hundredths of a point
BODY_SIZE_DEFAULT = "2400"
FORMULA_RE = re.compile(r"(\\\(.*?\\\))", re.DOTALL)
FORMULA_BODY_RE = re.compile(
    r"^(?=.*(?:=|\\(?:sum|frac|mathit|mathrm|Delta|gamma|eta)|_\{)).+$",
    re.DOTALL,
)
VARIABLE_TOKENS = {
    "PACE_GAP_STEPS",
    "REST_DURING_GAP",
    "ENTER_QUALITY",
    "EXIT_QUALITY",
    "STABLE_STEPS",
    "BATCH_SIZE",
    "URGENT_MARGIN_S",
    "scenario_id",
    "run_id",
    "student_policy.py",
    "lab-a-pace-rest",
}
VARIABLE_PATTERN = "|".join(
    re.escape(token) for token in sorted(VARIABLE_TOKENS, key=len, reverse=True)
)
SPECIAL_SPLIT_RE = re.compile(
    rf"(\\\(.*?\\\)|(?<=LaTeX：)[^\r\n]+|(?<![A-Za-z0-9_])(?:{VARIABLE_PATTERN})(?![A-Za-z0-9_]))",
    re.DOTALL,
)


def qn(ns: str, local: str) -> str:
    return f"{{{ns}}}{local}"


def ensure_child(parent: ET.Element, local: str) -> ET.Element:
    child = parent.find(qn(A, local))
    if child is None:
        child = ET.SubElement(parent, qn(A, local))
    return child


def ensure_run_properties(run: ET.Element) -> ET.Element:
    rpr = run.find(qn(A, "rPr"))
    if rpr is None:
        rpr = ET.Element(qn(A, "rPr"))
        run.insert(0, rpr)
    return rpr


def apply_font_contract(rpr: ET.Element, *, italic: bool, title: bool) -> None:
    rpr.set("i", "1" if italic else "0")
    if title:
        rpr.set("sz", TITLE_SIZE)
    ensure_child(rpr, "latin").set("typeface", LATIN_FONT)
    ensure_child(rpr, "ea").set("typeface", EAST_ASIA_FONT)
    ensure_child(rpr, "cs").set("typeface", LATIN_FONT)


def run_text(run: ET.Element) -> str:
    text = run.find(qn(A, "t"))
    return text.text or "" if text is not None else ""


def shape_text(shape: ET.Element) -> str:
    return "".join(node.text or "" for node in shape.findall(".//a:t", NS))


def set_run_text(run: ET.Element, value: str) -> None:
    text = run.find(qn(A, "t"))
    if text is None:
        text = ET.SubElement(run, qn(A, "t"))
    text.text = value
    if value.startswith(" ") or value.endswith(" ") or "\n" in value:
        text.set(qn(XML, "space"), "preserve")


def split_special_runs(root: ET.Element) -> tuple[int, int]:
    formula_count = 0
    variable_count = 0
    for parent in list(root.iter()):
        original_children = list(parent)
        for run in original_children:
            if run.tag != qn(A, "r"):
                continue
            text = run_text(run)
            if not SPECIAL_SPLIT_RE.search(text):
                continue
            parts = [part for part in SPECIAL_SPLIT_RE.split(text) if part]
            index = list(parent).index(run)
            parent.remove(run)
            for offset, part in enumerate(parts):
                clone = copy.deepcopy(run)
                is_delimited_formula = bool(FORMULA_RE.fullmatch(part))
                is_formula = is_delimited_formula or bool(FORMULA_BODY_RE.fullmatch(part))
                is_variable = part in VARIABLE_TOKENS
                # Keep the editable LaTeX source while removing display-only
                # delimiters.  The retained text is still valid LaTeX input.
                display_text = part[2:-2] if is_delimited_formula else part
                set_run_text(clone, display_text)
                apply_font_contract(
                    ensure_run_properties(clone),
                    italic=is_formula or is_variable,
                    title=False,
                )
                if is_formula:
                    formula_count += 1
                if is_variable:
                    variable_count += 1
                parent.insert(index + offset, clone)
    return formula_count, variable_count


def split_newline_paragraphs(root: ET.Element) -> int:
    """Convert embedded newlines to separate DrawingML paragraphs.

    Separate paragraphs reset character style after italic variable runs and
    are read back as ``\n`` by the template validator, unlike soft ``a:br``
    breaks.
    """

    break_count = 0
    for parent in list(root.iter()):
        for paragraph in list(parent):
            if paragraph.tag != qn(A, "p"):
                continue
            if not any("\n" in run_text(run) for run in paragraph.findall("a:r", NS)):
                continue

            ppr = paragraph.find(qn(A, "pPr"))
            end_rpr = paragraph.find(qn(A, "endParaRPr"))
            segments: list[list[ET.Element]] = [[]]
            for child in list(paragraph):
                if child.tag in {qn(A, "pPr"), qn(A, "endParaRPr")}:
                    continue
                if child.tag != qn(A, "r"):
                    segments[-1].append(copy.deepcopy(child))
                    continue
                parts = run_text(child).split("\n")
                for part_index, part in enumerate(parts):
                    if part:
                        clone = copy.deepcopy(child)
                        set_run_text(clone, part)
                        segments[-1].append(clone)
                    if part_index < len(parts) - 1:
                        segments.append([])
                        break_count += 1

            index = list(parent).index(paragraph)
            parent.remove(paragraph)
            for offset, segment in enumerate(segments):
                new_paragraph = ET.Element(qn(A, "p"))
                if ppr is not None:
                    new_paragraph.append(copy.deepcopy(ppr))
                for child in segment:
                    new_paragraph.append(child)
                if end_rpr is not None:
                    new_paragraph.append(copy.deepcopy(end_rpr))
                parent.insert(index + offset, new_paragraph)
    return break_count


def is_formula_text(text: str) -> bool:
    return bool(FORMULA_RE.fullmatch(text) or FORMULA_BODY_RE.fullmatch(text))


def is_body_shape(shape: ET.Element) -> bool:
    ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
    if ph is None:
        return False
    return ph.get("idx") != "10" and ph.get("type") not in {
        "title",
        "ctrTitle",
        "sldNum",
        "dt",
        "ftr",
    }


def disable_inherited_bullets(shape: ET.Element) -> int:
    """Turn off bullets only inside the native content placeholder.

    The educate source slide inherits a bullet from its layout.  Our checkpoint
    uses large evidence statements rather than a bullet list, so an explicit
    ``a:buNone`` keeps the original placeholder and background while removing
    the unintended marker.
    """

    changed = 0
    bullet_tags = {
        qn(A, "buNone"),
        qn(A, "buAutoNum"),
        qn(A, "buChar"),
        qn(A, "buBlip"),
    }
    late_tags = {qn(A, "tabLst"), qn(A, "defRPr"), qn(A, "extLst")}
    for paragraph in shape.findall(".//a:p", NS):
        ppr = paragraph.find(qn(A, "pPr"))
        if ppr is None:
            ppr = ET.Element(qn(A, "pPr"))
            paragraph.insert(0, ppr)
        for child in list(ppr):
            if child.tag in bullet_tags:
                ppr.remove(child)
        insert_at = len(ppr)
        for index, child in enumerate(list(ppr)):
            if child.tag in late_tags:
                insert_at = index
                break
        ppr.insert(insert_at, ET.Element(qn(A, "buNone")))
        changed += 1
    return changed


def body_size_override(shape: ET.Element) -> str | None:
    """Start every learner-facing body placeholder at the owner-fixed size."""

    del shape
    return BODY_SIZE_DEFAULT


def is_title_shape(shape: ET.Element) -> bool:
    ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
    if ph is None:
        return False
    return ph.get("type") in {"title", "ctrTitle"}


def format_slide(xml_bytes: bytes) -> tuple[bytes, dict[str, object]]:
    root = ET.fromstring(xml_bytes)
    background_count_before = len(root.findall("./p:cSld/p:bg", NS))
    formula_count, variable_count = split_special_runs(root)
    explicit_paragraph_breaks = split_newline_paragraphs(root)
    title_count = 0
    styled_run_count = 0
    body_paragraphs_without_bullets = 0
    body_font_sizes_pt: list[int] = []

    for shape in root.findall(".//p:sp", NS):
        title = is_title_shape(shape)
        body_size = body_size_override(shape) if is_body_shape(shape) else None
        if title:
            title_count += 1
        if is_body_shape(shape):
            body_paragraphs_without_bullets += disable_inherited_bullets(shape)
            if body_size:
                body_font_sizes_pt.append(int(body_size) // 100)

        for run in shape.findall(".//a:r", NS):
            text = run_text(run)
            italic = is_formula_text(text) or text in VARIABLE_TOKENS
            apply_font_contract(
                ensure_run_properties(run),
                italic=italic,
                title=title,
            )
            if body_size:
                ensure_run_properties(run).set("sz", body_size)
            if text:
                styled_run_count += 1

        for rpr in shape.findall(".//a:defRPr", NS) + shape.findall(".//a:endParaRPr", NS):
            apply_font_contract(rpr, italic=False, title=title)
            if body_size:
                rpr.set("sz", body_size)

        for rpr in shape.findall(".//a:br/a:rPr", NS):
            apply_font_contract(rpr, italic=False, title=title)
            if body_size:
                rpr.set("sz", body_size)

    background_count_after = len(root.findall("./p:cSld/p:bg", NS))
    if background_count_after != background_count_before:
        raise RuntimeError("Slide background contract changed during font formatting")

    ET.register_namespace("a", A)
    ET.register_namespace("p", P)
    xml_out = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return xml_out, {
        "formula_run_count": formula_count,
        "variable_run_count": variable_count,
        "explicit_paragraph_breaks": explicit_paragraph_breaks,
        "title_shape_count": title_count,
        "styled_run_count": styled_run_count,
        "body_paragraphs_without_bullets": body_paragraphs_without_bullets,
        "body_font_sizes_pt": body_font_sizes_pt,
        "background_nodes_unchanged": background_count_after == background_count_before,
    }


def slide_number(name: str) -> int:
    match = re.fullmatch(r"ppt/slides/slide([1-9]\d*)\.xml", name)
    return int(match.group(1)) if match else 0


def process(input_path: Path, output_path: Path, report_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    slide_reports: list[dict[str, object]] = []
    output_entries: dict[str, bytes] = {}

    with zipfile.ZipFile(input_path, "r") as source:
        for info in source.infolist():
            data = source.read(info.filename)
            if slide_number(info.filename):
                data, metrics = format_slide(data)
                slide_reports.append(
                    {"slide": slide_number(info.filename), **metrics}
                )
            output_entries[info.filename] = data

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for filename, data in output_entries.items():
            target.writestr(filename, data)

    slide_reports.sort(key=lambda item: int(item["slide"]))
    report = {
        "input": str(input_path),
        "output": str(output_path),
        "font_contract": {
            "latin": LATIN_FONT,
            "east_asia": EAST_ASIA_FONT,
            "title_size_pt": 28,
            "body_size_pt": 24,
            "default_italic": False,
            "formula_italic": True,
        },
        "background_policy": "unchanged native educate.pptx references; no fill added",
        "slides": slide_reports,
        "formula_runs_total": sum(int(item["formula_run_count"]) for item in slide_reports),
        "variable_runs_total": sum(int(item["variable_run_count"]) for item in slide_reports),
        "all_background_nodes_unchanged": all(
            bool(item["background_nodes_unchanged"]) for item in slide_reports
        ),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    process(args.input.resolve(), args.output.resolve(), args.report.resolve())


if __name__ == "__main__":
    main()
