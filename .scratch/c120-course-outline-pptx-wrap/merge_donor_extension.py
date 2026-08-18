#!/usr/bin/env python3
"""Append two shape-only slides without rewriting donor slide/master parts.

The accepted two-slide PowerPoint-normalized donor is the package authority.
This script copies only slide XML from the managed PptxGenJS extension deck,
binds both new slides to the donor's no-placeholder edu layout, and updates the
minimal presentation/content-type metadata required for a four-slide package.
"""

from __future__ import annotations

import argparse
from copy import copy
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


SLIDE_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "presentationml.slide+xml"
)
SLIDE_RELATIONSHIP_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
)
LAYOUT_RELATIONSHIP_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--donor", required=True, type=Path)
    parser.add_argument("--extension", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def require_once(text: str, needle: str, label: str) -> None:
    count = text.count(needle)
    if count != 1:
        raise RuntimeError(f"{label}: expected one occurrence, found {count}")


def append_before(text: str, marker: str, addition: str, label: str) -> str:
    require_once(text, marker, label)
    return text.replace(marker, f"{addition}{marker}")


def new_zip_info(filename: str, donor_info: ZipInfo) -> ZipInfo:
    info = copy(donor_info)
    info.filename = filename
    info.orig_filename = filename
    info.CRC = 0
    info.compress_size = 0
    info.file_size = 0
    info.header_offset = 0
    info.compress_type = donor_info.compress_type or ZIP_DEFLATED
    return info


def update_presentation_xml(xml: str) -> str:
    expected = (
        '<p:sldIdLst><p:sldId id="256" r:id="rId2"/>'
        '<p:sldId id="257" r:id="rId3"/></p:sldIdLst>'
    )
    replacement = (
        '<p:sldIdLst><p:sldId id="256" r:id="rId2"/>'
        '<p:sldId id="257" r:id="rId3"/>'
        '<p:sldId id="258" r:id="rId9"/>'
        '<p:sldId id="259" r:id="rId10"/></p:sldIdLst>'
    )
    require_once(xml, expected, "presentation slide list")
    return xml.replace(expected, replacement)


def update_presentation_relationships(xml: str) -> str:
    additions = (
        f'<Relationship Id="rId9" Type="{SLIDE_RELATIONSHIP_TYPE}" '
        'Target="slides/slide3.xml"/>'
        f'<Relationship Id="rId10" Type="{SLIDE_RELATIONSHIP_TYPE}" '
        'Target="slides/slide4.xml"/>'
    )
    return append_before(xml, "</Relationships>", additions, "presentation relationships")


def update_content_types(xml: str) -> str:
    additions = (
        f'<Override PartName="/ppt/slides/slide3.xml" ContentType="{SLIDE_CONTENT_TYPE}"/>'
        f'<Override PartName="/ppt/slides/slide4.xml" ContentType="{SLIDE_CONTENT_TYPE}"/>'
    )
    return append_before(xml, "</Types>", additions, "content types")


def update_app_properties(xml: str) -> str:
    require_once(xml, "<Slides>2</Slides>", "app slide count")
    xml = xml.replace("<Slides>2</Slides>", "<Slides>4</Slides>")
    require_once(
        xml,
        '<vt:variant><vt:lpstr>投影片標題</vt:lpstr></vt:variant>'
        '<vt:variant><vt:i4>2</vt:i4></vt:variant>',
        "app title heading count",
    )
    xml = xml.replace(
        '<vt:variant><vt:lpstr>投影片標題</vt:lpstr></vt:variant>'
        '<vt:variant><vt:i4>2</vt:i4></vt:variant>',
        '<vt:variant><vt:lpstr>投影片標題</vt:lpstr></vt:variant>'
        '<vt:variant><vt:i4>4</vt:i4></vt:variant>',
    )
    require_once(xml, '<vt:vector size="6" baseType="lpstr">', "app title vector size")
    xml = xml.replace(
        '<vt:vector size="6" baseType="lpstr">',
        '<vt:vector size="8" baseType="lpstr">',
    )
    title_additions = (
        '<vt:lpstr>Lab A｜同一份任務，快做還是慢做？</vt:lpstr>'
        '<vt:lpstr>Evidence clinic｜Prediction is not saving</vt:lpstr>'
    )
    return append_before(
        xml,
        "</vt:vector></TitlesOfParts>",
        title_additions,
        "app title vector",
    )


def slide_relationship_xml() -> bytes:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'<Relationship Id="rId1" Type="{LAYOUT_RELATIONSHIP_TYPE}" '
        'Target="../slideLayouts/slideLayout2.xml"/>'
        '</Relationships>'
    ).encode("utf-8")


def validate_source_slide(xml: bytes, label: str) -> None:
    text = xml.decode("utf-8")
    if not text.startswith("<?xml") or "<p:sld " not in text:
        raise RuntimeError(f"{label}: malformed slide XML")
    relationship_refs = re.findall(r'\br:(?:id|embed|link)="([^"]+)"', text)
    if relationship_refs:
        raise RuntimeError(
            f"{label}: relationship-bearing content is not allowed: {relationship_refs}"
        )


