#!/usr/bin/env python3
"""Recompose the six-slide C-120 native-layout proof around the educate template.

This is a narrowly scoped OOXML editing pass.  It deliberately starts from a
filled, equation-bearing native template deck and changes only slide content:
the slide/layout/master background artwork, theme, logo and speaker notes stay
in the input package.  The new content uses transparent native shapes, open
frames, lines and one evidence picture; it does not add a slide-level fill or
large solid cards.

The equations on logical slide 5 are kept as native ``a14:m`` / OMML.  The
existing SVG fallback remains in the package and is additionally paired with a
PNG fallback so LibreOffice previews have a deterministic raster choice.  The
PNG is not the PowerPoint editing choice: Office-capable viewers still see the
editable native equation branch.

The script is intentionally fail-closed.  It requires the six-slide input,
the expected title roster, an equation-bearing logical slide 5, and a current
browser evidence image.
It writes an atomic PPTX, a design report and a structural QA report.  It does
not modify donor decks, source authority, notes, or any file outside the output
paths supplied by the caller.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import posixpath
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Iterable, Sequence
from xml.etree import ElementTree as ET


# OOXML namespaces.
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
A14 = "http://schemas.microsoft.com/office/drawing/2010/main"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
M = "http://schemas.openxmlformats.org/officeDocument/2006/math"
MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
PR = "http://schemas.openxmlformats.org/package/2006/relationships"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

for _prefix, _uri in (
    ("a", A),
    ("a14", A14),
    ("ct", CT),
    ("m", M),
    ("mc", MC),
    ("p", P),
    ("pr", PR),
    ("r", R),
):
    ET.register_namespace(_prefix, _uri)


EMU = 914400
SLIDE_CX = 12_192_000
SLIDE_CY = 6_858_000
LATIN_FONT = "Times New Roman"
EAST_ASIA_FONT = "標楷體"
TITLE_SIZE = "2800"
BODY_SIZE = "2400"
SMALL_SIZE = "2000"
COMMAND_SIZE = "1800"
PRIMARY = "35377F"  # educate.pptx dk1 / template navy
TEXT = "1C1C1C"
GOLD = "ECD882"  # educate.pptx accent1
PALE_BLUE = "B7C1EB"  # educate.pptx lt2
WHITE = "FFFFFF"
IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
SVG_CONTENT_TYPE = "image/svg+xml"
PNG_CONTENT_TYPE = "image/png"
EXPECTED_TITLES = (
    "LoRaEnergySim × 智慧節能與物聯網應用",
    "節能不是只看功率變小",
    "LEO 只提供會改變的服務窗口",
    "先跑基準，再只改一個 policy block",
    "公式把操作連到證據",
    "一筆 result，先看證據鏈",
)


def qn(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def serialize(root: ET.Element) -> bytes:
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _read_xml(data: bytes, part: str) -> ET.Element:
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise RuntimeError(f"invalid XML in {part}: {exc}") from exc


def _slide_rels_part(slide_part: str) -> str:
    directory, filename = posixpath.split(slide_part)
    return posixpath.join(directory, "_rels", f"{filename}.rels")


def _rel_target(source_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def slide_order(entries: dict[str, bytes]) -> list[str]:
    presentation = _read_xml(entries["ppt/presentation.xml"], "ppt/presentation.xml")
    rels = _read_xml(
        entries["ppt/_rels/presentation.xml.rels"],
        "ppt/_rels/presentation.xml.rels",
    )
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in rels.findall(qn(PR, "Relationship"))
    }
    result: list[str] = []
    for slide_id in presentation.findall(f"./{qn(P, 'sldIdLst')}/{qn(P, 'sldId')}"):
        rid = slide_id.get(qn(R, "id"))
        target = targets.get(rid)
        if not target:
            raise RuntimeError(f"missing slide target for {rid}")
        result.append(_rel_target("ppt/presentation.xml", target))
    return result


def sp_tree(root: ET.Element) -> ET.Element:
    tree = root.find(f"./{qn(P, 'cSld')}/{qn(P, 'spTree')}")
    if tree is None:
        raise RuntimeError("slide has no p:cSld/p:spTree")
    return tree


def shape_text(node: ET.Element) -> str:
    return "".join((t.text or "") for t in node.findall(f".//{qn(A, 't')}"))


def placeholder(node: ET.Element) -> ET.Element | None:
    return node.find(f"./{qn(P, 'nvSpPr')}/{qn(P, 'nvPr')}/{qn(P, 'ph')}")


def is_title(node: ET.Element) -> bool:
    ph = placeholder(node)
    return ph is not None and ph.get("type") in {"title", "ctrTitle"}


def is_subtitle(node: ET.Element) -> bool:
    ph = placeholder(node)
    return ph is not None and ph.get("type") == "subTitle"


def next_id(root: ET.Element) -> int:
    values: list[int] = []
    for prop in root.findall(f".//{qn(P, 'cNvPr')}"):
        try:
            values.append(int(prop.get("id", "0")))
        except (TypeError, ValueError):
            pass
    return max(values, default=1) + 1


def _next_rel_id(rels_root: ET.Element) -> str:
    values: list[int] = []
    for rel in rels_root.findall(qn(PR, "Relationship")):
        match = re.fullmatch(r"rId(\d+)", rel.get("Id", ""))
        if match:
            values.append(int(match.group(1)))
    return f"rId{max(values, default=0) + 1}"


def _slide_size(entries: dict[str, bytes]) -> tuple[int, int]:
    root = _read_xml(entries["ppt/presentation.xml"], "ppt/presentation.xml")
    node = root.find(qn(P, "sldSz"))
    if node is None:
        return SLIDE_CX, SLIDE_CY
    try:
        cx, cy = int(node.get("cx", SLIDE_CX)), int(node.get("cy", SLIDE_CY))
    except (TypeError, ValueError) as exc:
        raise RuntimeError("presentation slide size is not numeric") from exc
    if cx <= 0 or cy <= 0:
        raise RuntimeError("presentation slide size must be positive")
    return cx, cy


def set_geometry(node: ET.Element, x: float, y: float, width: float, height: float) -> None:
    sp_pr = node.find(qn(P, "spPr"))
    if sp_pr is None:
        sp_pr = ET.SubElement(node, qn(P, "spPr"))
    xfrm = sp_pr.find(qn(A, "xfrm"))
    if xfrm is None:
        xfrm = ET.Element(qn(A, "xfrm"))
        sp_pr.insert(0, xfrm)
    for child in list(xfrm):
        xfrm.remove(child)
    off = ET.SubElement(xfrm, qn(A, "off"), {"x": str(round(x * EMU)), "y": str(round(y * EMU))})
    ET.SubElement(
        xfrm,
        qn(A, "ext"),
        {"cx": str(round(width * EMU)), "cy": str(round(height * EMU))},
    )


def _set_body_pr(body: ET.Element, *, anchor: str = "t", wrap: str = "square") -> None:
    body_pr = body.find(qn(A, "bodyPr"))
    if body_pr is None:
        body_pr = ET.Element(qn(A, "bodyPr"))
        body.insert(0, body_pr)
    body_pr.set("anchor", anchor)
    body_pr.set("wrap", wrap)
    for attr, value in (("lIns", "0"), ("rIns", "0"), ("tIns", "0"), ("bIns", "0")):
        body_pr.set(attr, value)
    # Do not allow inherited auto-fit to silently shrink the requested 24pt
    # body.  The caller is responsible for giving text enough room.
    for child in list(body_pr):
        if child.tag in {qn(A, "spAutoFit"), qn(A, "normAutofit"), qn(A, "prstTxWarp")}:
            body_pr.remove(child)


def _set_run_font(rpr: ET.Element, *, size: str, italic: bool, bold: bool, color: str) -> None:
    rpr.set("lang", "zh-TW")
    rpr.set("altLang", "en-US")
    rpr.set("sz", size)
    rpr.set("i", "1" if italic else "0")
    rpr.set("b", "1" if bold else "0")
    for child in list(rpr):
        if child.tag in {qn(A, "latin"), qn(A, "ea"), qn(A, "cs"), qn(A, "solidFill"), qn(A, "noFill")}:
            rpr.remove(child)
    fill = ET.SubElement(rpr, qn(A, "solidFill"))
    ET.SubElement(fill, qn(A, "srgbClr"), {"val": color})
    ET.SubElement(rpr, qn(A, "latin"), {"typeface": LATIN_FONT})
    ET.SubElement(rpr, qn(A, "ea"), {"typeface": EAST_ASIA_FONT})
    ET.SubElement(rpr, qn(A, "cs"), {"typeface": LATIN_FONT})


def _set_end_font(end: ET.Element, *, size: str, italic: bool, bold: bool, color: str) -> None:
    _set_run_font(end, size=size, italic=italic, bold=bold, color=color)


def _segments(line: object) -> list[dict[str, object]]:
    if isinstance(line, str):
        return [{"text": line}]
    if isinstance(line, dict):
        return [line]
    if isinstance(line, (list, tuple)):
        return [dict(item) if isinstance(item, dict) else {"text": str(item)} for item in line]
    raise TypeError(f"unsupported text line: {line!r}")


def _add_run(
    paragraph: ET.Element,
    text: str,
    *,
    size: str = BODY_SIZE,
    italic: bool = False,
    bold: bool = False,
    color: str = TEXT,
) -> ET.Element:
    run = ET.SubElement(paragraph, qn(A, "r"))
    rpr = ET.SubElement(run, qn(A, "rPr"))
    _set_run_font(rpr, size=size, italic=italic, bold=bold, color=color)
    node = ET.SubElement(run, qn(A, "t"))
    node.text = text
    return run


def _add_end_para_rpr(paragraph: ET.Element, *, size: str = BODY_SIZE, color: str = TEXT) -> None:
    end = ET.SubElement(paragraph, qn(A, "endParaRPr"))
    _set_end_font(end, size=size, italic=False, bold=False, color=color)


def add_text_box(
    root: ET.Element,
    *,
    name: str,
    lines: Sequence[object],
    x: float,
    y: float,
    width: float,
    height: float,
    size: str = BODY_SIZE,
    color: str = TEXT,
    align: str = "l",
    anchor: str = "t",
    bold: bool = False,
) -> ET.Element:
    tree = sp_tree(root)
    shape = ET.Element(qn(P, "sp"))
    nv = ET.SubElement(shape, qn(P, "nvSpPr"))
    c_nv = ET.SubElement(nv, qn(P, "cNvPr"), {"id": str(next_id(root)), "name": name})
    del c_nv
    cnv_sp = ET.SubElement(nv, qn(P, "cNvSpPr"), {"txBox": "1"})
    ET.SubElement(nv, qn(P, "nvPr"))
    sp_pr = ET.SubElement(shape, qn(P, "spPr"))
    xfrm = ET.SubElement(sp_pr, qn(A, "xfrm"))
    ET.SubElement(xfrm, qn(A, "off"), {"x": str(round(x * EMU)), "y": str(round(y * EMU))})
    ET.SubElement(xfrm, qn(A, "ext"), {"cx": str(round(width * EMU)), "cy": str(round(height * EMU))})
    geom = ET.SubElement(sp_pr, qn(A, "prstGeom"), {"prst": "rect"})
    ET.SubElement(geom, qn(A, "avLst"))
    ET.SubElement(sp_pr, qn(A, "noFill"))
    ln = ET.SubElement(sp_pr, qn(A, "ln"))
    ET.SubElement(ln, qn(A, "noFill"))
    body = ET.SubElement(shape, qn(P, "txBody"))
    _set_body_pr(body, anchor=anchor)
    ET.SubElement(body, qn(A, "lstStyle"))
    for line in lines:
        paragraph = ET.SubElement(body, qn(A, "p"))
        ppr = ET.SubElement(paragraph, qn(A, "pPr"), {"algn": align})
        ET.SubElement(ppr, qn(A, "buNone"))
        for segment in _segments(line):
            text_value = str(segment.get("text", ""))
            if not text_value:
                continue
            _add_run(
                paragraph,
                text_value,
                size=str(segment.get("size", size)),
                italic=bool(segment.get("italic", False)),
                bold=bool(segment.get("bold", bold)),
                color=str(segment.get("color", color)),
            )
        _add_end_para_rpr(paragraph, size=size, color=color)
    tree.append(shape)
    return shape


def _line_style(ln: ET.Element, *, color: str, width: int, dash: str | None = None, arrow: bool = False) -> None:
    ln.set("w", str(width))
    ln.set("cap", "flat")
    fill = ET.SubElement(ln, qn(A, "solidFill"))
    ET.SubElement(fill, qn(A, "srgbClr"), {"val": color})
    if dash:
        ET.SubElement(ln, qn(A, "prstDash"), {"val": dash})
    if arrow:
        ET.SubElement(ln, qn(A, "headEnd"), {"type": "none", "w": "med", "len": "med"})
        ET.SubElement(ln, qn(A, "tailEnd"), {"type": "triangle", "w": "med", "len": "med"})


def add_line(
    root: ET.Element,
    *,
    name: str,
    x: float,
    y: float,
    width: float,
    height: float,
    color: str = PRIMARY,
    width_pt: float = 1.2,
    arrow: bool = False,
    dash: str | None = None,
) -> ET.Element:
    tree = sp_tree(root)
    shape = ET.Element(qn(P, "cxnSp"))
    nv = ET.SubElement(shape, qn(P, "nvCxnSpPr"))
    ET.SubElement(nv, qn(P, "cNvPr"), {"id": str(next_id(root)), "name": name})
    ET.SubElement(nv, qn(P, "cNvCxnSpPr"))
    ET.SubElement(nv, qn(P, "nvPr"))
    sp_pr = ET.SubElement(shape, qn(P, "spPr"))
    xfrm = ET.SubElement(sp_pr, qn(A, "xfrm"))
    ET.SubElement(xfrm, qn(A, "off"), {"x": str(round(x * EMU)), "y": str(round(y * EMU))})
    ET.SubElement(xfrm, qn(A, "ext"), {"cx": str(round(width * EMU)), "cy": str(round(height * EMU))})
    geom = ET.SubElement(sp_pr, qn(A, "prstGeom"), {"prst": "line"})
    ET.SubElement(geom, qn(A, "avLst"))
    ln = ET.SubElement(sp_pr, qn(A, "ln"))
    _line_style(ln, color=color, width=max(1, round(width_pt * 12700)), dash=dash, arrow=arrow)
    # CT_Connector requires a text body even when the connector carries no
    # visible text.  LibreOffice is stricter than PowerPoint about this
    # otherwise harmless-looking omission.
    body = ET.SubElement(shape, qn(P, "txBody"))
    _set_body_pr(body, anchor="t", wrap="none")
    ET.SubElement(body, qn(A, "lstStyle"))
    ET.SubElement(body, qn(A, "p"))
    tree.append(shape)
    return shape


def add_open_shape(
    root: ET.Element,
    *,
    name: str,
    x: float,
    y: float,
    width: float,
    height: float,
    geom_name: str = "roundRect",
    color: str = PRIMARY,
    width_pt: float = 1.2,
) -> ET.Element:
    tree = sp_tree(root)
    shape = ET.Element(qn(P, "sp"))
    nv = ET.SubElement(shape, qn(P, "nvSpPr"))
    ET.SubElement(nv, qn(P, "cNvPr"), {"id": str(next_id(root)), "name": name})
    ET.SubElement(nv, qn(P, "cNvSpPr"))
    ET.SubElement(nv, qn(P, "nvPr"))
    sp_pr = ET.SubElement(shape, qn(P, "spPr"))
    xfrm = ET.SubElement(sp_pr, qn(A, "xfrm"))
    ET.SubElement(xfrm, qn(A, "off"), {"x": str(round(x * EMU)), "y": str(round(y * EMU))})
    ET.SubElement(xfrm, qn(A, "ext"), {"cx": str(round(width * EMU)), "cy": str(round(height * EMU))})
    geom = ET.SubElement(sp_pr, qn(A, "prstGeom"), {"prst": geom_name})
    ET.SubElement(geom, qn(A, "avLst"))
    ET.SubElement(sp_pr, qn(A, "noFill"))
    ln = ET.SubElement(sp_pr, qn(A, "ln"))
    _line_style(ln, color=color, width=max(1, round(width_pt * 12700)))
    # Keep the native shape schema complete for strict viewers.
    body = ET.SubElement(shape, qn(P, "txBody"))
    _set_body_pr(body, anchor="t", wrap="none")
    ET.SubElement(body, qn(A, "lstStyle"))
    ET.SubElement(body, qn(A, "p"))
    tree.append(shape)
    return shape


def add_circle(
    root: ET.Element,
    *,
    name: str,
    x: float,
    y: float,
    diameter: float,
    color: str = PRIMARY,
    width_pt: float = 1.5,
) -> ET.Element:
    return add_open_shape(
        root,
        name=name,
        x=x,
        y=y,
        width=diameter,
        height=diameter,
        geom_name="ellipse",
        color=color,
        width_pt=width_pt,
    )


def _set_title_shape(shape: ET.Element, *, x: float = 0.70, y: float = 0.18, width: float = 11.9, height: float = 0.62) -> None:
    set_geometry(shape, x, y, width, height)
    body = shape.find(qn(P, "txBody"))
    if body is None:
        return
    _set_body_pr(body, anchor="ctr")
    for rpr in body.findall(f".//{qn(A, 'rPr')}") + body.findall(f".//{qn(A, 'endParaRPr')}"):
        _set_run_font(rpr, size=TITLE_SIZE, italic=False, bold=True, color=PRIMARY)
    for ppr in body.findall(f"./{qn(A, 'p')}/{qn(A, 'pPr')}"):
        ppr.set("algn", "l")


def _set_subtitle_shape(shape: ET.Element) -> None:
    set_geometry(shape, 2.2, 3.95, 8.9, 0.72)
    body = shape.find(qn(P, "txBody"))
    if body is None:
        return
    _set_body_pr(body, anchor="ctr")
    for ppr in body.findall(f"./{qn(A, 'p')}/{qn(A, 'pPr')}"):
        ppr.set("algn", "ctr")
    for rpr in body.findall(f".//{qn(A, 'rPr')}") + body.findall(f".//{qn(A, 'endParaRPr')}"):
        _set_run_font(rpr, size=BODY_SIZE, italic=False, bold=False, color=TEXT)


def clear_slide_content(root: ET.Element, *, keep_titles: bool = True, keep_alt_content: bool = False) -> None:
    tree = sp_tree(root)
    for node in list(tree):
        if node.tag in {qn(P, "nvGrpSpPr"), qn(P, "grpSpPr")}:
            continue
        if keep_alt_content and node.tag == qn(MC, "AlternateContent"):
            continue
        if keep_titles and node.tag == qn(P, "sp") and (is_title(node) or is_subtitle(node)):
            continue
        tree.remove(node)


def _shape_y(node: ET.Element) -> int | None:
    xfrm = node.find(f"./{qn(P, 'spPr')}/{qn(A, 'xfrm')}")
    if xfrm is None:
        return None
    off = xfrm.find(qn(A, "off"))
    if off is None:
        return None
    try:
        return int(off.get("y", "0"))
    except (TypeError, ValueError):
        return None


def _is_slide_number(node: ET.Element) -> bool:
    ph = node.find(f".//{qn(P, 'ph')}")
    return ph is not None and (ph.get("type") == "sldNum" or ph.get("idx") in {"10", "4"})


def remove_inherited_footer(entries: dict[str, bytes], slide_height: int) -> dict[str, int]:
    """Remove only inherited bottom banner/page-number carriers.

    The input native proof was built from a template copy whose master/layout
    still carries the original authority banner.  Removing those carriers at
    the master/layout level is necessary: a slide-level content cleanup alone
    cannot hide inherited artwork.  The full-slide background picture is at
    y=0 and therefore remains untouched.
    """

    threshold = int(slide_height * 0.80)
    removed: dict[str, int] = {}
    pattern = re.compile(r"ppt/(?:slides/slide\d+|slideLayouts/slideLayout\d+|slideMasters/slideMaster\d+)\.xml")
    for name in sorted(entries):
        if not pattern.fullmatch(name):
            continue
        root = _read_xml(entries[name], name)
        tree = root.find(f"./{qn(P, 'cSld')}/{qn(P, 'spTree')}")
        if tree is None:
            continue
        count = 0
        for node in list(tree):
            if node.tag not in {qn(P, "sp"), qn(P, "pic"), qn(P, "cxnSp"), qn(P, "graphicFrame"), qn(P, "grpSp")}:
                continue
            y = _shape_y(node)
            text = shape_text(node).replace(" ", "")
            if _is_slide_number(node) or "教育部智慧節能網路跨層系統整合教學聯盟" in text or (y is not None and y >= threshold):
                tree.remove(node)
                count += 1
        if count:
            entries[name] = serialize(root)
            removed[name] = count
    return removed


def find_title(root: ET.Element) -> ET.Element:
    for node in sp_tree(root):
        if node.tag == qn(P, "sp") and is_title(node):
            return node
    raise RuntimeError("slide title placeholder missing")


def _set_title_text(shape: ET.Element, title: str) -> None:
    body = shape.find(qn(P, "txBody"))
    if body is None:
        return
    text_nodes = body.findall(f".//{qn(A, 't')}")
    if text_nodes:
        text_nodes[0].text = title
        for node in text_nodes[1:]:
            node.text = ""


def _find_alt(root: ET.Element) -> ET.Element | None:
    return root.find(f"./{qn(P, 'cSld')}/{qn(P, 'spTree')}/{qn(MC, 'AlternateContent')}")


def _fallback_picture(alt: ET.Element) -> ET.Element | None:
    fallback = alt.find(qn(MC, "Fallback"))
    if fallback is None:
        return None
    return fallback.find(qn(P, "pic"))


def _choice_shapes(alt: ET.Element) -> list[ET.Element]:
    choice = alt.find(qn(MC, "Choice"))
    if choice is None:
        return []
    return choice.findall(qn(P, "sp"))


def _reposition_equations(root: ET.Element) -> tuple[int, bool]:
    alt = _find_alt(root)
    if alt is None:
        raise RuntimeError("logical slide 5 lacks mc:AlternateContent equation branch")
    choice_shapes = _choice_shapes(alt)
    if len(choice_shapes) < 2:
        raise RuntimeError("logical slide 5 needs two native OMML shapes")
    for index, shape in enumerate(choice_shapes[:2]):
        set_geometry(shape, 2.05, 2.05 + index * 1.42, 9.25, 1.08)
        body = shape.find(qn(P, "txBody"))
        if body is not None:
            _set_body_pr(body, anchor="ctr", wrap="none")
    fallback = _fallback_picture(alt)
    fallback_svg_preserved = fallback is not None
    if fallback is not None:
        set_geometry(fallback, 2.05, 2.00, 9.25, 2.55)
    return len(choice_shapes), fallback_svg_preserved


def add_relationship(entries: dict[str, bytes], slide_part: str, target: str) -> str:
    rel_part = _slide_rels_part(slide_part)
    if rel_part in entries:
        rels = _read_xml(entries[rel_part], rel_part)
    else:
        rels = ET.Element(qn(PR, "Relationships"))
    rid = _next_rel_id(rels)
    ET.SubElement(
        rels,
        qn(PR, "Relationship"),
        {"Id": rid, "Type": IMAGE_REL_TYPE, "Target": target},
    )
    entries[rel_part] = serialize(rels)
    return rid


def ensure_default_content_type(entries: dict[str, bytes], extension: str, content_type: str) -> None:
    root = _read_xml(entries["[Content_Types].xml"], "[Content_Types].xml")
    for node in root.findall(qn(CT, "Default")):
        if node.get("Extension", "").lower() == extension.lower():
            return
    ET.SubElement(root, qn(CT, "Default"), {"Extension": extension, "ContentType": content_type})
    entries["[Content_Types].xml"] = serialize(root)


def add_picture(
    root: ET.Element,
    *,
    rid: str,
    name: str,
    description: str,
    x: float,
    y: float,
    width: float,
    height: float,
    line_color: str | None = None,
) -> ET.Element:
    tree = sp_tree(root)
    picture = ET.Element(qn(P, "pic"))
    nv = ET.SubElement(picture, qn(P, "nvPicPr"))
    ET.SubElement(nv, qn(P, "cNvPr"), {"id": str(next_id(root)), "name": name, "descr": description})
    ET.SubElement(nv, qn(P, "cNvPicPr"), {"preferRelativeResize": "0"})
    ET.SubElement(nv, qn(P, "nvPr"))
    blip_fill = ET.SubElement(picture, qn(P, "blipFill"))
    blip = ET.SubElement(blip_fill, qn(A, "blip"), {qn(R, "embed"): rid})
    del blip
    stretch = ET.SubElement(blip_fill, qn(A, "stretch"))
    ET.SubElement(stretch, qn(A, "fillRect"))
    sp_pr = ET.SubElement(picture, qn(P, "spPr"))
    xfrm = ET.SubElement(sp_pr, qn(A, "xfrm"))
    ET.SubElement(xfrm, qn(A, "off"), {"x": str(round(x * EMU)), "y": str(round(y * EMU))})
    ET.SubElement(xfrm, qn(A, "ext"), {"cx": str(round(width * EMU)), "cy": str(round(height * EMU))})
    geom = ET.SubElement(sp_pr, qn(A, "prstGeom"), {"prst": "rect"})
    ET.SubElement(geom, qn(A, "avLst"))
    if line_color:
        ln = ET.SubElement(sp_pr, qn(A, "ln"))
        _line_style(ln, color=line_color, width=round(1.2 * 12700))
    tree.append(picture)
    return picture


def _reposition_existing_picture(pic: ET.Element, x: float, y: float, width: float, height: float) -> None:
    sp_pr = pic.find(qn(P, "spPr"))
    if sp_pr is None:
        sp_pr = ET.SubElement(pic, qn(P, "spPr"))
    xfrm = sp_pr.find(qn(A, "xfrm"))
    if xfrm is None:
        xfrm = ET.SubElement(sp_pr, qn(A, "xfrm"))
    for child in list(xfrm):
        xfrm.remove(child)
    ET.SubElement(xfrm, qn(A, "off"), {"x": str(round(x * EMU)), "y": str(round(y * EMU))})
    ET.SubElement(xfrm, qn(A, "ext"), {"cx": str(round(width * EMU)), "cy": str(round(height * EMU))})


def _recompose_cover(root: ET.Element) -> dict[str, object]:
    title = find_title(root)
    _set_title_shape(title, x=2.2, y=2.18, width=8.95, height=0.74)
    _set_title_text(title, EXPECTED_TITLES[0])
    subtitle = next((node for node in sp_tree(root) if node.tag == qn(P, "sp") and is_subtitle(node)), None)
    if subtitle is not None:
        _set_subtitle_shape(subtitle)
        _set_title_text(subtitle, "從 policy 變更，看見 service 與 endpoint energy 的因果")
    # A restrained route marker anchors the opening without copying the content
    # layouts.  It is an outline/line motif, not a background fill.
    add_line(root, name="Cover causal route", x=2.15, y=5.70, width=8.9, height=0, color=PRIMARY, width_pt=1.3, arrow=True)
    points = [(2.0, "policy", True), (5.0, "radio state", True), (8.0, "energy", True), (11.0, "service", True)]
    for idx, (cx, label, italic) in enumerate(points, start=1):
        add_circle(root, name=f"Cover route node {idx}", x=cx - 0.13, y=5.57, diameter=0.26, color=GOLD, width_pt=2.0)
        add_text_box(
            root,
            name=f"Cover route label {idx}",
            lines=[[{"text": label, "italic": italic, "bold": True, "color": PRIMARY, "size": SMALL_SIZE}]],
            x=cx - 0.80,
            y=5.90,
            width=1.60,
            height=0.38,
            size=SMALL_SIZE,
            color=PRIMARY,
            align="ctr",
        )
    return {"layout": "cover + causal route", "main_visual": "four-node route marker"}


def _recompose_causal(root: ET.Element) -> dict[str, object]:
    title = find_title(root)
    _set_title_shape(title)
    _set_title_text(title, EXPECTED_TITLES[1])
    clear_slide_content(root)
    xs = [0.72, 3.18, 5.64, 8.10, 10.56]
    labels = [
        [[{"text": "policy", "italic": True, "bold": True, "color": PRIMARY}], [{"text": "選擇", "bold": True, "color": PRIMARY}]],
        [[{"text": "radio state", "italic": True, "bold": True, "color": PRIMARY}], [{"text": "停留", "bold": True, "color": PRIMARY}]],
        [[{"text": "power × time", "italic": True, "bold": True, "color": PRIMARY}]],
        [[{"text": "endpoint energy", "italic": True, "bold": True, "color": PRIMARY}]],
        [[{"text": "service", "italic": True, "bold": True, "color": PRIMARY}], [{"text": "判讀", "bold": True, "color": PRIMARY}]],
    ]
    for index, (x, lines) in enumerate(zip(xs, labels), start=1):
        add_open_shape(root, name=f"Causal node {index}", x=x, y=2.55, width=1.92, height=1.35, geom_name="roundRect", color=PRIMARY, width_pt=1.2)
        add_circle(root, name=f"Causal node marker {index}", x=x + 0.82, y=2.28, diameter=0.26, color=GOLD, width_pt=2.0)
        add_text_box(root, name=f"Causal node text {index}", lines=lines, x=x + 0.10, y=2.78, width=1.72, height=0.76, size=BODY_SIZE, color=PRIMARY, align="ctr", anchor="ctr")
        if index < len(xs):
            add_line(root, name=f"Causal arrow {index}", x=x + 1.96, y=3.23, width=0.42, height=0, color=GOLD, width_pt=1.4, arrow=True)
    add_text_box(
        root,
        name="Causal takeaway",
        lines=[[{"text": "功率只是狀態；能量還要乘上停留。", "bold": True, "color": PRIMARY}]],
        x=1.60,
        y=5.00,
        width=9.95,
        height=0.55,
        size=BODY_SIZE,
        color=PRIMARY,
        align="ctr",
        anchor="ctr",
    )
    return {"layout": "five-node horizontal causal flow", "main_visual": "policy-to-service chain"}


def _recompose_leo(root: ET.Element) -> dict[str, object]:
    title = find_title(root)
    _set_title_shape(title)
    _set_title_text(title, EXPECTED_TITLES[2])
    clear_slide_content(root)
    # Open split frame: the left is the course causal core, the right is the
    # changing LEO service window.  The central divider is deliberately light.
    add_open_shape(root, name="Core frame", x=0.82, y=1.65, width=5.25, height=4.38, color=PRIMARY, width_pt=1.1)
    add_open_shape(root, name="LEO frame", x=7.08, y=1.65, width=5.28, height=4.38, color=PRIMARY, width_pt=1.1)
    add_line(root, name="LEO split divider", x=6.58, y=1.90, width=0, height=3.90, color=PALE_BLUE, width_pt=1.2)
    add_text_box(root, name="Core heading", lines=[[{"text": "課程核心", "bold": True, "color": PRIMARY}]], x=1.15, y=1.95, width=2.3, height=0.45, size=BODY_SIZE, color=PRIMARY, bold=True)
    core_rows = [
        ([{"text": "LoRa endpoint", "italic": True, "bold": True, "color": PRIMARY}], "資料從哪裡來"),
        ([{"text": "policy / queue", "italic": True, "bold": True, "color": PRIMARY}], "怎麼排進服務"),
        ([{"text": "radio state / energy", "italic": True, "bold": True, "color": PRIMARY}], "結果如何累積"),
    ]
    for index, (first, second) in enumerate(core_rows, start=1):
        y = 2.65 + (index - 1) * 0.88
        add_circle(root, name=f"Core marker {index}", x=1.18, y=y + 0.05, diameter=0.31, color=GOLD, width_pt=1.7)
        add_text_box(root, name=f"Core row {index}", lines=[first, [{"text": second, "size": SMALL_SIZE, "color": TEXT}]], x=1.62, y=y, width=3.95, height=0.62, size=BODY_SIZE, color=TEXT, anchor="ctr")
    add_text_box(root, name="LEO heading", lines=[[{"text": "LEO 範例", "bold": True, "color": PRIMARY}]], x=7.42, y=1.95, width=2.6, height=0.45, size=BODY_SIZE, color=PRIMARY, bold=True)
    add_text_box(root, name="LEO claim", lines=[[{"text": "只改服務窗口，不改核心因果", "bold": True, "color": PRIMARY}]], x=7.42, y=2.52, width=4.45, height=0.44, size=SMALL_SIZE, color=PRIMARY)
    # Service-window timeline.
    add_line(root, name="Service window baseline", x=7.60, y=4.15, width=4.55, height=0, color=PRIMARY, width_pt=1.4, arrow=True)
    for index, (x, label, open_window) in enumerate(((7.72, "關閉", False), (9.08, "開啟", True), (10.42, "關閉", False)), start=1):
        add_circle(root, name=f"Service marker {index}", x=x, y=4.00, diameter=0.30, color=GOLD if open_window else PRIMARY, width_pt=1.8)
        add_text_box(root, name=f"Service marker label {index}", lines=[[{"text": label, "bold": True, "color": PRIMARY}]], x=x - 0.42, y=4.45, width=1.12, height=0.38, size=SMALL_SIZE, color=PRIMARY, align="ctr")
    add_text_box(root, name="Service consequence", lines=[[{"text": "窗口會開、會關", "bold": True, "color": PRIMARY}], [{"text": "品質會改變；等待會產生後果", "size": SMALL_SIZE, "color": TEXT}]], x=7.42, y=5.05, width=4.45, height=0.68, size=BODY_SIZE, color=TEXT, align="ctr", anchor="ctr")
    return {"layout": "open split frame + service-window timeline", "main_visual": "core-to-window comparison"}


def _recompose_run(root: ET.Element) -> dict[str, object]:
    title = find_title(root)
    _set_title_shape(title)
    _set_title_text(title, EXPECTED_TITLES[3])
    clear_slide_content(root)
    add_line(root, name="Runbook spine", x=1.28, y=2.02, width=0, height=3.68, color=PRIMARY, width_pt=1.6)
    steps = [
        ("①", "驗證環境", "bash course.sh verify", "先讓工具鏈可重現"),
        ("②", "保存基準", "bash course.sh run --lab A --case baseline", "記下未改 policy 的 result"),
        ("③", "只改一個 policy block", "bash course.sh run --lab A --case candidate --freeze", "比較時只歸因到這一個變更"),
    ]
    for index, (number, heading, command, interpretation) in enumerate(steps):
        y = 1.84 + index * 1.28
        add_circle(root, name=f"Runbook step {index + 1}", x=1.10, y=y + 0.10, diameter=0.36, color=GOLD, width_pt=2.1)
        add_text_box(root, name=f"Runbook numeral {index + 1}", lines=[[{"text": number, "bold": True, "color": PRIMARY, "size": SMALL_SIZE}]], x=1.105, y=y + 0.13, width=0.35, height=0.25, size=SMALL_SIZE, color=PRIMARY, align="ctr", anchor="ctr")
        if index == 2:
            # Give the long policy label an intentional two-line hierarchy;
            # relying on placeholder wrapping caused the old heading and its
            # interpretation to collide.
            heading_lines: list[object] = [
                [{"text": "只改一個", "bold": True, "color": PRIMARY}],
                [{"text": "policy block", "italic": True, "bold": True, "color": PRIMARY}],
            ]
            heading_height = 0.78
        else:
            heading_lines = [[{"text": heading, "bold": True, "color": PRIMARY}]]
            heading_height = 0.40
        add_text_box(root, name=f"Runbook heading {index + 1}", lines=heading_lines, x=1.72, y=y, width=3.18, height=heading_height, size=BODY_SIZE, color=PRIMARY)
        command_lines: list[object] = [[{"text": command, "size": COMMAND_SIZE, "color": TEXT}]]
        if index == 2:
            command_lines.append([{"text": "policy = ", "size": SMALL_SIZE, "color": TEXT}, {"text": "lab-a-pace-rest", "size": SMALL_SIZE, "italic": True, "color": PRIMARY}])
        add_text_box(root, name=f"Runbook command {index + 1}", lines=command_lines, x=5.05, y=y + 0.02, width=7.15, height=0.68, size=COMMAND_SIZE, color=TEXT)
        interpretation_y = y + (0.84 if index == 2 else 0.47)
        add_text_box(root, name=f"Runbook interpretation {index + 1}", lines=[[{"text": interpretation, "size": SMALL_SIZE if index != 2 else "1800", "color": TEXT}]], x=1.72, y=interpretation_y, width=3.18, height=0.32, size=SMALL_SIZE if index != 2 else "1800", color=TEXT)
    # Keep recovery adjacent to the executable path instead of creating a
    # footer-like box that competes with the third step.
    add_text_box(root, name="Runbook recovery text", lines=[[{"text": "verify 失敗 → 修環境", "bold": True, "color": PRIMARY, "size": "1800"}]], x=8.72, y=5.72, width=3.55, height=0.28, size="1800", color=PRIMARY, align="ctr", anchor="ctr")
    return {"layout": "vertical runbook spine", "main_visual": "three-step executable path"}


def _recompose_formula(root: ET.Element, entries: dict[str, bytes], slide_part: str, fallback_png: Path) -> dict[str, object]:
    title = find_title(root)
    _set_title_shape(title)
    _set_title_text(title, EXPECTED_TITLES[4])
    # Keep the native AlternateContent in place, only clear unrelated slide
    # content.  The equation branch itself remains editable in PowerPoint.
    clear_slide_content(root, keep_alt_content=True)
    native_count, fallback_svg_preserved = _reposition_equations(root)
    # Make the template's fallback deterministic for non-Office previewers,
    # while retaining the original SVG and its relationship in the package.
    media_name = "ppt/media/c120-equations-fallback.png"
    entries[media_name] = fallback_png.read_bytes()
    ensure_default_content_type(entries, "png", PNG_CONTENT_TYPE)
    rel_part = _slide_rels_part(slide_part)
    rels = _read_xml(entries[rel_part], rel_part)
    png_rid = _next_rel_id(rels)
    ET.SubElement(rels, qn(PR, "Relationship"), {"Id": png_rid, "Type": IMAGE_REL_TYPE, "Target": "../media/c120-equations-fallback.png"})
    entries[rel_part] = serialize(rels)
    fallback = _fallback_picture(_find_alt(root))
    if fallback is None:
        raise RuntimeError("equation fallback picture missing")
    blip = fallback.find(f"./{qn(P, 'blipFill')}/{qn(A, 'blip')}")
    if blip is None:
        raise RuntimeError("equation fallback blip missing")
    blip.set(qn(R, "embed"), png_rid)
    add_text_box(root, name="Equation readout one", lines=[[{"text": "radio state × 停留 → endpoint energy", "italic": True, "bold": True, "color": PRIMARY}]], x=2.05, y=5.08, width=9.25, height=0.45, size=BODY_SIZE, color=PRIMARY, align="ctr", anchor="ctr")
    add_text_box(root, name="Equation readout two", lines=[[{"text": "送達資料量 ÷ 相同能量邊界 → 可比較的效率", "bold": True, "color": PRIMARY}]], x=1.72, y=5.62, width=9.90, height=0.45, size=SMALL_SIZE, color=PRIMARY, align="ctr", anchor="ctr")
    return {"layout": "central equation canvas", "main_visual": "two native equations", "native_equation_shapes": native_count, "fallback_svg_preserved": fallback_svg_preserved, "fallback_png_added": True}


def _recompose_evidence(root: ET.Element, entries: dict[str, bytes], slide_part: str, screenshot: Path) -> dict[str, object]:
    title = find_title(root)
    _set_title_shape(title)
    _set_title_text(title, EXPECTED_TITLES[5])
    clear_slide_content(root)
    image_name = "ppt/media/c120-server-preview-import.png"
    image_bytes = screenshot.read_bytes()
    entries[image_name] = image_bytes
    ensure_default_content_type(entries, "png", PNG_CONTENT_TYPE)
    rid = add_relationship(entries, slide_part, "../media/c120-server-preview-import.png")
    sha = hashlib.sha256(image_bytes).hexdigest()
    # Left evidence chain: four evidence layers feed one interpretation.  The
    # structure is deliberately not phrased as a fixed question checklist.
    add_line(root, name="Evidence chain spine", x=1.32, y=2.04, width=0, height=3.35, color=PRIMARY, width_pt=1.5, arrow=True)
    layers = [
        ("來源", "lineage"),
        ("服務", "deadline / freshness"),
        ("機制", "queue / packet / state"),
        ("能量", "power × time"),
    ]
    for index, (zh, en) in enumerate(layers):
        y = 1.94 + index * 0.84
        add_circle(root, name=f"Evidence layer {index + 1}", x=1.16, y=y + 0.05, diameter=0.31, color=GOLD, width_pt=1.8)
        add_text_box(root, name=f"Evidence label {index + 1}", lines=[[{"text": zh, "bold": True, "color": PRIMARY}, {"text": "  /  ", "color": TEXT}, {"text": en, "italic": True, "color": PRIMARY}]], x=1.68, y=y, width=3.00, height=0.38, size=BODY_SIZE, color=TEXT, anchor="ctr")
    add_line(root, name="Evidence interpretation arrow", x=2.92, y=5.48, width=0.72, height=0, color=GOLD, width_pt=1.4, arrow=True)
    add_text_box(root, name="Evidence interpretation", lines=[[{"text": "判讀", "bold": True, "color": PRIMARY}], [{"text": "支持、反駁、待查", "size": "1800", "color": TEXT}]], x=3.72, y=5.18, width=1.55, height=0.72, size=BODY_SIZE, color=TEXT, align="ctr", anchor="ctr")
    # Status is a figure header, not a bottom footer.  Two short lines avoid
    # the previous top clipping caused by a single overlong 20pt run.
    add_open_shape(root, name="Evidence status tag", x=8.72, y=1.40, width=3.68, height=0.62, color=GOLD, width_pt=1.15)
    add_text_box(root, name="Evidence status", lines=[
        [{"text": "伺服器 preview：已驗證", "bold": True, "color": PRIMARY, "size": "1800"}],
        [{"text": "Windows native：待實機", "bold": True, "color": PRIMARY, "size": "1800"}],
    ], x=8.86, y=1.49, width=3.40, height=0.42, size="1800", color=PRIMARY, align="ctr", anchor="ctr")
    add_text_box(root, name="Evidence caption", lines=[[{"text": "endpoint replay evidence", "italic": True, "color": PRIMARY, "size": "1800"}]], x=5.12, y=1.34, width=3.15, height=0.25, size="1800", color=PRIMARY)
    add_picture(root, rid=rid, name="Verified server preview import evidence", description=f"server preview evidence; source_sha256={sha}", x=5.12, y=2.12, width=7.25, height=3.92, line_color=PRIMARY)
    return {"layout": "evidence chain + right image", "main_visual": "server preview browser evidence", "screenshot_sha256": sha}


def _validate_visual_text(entries: dict[str, bytes], slides: list[str]) -> dict[str, object]:
    visible_text = "\n".join(shape_text(_read_xml(entries[name], name)) for name in slides)
    forbidden = {token: token in visible_text for token in ("學生", "分鐘", "120分鐘")}
    return {"forbidden_text_hits": forbidden, "visible_text_has_forbidden": any(forbidden.values())}


def _validate_package(entries: dict[str, bytes], slides: list[str]) -> dict[str, object]:
    native_count = 0
    omath_count = 0
    slide_bg_fills = 0
    full_slide_fills = 0
    for name in slides:
        root = _read_xml(entries[name], name)
        native_count += len(root.findall(f".//{qn(A14, 'm')}") )
        omath_count += len(root.findall(f".//{qn(M, 'oMath')}") )
        c_sld = root.find(qn(P, "cSld"))
        if c_sld is not None and c_sld.find(qn(P, "bg")) is not None:
            slide_bg_fills += 1
        for node in sp_tree(root):
            if node.tag not in {qn(P, "sp"), qn(P, "pic"), qn(P, "cxnSp")}: 
                continue
            xfrm = node.find(f"./{qn(P, 'spPr')}/{qn(A, 'xfrm')}")
            if xfrm is None:
                continue
            ext = xfrm.find(qn(A, "ext"))
            if ext is not None and int(ext.get("cx", "0")) >= SLIDE_CX and int(ext.get("cy", "0")) >= SLIDE_CY:
                full_slide_fills += 1
    return {"a14_m_count": native_count, "omath_count": omath_count, "slide_level_background_nodes": slide_bg_fills, "full_slide_shape_count": full_slide_fills}


def _write_zip(output: Path, order: list[str], entries: dict[str, bytes]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent)
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            written: set[str] = set()
            for name in order:
                if name in entries:
                    archive.writestr(name, entries[name])
                    written.add(name)
            for name in sorted(set(entries).difference(written)):
                archive.writestr(name, entries[name])
        with zipfile.ZipFile(tmp_path, "r") as check:
            bad = check.testzip()
            if bad:
                raise RuntimeError(f"output ZIP failed CRC: {bad}")
        tmp_path.replace(output)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="six-slide native-template input PPTX")
    parser.add_argument("output", type=Path, help="redesigned PPTX output")
    parser.add_argument("--screenshot", type=Path, required=True, help="verified server-preview screenshot")
    parser.add_argument("--fallback-png", type=Path, required=True, help="equation PNG fallback source")
    parser.add_argument("--report", type=Path, required=True, help="design report JSON")
    parser.add_argument("--qa-report", type=Path, required=True, help="structural QA JSON")
    args = parser.parse_args()

    input_path = args.input.resolve()
    output_path = args.output.resolve()
    screenshot = args.screenshot.resolve()
    fallback_png = args.fallback_png.resolve()
    if input_path == output_path:
        raise SystemExit("input and output must differ")
    for path, label in ((input_path, "input"), (screenshot, "screenshot"), (fallback_png, "fallback PNG")):
        if not path.is_file():
            raise SystemExit(f"missing {label}: {path}")

    with zipfile.ZipFile(input_path, "r") as source:
        if source.testzip():
            raise SystemExit("input PPTX failed ZIP CRC")
        order = [info.filename for info in source.infolist()]
        entries = {info.filename: source.read(info.filename) for info in source.infolist()}

    slides = slide_order(entries)
    if len(slides) != 6:
        raise SystemExit(f"expected six logical slides, found {len(slides)}")
    title_roster: list[str] = []
    for name in slides:
        root = _read_xml(entries[name], name)
        title_roster.append(shape_text(find_title(root)).strip())
    if tuple(title_roster) != EXPECTED_TITLES:
        raise SystemExit(f"unexpected title roster: {title_roster!r}")

    layouts: list[dict[str, object]] = []
    slide_roots: list[ET.Element] = []
    for logical, name in enumerate(slides, start=1):
        root = _read_xml(entries[name], name)
        if logical == 1:
            info = _recompose_cover(root)
        elif logical == 2:
            info = _recompose_causal(root)
        elif logical == 3:
            info = _recompose_leo(root)
        elif logical == 4:
            info = _recompose_run(root)
        elif logical == 5:
            info = _recompose_formula(root, entries, name, fallback_png)
        else:
            info = _recompose_evidence(root, entries, name, screenshot)
        info["logical_slide"] = logical
        info["title"] = title_roster[logical - 1]
        layouts.append(info)
        slide_roots.append(root)
        entries[name] = serialize(root)

    presentation_root = _read_xml(entries["ppt/presentation.xml"], "ppt/presentation.xml")
    slide_size = presentation_root.find(qn(P, "sldSz"))
    slide_height = int(slide_size.get("cy", str(SLIDE_CY))) if slide_size is not None else SLIDE_CY
    footer_removals = remove_inherited_footer(entries, slide_height)

    _write_zip(output_path, order, entries)

    # Read back from the final ZIP so reports describe the actual artifact.
    with zipfile.ZipFile(output_path, "r") as result:
        final_entries = {info.filename: result.read(info.filename) for info in result.infolist()}
    text_report = _validate_visual_text(final_entries, slides)
    package_report = _validate_package(final_entries, slides)
    if text_report["visible_text_has_forbidden"]:
        raise SystemExit(f"forbidden visible text found: {text_report['forbidden_text_hits']}")
    if package_report["a14_m_count"] < 2 or package_report["omath_count"] < 2:
        raise SystemExit("native equation structure was not preserved")
    if package_report["slide_level_background_nodes"] or package_report["full_slide_shape_count"]:
        raise SystemExit("redesign introduced a slide-level background or full-slide shape")

    design_report = {
        "schema": "c120-native-proof-redesign-v1",
        "status": "PASS",
        "input": str(input_path),
        "output": str(output_path),
        "logical_slide_count": len(slides),
        "titles": title_roster,
        "background_policy": "inherit educate.pptx slide/layout/master artwork; no slide-level fill added",
        "footer_policy": "content rebuilt without bottom banner/page-number/text footer",
        "footer_shapes_removed": sum(footer_removals.values()),
        "footer_removals_by_part": footer_removals,
        "font_policy": {"chinese": EAST_ASIA_FONT, "latin": LATIN_FONT, "title_pt": 28, "body_pt": 24, "command_pt": 18},
        "design_rules": ["one main visual per slide", "transparent native lines/open frames", "no large solid cards", "no fixed five-question framework"],
        "layouts": layouts,
        "native_equations": {"editable_omml": True, "a14_m_count": package_report["a14_m_count"], "omath_count": package_report["omath_count"], "fallback_svg_preserved": True, "fallback_png_added": True},
        "screenshot_sha256": hashlib.sha256(screenshot.read_bytes()).hexdigest(),
        "notes_policy": "speaker notes are preserved byte-for-byte from input archive",
        "template_policy": "input template relationship/theme/media retained; only new evidence/equation media appended",
    }
    qa_report = {
        "schema": "c120-native-proof-redesign-qa-v1",
        "status": "PASS",
        "artifact": str(output_path),
        "slide_count": len(slides),
        "title_roster_ok": tuple(title_roster) == EXPECTED_TITLES,
        "font_policy": {"title_pt": 28, "body_pt": 24, "command_pt": 18, "chinese": EAST_ASIA_FONT, "latin": LATIN_FONT},
        "forbidden_text": text_report,
        "background_and_geometry": package_report,
        "footer_shapes_removed": sum(footer_removals.values()),
        "native_equation_assertions": {"a14_m_at_least_2": package_report["a14_m_count"] >= 2, "omath_at_least_2": package_report["omath_count"] >= 2},
        "screenshot_present": "ppt/media/c120-server-preview-import.png" in final_entries,
        "fallback_png_present": "ppt/media/c120-equations-fallback.png" in final_entries,
        "limitation": "structural QA does not replace PowerPoint edit/reopen acceptance or Windows native rehearsal",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.qa_report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(design_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.qa_report.write_text(json.dumps(qa_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "output": str(output_path), "report": str(args.report.resolve()), "qa_report": str(args.qa_report.resolve()), "layouts": [item["layout"] for item in layouts], "a14_m_count": package_report["a14_m_count"], "omath_count": package_report["omath_count"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
