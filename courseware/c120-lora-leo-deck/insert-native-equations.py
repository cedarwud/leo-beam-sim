#!/usr/bin/env python3
"""Insert one or more editable Office Math equations into a PowerPoint slide.

This is intentionally an OOXML-only command-line tool.  It does not import
``python-pptx`` and it does not ask LibreOffice, PowerPoint, or a formula
renderer to rewrite the presentation.  The native choice is the
Microsoft-documented ``a14:m`` wrapper containing OMML.  When ``--fallback-svg``
is supplied, the two native shapes are wrapped in one
``mc:AlternateContent`` element and the SVG is embedded as the fallback
picture.  Without that option, no image part or AlternateContent wrapper is
created.

The source strings are deliberately kept as exact LaTeX in the non-visual
name/description metadata of the inserted shapes:

    E_{\\mathrm{endpoint}} = \\sum_{s \\in S} P_s t_s
    \\eta_E = \\frac{D_{\\mathrm{delivered}}}{E_{\\mathrm{endpoint}}}

The target is selected by the one-based logical order in
``ppt/presentation.xml``'s ``p:sldIdLst``; slide filenames are not used as
logical numbers.  The slide must contain a title shape and a ``p:spTree`` so
that an accidental logical-slide mismatch fails closed.  The tool writes a
JSON report with ``--report`` and validates the output ZIP and XML before the
atomic output rename.

Limitations are explicit in the report: this script verifies OOXML structure,
not human visual acceptance or Microsoft PowerPoint's edit/save/reopen path.
LibreOffice handling of a PowerPoint ``a14:m`` native choice is not claimed;
use the optional SVG fallback when a LibreOffice preview is required.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import posixpath
import re
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


# Namespace URIs used by PresentationML, DrawingML, OMML and package rels.
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
A14 = "http://schemas.microsoft.com/office/drawing/2010/main"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
M = "http://schemas.openxmlformats.org/officeDocument/2006/math"
MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XML = "http://www.w3.org/XML/1998/namespace"

for _prefix, _uri in (
    ("a", A),
    ("a14", A14),
    ("ct", CT),
    ("m", M),
    ("mc", MC),
    ("p", P),
    ("r", R),
):
    ET.register_namespace(_prefix, _uri)


LATEX_SUM = r"E_{\mathrm{endpoint}} = \sum_{s \in S} P_s t_s"
LATEX_EE = r"\eta_E = \frac{D_{\mathrm{delivered}}}{E_{\mathrm{endpoint}}}"
EQUATIONS = (
    ("E_endpoint", LATEX_SUM),
    ("eta_E", LATEX_EE),
)

IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
SLIDE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
SVG_CONTENT_TYPE = "image/svg+xml"
DEFAULT_SLIDE_CX = 12_192_000  # 13.333 in, 16:9
DEFAULT_SLIDE_CY = 6_858_000  # 7.5 in, 16:9
FONT_SIZE_HUNDREDTHS = "3000"
TOOL_SCHEMA = "c120-native-equations-report-v1"


def qname(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def child(parent: ET.Element, namespace: str, local: str, **attrs: str) -> ET.Element:
    return ET.SubElement(parent, qname(namespace, local), attrs)


class ToolError(RuntimeError):
    """Stable, reportable fail-closed error."""

    def __init__(self, code: str, message: str, **details: object) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


@dataclass(frozen=True)
class SlideMapping:
    logical_number: int
    part_name: str
    relationship_id: str


@dataclass(frozen=True)
class Geometry:
    x: int
    first_y: int
    width: int
    height: int
    gap: int
    slide_cx: int
    slide_cy: int

    @property
    def second_y(self) -> int:
        return self.first_y + self.height + self.gap

    @property
    def fallback_height(self) -> int:
        return 2 * self.height + self.gap


def _read_xml(data: bytes, *, part_name: str) -> ET.Element:
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise ToolError("XML_INVALID", f"invalid XML in {part_name}: {exc}", part=part_name) from exc


def _xml_bytes(root: ET.Element) -> bytes:
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _ensure_input_pptx(path: Path) -> None:
    if not path.is_file():
        raise ToolError("INPUT_MISSING", f"input PPTX does not exist: {path}", input=str(path))
    try:
        with zipfile.ZipFile(path, "r") as archive:
            bad = archive.testzip()
            if bad is not None:
                raise ToolError("INPUT_ZIP_CRC", f"input ZIP member failed CRC: {bad}", member=bad)
            required = {"[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"}
            missing = sorted(required.difference(archive.namelist()))
            if missing:
                raise ToolError("PPTX_PART_MISSING", f"input is missing required parts: {', '.join(missing)}", missing=missing)
    except zipfile.BadZipFile as exc:
        raise ToolError("INPUT_ZIP_INVALID", f"input PPTX is not a readable ZIP: {exc}", input=str(path)) from exc


def _read_archive(path: Path) -> tuple[list[zipfile.ZipInfo], dict[str, bytes]]:
    _ensure_input_pptx(path)
    try:
        with zipfile.ZipFile(path, "r") as archive:
            infos = [copy.copy(info) for info in archive.infolist()]
            data = {info.filename: archive.read(info.filename) for info in infos}
    except (OSError, KeyError, zipfile.BadZipFile) as exc:
        raise ToolError("INPUT_READ_FAILED", f"could not read input PPTX: {exc}", input=str(path)) from exc
    return infos, data


def _relationship_target(source_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def logical_slide_mapping(presentation_xml: bytes, presentation_rels_xml: bytes, logical_number: int) -> SlideMapping:
    if logical_number <= 0:
        raise ToolError("LOGICAL_SLIDE_INVALID", "logical slide number must be a positive one-based integer", logical_slide=logical_number)
    presentation = _read_xml(presentation_xml, part_name="ppt/presentation.xml")
    rels = _read_xml(presentation_rels_xml, part_name="ppt/_rels/presentation.xml.rels")
    rel_targets: dict[str, tuple[str, str]] = {}
    for rel in rels.findall(qname(PKG_REL, "Relationship")):
        rid = rel.get("Id")
        target = rel.get("Target")
        if not rid or not target:
            continue
        rel_targets[rid] = (target, rel.get("TargetMode", ""))

    slide_ids = presentation.findall(f"./{qname(P, 'sldIdLst')}/{qname(P, 'sldId')}")
    if not slide_ids:
        raise ToolError("SLIDE_MAPPING_MISSING", "presentation has no p:sldId entries")
    if logical_number > len(slide_ids):
        raise ToolError(
            "LOGICAL_SLIDE_OUT_OF_RANGE",
            f"logical slide {logical_number} is outside the {len(slide_ids)}-slide mapping",
            logical_slide=logical_number,
            slide_count=len(slide_ids),
        )

    selected = slide_ids[logical_number - 1]
    rid = selected.get(qname(R, "id"))
    if not rid or rid not in rel_targets:
        raise ToolError("SLIDE_MAPPING_MISSING", f"logical slide {logical_number} has no resolvable relationship", logical_slide=logical_number, relationship_id=rid)
    target, target_mode = rel_targets[rid]
    if target_mode:
        raise ToolError("SLIDE_MAPPING_EXTERNAL", f"logical slide {logical_number} maps to an external target", logical_slide=logical_number, target_mode=target_mode)
    part_name = _relationship_target("ppt/presentation.xml", target)
    if not re.fullmatch(r"ppt/slides/[^/]+\.xml", part_name):
        raise ToolError("SLIDE_MAPPING_INVALID", f"logical slide {logical_number} maps outside ppt/slides: {part_name}", logical_slide=logical_number, target=target)
    return SlideMapping(logical_number, part_name, rid)


def _slide_rels_name(slide_part: str) -> str:
    directory, filename = posixpath.split(slide_part)
    return posixpath.join(directory, "_rels", f"{filename}.rels")


def _find_sp_tree(slide_root: ET.Element) -> ET.Element:
    tree = slide_root.find(f"./{qname(P, 'cSld')}/{qname(P, 'spTree')}")
    if tree is None:
        raise ToolError("INSERTION_TARGET_MISSING", "target slide has no p:cSld/p:spTree insertion target")
    return tree


def _find_title_shape(sp_tree: ET.Element) -> ET.Element:
    for shape in sp_tree.findall(qname(P, "sp")):
        ph = shape.find(f"./{qname(P, 'nvSpPr')}/{qname(P, 'nvPr')}/{qname(P, 'ph')}")
        c_nv_pr = shape.find(f"./{qname(P, 'nvSpPr')}/{qname(P, 'cNvPr')}")
        if ph is not None and ph.get("type") in {"title", "ctrTitle"}:
            return shape
        if c_nv_pr is not None and "title" in c_nv_pr.get("name", "").lower():
            return shape
    raise ToolError("INSERTION_TARGET_MISSING", "target slide has no title anchor for the equation insertion")


def _existing_shape_ids(slide_root: ET.Element) -> list[int]:
    ids: list[int] = []
    for node in slide_root.findall(f".//{qname(P, 'cNvPr')}"):
        value = node.get("id")
        if value and value.isdigit():
            ids.append(int(value))
    return ids


def _title_bottom(title_shape: ET.Element) -> int:
    xfrm = title_shape.find(f"./{qname(P, 'spPr')}/{qname(A, 'xfrm')}")
    if xfrm is None:
        # A title with inherited geometry still gives us a conservative anchor.
        return 800_000
    off = xfrm.find(qname(A, "off"))
    ext = xfrm.find(qname(A, "ext"))
    try:
        y = int(off.get("y", "0")) if off is not None else 0
        cy = int(ext.get("cy", "0")) if ext is not None else 0
    except (TypeError, ValueError) as exc:
        raise ToolError("INSERTION_GEOMETRY_INVALID", "title anchor has invalid DrawingML geometry") from exc
    return y + cy


def _slide_size(presentation_root: ET.Element) -> tuple[int, int]:
    size = presentation_root.find(qname(P, "sldSz"))
    if size is None:
        return DEFAULT_SLIDE_CX, DEFAULT_SLIDE_CY
    try:
        cx = int(size.get("cx", str(DEFAULT_SLIDE_CX)))
        cy = int(size.get("cy", str(DEFAULT_SLIDE_CY)))
    except (TypeError, ValueError) as exc:
        raise ToolError("SLIDE_SIZE_INVALID", "presentation p:sldSz contains non-numeric dimensions") from exc
    if cx <= 0 or cy <= 0:
        raise ToolError("SLIDE_SIZE_INVALID", "presentation p:sldSz must have positive dimensions", cx=cx, cy=cy)
    return cx, cy


def compute_geometry(presentation_root: ET.Element, title_shape: ET.Element) -> Geometry:
    cx, cy = _slide_size(presentation_root)
    margin = max(360_000, cx // 20)
    width = cx - (2 * margin)
    if width <= 0:
        raise ToolError("INSERTION_GEOMETRY_MISSING", "slide is too narrow for two equations", slide_cx=cx)
    height = min(1_200_000, max(650_000, cy // 7))
    gap = max(160_000, cy // 40)
    title_end = _title_bottom(title_shape)
    top = max(title_end + max(220_000, cy // 32), cy // 4)
    bottom_limit = cy - margin
    total = (2 * height) + gap
    if top + total > bottom_limit:
        top = bottom_limit - total
    if top <= title_end or top + total > bottom_limit or top < 0:
        raise ToolError(
            "INSERTION_GEOMETRY_MISSING",
            "target slide has no safe two-equation insertion area below its title",
            title_bottom=title_end,
            slide_cy=cy,
        )
    return Geometry(margin, top, width, height, gap, cx, cy)


def _run_properties(*, roman: bool = False) -> ET.Element:
    # PowerPoint's documented DrawingML representation uses a:rPr inside m:r.
    attrs = {"lang": "en-US", "altLang": "en-US", "sz": FONT_SIZE_HUNDREDTHS, "dirty": "0"}
    if roman:
        attrs["i"] = "0"
    rpr = ET.Element(qname(A, "rPr"), attrs)
    child(rpr, A, "latin", typeface="Cambria Math")
    return rpr


def _math_run(text: str, *, roman: bool = False) -> ET.Element:
    run = ET.Element(qname(M, "r"))
    run.append(_run_properties(roman=roman))
    text_node = child(run, M, "t")
    text_node.text = text
    if text[:1].isspace() or text[-1:].isspace():
        text_node.set(qname(XML, "space"), "preserve")
    return run


def _math_arg(*items: ET.Element) -> ET.Element:
    arg = ET.Element(qname(M, "e"))
    for item in items:
        arg.append(item)
    return arg


def _subscript(base: ET.Element, sub: ET.Element) -> ET.Element:
    node = ET.Element(qname(M, "sSub"))
    child(node, M, "sSubPr")
    node.append(_math_arg(base))
    node.append(_math_arg(sub))
    return node


def _sum_expression() -> ET.Element:
    nary = ET.Element(qname(M, "nary"))
    nary_pr = child(nary, M, "naryPr")
    child(nary_pr, M, "chr", **{qname(M, "val"): "∑"})
    child(nary_pr, M, "limLoc", **{qname(M, "val"): "undOvr"})
    child(nary_pr, M, "grow", **{qname(M, "val"): "1"})
    lower = _math_arg(_math_run("s"), _math_run(" ∈ "), _math_run("S"))
    lower.tag = qname(M, "sub")
    nary.append(lower)
    child(nary, M, "sup")
    nary.append(
        _math_arg(
            _subscript(_math_run("P"), _math_run("s")),
            _math_run(" "),
            _subscript(_math_run("t"), _math_run("s")),
        )
    )
    return nary


def _fraction(numerator: ET.Element, denominator: ET.Element) -> ET.Element:
    frac = ET.Element(qname(M, "f"))
    f_pr = child(frac, M, "fPr")
    child(f_pr, M, "type", **{qname(M, "val"): "bar"})
    frac.append(_math_arg(numerator))
    # CT_F requires ``num`` and ``den``; use explicit names after construction
    # rather than relying on positional helper naming.
    frac[-1].tag = qname(M, "num")
    frac.append(_math_arg(denominator))
    frac[-1].tag = qname(M, "den")
    return frac


def _formula_omml(key: str) -> ET.Element:
    if key == "E_endpoint":
        omath = ET.Element(qname(M, "oMath"))
        omath.append(_subscript(_math_run("E"), _math_run("endpoint", roman=True)))
        omath.append(_math_run(" = "))
        omath.append(_sum_expression())
        return omath
    if key == "eta_E":
        omath = ET.Element(qname(M, "oMath"))
        omath.append(_subscript(_math_run("η"), _math_run("E")))
        omath.append(_math_run(" = "))
        omath.append(
            _fraction(
                _subscript(_math_run("D"), _math_run("delivered", roman=True)),
                _subscript(_math_run("E"), _math_run("endpoint", roman=True)),
            )
        )
        return omath
    raise ToolError("FORMULA_INTERNAL", f"unsupported equation key: {key}")


def _formula_para(key: str) -> ET.Element:
    para = ET.Element(qname(M, "oMathPara"))
    para.append(_formula_omml(key))
    return para


def _native_shape(shape_id: int, key: str, latex: str, x: int, y: int, width: int, height: int) -> ET.Element:
    shape = ET.Element(qname(P, "sp"))
    nv_sp_pr = child(shape, P, "nvSpPr")
    child(nv_sp_pr, P, "cNvPr", id=str(shape_id), name=f"Native Office Math {key}", title=key, descr=latex)
    c_nv_sp_pr = child(nv_sp_pr, P, "cNvSpPr")
    child(c_nv_sp_pr, A, "spLocks", noGrp="1")
    child(nv_sp_pr, P, "nvPr")

    sp_pr = child(shape, P, "spPr")
    xfrm = child(sp_pr, A, "xfrm")
    child(xfrm, A, "off", x=str(x), y=str(y))
    child(xfrm, A, "ext", cx=str(width), cy=str(height))
    child(sp_pr, A, "noFill")
    line = child(sp_pr, A, "ln")
    child(line, A, "noFill")

    tx_body = child(shape, P, "txBody")
    child(tx_body, A, "bodyPr", anchor="ctr", wrap="none")
    child(tx_body, A, "lstStyle")
    para = child(tx_body, A, "p")
    child(para, A, "pPr", algn="ctr")
    math_wrapper = child(para, A14, "m")
    math_wrapper.append(_formula_para(key))
    child(para, A, "endParaRPr", lang="en-US", altLang="en-US", sz=FONT_SIZE_HUNDREDTHS, dirty="0")
    return shape


def _fallback_picture(shape_id: int, latex_text: str, relationship_id: str, geometry: Geometry) -> ET.Element:
    # The source SVG contains both equations in a single aligned vector.  Keep
    # its aspect ratio approximately while leaving the native choice at full
    # width.  The fallback is for rendering compatibility, not editability.
    fallback_width = min(7_900_000, geometry.width)
    fallback_height = min(geometry.fallback_height, max(1, int(round(fallback_width * 66.059 / 98.743))))
    fallback_height = min(fallback_height, geometry.fallback_height)
    x = max(0, (geometry.slide_cx - fallback_width) // 2)
    y = geometry.first_y
    pic = ET.Element(qname(P, "pic"))
    nv_pic_pr = child(pic, P, "nvPicPr")
    child(nv_pic_pr, P, "cNvPr", id=str(shape_id), name="Native Office Math fallback SVG", title="Office Math fallback", descr=latex_text)
    child(nv_pic_pr, P, "cNvPicPr", preferRelativeResize="0")
    child(nv_pic_pr, P, "nvPr")
    blip_fill = child(pic, P, "blipFill")
    child(blip_fill, A, "blip", **{qname(R, "embed"): relationship_id})
    stretch = child(blip_fill, A, "stretch")
    child(stretch, A, "fillRect")
    sp_pr = child(pic, P, "spPr")
    xfrm = child(sp_pr, A, "xfrm")
    child(xfrm, A, "off", x=str(x), y=str(y))
    child(xfrm, A, "ext", cx=str(fallback_width), cy=str(fallback_height))
    geometry_node = child(sp_pr, A, "prstGeom", prst="rect")
    child(geometry_node, A, "avLst")
    return pic


def _alternate_content(native_shapes: Iterable[ET.Element], fallback: ET.Element) -> ET.Element:
    alternate = ET.Element(qname(MC, "AlternateContent"))
    choice = child(alternate, MC, "Choice", Requires="a14")
    for shape in native_shapes:
        choice.append(shape)
    fallback_node = child(alternate, MC, "Fallback")
    fallback_node.append(fallback)
    return alternate


def _next_relationship_id(rels_root: ET.Element) -> str:
    used = {rel.get("Id", "") for rel in rels_root.findall(qname(PKG_REL, "Relationship"))}
    numeric = [int(value[3:]) for value in used if re.fullmatch(r"rId[0-9]+", value)]
    candidate = max(numeric, default=0) + 1
    while f"rId{candidate}" in used:
        candidate += 1
    return f"rId{candidate}"


def _next_media_name(members: Iterable[str]) -> str:
    existing = set(members)
    stem = "ppt/media/native-equations-fallback"
    candidate = f"{stem}.svg"
    index = 2
    while candidate in existing:
        candidate = f"{stem}-{index}.svg"
        index += 1
    return candidate


def _validate_svg(path: Path) -> bytes:
    if not path.is_file():
        raise ToolError("FALLBACK_SVG_MISSING", f"fallback SVG does not exist: {path}", fallback_svg=str(path))
    try:
        data = path.read_bytes()
    except OSError as exc:
        raise ToolError("FALLBACK_SVG_READ_FAILED", f"could not read fallback SVG: {exc}", fallback_svg=str(path)) from exc
    root = _read_xml(data, part_name=str(path))
    if local_name(root.tag).lower() != "svg":
        raise ToolError("FALLBACK_SVG_INVALID", "fallback file root is not an SVG element", fallback_svg=str(path))
    return data


def _add_svg_content_type(content_types_root: ET.Element) -> bool:
    for node in content_types_root.findall(qname(CT, "Default")):
        if node.get("Extension", "").lower() == "svg":
            if node.get("ContentType") != SVG_CONTENT_TYPE:
                raise ToolError("CONTENT_TYPE_CONFLICT", "existing SVG default content type is not image/svg+xml")
            return False
    child(content_types_root, CT, "Default", Extension="svg", ContentType=SVG_CONTENT_TYPE)
    return True


def _add_slide_image_relationship(rels_xml: bytes | None) -> tuple[bytes, str]:
    if rels_xml is None:
        rels_root = ET.Element(qname(PKG_REL, "Relationships"))
    else:
        rels_root = _read_xml(rels_xml, part_name="slide relationships")
    relationship_id = _next_relationship_id(rels_root)
    # The target is filled by the caller after the unique media name is chosen.
    return _xml_bytes(rels_root), relationship_id


def _set_slide_image_relationship(rels_xml: bytes, relationship_id: str, media_name: str) -> bytes:
    root = _read_xml(rels_xml, part_name="slide relationships")
    target = posixpath.relpath(media_name, start=posixpath.dirname("ppt/slides/slide.xml"))
    child(root, PKG_REL, "Relationship", Id=relationship_id, Type=IMAGE_REL_TYPE, Target=target)
    return _xml_bytes(root)


def _hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _xml_fingerprint(node: ET.Element | None) -> tuple[object, ...] | None:
    """Return a namespace-aware structural fingerprint for a small XML node."""

    if node is None:
        return None
    attrs = tuple(sorted((key, value) for key, value in node.attrib.items()))
    children = tuple(_xml_fingerprint(child_node) for child_node in list(node))
    return (node.tag, attrs, node.text or "", children)


def _preservation_report(before: dict[str, bytes], after: dict[str, bytes], changed: set[str]) -> dict[str, object]:
    # These are the parts that must remain byte-for-byte unchanged by this
    # focused slide edit.  The target slide and the intentionally changed
    # package metadata are excluded; a newly embedded SVG is not an input part.
    required_unchanged = {
        name
        for name in before
        if name not in changed
        and (
            name.startswith("ppt/notes")
            or name.startswith("ppt/slideMasters/")
            or name.startswith("ppt/slideLayouts/")
            or name.startswith("ppt/theme/")
            or name.endswith("/slideMaster.xml")
        )
    }
    violations = sorted(name for name in required_unchanged if before.get(name) != after.get(name))
    return {
        "required_unchanged_count": len(required_unchanged),
        "required_unchanged_sha256": {name: _hash(before[name]) for name in sorted(required_unchanged)},
        "violations": violations,
        "notes_preserved": not any(name.startswith("ppt/notes") for name in violations),
        "masters_layouts_preserved": not any(
            name.startswith(("ppt/slideMasters/", "ppt/slideLayouts/")) for name in violations
        ),
    }


def _validate_output(
    output_path: Path,
    *,
    input_data: dict[str, bytes],
    changed_parts: set[str],
    slide_part: str,
    fallback_media: str | None,
    expected_equations: tuple[str, ...],
) -> dict[str, object]:
    try:
        with zipfile.ZipFile(output_path, "r") as archive:
            bad = archive.testzip()
            if bad is not None:
                raise ToolError("OUTPUT_ZIP_CRC", f"output ZIP member failed CRC: {bad}", member=bad)
            out_data = {name: archive.read(name) for name in archive.namelist()}
    except zipfile.BadZipFile as exc:
        raise ToolError("OUTPUT_ZIP_INVALID", f"output PPTX is not a readable ZIP: {exc}") from exc

    xml_parts = [name for name in out_data if name.endswith(".xml") or name.endswith(".rels")]
    xml_failures: list[str] = []
    parsed: dict[str, ET.Element] = {}
    for name in xml_parts:
        try:
            parsed[name] = ET.fromstring(out_data[name])
        except ET.ParseError as exc:
            xml_failures.append(f"{name}: {exc}")
    if xml_failures:
        raise ToolError("OUTPUT_XML_INVALID", "output contains invalid XML", failures=xml_failures)

    slide_root = parsed.get(slide_part)
    if slide_root is None:
        raise ToolError("OUTPUT_SLIDE_MISSING", f"output is missing target slide part: {slide_part}")
    input_slide_root = _read_xml(input_data[slide_part], part_name=slide_part)
    target_background_preserved = _xml_fingerprint(
        input_slide_root.find(f"./{qname(P, 'cSld')}/{qname(P, 'bg')}")
    ) == _xml_fingerprint(
        slide_root.find(f"./{qname(P, 'cSld')}/{qname(P, 'bg')}")
    )
    if not target_background_preserved:
        raise ToolError("BACKGROUND_CHANGED", "target slide background changed unexpectedly")
    native_wrappers = slide_root.findall(f".//{qname(A14, 'm')}")
    omath = slide_root.findall(f".//{qname(M, 'oMath')}")
    descriptions = {
        c_nv_pr.get("descr", "")
        for c_nv_pr in slide_root.findall(f".//{qname(P, 'cNvPr')}")
        if c_nv_pr.get("descr", "") in expected_equations
    }
    if len(native_wrappers) < len(expected_equations) or len(omath) < len(expected_equations) or descriptions != set(expected_equations):
        raise ToolError(
            "OUTPUT_NATIVE_MATH_INVALID",
            "output target slide does not contain every expected native Office Math equation and exact LaTeX metadata",
            a14_m_count=len(native_wrappers),
            omath_count=len(omath),
            descriptions=sorted(descriptions),
        )
    if fallback_media is not None:
        if fallback_media not in out_data:
            raise ToolError("OUTPUT_FALLBACK_MISSING", f"output is missing embedded fallback SVG: {fallback_media}")
        content_types = parsed.get("[Content_Types].xml")
        if content_types is None or not any(
            node.get("Extension", "").lower() == "svg" and node.get("ContentType") == SVG_CONTENT_TYPE
            for node in content_types.findall(qname(CT, "Default"))
        ):
            raise ToolError("OUTPUT_CONTENT_TYPE_MISSING", "output does not declare image/svg+xml content type")

    preservation = _preservation_report(input_data, out_data, changed_parts)
    if preservation["violations"]:
        raise ToolError("PRESERVATION_FAILED", "protected PPTX parts changed unexpectedly", violations=preservation["violations"])
    return {
        "zip_valid": True,
        "xml_parts_validated": len(xml_parts),
        "target_a14_m_count": len(native_wrappers),
        "target_omath_count": len(omath),
        "exact_latex_metadata_present": True,
        "target_background_preserved": target_background_preserved,
        "preservation": preservation,
    }


def _write_archive(
    output_path: Path,
    infos: list[zipfile.ZipInfo],
    data: dict[str, bytes],
    additions: dict[str, bytes],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{output_path.name}.", suffix=".tmp", dir=str(output_path.parent))
    os.close(fd)
    temporary = Path(temp_name)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            written: set[str] = set()
            for info in infos:
                if info.filename in written:
                    continue
                archive.writestr(info, data[info.filename])
                written.add(info.filename)
            for name, payload in additions.items():
                if name in written:
                    raise ToolError("OUTPUT_PART_COLLISION", f"output addition collides with existing ZIP part: {name}")
                archive.writestr(name, payload)
                written.add(name)
        os.replace(temporary, output_path)
    except Exception:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def build_report_base(
    input_path: Path,
    output_path: Path,
    logical_number: int,
    fallback_svg: Path | None,
    selected_equations: tuple[tuple[str, str], ...] = EQUATIONS,
) -> dict[str, object]:
    return {
        "schema_id": TOOL_SCHEMA,
        "status": "FAIL",
        "tool": {
            "script": str(Path(__file__).resolve()),
            "mode": "OOXML-only",
            "python_pptx_used": False,
            "packages_installed": False,
            "native_math_font": "Cambria Math",
            "fallback_math_font": "Times-like SVG source (mathptmx in the supplied asset)",
        },
        "input": str(input_path),
        "output": str(output_path),
        "logical_slide": logical_number,
        "fallback_svg": str(fallback_svg) if fallback_svg is not None else None,
        "equations": [{"key": key, "latex": latex} for key, latex in selected_equations],
        "limitations": {
            "powerpoint_edit_save_reopen": "not tested by this tool; Microsoft PowerPoint remains the authoritative native-editability check",
            "native_math_font": "Cambria Math is used for the editable a14:m/OMML runs because PowerPoint's math zone reliably shapes sum, Greek eta, subscripts, and fractions with a math font; Times New Roman is not guaranteed to contain or shape all of those operators. The surrounding deck text remains untouched, and the supplied fallback SVG is Times-like.",
            "libreoffice": "a14:m native-choice rendering is not claimed or tested; LibreOffice may ignore or flatten the native choice, so provide --fallback-svg for a preview fallback",
            "visual_acceptance": "not claimed; render every page and inspect overlap, crop, overflow, and whitespace separately",
        },
    }


def insert_equations(
    input_path: Path,
    output_path: Path,
    logical_number: int,
    fallback_svg: Path | None,
    equation_keys: tuple[str, ...] | None = None,
) -> dict[str, object]:
    if input_path.resolve() == output_path.resolve():
        raise ToolError("OUTPUT_EQUALS_INPUT", "input and output PPTX paths must differ")
    infos, data = _read_archive(input_path)
    selected_equations = tuple(
        (key, latex)
        for key, latex in EQUATIONS
        if equation_keys is None or key in equation_keys
    )
    if not selected_equations:
        raise ToolError("FORMULA_SELECTION_EMPTY", "at least one supported equation must be selected")

    presentation_root = _read_xml(data["ppt/presentation.xml"], part_name="ppt/presentation.xml")
    mapping = logical_slide_mapping(
        data["ppt/presentation.xml"],
        data["ppt/_rels/presentation.xml.rels"],
        logical_number,
    )
    if mapping.part_name not in data:
        raise ToolError("SLIDE_PART_MISSING", f"logical slide maps to missing part: {mapping.part_name}", logical_slide=logical_number, part=mapping.part_name)
    slide_root = _read_xml(data[mapping.part_name], part_name=mapping.part_name)
    sp_tree = _find_sp_tree(slide_root)
    title_shape = _find_title_shape(sp_tree)
    existing_latex = {
        node.get("descr", "")
        for node in slide_root.findall(f".//{qname(P, 'cNvPr')}")
        if node.get("descr", "") in {latex for _, latex in selected_equations}
    }
    if existing_latex:
        raise ToolError("INSERTION_TARGET_OCCUPIED", "target slide already contains one of the exact native-equation metadata strings", existing=sorted(existing_latex), logical_slide=logical_number)
    geometry = compute_geometry(presentation_root, title_shape)
    max_id = max(_existing_shape_ids(slide_root), default=1)
    native_shapes = [
        _native_shape(
            max_id + index + 1,
            key,
            latex,
            geometry.x,
            geometry.first_y + index * (geometry.height + geometry.gap),
            geometry.width,
            geometry.height,
        )
        for index, (key, latex) in enumerate(selected_equations)
    ]

    changed_parts = {mapping.part_name}
    additions: dict[str, bytes] = {}
    fallback_media: str | None = None
    if fallback_svg is not None:
        svg_data = _validate_svg(fallback_svg)
        fallback_media = _next_media_name(data)
        rel_name = _slide_rels_name(mapping.part_name)
        rel_xml = data.get(rel_name)
        rel_xml, relationship_id = _add_slide_image_relationship(rel_xml)
        rel_xml = _set_slide_image_relationship(rel_xml, relationship_id, fallback_media)
        data[rel_name] = rel_xml
        changed_parts.add(rel_name)
        additions[fallback_media] = svg_data

        content_types_root = _read_xml(data["[Content_Types].xml"], part_name="[Content_Types].xml")
        if _add_svg_content_type(content_types_root):
            data["[Content_Types].xml"] = _xml_bytes(content_types_root)
            changed_parts.add("[Content_Types].xml")
        fallback_text = "\n".join(latex for _, latex in selected_equations)
        fallback = _fallback_picture(max_id + 3, fallback_text, relationship_id, geometry)
        sp_tree.append(_alternate_content(native_shapes, fallback))
    else:
        for shape in native_shapes:
            sp_tree.append(shape)

    data[mapping.part_name] = _xml_bytes(slide_root)
    _write_archive(output_path, infos, data, additions)
    validation = _validate_output(
        output_path,
        input_data={name: payload for name, payload in _read_archive(input_path)[1].items()},
        changed_parts=changed_parts,
        slide_part=mapping.part_name,
        fallback_media=fallback_media,
        expected_equations=tuple(latex for _, latex in selected_equations),
    )

    report = build_report_base(input_path, output_path, logical_number, fallback_svg, selected_equations)
    report.update(
        {
            "status": "PASS",
            "slide_mapping": {
                "logical_number": mapping.logical_number,
                "physical_part": mapping.part_name,
                "relationship_id": mapping.relationship_id,
                "mapping_basis": "presentation.xml p:sldIdLst order",
            },
            "insertion_target": {
                "kind": "p:cSld/p:spTree with title anchor",
                "title_anchor_found": True,
                "native_shapes_inserted": len(selected_equations),
                "fallback_wrapped_in_mc_AlternateContent": fallback_svg is not None,
            },
            "geometry_emu": {
                "slide_cx": geometry.slide_cx,
                "slide_cy": geometry.slide_cy,
                "x": geometry.x,
                "first_y": geometry.first_y,
                "second_y": geometry.second_y,
                "width": geometry.width,
                "height": geometry.height,
                "gap": geometry.gap,
            },
            "fallback": {
                "embedded_media_part": fallback_media,
                "content_type": SVG_CONTENT_TYPE if fallback_media else None,
                "choice_requires": "a14" if fallback_media else None,
            },
            "changed_parts": sorted(changed_parts),
            "validation": validation,
        }
    )
    return report


def _write_report(path: Path | None, report: dict[str, object]) -> None:
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    if path is None:
        return
    if str(path) == "-":
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload, encoding="utf-8")


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_pptx", type=Path, help="input PowerPoint .pptx")
    parser.add_argument("output_pptx", type=Path, help="output PowerPoint .pptx")
    parser.add_argument("logical_slide_pos", nargs="?", type=int, help="one-based logical slide number")
    parser.add_argument("--logical-slide", "--slide", dest="logical_slide_opt", type=int, help="one-based logical slide number")
    parser.add_argument("--fallback-svg", "--fallback", dest="fallback_svg", type=Path, help="optional SVG used only inside mc:Fallback")
    parser.add_argument(
        "--equation",
        dest="equations",
        action="append",
        choices=[key for key, _ in EQUATIONS],
        help="insert only the named editable Office Math equation; repeat to select more than one (default: both)",
    )
    parser.add_argument("--report", type=Path, help="write a JSON report; use '-' to suppress a report file")
    args = parser.parse_args(argv)
    if args.logical_slide_pos is not None and args.logical_slide_opt is not None and args.logical_slide_pos != args.logical_slide_opt:
        parser.error("positional logical slide and --logical-slide disagree")
    args.logical_slide = args.logical_slide_opt if args.logical_slide_opt is not None else args.logical_slide_pos
    if args.logical_slide is None:
        parser.error("a logical slide number is required (positional or --logical-slide)")
    return args


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    # Keep CLI parsing failures conventional; operation failures receive the
    # same structured report as all other fail-closed paths.
    try:
        args = _parse_args(argv)
    except SystemExit:
        raise
    selected_equations = tuple(
        (key, latex)
        for key, latex in EQUATIONS
        if not args.equations or key in args.equations
    )
    report = build_report_base(
        args.input_pptx,
        args.output_pptx,
        args.logical_slide,
        args.fallback_svg,
        selected_equations,
    )
    try:
        report = insert_equations(
            args.input_pptx,
            args.output_pptx,
            args.logical_slide,
            args.fallback_svg,
            tuple(args.equations) if args.equations else None,
        )
    except ToolError as exc:
        report.update({"status": "FAIL", "error": {"code": exc.code, "message": exc.message, **exc.details}})
        _write_report(args.report, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2
    except OSError as exc:
        report.update({"status": "FAIL", "error": {"code": "IO_ERROR", "message": str(exc)}})
        _write_report(args.report, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2
    _write_report(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
