#!/usr/bin/env python3
"""Finish the six-page educate.pptx proof without adding slide backgrounds.

This pass performs only user-requested presentation finishing work:

* removes the inherited bottom banner, authority line, and slide numbers;
* centers the cover subtitle and the single-object causal chain;
* places verified server-preview browser evidence in logical slide 6;
* adds transparent, editable interpretation text on slides 5 and 6.

It does not alter the full-slide background artwork, theme colors, speaker
notes, or native layout relationships.  Native Office Math is inserted by the
separate ``insert-native-equations.py`` source pass.
"""

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
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
NS = {"a": A, "p": P, "r": R, "pr": PR, "ct": CT}

EMU = 914400
LATIN_FONT = "Times New Roman"
EAST_ASIA_FONT = "標楷體"
BODY_SIZE = "2400"
TEXT_COLOR = "292B6E"
AUTHORITY_TEXT = "教育部智慧節能網路跨層系統整合教學聯盟"


def qn(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def serialize(root: ET.Element) -> bytes:
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def slide_order(entries: dict[str, bytes]) -> list[str]:
    presentation = ET.fromstring(entries["ppt/presentation.xml"])
    rels = ET.fromstring(entries["ppt/_rels/presentation.xml.rels"])
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in rels.findall("pr:Relationship", NS)
    }
    ordered: list[str] = []
    for node in presentation.findall("./p:sldIdLst/p:sldId", NS):
        rel_id = node.get(qn(R, "id"))
        target = targets.get(rel_id or "")
        if not target:
            raise RuntimeError(f"missing slide target for relationship {rel_id}")
        ordered.append(posixpath.normpath(posixpath.join("ppt", target)))
    return ordered


def slide_rels_part(slide_part: str) -> str:
    path = Path(slide_part)
    return posixpath.join(str(path.parent), "_rels", f"{path.name}.rels")


def part_text(node: ET.Element) -> str:
    return "".join(text.text or "" for text in node.findall(".//a:t", NS))


def shape_y(node: ET.Element) -> int | None:
    xfrm = node.find("./p:spPr/a:xfrm", NS)
    if xfrm is None:
        xfrm = node.find("./p:grpSpPr/a:xfrm", NS)
    if xfrm is None:
        return None
    off = xfrm.find("a:off", NS)
    return int(off.get("y", "0")) if off is not None else None


def is_slide_number(node: ET.Element) -> bool:
    ph = node.find(".//p:nvPr/p:ph", NS)
    return bool(
        ph is not None
        and (ph.get("type") == "sldNum" or ph.get("idx") == "10")
    )


def remove_bottom_footer(root: ET.Element, slide_height: int) -> int:
    """Remove only bottom-only artwork and footer/page-number carriers."""

    tree = root.find("./p:cSld/p:spTree", NS)
    if tree is None:
        return 0
    removed = 0
    threshold = int(slide_height * 0.80)
    for node in list(tree):
        if node.tag not in {
            qn(P, "sp"),
            qn(P, "pic"),
            qn(P, "graphicFrame"),
            qn(P, "grpSp"),
        }:
            continue
        text = part_text(node).replace(" ", "")
        y = shape_y(node)
        if is_slide_number(node) or AUTHORITY_TEXT in text or (
            y is not None and y >= threshold
        ):
            tree.remove(node)
            removed += 1
    return removed


def set_paragraph_alignment(shape: ET.Element, alignment: str) -> None:
    body = shape.find("p:txBody", NS)
    if body is None:
        return
    body_pr = body.find("a:bodyPr", NS)
    if body_pr is not None:
        body_pr.set("anchor", "ctr")
    for paragraph in body.findall("a:p", NS):
        ppr = paragraph.find("a:pPr", NS)
        if ppr is None:
            ppr = ET.Element(qn(A, "pPr"))
            paragraph.insert(0, ppr)
        ppr.set("algn", alignment)


