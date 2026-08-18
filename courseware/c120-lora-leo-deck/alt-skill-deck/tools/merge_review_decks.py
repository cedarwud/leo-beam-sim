#!/usr/bin/env python3
"""Merge same-template classroom decks while preserving notes and slide media.

This merger intentionally supports the narrow relationship surface used by the
C-120 deck chunks: slide layout, notes slide, and raster image relationships.
It fails closed if a source slide contains any other relationship type.
"""

from __future__ import annotations

import argparse
import posixpath
import re
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"

REL_SLIDE = f"{R_NS}/slide"
REL_LAYOUT = f"{R_NS}/slideLayout"
REL_NOTES = f"{R_NS}/notesSlide"
REL_NOTES_MASTER = f"{R_NS}/notesMaster"
REL_IMAGE = f"{R_NS}/image"
SUPPORTED_SLIDE_RELS = {REL_LAYOUT, REL_NOTES, REL_IMAGE}
SUPPORTED_NOTES_RELS = {REL_SLIDE, REL_NOTES_MASTER}

ET.register_namespace("a", "http://schemas.openxmlformats.org/drawingml/2006/main")
ET.register_namespace("p", P_NS)
ET.register_namespace("r", R_NS)
ET.register_namespace("p15", "http://schemas.microsoft.com/office/powerpoint/2012/main")


def xml(data: bytes) -> ET.Element:
    return ET.fromstring(data)


def xml_bytes(root: ET.Element) -> bytes:
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def xml_bytes_with_default(root: ET.Element, namespace: str) -> bytes:
    """Serialize package metadata with the default namespace used by Office."""
    ET.register_namespace("", namespace)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def relationships_path(part_name: str) -> str:
    directory, filename = posixpath.split(part_name)
    return posixpath.join(directory, "_rels", f"{filename}.rels")


def resolve_target(owner_part: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(owner_part), target))


def relative_target(owner_part: str, target_part: str) -> str:
    return posixpath.relpath(target_part, posixpath.dirname(owner_part))


def numeric_suffix(value: str, prefix: str) -> int:
    match = re.fullmatch(re.escape(prefix) + r"(\d+)", value)
    return int(match.group(1)) if match else 0


def max_part_index(entries: dict[str, bytes], pattern: str) -> int:
    regex = re.compile(pattern)
    values = []
    for name in entries:
        match = regex.fullmatch(name)
        if match:
            values.append(int(match.group(1)))
    return max(values, default=0)


def presentation_slide_parts(entries: dict[str, bytes]) -> list[str]:
    presentation = xml(entries["ppt/presentation.xml"])
    rels = xml(entries["ppt/_rels/presentation.xml.rels"])
    targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(f"{{{PKG_REL_NS}}}Relationship")
    }
    ordered = []
    for slide_id in presentation.findall(f".//{{{P_NS}}}sldId"):
        rel_id = slide_id.attrib[f"{{{R_NS}}}id"]
        ordered.append(posixpath.normpath(posixpath.join("ppt", targets[rel_id])))
    return ordered


def content_type_maps(root: ET.Element) -> tuple[dict[str, str], dict[str, str]]:
    defaults = {
        item.attrib["Extension"].lower(): item.attrib["ContentType"]
        for item in root.findall(f"{{{CT_NS}}}Default")
    }
    overrides = {
        item.attrib["PartName"].lstrip("/"): item.attrib["ContentType"]
        for item in root.findall(f"{{{CT_NS}}}Override")
    }
    return defaults, overrides


def ensure_default(
    destination_root: ET.Element,
    destination_defaults: dict[str, str],
    source_defaults: dict[str, str],
    extension: str,
) -> None:
    extension = extension.lower()
    if extension in destination_defaults:
        return
    content_type = source_defaults.get(extension)
    if not content_type:
        raise ValueError(f"missing content type for .{extension}")
    ET.SubElement(
        destination_root,
        f"{{{CT_NS}}}Default",
        Extension=extension,
        ContentType=content_type,
    )
    destination_defaults[extension] = content_type


