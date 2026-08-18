#!/usr/bin/env python3
"""Fail-closed native-template, typography, notes and content QA for C-120."""

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
PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"a": A, "p": P, "r": R, "pr": PKG_R}

LATIN_FONT = "Times New Roman"
EAST_ASIA_FONT = "標楷體"
TITLE_SIZE = "2800"
FORBIDDEN = "學生"
FIXED_TITLES = {
    6: "從預測到驗證",
    7: "操作與修改的五問框架",
    8: "120 分鐘：setup 與 labs",
    9: "Opening checkpoint",
}
VARIABLE_TOKENS = {
    "PACE_GAP_STEPS",
    "REST_DURING_GAP",
    "ENTER_QUALITY",
    "EXIT_QUALITY",
    "STABLE_STEPS",
    "BATCH_SIZE",
    "URGENT_MARGIN_S",
    "scenario_id",
}
PRESERVED_PREFIXES = (
    "ppt/slideMasters/",
    "ppt/slideLayouts/",
    "ppt/theme/",
    "ppt/media/",
)


def qn(ns: str, local: str) -> str:
    return f"{{{ns}}}{local}"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def slide_order(package: zipfile.ZipFile) -> list[str]:
    presentation = ET.fromstring(package.read("ppt/presentation.xml"))
    rels = ET.fromstring(package.read("ppt/_rels/presentation.xml.rels"))
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in rels.findall("pr:Relationship", NS)
    }
    ordered: list[str] = []
    for node in presentation.findall("./p:sldIdLst/p:sldId", NS):
        target = targets[node.get(qn(R, "id"))]
        ordered.append(posixpath.normpath(posixpath.join("ppt", target)))
    return ordered


def text_of(root: ET.Element) -> str:
    return "".join(node.text or "" for node in root.findall(".//a:t", NS))


def title_of(root: ET.Element) -> tuple[str, ET.Element | None]:
    for shape in root.findall(".//p:sp", NS):
        ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
        if ph is not None and ph.get("type") in {"title", "ctrTitle"}:
            return text_of(shape), shape
    return "", None


def run_kind(text: str) -> str:
    if text in VARIABLE_TOKENS:
        return "variable"
    if re.search(r"(?:=|\\(?:sum|frac|mathit|mathrm|Delta|gamma|eta)|_\{)", text):
        return "formula"
    return "prose"