def find_placeholder_shapes(root: ET.Element) -> list[ET.Element]:
    return [
        shape
        for shape in root.findall("./p:cSld/p:spTree/p:sp", NS)
        if shape.find("./p:nvSpPr/p:nvPr/p:ph", NS) is not None
    ]


def center_cover_subtitle(root: ET.Element) -> int:
    changed = 0
    for shape in find_placeholder_shapes(root):
        ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
        if ph is not None and ph.get("type") == "subTitle":
            set_paragraph_alignment(shape, "ctr")
            changed += 1
    return changed


def center_causal_chain(root: ET.Element) -> int:
    changed = 0
    for shape in find_placeholder_shapes(root):
        ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
        if ph is None or ph.get("type") in {"title", "ctrTitle", "sldNum"}:
            continue
        if ph.get("idx") == "10":
            continue
        set_paragraph_alignment(shape, "ctr")
        changed += 1
    return changed


def format_command_walkthrough(root: ET.Element) -> int:
    """Keep prose at 24 pt and use 18 pt only for exact shell commands."""

    changed = 0
    for shape in root.findall("./p:cSld/p:spTree/p:sp", NS):
        cnv = shape.find("./p:nvSpPr/p:cNvPr", NS)
        name = cnv.get("name", "") if cnv is not None else ""
        if name not in {"Native content placeholder 2", "Native content placeholder 4"}:
            continue
        body = shape.find("p:txBody", NS)
        if body is None:
            continue
        body_pr = body.find("a:bodyPr", NS)
        if body_pr is not None:
            body_pr.set("anchor", "t")
            body_pr.set("lIns", "0")
            body_pr.set("rIns", "0")
        for paragraph in body.findall("a:p", NS):
            text = "".join(node.text or "" for node in paragraph.findall(".//a:t", NS))
            if not text.strip().startswith("bash "):
                continue
            ppr = paragraph.find("a:pPr", NS)
            if ppr is None:
                ppr = ET.Element(qn(A, "pPr"))
                paragraph.insert(0, ppr)
            ppr.set("algn", "l")
            for props in paragraph.findall("a:r/a:rPr", NS) + paragraph.findall(
                "a:endParaRPr", NS
            ):
                props.set("sz", "1800")
                props.set("i", "0")
            changed += 1
    return changed


def next_shape_id(root: ET.Element) -> int:
    values = []
    for prop in root.findall(".//p:cNvPr", NS):
        try:
            values.append(int(prop.get("id", "0")))
        except ValueError:
            continue
    return max(values, default=1) + 1


def next_relationship_id(root: ET.Element) -> str:
    values = []
    for rel in root.findall("pr:Relationship", NS):
        match = re.fullmatch(r"rId(\d+)", rel.get("Id", ""))
        if match:
            values.append(int(match.group(1)))
    return f"rId{max(values, default=0) + 1}"


def add_image_relationship(entries: dict[str, bytes], slide_part: str, target: str) -> str:
    rels_part = slide_rels_part(slide_part)
    if rels_part not in entries:
        root = ET.Element(qn(PR, "Relationships"))
    else:
        root = ET.fromstring(entries[rels_part])
    rel_id = next_relationship_id(root)
    relationship = ET.SubElement(root, qn(PR, "Relationship"))
    relationship.set("Id", rel_id)
    relationship.set(
        "Type",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
    )
    relationship.set("Target", target)
    entries[rels_part] = serialize(root)
    return rel_id


