#!/usr/bin/env python3
"""Merge the independent ALT review decks without flattening editable content.

All inputs share the exact educate template.  Slides, speaker notes, native
Office Math, and slide-level relationships are copied as OOXML parts.  Native
layout/master/theme parts remain the ones from Part A, and every appended slide
continues to target ``slideLayout2.xml``.
"""

from __future__ import annotations

import hashlib
import json
import posixpath
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
COURSEWARE = ROOT.parents[1]
PART_A = ROOT / "LoRaEnergySim-LEO-ALT-PART-A-REVIEW.pptx"
PART_B = ROOT / "LoRaEnergySim-LEO-ALT-PART-B-REVIEW.pptx"
PART_C = ROOT / "LoRaEnergySim-LEO-ALT-PART-C-REVIEW.pptx"
APPENDIX = ROOT / "LoRaEnergySim-LEO-ALT-APPENDIX-REVIEW.pptx"
OUTPUT = COURSEWARE / "LoRaEnergySim-LEO-ALT-REVIEW.pptx"
REPORT = ROOT / "shared" / "merge-report.json"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
SLIDE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"

REUSABLE_PREFIXES = (
    "ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/",
    "ppt/notesMasters/", "ppt/tableStyles.xml",
)

# Optional donor-tail priority.  The selected subset is sorted into its source
# order after the capacity limit is applied.
APPENDIX_PRIORITY = [19, 14, 13, 12, 15, 16, 17, 8, 1, 2, 3, 4, 5, 6, 9, 10, 11, 18, 7]
MAX_SLIDES = 116


def parse_xml(data: bytes) -> etree._Element:
    return etree.fromstring(data)


def serialize_xml(root: etree._Element) -> bytes:
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone="yes")


def rels_name(part_name: str) -> str:
    folder, base = posixpath.split(part_name)
    return posixpath.join(folder, "_rels", base + ".rels")


@dataclass
class ContentTypes:
    root: etree._Element

    @classmethod
    def from_bytes(cls, data: bytes) -> "ContentTypes":
        return cls(parse_xml(data))

    def overrides(self) -> dict[str, str]:
        return {
            node.get("PartName", "").lstrip("/"): node.get("ContentType", "")
            for node in self.root.findall(f"{{{CT_NS}}}Override")
        }

    def defaults(self) -> dict[str, str]:
        return {
            node.get("Extension", "").lower(): node.get("ContentType", "")
            for node in self.root.findall(f"{{{CT_NS}}}Default")
        }

    def ensure_from(self, source: "ContentTypes", source_part: str, target_part: str) -> None:
        source_override = source.overrides().get(source_part)
        current_overrides = self.overrides()
        if source_override:
            if target_part not in current_overrides:
                etree.SubElement(
                    self.root, f"{{{CT_NS}}}Override",
                    PartName="/" + target_part, ContentType=source_override,
                )
            return
        ext = target_part.rsplit(".", 1)[-1].lower() if "." in target_part else ""
        source_default = source.defaults().get(ext)
        if source_default and ext not in self.defaults():
            etree.SubElement(
                self.root, f"{{{CT_NS}}}Default",
                Extension=ext, ContentType=source_default,
            )