def audit(pptx: Path, template: Path, expected_slides: int) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    metrics: dict[str, object] = {}

    with zipfile.ZipFile(pptx) as deck, zipfile.ZipFile(template) as source:
        names = set(deck.namelist())
        ordered = slide_order(deck)
        metrics["slide_count"] = len(ordered)
        if len(ordered) != expected_slides:
            errors.append(f"slide_count expected={expected_slides} actual={len(ordered)}")

        source_names = {
            name for name in source.namelist() if name.startswith(PRESERVED_PREFIXES)
        }
        missing_assets = sorted(source_names - names)
        changed_assets = sorted(
            name
            for name in source_names & names
            if sha(source.read(name)) != sha(deck.read(name))
        )
        metrics["preserved_template_assets"] = len(source_names)
        if missing_assets:
            errors.append(f"missing_template_assets={missing_assets}")
        if changed_assets:
            errors.append(f"changed_template_assets={changed_assets}")

        presentation = ET.fromstring(deck.read("ppt/presentation.xml"))
        size = presentation.find("p:sldSz", NS)
        slide_cx = int(size.get("cx", "0")) if size is not None else 0
        slide_cy = int(size.get("cy", "0")) if size is not None else 0

        title_count = 0
        styled_runs = 0
        formula_runs = 0
        variable_runs = 0
        background_nodes = 0
        full_slide_solid_fills = 0
        titles: dict[int, str] = {}

        for page, name in enumerate(ordered, start=1):
            root = ET.fromstring(deck.read(name))
            slide_text = text_of(root)
            if FORBIDDEN in slide_text:
                errors.append(f"slide {page}: forbidden exact word {FORBIDDEN}")
            if "\\(" in slide_text or "\\)" in slide_text:
                errors.append(f"slide {page}: LaTeX display delimiters remain visible")

            bgs = root.findall("./p:cSld/p:bg", NS)
            background_nodes += len(bgs)
            if bgs:
                errors.append(f"slide {page}: added slide-level background")

            title_text, title_shape = title_of(root)
            titles[page] = title_text
            if title_shape is None:
                errors.append(f"slide {page}: missing native title placeholder")
            else:
                title_count += 1

            for shape in root.findall(".//p:sp", NS):
                xfrm = shape.find("./p:spPr/a:xfrm", NS)
                solid = shape.find("./p:spPr/a:solidFill", NS)
                if xfrm is not None and solid is not None and slide_cx and slide_cy:
                    ext = xfrm.find("a:ext", NS)
                    if ext is not None:
                        if int(ext.get("cx", "0")) >= 0.95 * slide_cx and int(
                            ext.get("cy", "0")
                        ) >= 0.95 * slide_cy:
                            full_slide_solid_fills += 1
                            errors.append(f"slide {page}: full-slide solid-fill shape")

                is_title = shape is title_shape
                for run in shape.findall(".//a:r", NS):
                    text = text_of(run)
                    if not text:
                        continue
                    styled_runs += 1
                    rpr = run.find("a:rPr", NS)
                    if rpr is None:
                        errors.append(f"slide {page}: visible run lacks direct rPr: {text!r}")
                        continue
                    latin = rpr.find("a:latin", NS)
                    east = rpr.find("a:ea", NS)
                    cs = rpr.find("a:cs", NS)
                    if latin is None or latin.get("typeface") != LATIN_FONT:
                        errors.append(f"slide {page}: Latin font mismatch: {text!r}")
                    if east is None or east.get("typeface") != EAST_ASIA_FONT:
                        errors.append(f"slide {page}: East Asian font mismatch: {text!r}")
                    if cs is None or cs.get("typeface") != LATIN_FONT:
                        errors.append(f"slide {page}: complex font mismatch: {text!r}")
                    if is_title and rpr.get("sz") != TITLE_SIZE:
                        errors.append(f"slide {page}: title run is not 28 pt: {text!r}")
                    kind = run_kind(text)
                    expected_italic = kind in {"formula", "variable"}
                    actual_italic = rpr.get("i") in {"1", "true"}
                    if actual_italic != expected_italic:
                        errors.append(
                            f"slide {page}: italic mismatch kind={kind} text={text!r}"
                        )
                    formula_runs += int(kind == "formula")
                    variable_runs += int(kind == "variable")

        for page, expected in FIXED_TITLES.items():
            actual = titles.get(page)
            if actual != expected:
                errors.append(
                    f"slide {page}: fixed title mismatch expected={expected!r} actual={actual!r}"
                )

        note_names = sorted(
            name
            for name in names
            if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)
        )
        nonempty_notes = 0
        for name in note_names:
            root = ET.fromstring(deck.read(name))
            note_text = text_of(root)
            if FORBIDDEN in note_text:
                errors.append(f"{name}: forbidden exact word {FORBIDDEN}")
            if note_text.strip():
                nonempty_notes += 1
        if len(note_names) != expected_slides or nonempty_notes != expected_slides:
            errors.append(
                f"notes expected={expected_slides} parts={len(note_names)} nonempty={nonempty_notes}"
            )

        metrics.update(
            {
                "title_count": title_count,
                "styled_visible_runs": styled_runs,
                "formula_runs": formula_runs,
                "variable_runs": variable_runs,
                "slide_level_background_nodes": background_nodes,
                "full_slide_solid_fills": full_slide_solid_fills,
                "notes_parts": len(note_names),
                "nonempty_notes": nonempty_notes,
                "fixed_titles": titles,
            }
        )

    return {
        "status": "PASS" if not errors else "FAIL",
        "pptx": str(pptx.resolve()),
        "template": str(template.resolve()),
        "metrics": metrics,
        "warnings": warnings,
        "errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pptx", required=True, type=Path)
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--expected-slides", type=int, default=108)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    report = audit(args.pptx, args.template, args.expected_slides)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"native QA: {report['status']} slides={report['metrics'].get('slide_count')} "
        f"errors={len(report['errors'])} -> {args.report}"
    )
    if report["errors"]:
        for error in report["errors"][:30]:
            print(f"ERROR {error}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
