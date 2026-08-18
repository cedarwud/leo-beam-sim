#!/usr/bin/env python3
"""Publish matching Core decks with and without speaker-note bodies.

The source PPTX is copied byte-for-byte for the WITH-NOTES variant.  The
NO-NOTES variant changes only the body placeholder in each notes-slide XML;
all visible slide, layout, master, theme, media, and presentation parts remain
byte-identical to the WITH-NOTES deck.
"""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"

ET.register_namespace("a", A_NS)
ET.register_namespace("p", P_NS)


def clear_notes_body(data: bytes) -> tuple[bytes, bool]:
    root = ET.fromstring(data)
    for shape in root.findall(f".//{{{P_NS}}}sp"):
        placeholder = shape.find(f".//{{{P_NS}}}ph")
        if placeholder is None or placeholder.get("type") != "body":
            continue
        text_body = shape.find(f"{{{P_NS}}}txBody")
        if text_body is None:
            raise ValueError("notes body placeholder has no text body")
        for child in list(text_body):
            if child.tag == f"{{{A_NS}}}p":
                text_body.remove(child)
        ET.SubElement(text_body, f"{{{A_NS}}}p")
        return ET.tostring(root, encoding="utf-8", xml_declaration=True), True
    raise ValueError("notes slide has no body placeholder")


def publish(source: Path, with_notes: Path, no_notes: Path) -> dict[str, object]:
    if not source.is_file():
        raise FileNotFoundError(source)
    with_notes.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, with_notes)

    with zipfile.ZipFile(with_notes) as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}

    note_parts = sorted(
        name
        for name in entries
        if name.startswith("ppt/notesSlides/notesSlide") and name.endswith(".xml")
    )
    cleared = 0
    for part in note_parts:
        entries[part], changed = clear_notes_body(entries[part])
        cleared += int(changed)

    with tempfile.NamedTemporaryFile(
        dir=no_notes.parent,
        prefix=f".{no_notes.stem}.",
        suffix=".pptx",
        delete=False,
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(
            temporary_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=6,
        ) as archive:
            for name, data in entries.items():
                archive.writestr(name, data)
        temporary_path.replace(no_notes)
    finally:
        temporary_path.unlink(missing_ok=True)

    return {
        "source": str(source),
        "with_notes": str(with_notes),
        "no_notes": str(no_notes),
        "notes_parts": len(note_parts),
        "notes_bodies_cleared": cleared,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--with-notes", type=Path, required=True)
    parser.add_argument("--no-notes", type=Path, required=True)
    args = parser.parse_args()
    report = publish(
        args.source.resolve(),
        args.with_notes.resolve(),
        args.no_notes.resolve(),
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