class Merger:
    def __init__(self, base: Path):
        with zipfile.ZipFile(base) as archive:
            self.files = {info.filename: archive.read(info.filename) for info in archive.infolist()}
        self.content_types = ContentTypes.from_bytes(self.files["[Content_Types].xml"])
        self.presentation = parse_xml(self.files["ppt/presentation.xml"])
        self.presentation_rels = parse_xml(self.files["ppt/_rels/presentation.xml.rels"])
        self.slide_list = self.presentation.find(f"{{{P_NS}}}sldIdLst")
        if self.slide_list is None:
            raise ValueError("base presentation has no slide list")
        self.next_slide_number = self._max_number("ppt/slides/slide", ".xml") + 1
        self.next_notes_number = self._max_number("ppt/notesSlides/notesSlide", ".xml") + 1
        self.next_slide_id = max(int(node.get("id")) for node in self.slide_list) + 1
        self.next_presentation_rid = self._max_rid(self.presentation_rels) + 1
        self.media_hashes = {
            hashlib.sha256(payload).hexdigest(): name
            for name, payload in self.files.items() if name.startswith("ppt/media/")
        }
        self.source_records: list[dict[str, object]] = []

    def _max_number(self, prefix: str, suffix: str) -> int:
        values = []
        pattern = re.compile(re.escape(prefix) + r"(\d+)" + re.escape(suffix) + r"$")
        for name in self.files:
            match = pattern.match(name)
            if match:
                values.append(int(match.group(1)))
        return max(values, default=0)

    @staticmethod
    def _max_rid(root: etree._Element) -> int:
        values = []
        for node in root.findall(f"{{{REL_NS}}}Relationship"):
            match = re.fullmatch(r"rId(\d+)", node.get("Id", ""))
            if match:
                values.append(int(match.group(1)))
        return max(values, default=0)

    def _allocate_generic(self, source_part: str) -> str:
        folder, base = posixpath.split(source_part)
        stem, ext = posixpath.splitext(base)
        stem_root = re.sub(r"\d+$", "", stem) or stem
        index = 1
        while True:
            candidate = posixpath.join(folder, f"{stem_root}{index}{ext}")
            if candidate not in self.files:
                return candidate
            index += 1

    def _allocate_dependency(self, source_zip: zipfile.ZipFile, source_part: str) -> str:
        if source_part.startswith("ppt/media/"):
            payload = source_zip.read(source_part)
            digest = hashlib.sha256(payload).hexdigest()
            if digest in self.media_hashes:
                return self.media_hashes[digest]
            target = self._allocate_generic(source_part)
            self.media_hashes[digest] = target
            return target
        if source_part.startswith("ppt/notesSlides/notesSlide"):
            target = f"ppt/notesSlides/notesSlide{self.next_notes_number}.xml"
            self.next_notes_number += 1
            return target
        return self._allocate_generic(source_part)

    def _copy_part(
        self,
        source_zip: zipfile.ZipFile,
        source_types: ContentTypes,
        source_part: str,
        target_part: str,
        mapping: dict[str, str],
        slide_mapping: dict[str, str],
    ) -> None:
        if target_part in self.files:
            mapping[source_part] = target_part
            return
        mapping[source_part] = target_part
        self.files[target_part] = source_zip.read(source_part)
        self.content_types.ensure_from(source_types, source_part, target_part)

        source_rels = rels_name(source_part)
        if source_rels not in source_zip.namelist():
            return
        rel_root = parse_xml(source_zip.read(source_rels))
        for rel in rel_root.findall(f"{{{REL_NS}}}Relationship"):
            if rel.get("TargetMode") == "External":
                continue
            raw_target = rel.get("Target", "")
            source_dep = posixpath.normpath(posixpath.join(posixpath.dirname(source_part), raw_target))
            if source_dep.startswith(REUSABLE_PREFIXES):
                target_dep = source_dep
            elif source_dep.startswith("ppt/slides/") and source_dep in slide_mapping:
                target_dep = slide_mapping[source_dep]
            else:
                target_dep = mapping.get(source_dep)
                if target_dep is None:
                    target_dep = self._allocate_dependency(source_zip, source_dep)
                    self._copy_part(
                        source_zip, source_types, source_dep, target_dep,
                        mapping, slide_mapping,
                    )
            rel.set("Target", posixpath.relpath(target_dep, posixpath.dirname(target_part)))
        self.files[rels_name(target_part)] = serialize_xml(rel_root)

    def append_deck(self, source_path: Path, *, label: str, indices: list[int] | None = None) -> int:
        with zipfile.ZipFile(source_path) as source_zip:
            source_types = ContentTypes.from_bytes(source_zip.read("[Content_Types].xml"))
            source_presentation = parse_xml(source_zip.read("ppt/presentation.xml"))
            source_rels = parse_xml(source_zip.read("ppt/_rels/presentation.xml.rels"))
            rid_to_target = {
                rel.get("Id"): posixpath.normpath(posixpath.join("ppt", rel.get("Target", "")))
                for rel in source_rels.findall(f"{{{REL_NS}}}Relationship")
                if rel.get("Type") == SLIDE_REL
            }
            source_sld_list = source_presentation.find(f"{{{P_NS}}}sldIdLst")
            if source_sld_list is None:
                raise ValueError(f"{source_path} has no slide list")
            ordered_parts = [rid_to_target[node.get(f"{{{R_NS}}}id")] for node in source_sld_list]
            selected = indices or list(range(1, len(ordered_parts) + 1))
            mapping: dict[str, str] = {}
            # Reserve every destination slide name before copying any OOXML
            # dependencies.  Notes and hyperlinks can point back to a slide;
            # without this complete map, a dependency may allocate the next
            # slide number and collide with the following top-level append.
            slide_mapping: dict[str, str] = {}
            for source_index in selected:
                source_part = ordered_parts[source_index - 1]
                slide_mapping[source_part] = f"ppt/slides/slide{self.next_slide_number}.xml"
                self.next_slide_number += 1
            appended = 0
            for source_index in selected:
                source_part = ordered_parts[source_index - 1]
                target_part = slide_mapping[source_part]
                self._copy_part(
                    source_zip, source_types, source_part, target_part,
                    mapping, slide_mapping,
                )

                rid = f"rId{self.next_presentation_rid}"
                self.next_presentation_rid += 1
                etree.SubElement(
                    self.presentation_rels, f"{{{REL_NS}}}Relationship",
                    Id=rid, Type=SLIDE_REL,
                    Target=posixpath.relpath(target_part, "ppt"),
                )
                node = etree.SubElement(self.slide_list, f"{{{P_NS}}}sldId")
                node.set("id", str(self.next_slide_id))
                node.set(f"{{{R_NS}}}id", rid)
                self.next_slide_id += 1
                appended += 1
                self.source_records.append({
                    "final_slide": len(self.slide_list),
                    "source_deck": label,
                    "source_slide": source_index,
                })
            return appended

    def slide_count(self) -> int:
        return len(self.slide_list)

    def finish(self, output: Path) -> None:
        self.files["ppt/presentation.xml"] = serialize_xml(self.presentation)
        self.files["ppt/_rels/presentation.xml.rels"] = serialize_xml(self.presentation_rels)
        self.files["[Content_Types].xml"] = serialize_xml(self.content_types.root)

        app_name = "docProps/app.xml"
        if app_name in self.files:
            app = parse_xml(self.files[app_name])
            slides = app.find("{http://schemas.openxmlformats.org/officeDocument/2006/extended-properties}Slides")
            if slides is not None:
                slides.text = str(self.slide_count())
                self.files[app_name] = serialize_xml(app)

        output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, payload in self.files.items():
                archive.writestr(name, payload)