def ensure_override(
    destination_root: ET.Element,
    destination_overrides: dict[str, str],
    part_name: str,
    content_type: str,
) -> None:
    if part_name in destination_overrides:
        return
    ET.SubElement(
        destination_root,
        f"{{{CT_NS}}}Override",
        PartName=f"/{part_name}",
        ContentType=content_type,
    )
    destination_overrides[part_name] = content_type


def next_relationship_id(root: ET.Element) -> str:
    maximum = 0
    for rel in root.findall(f"{{{PKG_REL_NS}}}Relationship"):
        maximum = max(maximum, numeric_suffix(rel.attrib.get("Id", ""), "rId"))
    return f"rId{maximum + 1}"


def update_slide_count(entries: dict[str, bytes], count: int) -> None:
    part = "docProps/app.xml"
    if part not in entries:
        return
    root = xml(entries[part])
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] == "Slides":
            element.text = str(count)
            entries[part] = xml_bytes(root)
            return


def merge(inputs: list[Path], output: Path) -> int:
    if len(inputs) < 2:
        raise ValueError("at least two input decks are required")
    for source in inputs:
        if not source.is_file():
            raise FileNotFoundError(source)

    with zipfile.ZipFile(inputs[0]) as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}

    presentation = xml(entries["ppt/presentation.xml"])
    presentation_rels = xml(entries["ppt/_rels/presentation.xml.rels"])
    content_types = xml(entries["[Content_Types].xml"])
    destination_defaults, destination_overrides = content_type_maps(content_types)

    slide_list = presentation.find(f"{{{P_NS}}}sldIdLst")
    if slide_list is None:
        raise ValueError("base deck has no slide list")
    max_slide_id = max((int(item.attrib["id"]) for item in slide_list), default=255)
    next_slide_number = max_part_index(entries, r"ppt/slides/slide(\d+)\.xml") + 1
    next_notes_number = max_part_index(entries, r"ppt/notesSlides/notesSlide(\d+)\.xml") + 1
    media_serial = 1
    imported_slides = 0

    for deck_number, source_path in enumerate(inputs[1:], start=2):
        with zipfile.ZipFile(source_path) as archive:
            source_entries = {name: archive.read(name) for name in archive.namelist()}
        source_content_types = xml(source_entries["[Content_Types].xml"])
        source_defaults, source_overrides = content_type_maps(source_content_types)
        image_map: dict[str, str] = {}

        for source_slide in presentation_slide_parts(source_entries):
            destination_slide = f"ppt/slides/slide{next_slide_number}.xml"
            destination_slide_rels = relationships_path(destination_slide)
            source_slide_rels = relationships_path(source_slide)
            if source_slide_rels not in source_entries:
                raise ValueError(f"missing relationships for {source_slide}")

            entries[destination_slide] = source_entries[source_slide]
            source_rels_root = xml(source_entries[source_slide_rels])
            notes_source_part: str | None = None
            notes_destination_part: str | None = None

            for rel in source_rels_root.findall(f"{{{PKG_REL_NS}}}Relationship"):
                rel_type = rel.attrib["Type"]
                if rel_type not in SUPPORTED_SLIDE_RELS:
                    raise ValueError(
                        f"unsupported slide relationship {rel_type} in {source_path.name}"
                    )
                if rel_type == REL_LAYOUT:
                    rel.attrib["Target"] = "../slideLayouts/slideLayout2.xml"
                elif rel_type == REL_NOTES:
                    notes_source_part = resolve_target(source_slide, rel.attrib["Target"])
                    notes_destination_part = (
                        f"ppt/notesSlides/notesSlide{next_notes_number}.xml"
                    )
                    rel.attrib["Target"] = relative_target(
                        destination_slide, notes_destination_part
                    )
                elif rel_type == REL_IMAGE:
                    source_image = resolve_target(source_slide, rel.attrib["Target"])
                    if source_image not in source_entries:
                        raise ValueError(f"missing image part {source_image}")
                    if source_image not in image_map:
                        suffix = Path(source_image).suffix.lower()
                        destination_image = (
                            f"ppt/media/merged_d{deck_number}_{media_serial}{suffix}"
                        )
                        media_serial += 1
                        image_map[source_image] = destination_image
                        entries[destination_image] = source_entries[source_image]
                        ensure_default(
                            content_types,
                            destination_defaults,
                            source_defaults,
                            suffix.lstrip("."),
                        )
                    rel.attrib["Target"] = relative_target(
                        destination_slide, image_map[source_image]
                    )

            if notes_source_part is None or notes_destination_part is None:
                raise ValueError(f"{source_slide} has no notes slide")
            entries[destination_slide_rels] = xml_bytes_with_default(
                source_rels_root, PKG_REL_NS
            )

            source_notes_rels = relationships_path(notes_source_part)
            if notes_source_part not in source_entries or source_notes_rels not in source_entries:
                raise ValueError(f"missing notes package for {source_slide}")
            entries[notes_destination_part] = source_entries[notes_source_part]
            notes_rels_root = xml(source_entries[source_notes_rels])
            for rel in notes_rels_root.findall(f"{{{PKG_REL_NS}}}Relationship"):
                rel_type = rel.attrib["Type"]
                if rel_type not in SUPPORTED_NOTES_RELS:
                    raise ValueError(
                        f"unsupported notes relationship {rel_type} in {source_path.name}"
                    )
                if rel_type == REL_SLIDE:
                    rel.attrib["Target"] = relative_target(
                        notes_destination_part, destination_slide
                    )
                elif rel_type == REL_NOTES_MASTER:
                    rel.attrib["Target"] = "../notesMasters/notesMaster1.xml"
            entries[relationships_path(notes_destination_part)] = xml_bytes_with_default(
                notes_rels_root, PKG_REL_NS
            )

            slide_content_type = source_overrides.get(source_slide)
            notes_content_type = source_overrides.get(notes_source_part)
            if not slide_content_type or not notes_content_type:
                raise ValueError(f"missing slide/notes content type for {source_slide}")
            ensure_override(
                content_types,
                destination_overrides,
                destination_slide,
                slide_content_type,
            )
            ensure_override(
                content_types,
                destination_overrides,
                notes_destination_part,
                notes_content_type,
            )

            presentation_rel_id = next_relationship_id(presentation_rels)
            ET.SubElement(
                presentation_rels,
                f"{{{PKG_REL_NS}}}Relationship",
                Id=presentation_rel_id,
                Type=REL_SLIDE,
                Target=posixpath.relpath(destination_slide, "ppt"),
            )
            max_slide_id += 1
            ET.SubElement(
                slide_list,
                f"{{{P_NS}}}sldId",
                {"id": str(max_slide_id), f"{{{R_NS}}}id": presentation_rel_id},
            )

            next_slide_number += 1
            next_notes_number += 1
            imported_slides += 1

    entries["ppt/presentation.xml"] = xml_bytes(presentation)
    entries["ppt/_rels/presentation.xml.rels"] = xml_bytes_with_default(
        presentation_rels, PKG_REL_NS
    )
    entries["[Content_Types].xml"] = xml_bytes_with_default(content_types, CT_NS)
    total_slides = len(slide_list)

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        dir=output.parent, prefix=f".{output.stem}.", suffix=".pptx", delete=False
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(
            temporary_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6
        ) as archive:
            for name, data in entries.items():
                archive.writestr(name, data)
        temporary_path.replace(output)
    finally:
        temporary_path.unlink(missing_ok=True)

    return total_slides


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("inputs", nargs="+", type=Path)
    args = parser.parse_args()
    count = merge(args.inputs, args.output)
    print(f"merged_slides={count}")
    print(f"output={args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