def add_picture(
    root: ET.Element,
    *,
    rel_id: str,
    name: str,
    description: str,
    x: float,
    y: float,
    width: float,
    height: float,
) -> None:
    tree = root.find("./p:cSld/p:spTree", NS)
    if tree is None:
        raise RuntimeError("slide has no shape tree")
    picture = ET.Element(qn(P, "pic"))
    nv = ET.SubElement(picture, qn(P, "nvPicPr"))
    cnv = ET.SubElement(nv, qn(P, "cNvPr"))
    cnv.set("id", str(next_shape_id(root)))
    cnv.set("name", name)
    cnv.set("descr", description)
    cnv_pic = ET.SubElement(nv, qn(P, "cNvPicPr"))
    locks = ET.SubElement(cnv_pic, qn(A, "picLocks"))
    locks.set("noChangeAspect", "1")
    ET.SubElement(nv, qn(P, "nvPr"))

    blip_fill = ET.SubElement(picture, qn(P, "blipFill"))
    blip = ET.SubElement(blip_fill, qn(A, "blip"))
    blip.set(qn(R, "embed"), rel_id)
    stretch = ET.SubElement(blip_fill, qn(A, "stretch"))
    ET.SubElement(stretch, qn(A, "fillRect"))

    sp_pr = ET.SubElement(picture, qn(P, "spPr"))
    xfrm = ET.SubElement(sp_pr, qn(A, "xfrm"))
    off = ET.SubElement(xfrm, qn(A, "off"))
    off.set("x", str(round(x * EMU)))
    off.set("y", str(round(y * EMU)))
    ext = ET.SubElement(xfrm, qn(A, "ext"))
    ext.set("cx", str(round(width * EMU)))
    ext.set("cy", str(round(height * EMU)))
    geom = ET.SubElement(sp_pr, qn(A, "prstGeom"))
    geom.set("prst", "rect")
    ET.SubElement(geom, qn(A, "avLst"))
    tree.append(picture)


def add_run(paragraph: ET.Element, text: str, *, bold: bool = False) -> None:
    run = ET.SubElement(paragraph, qn(A, "r"))
    rpr = ET.SubElement(run, qn(A, "rPr"))
    rpr.set("lang", "zh-TW")
    rpr.set("altLang", "en-US")
    rpr.set("sz", BODY_SIZE)
    rpr.set("i", "0")
    rpr.set("b", "1" if bold else "0")
    fill = ET.SubElement(rpr, qn(A, "solidFill"))
    color = ET.SubElement(fill, qn(A, "srgbClr"))
    color.set("val", TEXT_COLOR)
    ET.SubElement(rpr, qn(A, "latin")).set("typeface", LATIN_FONT)
    ET.SubElement(rpr, qn(A, "ea")).set("typeface", EAST_ASIA_FONT)
    ET.SubElement(rpr, qn(A, "cs")).set("typeface", LATIN_FONT)
    text_node = ET.SubElement(run, qn(A, "t"))
    text_node.text = text


def add_text_box(
    root: ET.Element,
    *,
    name: str,
    paragraphs: list[str],
    x: float,
    y: float,
    width: float,
    height: float,
    alignment: str = "ctr",
) -> None:
    tree = root.find("./p:cSld/p:spTree", NS)
    if tree is None:
        raise RuntimeError("slide has no shape tree")
    shape = ET.Element(qn(P, "sp"))
    nv = ET.SubElement(shape, qn(P, "nvSpPr"))
    cnv = ET.SubElement(nv, qn(P, "cNvPr"))
    cnv.set("id", str(next_shape_id(root)))
    cnv.set("name", name)
    cnv_sp = ET.SubElement(nv, qn(P, "cNvSpPr"))
    cnv_sp.set("txBox", "1")
    ET.SubElement(nv, qn(P, "nvPr"))

    sp_pr = ET.SubElement(shape, qn(P, "spPr"))
    xfrm = ET.SubElement(sp_pr, qn(A, "xfrm"))
    off = ET.SubElement(xfrm, qn(A, "off"))
    off.set("x", str(round(x * EMU)))
    off.set("y", str(round(y * EMU)))
    ext = ET.SubElement(xfrm, qn(A, "ext"))
    ext.set("cx", str(round(width * EMU)))
    ext.set("cy", str(round(height * EMU)))
    geom = ET.SubElement(sp_pr, qn(A, "prstGeom"))
    geom.set("prst", "rect")
    ET.SubElement(geom, qn(A, "avLst"))
    ET.SubElement(sp_pr, qn(A, "noFill"))
    line = ET.SubElement(sp_pr, qn(A, "ln"))
    ET.SubElement(line, qn(A, "noFill"))

    body = ET.SubElement(shape, qn(P, "txBody"))
    body_pr = ET.SubElement(body, qn(A, "bodyPr"))
    body_pr.set("wrap", "square")
    body_pr.set("anchor", "ctr")
    body_pr.set("lIns", "0")
    body_pr.set("rIns", "0")
    body_pr.set("tIns", "0")
    body_pr.set("bIns", "0")
    ET.SubElement(body, qn(A, "lstStyle"))
    for text in paragraphs:
        paragraph = ET.SubElement(body, qn(A, "p"))
        ppr = ET.SubElement(paragraph, qn(A, "pPr"))
        ppr.set("algn", alignment)
        ET.SubElement(ppr, qn(A, "buNone"))
        add_run(paragraph, text)
        end = ET.SubElement(paragraph, qn(A, "endParaRPr"))
        end.set("lang", "zh-TW")
        end.set("altLang", "en-US")
        end.set("sz", BODY_SIZE)
        end.set("i", "0")
        ET.SubElement(end, qn(A, "latin")).set("typeface", LATIN_FONT)
        ET.SubElement(end, qn(A, "ea")).set("typeface", EAST_ASIA_FONT)
        ET.SubElement(end, qn(A, "cs")).set("typeface", LATIN_FONT)
    tree.append(shape)


