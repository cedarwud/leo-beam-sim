#!/usr/bin/env python3
"""Fail-closed QA for the six-slide educate.pptx native-layout proof."""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PR = "http://schemas.openxmlformats.org/package/2006/relationships"
A14 = "http://schemas.microsoft.com/office/drawing/2010/main"
M = "http://schemas.openxmlformats.org/officeDocument/2006/math"
NS = {"a": A, "p": P, "r": R, "pr": PR, "a14": A14, "m": M}

LATIN_FONT = "Times New Roman"
EAST_ASIA_FONT = "標楷體"
FORBIDDEN_WORD = "學生"
EXPECTED_TITLES = [
    "LoRaEnergySim × 智慧節能與物聯網應用",
    "節能不是只看功率變小",
    "LEO 只提供會改變的服務窗口",
    "先跑基準，再只改一個 policy block",
    "公式把操作連到證據",
    "一筆 result，先看證據鏈",
]
VARIABLE_TOKENS = {"lab-a-pace-rest"}
AUTHORITY_TEXT = "教育部智慧節能網路跨層系統整合教學聯盟"


def qn(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def slide_order(package: zipfile.ZipFile) -> list[str]:
    presentation = ET.fromstring(package.read("ppt/presentation.xml"))
    rels = ET.fromstring(package.read("ppt/_rels/presentation.xml.rels"))
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in rels.findall("pr:Relationship", NS)
    }
    ordered = []
    for node in presentation.findall("./p:sldIdLst/p:sldId", NS):
        target = targets.get(node.get(qn(R, "id"), ""))
        if not target:
            raise RuntimeError("presentation slide relationship is incomplete")
        ordered.append(posixpath.normpath(posixpath.join("ppt", target)))
    return ordered


def slide_rels_part(slide_part: str) -> str:
    name = posixpath.basename(slide_part)
    return posixpath.join(posixpath.dirname(slide_part), "_rels", f"{name}.rels")


def layout_target(package: zipfile.ZipFile, slide_part: str) -> str:
    rels = ET.fromstring(package.read(slide_rels_part(slide_part)))
    for rel in rels.findall("pr:Relationship", NS):
        if rel.get("Type", "").endswith("/slideLayout"):
            return posixpath.normpath(
                posixpath.join(posixpath.dirname(slide_part), rel.get("Target", ""))
            )
    raise RuntimeError(f"slide has no layout relationship: {slide_part}")


def text_of(node: ET.Element) -> str:
    return "".join(text.text or "" for text in node.findall(".//a:t", NS))


def title_shape(root: ET.Element) -> ET.Element | None:
    for shape in root.findall("./p:cSld/p:spTree/p:sp", NS):
        ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
        if ph is not None and ph.get("type") in {"title", "ctrTitle"}:
            return shape
    return None


def raw_latex_visible(text: str) -> bool:
    return bool(
        re.search(
            r"\\(?:sum|frac|mathit|mathrm|eta|gamma|Delta|begin|end)|\\\(|\\\)",
            text,
        )
    )


def minute_visible(text: str) -> bool:
    return bool(
        "分鐘" in text
        or re.search(r"\b\d+\s*(?:min|mins|minute|minutes)\b", text, re.I)
    )