def strip_authoring_placeholders(xml: bytes, label: str) -> bytes:
    text = xml.decode("utf-8")
    placeholder_types: list[str] = []

    def rewrite_shape(match: re.Match[str]) -> str:
        block = match.group(0)
        placeholder = re.search(r"<p:ph\b[\s\S]*?/>", block)
        if placeholder is None:
            return block
        type_match = re.search(r'\btype="([^"]+)"', placeholder.group(0))
        placeholder_type = type_match.group(1) if type_match else "body"
        placeholder_types.append(placeholder_type)
        if placeholder_type in {"title", "body"}:
            return ""
        if placeholder_type == "sldNum":
            return block.replace(placeholder.group(0), "")
        raise RuntimeError(f"{label}: unsupported placeholder type {placeholder_type}")

    cleaned = re.sub(r"<p:sp>[\s\S]*?</p:sp>", rewrite_shape, text)
    if sorted(placeholder_types) != ["body", "sldNum", "title"]:
        raise RuntimeError(
            f"{label}: expected title/body/sldNum placeholders, got {placeholder_types}"
        )
    if "<p:ph" in cleaned:
        raise RuntimeError(f"{label}: placeholder XML remains after cleanup")
    return cleaned.encode("utf-8")


def update_slide_number_cache(xml: bytes, target_number: int, label: str) -> bytes:
    text = xml.decode("utf-8")
    pattern = re.compile(
        r'(<a:fld\b[^>]*\btype="slidenum"[^>]*>[\s\S]*?<a:t>)([^<]*)(</a:t>[\s\S]*?</a:fld>)'
    )
    updated, count = pattern.subn(
        lambda match: f"{match.group(1)}{target_number}{match.group(3)}",
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one slide-number field, found {count}")
    page_number_style = (
        '<a:defRPr sz="1400"><a:solidFill><a:srgbClr val="35377F"/>'
    )
    if updated.count(page_number_style) != 1:
        raise RuntimeError(f"{label}: unexpected slide-number font style")
    updated = updated.replace(
        page_number_style,
        '<a:defRPr sz="1600"><a:solidFill><a:srgbClr val="35377F"/>',
    )
    return updated.encode("utf-8")


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(args.donor, "r") as donor_zip, ZipFile(args.extension, "r") as source_zip:
        donor_names = donor_zip.namelist()
        required = {
            "[Content_Types].xml",
            "ppt/presentation.xml",
            "ppt/_rels/presentation.xml.rels",
            "ppt/slideLayouts/slideLayout2.xml",
            "ppt/slides/slide1.xml",
            "ppt/slides/slide2.xml",
            "docProps/app.xml",
        }
        missing = sorted(required - set(donor_names))
        if missing:
            raise RuntimeError(f"donor is missing required parts: {missing}")
        if "ppt/slides/slide3.xml" in donor_names or "ppt/slides/slide4.xml" in donor_names:
            raise RuntimeError("donor unexpectedly already contains slide 3 or 4")

        source_slides = {
            "ppt/slides/slide3.xml": strip_authoring_placeholders(
                update_slide_number_cache(
                    source_zip.read("ppt/slides/slide1.xml"), 3, "slide 3"
                ),
                "slide 3",
            ),
            "ppt/slides/slide4.xml": strip_authoring_placeholders(
                update_slide_number_cache(
                    source_zip.read("ppt/slides/slide2.xml"), 4, "slide 4"
                ),
                "slide 4",
            ),
        }
        for name, data in source_slides.items():
            validate_source_slide(data, name)

        replacements = {
            "ppt/presentation.xml": update_presentation_xml(
                donor_zip.read("ppt/presentation.xml").decode("utf-8")
            ).encode("utf-8"),
            "ppt/_rels/presentation.xml.rels": update_presentation_relationships(
                donor_zip.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
            ).encode("utf-8"),
            "[Content_Types].xml": update_content_types(
                donor_zip.read("[Content_Types].xml").decode("utf-8")
            ).encode("utf-8"),
            "docProps/app.xml": update_app_properties(
                donor_zip.read("docProps/app.xml").decode("utf-8")
            ).encode("utf-8"),
        }

        slide_info = donor_zip.getinfo("ppt/slides/slide2.xml")
        rel_info = donor_zip.getinfo("ppt/slides/_rels/slide2.xml.rels")
        new_parts = {
            **source_slides,
            "ppt/slides/_rels/slide3.xml.rels": slide_relationship_xml(),
            "ppt/slides/_rels/slide4.xml.rels": slide_relationship_xml(),
        }

        with NamedTemporaryFile(
            prefix="c120-donor-extension-",
            suffix=".pptx",
            dir=args.output.parent,
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)

        try:
            with ZipFile(temporary_path, "w", allowZip64=True, strict_timestamps=False) as output_zip:
                for name in donor_names:
                    info = donor_zip.getinfo(name)
                    data = replacements.get(name, donor_zip.read(name))
                    output_zip.writestr(copy(info), data)

                output_zip.writestr(
                    new_zip_info("ppt/slides/slide3.xml", slide_info),
                    new_parts["ppt/slides/slide3.xml"],
                )
                output_zip.writestr(
                    new_zip_info("ppt/slides/slide4.xml", slide_info),
                    new_parts["ppt/slides/slide4.xml"],
                )
                output_zip.writestr(
                    new_zip_info("ppt/slides/_rels/slide3.xml.rels", rel_info),
                    new_parts["ppt/slides/_rels/slide3.xml.rels"],
                )
                output_zip.writestr(
                    new_zip_info("ppt/slides/_rels/slide4.xml.rels", rel_info),
                    new_parts["ppt/slides/_rels/slide4.xml.rels"],
                )

            temporary_path.replace(args.output)
        finally:
            if temporary_path.exists():
                temporary_path.unlink()


if __name__ == "__main__":
    main()