def remove_right_empty_placeholder(root: ET.Element) -> str:
    tree = root.find("./p:cSld/p:spTree", NS)
    if tree is None:
        raise RuntimeError("slide has no shape tree")
    candidates: list[tuple[int, ET.Element, str]] = []
    for shape in tree.findall("p:sp", NS):
        ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
        if ph is None or ph.get("type") in {"title", "ctrTitle", "sldNum"}:
            continue
        cnv = shape.find("./p:nvSpPr/p:cNvPr", NS)
        name = cnv.get("name", "") if cnv is not None else ""
        xfrm = shape.find("./p:spPr/a:xfrm", NS)
        off = xfrm.find("a:off", NS) if xfrm is not None else None
        x = int(off.get("x", "0")) if off is not None else 0
        candidates.append((x, shape, name))
    if not candidates:
        raise RuntimeError("logical slide 6 has no non-title native placeholder")
    _, target, name = max(candidates, key=lambda item: item[0])
    tree.remove(target)
    return name


def ensure_content_type(entries: dict[str, bytes], extension: str, content_type: str) -> None:
    root = ET.fromstring(entries["[Content_Types].xml"])
    for node in root.findall("ct:Default", NS):
        if node.get("Extension", "").lower() == extension.lower():
            return
    node = ET.SubElement(root, qn(CT, "Default"))
    node.set("Extension", extension)
    node.set("ContentType", content_type)
    entries["[Content_Types].xml"] = serialize(root)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--screenshot", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()

    input_path = args.input.resolve()
    output_path = args.output.resolve()
    screenshot_path = args.screenshot.resolve()
    if input_path == output_path:
        raise SystemExit("input and output must differ")
    if not screenshot_path.is_file():
        raise SystemExit(f"missing screenshot: {screenshot_path}")

    with zipfile.ZipFile(input_path, "r") as source:
        entries = {info.filename: source.read(info.filename) for info in source.infolist()}
        order = [info.filename for info in source.infolist()]

    slides = slide_order(entries)
    if len(slides) != 6:
        raise SystemExit(f"expected six logical slides, found {len(slides)}")
    presentation = ET.fromstring(entries["ppt/presentation.xml"])
    size = presentation.find("p:sldSz", NS)
    if size is None:
        raise SystemExit("missing presentation slide size")
    slide_height = int(size.get("cy", "0"))

    removed_by_part: dict[str, int] = {}
    native_parts = [
        name
        for name in entries
        if re.fullmatch(
            r"ppt/(?:slides/slide\d+|slideLayouts/slideLayout\d+|slideMasters/slideMaster\d+)\.xml",
            name,
        )
    ]
    for name in native_parts:
        root = ET.fromstring(entries[name])
        removed = remove_bottom_footer(root, slide_height)
        if removed:
            entries[name] = serialize(root)
            removed_by_part[name] = removed

    cover = ET.fromstring(entries[slides[0]])
    cover_centered = center_cover_subtitle(cover)
    entries[slides[0]] = serialize(cover)

    causal = ET.fromstring(entries[slides[1]])
    causal_centered = center_causal_chain(causal)
    entries[slides[1]] = serialize(causal)

    command_slide = ET.fromstring(entries[slides[3]])
    command_paragraphs_resized = format_command_walkthrough(command_slide)
    entries[slides[3]] = serialize(command_slide)

    formula_slide = ET.fromstring(entries[slides[4]])
    add_text_box(
        formula_slide,
        name="C120 equation interpretation",
        paragraphs=[
            "第一式：各 radio state 的功率與停留時間累積為 endpoint energy",
            "第二式：送達資料量除以相同能量邊界，才可比較 energy efficiency",
        ],
        x=1.05,
        y=5.30,
        width=11.25,
        height=1.10,
        alignment="ctr",
    )
    entries[slides[4]] = serialize(formula_slide)

    screenshot_bytes = screenshot_path.read_bytes()
    media_name = "ppt/media/c120-server-preview-import.png"
    entries[media_name] = screenshot_bytes
    ensure_content_type(entries, "png", "image/png")
    screenshot_rel = add_image_relationship(
        entries,
        slides[5],
        "../media/c120-server-preview-import.png",
    )
    evidence_slide = ET.fromstring(entries[slides[5]])
    removed_placeholder = remove_right_empty_placeholder(evidence_slide)
    screenshot_sha = hashlib.sha256(screenshot_bytes).hexdigest()
    add_picture(
        evidence_slide,
        rel_id=screenshot_rel,
        name="Verified server preview import evidence",
        description=(
            "C-120 server preview browser import evidence; "
            f"source_sha256={screenshot_sha}"
        ),
        x=5.22,
        y=1.10,
        width=7.77,
        height=4.37,
    )
    add_text_box(
        evidence_slide,
        name="Evidence boundary",
        paragraphs=["Server preview 已驗證；Windows native 待實機驗證"],
        x=5.22,
        y=5.62,
        width=7.77,
        height=0.62,
        alignment="ctr",
    )
    entries[slides[5]] = serialize(evidence_slide)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as target:
        written = set()
        for name in order:
            target.writestr(name, entries[name])
            written.add(name)
        for name in sorted(set(entries) - written):
            target.writestr(name, entries[name])

    with zipfile.ZipFile(output_path, "r") as check:
        bad = check.testzip()
        if bad:
            raise RuntimeError(f"corrupt output member: {bad}")
        for name in slides:
            ET.fromstring(check.read(name))

    report = {
        "input": str(input_path),
        "output": str(output_path),
        "slide_count": len(slides),
        "background_policy": "no slide-level background or solid fill added",
        "footer_shapes_removed": sum(removed_by_part.values()),
        "footer_removals_by_part": removed_by_part,
        "cover_subtitle_shapes_centered": cover_centered,
        "causal_shapes_centered": causal_centered,
        "command_paragraphs_resized_to_18pt": command_paragraphs_resized,
        "logical_slide_6_removed_placeholder": removed_placeholder,
        "screenshot": str(screenshot_path),
        "screenshot_sha256": screenshot_sha,
        "visible_evidence_boundary": "Server preview verified; Windows native pending",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    ET.register_namespace("a", A)
    ET.register_namespace("p", P)
    ET.register_namespace("r", R)
    ET.register_namespace("pr", PR)
    ET.register_namespace("ct", CT)
    main()
