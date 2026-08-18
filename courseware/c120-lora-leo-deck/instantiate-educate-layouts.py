#!/usr/bin/env python3
"""Finalize a six-slide native-layout sampler derived from educate.pptx.

The pptx skill's ``add_slide.py from-layout`` creates slide parts and
presentation relationships but intentionally leaves slide-order insertion to
the caller.  This helper performs only that deterministic insertion.  It does
not add or alter masters, layouts, themes, backgrounds, colors, or slide fills.
"""

from __future__ import annotations

import argparse
import copy
import re
from pathlib import Path
from xml.etree import ElementTree as ET


A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"a": A, "p": P, "r": R}

LAYOUT_SLIDES = {
    "slide3.xml": "slideLayout2.xml",
    "slide4.xml": "slideLayout3.xml",
    "slide5.xml": "slideLayout4.xml",
    "slide6.xml": "slideLayout5.xml",
    "slide7.xml": "slideLayout7.xml",
}


SLIDE_LIST = (
    '<p:sldIdLst>'
    '<p:sldId id="277" r:id="rId2"/>'
    '<p:sldId id="296" r:id="rId9"/>'
    '<p:sldId id="297" r:id="rId10"/>'
    '<p:sldId id="298" r:id="rId11"/>'
    '<p:sldId id="299" r:id="rId12"/>'
    '<p:sldId id="300" r:id="rId13"/>'
    '</p:sldIdLst>'
)


def qn(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def set_placeholder_token(shape: ET.Element, token: str) -> None:
    tx_body = shape.find("p:txBody", NS)
    if tx_body is None:
        tx_body = ET.SubElement(shape, qn(P, "txBody"))
        ET.SubElement(tx_body, qn(A, "bodyPr"))
        ET.SubElement(tx_body, qn(A, "lstStyle"))
    for paragraph in list(tx_body.findall("a:p", NS)):
        tx_body.remove(paragraph)
    paragraph = ET.SubElement(tx_body, qn(A, "p"))
    run = ET.SubElement(paragraph, qn(A, "r"))
    run_properties = ET.SubElement(run, qn(A, "rPr"))
    run_properties.set("lang", "zh-TW")
    text = ET.SubElement(run, qn(A, "t"))
    text.text = token
    end_properties = ET.SubElement(paragraph, qn(A, "endParaRPr"))
    end_properties.set("lang", "zh-TW")


def materialize_layout_placeholders(root: Path) -> None:
    slide_dir = root / "ppt" / "slides"
    layout_dir = root / "ppt" / "slideLayouts"

    ET.register_namespace("a", A)
    ET.register_namespace("p", P)
    ET.register_namespace("r", R)

    for slide_name, layout_name in LAYOUT_SLIDES.items():
        slide_path = slide_dir / slide_name
        layout_path = layout_dir / layout_name
        slide_root = ET.parse(slide_path).getroot()
        layout_root = ET.parse(layout_path).getroot()
        slide_tree = slide_root.find("./p:cSld/p:spTree", NS)
        if slide_tree is None:
            raise RuntimeError(f"missing slide shape tree: {slide_name}")

        next_shape_id = 2
        content_index = 1
        for source_shape in layout_root.findall("./p:cSld/p:spTree/p:sp", NS):
            placeholder = source_shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
            if placeholder is None:
                continue
            placeholder_type = placeholder.get("type", "obj")
            placeholder_index = placeholder.get("idx")
            if placeholder_type == "sldNum" or placeholder_index == "10":
                continue

            clone = copy.deepcopy(source_shape)
            non_visual = clone.find("./p:nvSpPr/p:cNvPr", NS)
            if non_visual is None:
                raise RuntimeError(f"missing cNvPr in {layout_name}")
            non_visual.set("id", str(next_shape_id))

            if placeholder_type in {"title", "ctrTitle"}:
                token = "[[TITLE]]"
                non_visual.set("name", "Native title placeholder")
            else:
                token = f"[[CONTENT_{content_index}]]"
                non_visual.set("name", f"Native content placeholder {content_index}")
                content_index += 1
            set_placeholder_token(clone, token)
            slide_tree.append(clone)
            next_shape_id += 1

        ET.ElementTree(slide_root).write(
            slide_path,
            encoding="utf-8",
            xml_declaration=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("unpacked", type=Path)
    args = parser.parse_args()

    root = args.unpacked.resolve()
    presentation = root / "ppt" / "presentation.xml"
    relationships = root / "ppt" / "_rels" / "presentation.xml.rels"

    xml = presentation.read_text(encoding="utf-8")
    xml, count = re.subn(
        r"<p:sldIdLst>.*?</p:sldIdLst>",
        SLIDE_LIST,
        xml,
        count=1,
        flags=re.DOTALL,
    )
    if count != 1:
        raise RuntimeError("expected exactly one p:sldIdLst")
    presentation.write_text(xml, encoding="utf-8")

    rels = relationships.read_text(encoding="utf-8")
    rels, count = re.subn(
        r'<Relationship\b(?=[^>]*\bId="rId3")(?=[^>]*\bType="[^"]*/slide")[^>]*/>',
        "",
        rels,
        count=1,
    )
    if count != 1:
        raise RuntimeError("expected the original slide2 relationship rId3")
    relationships.write_text(rels, encoding="utf-8")

    materialize_layout_placeholders(root)


if __name__ == "__main__":
    main()