def audit(
    pptx: Path,
    template: Path,
    latex_source: Path,
) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    metrics: dict[str, object] = {}

    with zipfile.ZipFile(pptx) as deck, zipfile.ZipFile(template) as source:
        bad = deck.testzip()
        if bad:
            errors.append(f"corrupt_zip_member={bad}")
        names = set(deck.namelist())
        ordered = slide_order(deck)
        metrics["slide_count"] = len(ordered)
        if len(ordered) != 6:
            errors.append(f"slide_count expected=6 actual={len(ordered)}")

        layouts = []
        for part in ordered:
            layouts.append(layout_target(deck, part))
        metrics["logical_layout_targets"] = layouts
        metrics["distinct_layout_count"] = len(set(layouts))
        if len(set(layouts)) != 6:
            errors.append(f"expected six distinct native layouts, got {layouts}")

        for prefix in ("ppt/theme/", "ppt/media/"):
            original_names = sorted(
                name for name in source.namelist() if name.startswith(prefix)
            )
            for name in original_names:
                if name not in names:
                    errors.append(f"missing original template asset: {name}")
                elif sha(deck.read(name)) != sha(source.read(name)):
                    errors.append(f"changed original template asset: {name}")

        presentation = ET.fromstring(deck.read("ppt/presentation.xml"))
        size = presentation.find("p:sldSz", NS)
        slide_cx = int(size.get("cx", "0")) if size is not None else 0
        slide_cy = int(size.get("cy", "0")) if size is not None else 0
        if (slide_cx, slide_cy) != (12192000, 6858000):
            errors.append(f"slide_size changed: {(slide_cx, slide_cy)}")

        visible_text = []
        title_values = []
        styled_runs = 0
        command_runs = 0
        variable_runs = 0
        slide_background_nodes = 0
        full_slide_fills = 0

        for page, part in enumerate(ordered, start=1):
            root = ET.fromstring(deck.read(part))
            slide_text = text_of(root)
            visible_text.append(slide_text)
            if FORBIDDEN_WORD in slide_text:
                errors.append(f"slide {page}: forbidden exact word")
            if minute_visible(slide_text):
                errors.append(f"slide {page}: visible minute/duration text")
            if raw_latex_visible(slide_text):
                errors.append(f"slide {page}: raw LaTeX command remains visible")

            backgrounds = root.findall("./p:cSld/p:bg", NS)
            slide_background_nodes += len(backgrounds)
            if backgrounds:
                errors.append(f"slide {page}: slide-level background node added")

            title = title_shape(root)
            if title is None:
                errors.append(f"slide {page}: missing native title placeholder")
                title_values.append("")
            else:
                title_values.append(text_of(title))

            for shape in root.findall("./p:cSld/p:spTree/p:sp", NS):
                xfrm = shape.find("./p:spPr/a:xfrm", NS)
                solid = shape.find("./p:spPr/a:solidFill", NS)
                if xfrm is not None and solid is not None and slide_cx and slide_cy:
                    ext = xfrm.find("a:ext", NS)
                    if ext is not None and int(ext.get("cx", "0")) >= 0.95 * slide_cx and int(
                        ext.get("cy", "0")
                    ) >= 0.95 * slide_cy:
                        full_slide_fills += 1
                        errors.append(f"slide {page}: full-slide solid-fill shape")

                is_title = shape is title
                for run in shape.findall(".//a:r", NS):
                    text = text_of(run)
                    if not text:
                        continue
                    styled_runs += 1
                    rpr = run.find("a:rPr", NS)
                    if rpr is None:
                        errors.append(f"slide {page}: visible run lacks rPr: {text!r}")
                        continue
                    latin = rpr.find("a:latin", NS)
                    east = rpr.find("a:ea", NS)
                    complex_font = rpr.find("a:cs", NS)
                    if latin is None or latin.get("typeface") != LATIN_FONT:
                        errors.append(f"slide {page}: Latin font mismatch: {text!r}")
                    if east is None or east.get("typeface") != EAST_ASIA_FONT:
                        errors.append(f"slide {page}: East Asian font mismatch: {text!r}")
                    if complex_font is None or complex_font.get("typeface") != LATIN_FONT:
                        errors.append(f"slide {page}: complex font mismatch: {text!r}")

                    if is_title:
                        expected_size = "2800"
                    elif text.strip().startswith("bash "):
                        expected_size = "1800"
                        command_runs += 1
                    else:
                        expected_size = "2400"
                    if rpr.get("sz") != expected_size:
                        errors.append(
                            f"slide {page}: font size expected={expected_size} text={text!r} actual={rpr.get('sz')}"
                        )

                    should_italic = text in VARIABLE_TOKENS
                    italic = rpr.get("i") in {"1", "true"}
                    if italic != should_italic:
                        errors.append(
                            f"slide {page}: italic mismatch expected={should_italic} text={text!r}"
                        )
                    variable_runs += int(should_italic)

        if title_values != EXPECTED_TITLES:
            errors.append(
                f"title roster mismatch expected={EXPECTED_TITLES!r} actual={title_values!r}"
            )

        equation_root = ET.fromstring(deck.read(ordered[4]))
        native_math_carriers = equation_root.findall(".//a14:m", NS)
        native_equations = equation_root.findall(".//m:oMath", NS)
        metrics["native_math_carriers"] = len(native_math_carriers)
        metrics["native_office_math_equations"] = len(native_equations)
        if not native_math_carriers or len(native_equations) < 2:
            errors.append(
                "logical slide 5 must contain editable a14:m / OMML equations"
            )

        screenshot_name = "ppt/media/c120-server-preview-import.png"
        if screenshot_name not in names:
            errors.append("verified server-preview screenshot media is missing")

        native_parts = [
            name
            for name in names
            if re.fullmatch(
                r"ppt/(?:slides/slide\d+|slideLayouts/slideLayout\d+|slideMasters/slideMaster\d+)\.xml",
                name,
            )
        ]
        footer_fields = 0
        footer_placeholders = 0
        authority_hits = 0
        for name in native_parts:
            root = ET.fromstring(deck.read(name))
            authority_hits += int(AUTHORITY_TEXT in text_of(root).replace(" ", ""))
            footer_fields += len(
                [
                    field
                    for field in root.findall(".//a:fld", NS)
                    if field.get("type", "").lower() == "slidenum"
                ]
            )
            footer_placeholders += len(
                [
                    ph
                    for ph in root.findall(".//p:ph", NS)
                    if ph.get("type") == "sldNum" or ph.get("idx") == "10"
                ]
            )
        if footer_fields or footer_placeholders or authority_hits:
            errors.append(
                f"footer remains fields={footer_fields} placeholders={footer_placeholders} authority={authority_hits}"
            )

        note_names = sorted(
            name
            for name in names
            if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)
        )
        nonempty_notes = 0
        for name in note_names:
            note_root = ET.fromstring(deck.read(name))
            note_text = text_of(note_root)
            if note_text.strip():
                nonempty_notes += 1
            if FORBIDDEN_WORD in note_text:
                errors.append(f"{name}: forbidden exact word")
            if minute_visible(note_text):
                errors.append(f"{name}: minute/duration text remains")
        if len(note_names) != 6 or nonempty_notes != 6:
            errors.append(
                f"speaker notes expected=6 parts={len(note_names)} nonempty={nonempty_notes}"
            )

        latex_text = latex_source.read_text(encoding="utf-8")
        required_latex = [
            r"E_{\mathit{endpoint}}",
            r"\sum_{s \in \mathcal{S}} P_s t_s",
            r"\frac{D_{\mathit{delivered}}}{E_{\mathit{endpoint}}}",
        ]
        for expression in required_latex:
            if expression not in latex_text:
                errors.append(f"LaTeX source missing expression: {expression}")

        metrics.update(
            {
                "titles": title_values,
                "styled_visible_runs": styled_runs,
                "command_runs_at_18pt": command_runs,
                "italic_variable_runs": variable_runs,
                "slide_level_background_nodes": slide_background_nodes,
                "full_slide_solid_fills": full_slide_fills,
                "notes_parts": len(note_names),
                "nonempty_notes": nonempty_notes,
                "footer_fields": footer_fields,
                "footer_placeholders": footer_placeholders,
                "authority_text_hits": authority_hits,
                "latex_source_sha256": sha(latex_source.read_bytes()),
            }
        )

    return {
        "status": "PASS" if not errors else "FAIL",
        "pptx": str(pptx.resolve()),
        "template": str(template.resolve()),
        "latex_source": str(latex_source.resolve()),
        "metrics": metrics,
        "warnings": warnings,
        "errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pptx", required=True, type=Path)
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--latex-source", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    report = audit(
        args.pptx.resolve(),
        args.template.resolve(),
        args.latex_source.resolve(),
    )
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"native proof QA: {report['status']} errors={len(report['errors'])} -> {args.report}"
    )
    for error in report["errors"][:40]:
        print(f"ERROR {error}")
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
