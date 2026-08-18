#!/usr/bin/env python3
"""Apply authoritative speaker notes without touching visible PPTX parts.

The source is matched by semantic key metadata plus the current visible title
and complete visible-text signature. The package is rebuilt in a temporary
same-directory copy, only notes-slide XML is replaced, and the result is
atomically installed at the existing core filename.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import stat
import tempfile
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
SLIDE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
NOTES_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"

CORE_DIR = Path(__file__).resolve().parent
CORE_FILENAME = "LoRaEnergySim-LEO-ALT-CORE-CLASSROOM-REVIEW.pptx"
DEFAULT_DECK = CORE_DIR.parent / "latest" / CORE_FILENAME
DEFAULT_SOURCE = CORE_DIR / "notes" / "core-speaker-notes.json"
DEFAULT_QA_DIR = CORE_DIR.parent / "local-qa" / "core-speaker-notes"
MIN_NOTE_CHARS = 140
FORBIDDEN_TERMS = (
    "學生",
    "老師",
    "講師",
    "你",
    "分鐘",
    "SHA",
    "sha256",
    "checksum",
    "ZIP test",
    "製作備註",
    "production notes",
    "口語標語",
    "截圖",
    "screenshot",
    "為什麼仍然選",
    "簡化了什麼",
)
PRESERVED_PREFIXES = (
    "ppt/slides/",
    "ppt/slideLayouts/",
    "ppt/slideMasters/",
    "ppt/media/",
    "ppt/theme/",
)
PRESERVED_EXACT = (
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
)

ET.register_namespace("a", A_NS)
ET.register_namespace("p", P_NS)
ET.register_namespace("r", R_NS)


def rels_name(part: str) -> str:
    folder, base = posixpath.split(part)
    return posixpath.join(folder, "_rels", base + ".rels")


def resolve(part: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(part), target))


def parse_xml(data: bytes) -> ET.Element:
    return ET.fromstring(data)


def relationships(archive: zipfile.ZipFile, part: str) -> list[dict[str, str]]:
    path = rels_name(part)
    if path not in archive.namelist():
        return []
    root = parse_xml(archive.read(path))
    return [
        {
            "id": item.get("Id", ""),
            "type": item.get("Type", ""),
            "target": item.get("Target", ""),
            "resolved": resolve(part, item.get("Target", "")),
        }
        for item in root.findall(f"{{{REL_NS}}}Relationship")
    ]


def ordered_slides(archive: zipfile.ZipFile) -> list[str]:
    presentation = parse_xml(archive.read("ppt/presentation.xml"))
    rels = {
        item["id"]: item["resolved"]
        for item in relationships(archive, "ppt/presentation.xml")
        if item["type"] == SLIDE_REL
    }
    slide_list = presentation.find(f"{{{P_NS}}}sldIdLst")
    if slide_list is None:
        return []
    return [rels[node.get(f"{{{R_NS}}}id", "")] for node in slide_list]


def visible_texts(archive: zipfile.ZipFile, slide_part: str) -> list[str]:
    root = parse_xml(archive.read(slide_part))
    return [node.text or "" for node in root.findall(f".//{{{A_NS}}}t")]


def visible_signature(texts: list[str]) -> str:
    return hashlib.sha256("\x1f".join(texts).encode("utf-8")).hexdigest()


def note_targets(archive: zipfile.ZipFile, slide_part: str) -> list[str]:
    return [
        item["resolved"]
        for item in relationships(archive, slide_part)
        if item["type"] == NOTES_REL
    ]


def note_text(data: bytes) -> str:
    root = parse_xml(data)
    return "".join(node.text or "" for node in root.findall(f".//{{{A_NS}}}t"))


def note_forbidden_text(note: str) -> str:
    # The filename is explicitly allowed by the contract.
    return note.replace("student_policy.py", "")


def validate_source(source: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    errors: list[str] = []
    entries = source.get("entries")
    if not isinstance(entries, list) or not entries:
        return [], ["notes source entries must be a non-empty list"]
    seen_keys: set[str] = set()
    seen_signatures: set[str] = set()
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            errors.append(f"source entry {index} is not an object")
            continue
        required = {
            "semantic_key",
            "visible_title",
            "visible_text_signature_sha256",
            "note",
        }
        missing = sorted(required - entry.keys())
        if missing:
            errors.append(f"source entry {index} missing {missing}")
            continue
        key = entry["semantic_key"]
        signature = entry["visible_text_signature_sha256"]
        if not isinstance(key, str) or not key.strip():
            errors.append(f"source entry {index} has an invalid semantic key")
        elif key in seen_keys:
            errors.append(f"duplicate semantic key {key!r}")
        else:
            seen_keys.add(key)
        if not isinstance(signature, str) or len(signature) != 64:
            errors.append(f"source entry {index} has an invalid visible signature")
        elif signature in seen_signatures:
            errors.append(f"duplicate visible signature {signature!r}")
        else:
            seen_signatures.add(signature)
        note = entry["note"]
        if not isinstance(note, str):
            errors.append(f"source entry {index} note is not text")
            continue
        meaningful = len("".join(note.split()))
        if meaningful < MIN_NOTE_CHARS:
            errors.append(
                f"source entry {key!r} note is below {MIN_NOTE_CHARS} meaningful characters "
                f"({meaningful})"
            )
        lowered = note_forbidden_text(note).lower()
        for term in FORBIDDEN_TERMS:
            if term.lower() in lowered:
                errors.append(f"source entry {key!r} contains forbidden term {term!r}")
    return entries, errors


def replace_note_text(original: bytes, replacement: str) -> bytes:
    root = parse_xml(original)
    body_shape = None
    for shape in root.findall(f".//{{{P_NS}}}sp"):
        placeholder = shape.find(f".//{{{P_NS}}}ph")
        if placeholder is not None and placeholder.get("type") == "body":
            body_shape = shape
            break
    if body_shape is None:
        raise ValueError("notes slide has no body placeholder")
    tx_body = body_shape.find(f"{{{P_NS}}}txBody")
    if tx_body is None:
        raise ValueError("notes body placeholder has no text body")
    for child in list(tx_body):
        if child.tag == f"{{{A_NS}}}p":
            tx_body.remove(child)
    paragraph = ET.SubElement(tx_body, f"{{{A_NS}}}p")
    run = ET.SubElement(paragraph, f"{{{A_NS}}}r")
    text = ET.SubElement(run, f"{{{A_NS}}}t")
    text.text = replacement
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def preserved_names(names: set[str]) -> list[str]:
    return sorted(
        name
        for name in names
        if name in PRESERVED_EXACT or name.startswith(PRESERVED_PREFIXES)
    )


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Core speaker-notes apply report",
        "",
        f"- Status: {report['status']}",
        f"- Core: {report['deck']}",
        f"- Source entries: {report['source_entries']}",
        f"- Ordered slides matched: {report['slides_matched']}",
        f"- Notes XML parts replaced: {report['notes_replaced']}",
        f"- Preserved visible/package groups: {report['preserved_groups']}",
        f"- Byte-preservation: {report['byte_preservation']['status']}",
        "",
    ]
    if report.get("errors"):
        lines.extend(["## Errors", ""])
        lines.extend(f"- {error}" for error in report["errors"])
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pptx", type=Path, default=DEFAULT_DECK)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_QA_DIR)
    args = parser.parse_args()

    deck = args.pptx.resolve()
    source_path = args.source.resolve()
    report_dir = args.report_dir.resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {
        "status": "FAIL",
        "deck": str(deck),
        "source": str(source_path),
        "source_entries": 0,
        "slides_matched": 0,
        "notes_replaced": 0,
        "preserved_groups": list(PRESERVED_PREFIXES) + list(PRESERVED_EXACT),
        "byte_preservation": {"status": "NOT_RUN"},
        "errors": [],
    }
    temporary: Path | None = None
    try:
        source = json.loads(source_path.read_text(encoding="utf-8"))
        entries, source_errors = validate_source(source)
        report["source_entries"] = len(entries)
        report["errors"].extend(source_errors)
        if report["errors"]:
            raise ValueError("notes source validation failed")
        by_signature = {
            entry["visible_text_signature_sha256"]: entry for entry in entries
        }
        with zipfile.ZipFile(deck, "r") as original:
            names = set(original.namelist())
            slides = ordered_slides(original)
            if not slides:
                raise ValueError("presentation has no ordered slides")
            replacements: dict[str, bytes] = {}
            matched_keys: set[str] = set()
            slide_matches: list[dict[str, Any]] = []
            for index, slide_part in enumerate(slides, start=1):
                texts = visible_texts(original, slide_part)
                title = texts[0] if texts else ""
                signature = visible_signature(texts)
                entry = by_signature.get(signature)
                if entry is None:
                    report["errors"].append(
                        f"slide {index} {slide_part!r} has no matching semantic note "
                        f"for visible title {title!r}"
                    )
                    continue
                if entry["visible_title"] != title:
                    report["errors"].append(
                        f"slide {index} title mismatch for {entry['semantic_key']!r}: "
                        f"source {entry['visible_title']!r}, deck {title!r}"
                    )
                if entry["semantic_key"] in matched_keys:
                    report["errors"].append(
                        f"semantic key {entry['semantic_key']!r} matches more than one slide"
                    )
                    continue
                matched_keys.add(entry["semantic_key"])
                targets = note_targets(original, slide_part)
                if len(targets) != 1 or targets[0] not in names:
                    report["errors"].append(
                        f"slide {index} {slide_part!r} has no single valid notes relationship"
                    )
                    continue
                target = targets[0]
                replacements[target] = replace_note_text(
                    original.read(target), entry["note"]
                )
                slide_matches.append(
                    {
                        "presentation_index": index,
                        "slide_part": slide_part,
                        "notes_part": target,
                        "semantic_key": entry["semantic_key"],
                        "visible_title": title,
                        "visible_text_signature_sha256": signature,
                    }
                )
            unused = sorted(
                entry["semantic_key"]
                for entry in entries
                if entry["semantic_key"] not in matched_keys
            )
            if unused:
                report["errors"].append(
                    "unused source semantic keys after ordered-slide matching: "
                    + ", ".join(unused)
                )
            report["slides_matched"] = len(slide_matches)
            report["notes_replaced"] = len(replacements)
            if report["errors"]:
                raise ValueError("slide/source matching failed")

            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{deck.name}.", suffix=".tmp", dir=str(deck.parent)
            )
            os.close(descriptor)
            temporary = Path(temporary_name)
            with zipfile.ZipFile(temporary, "w") as output:
                for info in original.infolist():
                    payload = replacements.get(info.filename, original.read(info.filename))
                    output.writestr(info, payload)
            os.chmod(temporary, stat.S_IMODE(deck.stat().st_mode))

        with zipfile.ZipFile(deck, "r") as before, zipfile.ZipFile(temporary, "r") as after:
            before_names = set(before.namelist())
            after_names = set(after.namelist())
            if before_names != after_names:
                report["errors"].append("temporary package entry names differ")
            changed = sorted(
                name
                for name in before_names & after_names
                if before.read(name) != after.read(name)
            )
            unexpected = [
                name
                for name in changed
                if not (
                    name.startswith("ppt/notesSlides/notesSlide")
                    and name.endswith(".xml")
                )
            ]
            if unexpected:
                report["errors"].append(
                    "non-notes XML changed in temporary package: " + ", ".join(unexpected)
                )
            if sorted(
                name for name in changed if name.startswith("ppt/notesSlides/notesSlide")
            ) != sorted(replacements):
                report["errors"].append(
                    "changed notes parts do not equal the matched note parts"
                )
            preserved: dict[str, dict[str, str]] = {}
            for name in preserved_names(before_names):
                if name not in after_names:
                    report["errors"].append(f"preserved part missing after rebuild: {name}")
                    continue
                before_hash = sha256_bytes(before.read(name))
                after_hash = sha256_bytes(after.read(name))
                preserved[name] = {"before": before_hash, "after": after_hash}
                if before_hash != after_hash:
                    report["errors"].append(f"preserved part changed: {name}")
            report["byte_preservation"] = {
                "status": "PASS" if not report["errors"] else "FAIL",
                "checked_parts": len(preserved),
                "hashes": preserved,
                "changed_parts": changed,
            }
        if report["errors"]:
            raise ValueError("temporary package preservation failed")
        os.replace(temporary, deck)
        temporary = None
        report["status"] = "PASS"
        report["atomic_replace"] = True
        report["matches"] = slide_matches
    except Exception as exc:
        if not report["errors"]:
            report["errors"].append(f"{type(exc).__name__}: {exc}")
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

    (report_dir / "core-notes-apply-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (report_dir / "core-notes-apply-report.md").write_text(
        markdown_report(report), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