def count_slides(path: Path) -> int:
    with zipfile.ZipFile(path) as archive:
        return sum(
            1 for name in archive.namelist()
            if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
        )


def validate_inputs() -> None:
    missing = [str(path) for path in (PART_A, PART_B, PART_C, APPENDIX) if not path.is_file()]
    if missing:
        raise FileNotFoundError("missing review deck(s): " + ", ".join(missing))


def main() -> None:
    validate_inputs()
    counts = {"part_a": count_slides(PART_A), "part_b": count_slides(PART_B),
              "part_c": count_slides(PART_C), "appendix_available": count_slides(APPENDIX)}
    base_total = counts["part_a"] + counts["part_b"] + counts["part_c"]
    capacity = max(0, MAX_SLIDES - base_total)
    chosen_appendix = sorted(APPENDIX_PRIORITY[:capacity])

    merger = Merger(PART_A)
    merger.source_records = [
        {"final_slide": index, "source_deck": "Part A", "source_slide": index}
        for index in range(1, counts["part_a"] + 1)
    ]
    merger.append_deck(PART_B, label="Part B")
    merger.append_deck(PART_C, label="Part C")
    if chosen_appendix:
        merger.append_deck(APPENDIX, label="Appendix", indices=chosen_appendix)
    merger.finish(OUTPUT)

    REPORT.write_text(json.dumps({
        "status": "INITIAL_MERGED_REVIEW",
        "output": str(OUTPUT),
        "input_counts": counts,
        "base_total": base_total,
        "appendix_selected_source_slides": chosen_appendix,
        "final_slide_count": merger.slide_count(),
        "maximum_slide_contract": MAX_SLIDES,
        "source_map": merger.source_records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
