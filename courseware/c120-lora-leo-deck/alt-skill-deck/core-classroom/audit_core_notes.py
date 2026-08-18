#!/usr/bin/env python3
"""Fail-closed QA gate for stable-key core speaker notes."""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import zipfile
from collections import Counter
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


def rels_name(part: str) -> str:
    folder, base = posixpath.split(part)
    return posixpath.join(folder, "_rels", base + ".rels")


def resolve(part: str, target: str) -> str:
    return posixpath.normpath(posixpath.join(posixpath.dirname(part), target))


def relationships(archive: zipfile.ZipFile, part: str) -> list[dict[str, str]]:
    path = rels_name(part)
    if path not in archive.namelist():
        return []
    root = ET.fromstring(archive.read(path))
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
    presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
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
    root = ET.fromstring(archive.read(slide_part))
    return [node.text or "" for node in root.findall(f".//{{{A_NS}}}t")]


def visible_signature(texts: list[str]) -> str:
    return hashlib.sha256("\x1f".join(texts).encode("utf-8")).hexdigest()


def note_text(archive: zipfile.ZipFile, part: str) -> str:
    root = ET.fromstring(archive.read(part))
    return "".join(node.text or "" for node in root.findall(f".//{{{A_NS}}}t"))


def strip_allowed_filename(note: str) -> str:
    return note.replace("student_policy.py", "")


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Core speaker-notes audit",
        "",
        f"- Status: {report['status']}",
        f"- Core: {report['deck']}",
        f"- Source: {report['source']}",
        f"- Ordered slides: {report['slides']}",
        f"- Referenced notes: {report['notes_referenced']}",
        f"- Notes XML parts: {report['notes_parts']}",
        f"- Matched notes: {report['matched']}",
        f"- Minimum meaningful note characters: {MIN_NOTE_CHARS}",
        "",
    ]
    for title, key in (
        ("Unmatched slides", "unmatched_slides"),
        ("Unused source keys", "unused_source_keys"),
        ("Ambiguous semantic keys", "ambiguous_semantic_keys"),
        ("Short notes", "short_notes"),
        ("Embedded note mismatches", "embedded_note_mismatches"),
        ("Forbidden-language hits", "forbidden_language_hits"),
        ("Source errors", "source_errors"),
    ):
        values = report.get(key, [])
        if values:
            lines.extend([f"## {title}", ""])
            lines.extend(f"- {value}" for value in values)
            lines.append("")
    return "\n".join(lines)


def audit(deck: Path, source_path: Path) -> dict[str, Any]:
    report: dict[str, Any] = {
        "status": "FAIL",
        "deck": str(deck),
        "source": str(source_path),
        "slides": 0,
        "notes_referenced": 0,
        "notes_parts": 0,
        "matched": 0,
        "presentation_order": [],
        "unmatched_slides": [],
        "unused_source_keys": [],
        "ambiguous_semantic_keys": [],
        "short_notes": [],
        "embedded_note_mismatches": [],
        "forbidden_language_hits": [],
        "source_errors": [],
        "errors": [],
    }
    try:
        source = json.loads(source_path.read_text(encoding="utf-8"))
    except Exception as exc:
        report["source_errors"].append(f"{type(exc).__name__}: {exc}")
        report["errors"].append("notes source cannot be read")
        return report
    entries = source.get("entries")
    if not isinstance(entries, list) or not entries:
        report["source_errors"].append("entries must be a non-empty list")
        report["errors"].append("notes source has no entries")
        return report

    key_counts = Counter(
        entry.get("semantic_key")
        for entry in entries
        if isinstance(entry, dict) and entry.get("semantic_key")
    )
    signature_counts = Counter(
        entry.get("visible_text_signature_sha256")
        for entry in entries
        if isinstance(entry, dict) and entry.get("visible_text_signature_sha256")
    )
    for key, count in sorted(key_counts.items()):
        if count > 1:
            report["ambiguous_semantic_keys"].append(
                f"source key {key!r} appears {count} times"
            )
    for signature, count in sorted(signature_counts.items()):
        if count > 1:
            report["ambiguous_semantic_keys"].append(
                f"source visible signature {signature!r} appears {count} times"
            )
    source_by_signature = {
        entry.get("visible_text_signature_sha256"): entry
        for entry in entries
        if isinstance(entry, dict)
        and isinstance(entry.get("visible_text_signature_sha256"), str)
        and signature_counts[entry.get("visible_text_signature_sha256")] == 1
    }
    source_keys = {
        entry.get("semantic_key")
        for entry in entries
        if isinstance(entry, dict) and entry.get("semantic_key")
    }
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            report["source_errors"].append(f"entry {index} is not an object")
            continue
        for field in (
            "semantic_key",
            "visible_title",
            "visible_text_signature_sha256",
            "note",
        ):
            if field not in entry:
                report["source_errors"].append(f"entry {index} missing {field}")
        note = entry.get("note")
        if not isinstance(note, str):
            continue
        meaningful = len("".join(note.split()))
        if meaningful < MIN_NOTE_CHARS:
            report["short_notes"].append(
                f"{entry.get('semantic_key', index)!r}: {meaningful} < {MIN_NOTE_CHARS}"
            )
        scan_text = strip_allowed_filename(note).lower()
        for term in FORBIDDEN_TERMS:
            if term.lower() in scan_text:
                report["forbidden_language_hits"].append(
                    f"{entry.get('semantic_key', index)!r}: {term!r}"
                )

    try:
        with zipfile.ZipFile(deck, "r") as archive:
            names = set(archive.namelist())
            note_parts = {
                name
                for name in names
                if name.startswith("ppt/notesSlides/notesSlide")
                and name.endswith(".xml")
            }
            report["notes_parts"] = len(note_parts)
            slides = ordered_slides(archive)
            report["slides"] = len(slides)
            seen_keys: set[str] = set()
            referenced_notes: set[str] = set()
            for index, slide_part in enumerate(slides, start=1):
                texts = visible_texts(archive, slide_part)
                title = texts[0] if texts else ""
                signature = visible_signature(texts)
                entry = source_by_signature.get(signature)
                if entry is None:
                    report["unmatched_slides"].append(
                        f"slide {index} {slide_part!r}: title={title!r}, "
                        f"signature={signature}"
                    )
                else:
                    key = entry.get("semantic_key")
                    if entry.get("visible_title") != title:
                        report["unmatched_slides"].append(
                            f"slide {index} {slide_part!r}: title mismatch for {key!r}"
                        )
                    if key in seen_keys:
                        report["ambiguous_semantic_keys"].append(
                            f"current slide {index} reuses semantic key {key!r}"
                        )
                    seen_keys.add(key)
                    report["presentation_order"].append(
                        {
                            "presentation_index": index,
                            "semantic_key": key,
                            "visible_title": title,
                            "slide_part": slide_part,
                        }
                    )
                    report["matched"] += 1
                targets = [
                    item["resolved"]
                    for item in relationships(archive, slide_part)
                    if item["type"] == NOTES_REL
                ]
                if len(targets) != 1 or targets[0] not in names:
                    report["unmatched_slides"].append(
                        f"slide {index} {slide_part!r}: visible slide without valid notes"
                    )
                    continue
                target = targets[0]
                referenced_notes.add(target)
                report["notes_referenced"] += 1
                text = note_text(archive, target)
                if entry is not None and text != entry.get("note"):
                    report["embedded_note_mismatches"].append(
                        f"slide {index} {target!r}: embedded text differs from "
                        f"authoritative source key {entry.get('semantic_key')!r}"
                    )
                meaningful = len("".join(text.split()))
                if meaningful < MIN_NOTE_CHARS:
                    report["short_notes"].append(
                        f"slide {index} {target!r}: {meaningful} < {MIN_NOTE_CHARS}"
                    )
                scan_text = strip_allowed_filename(text).lower()
                for term in FORBIDDEN_TERMS:
                    if term.lower() in scan_text:
                        report["forbidden_language_hits"].append(
                            f"slide {index} {target!r}: {term!r}"
                        )
            if note_parts != referenced_notes:
                orphaned = sorted(note_parts - referenced_notes)
                missing_parts = sorted(referenced_notes - note_parts)
                if orphaned:
                    report["errors"].append(
                        "orphan notes XML parts: " + ", ".join(orphaned)
                    )
                if missing_parts:
                    report["errors"].append(
                        "referenced notes parts missing from package: "
                        + ", ".join(missing_parts)
                    )
    except Exception as exc:
        report["errors"].append(f"{type(exc).__name__}: {exc}")
        return report

    report["unused_source_keys"] = sorted(source_keys - {
        item["semantic_key"] for item in report["presentation_order"]
    })
    if report["slides"] != len(entries):
        report["errors"].append(
            f"source entries ({len(entries)}) do not equal ordered slides ({report['slides']})"
        )
    if report["notes_referenced"] != report["slides"]:
        report["errors"].append(
            f"referenced notes ({report['notes_referenced']}) do not equal slides ({report['slides']})"
        )
    if report["notes_parts"] != report["slides"]:
        report["errors"].append(
            f"notes XML parts ({report['notes_parts']}) do not equal slides ({report['slides']})"
        )
    if report["unmatched_slides"]:
        report["errors"].append("one or more visible slides have no matching source note")
    if report["unused_source_keys"]:
        report["errors"].append("one or more source notes have no current visible slide")
    if report["ambiguous_semantic_keys"]:
        report["errors"].append("semantic key or visible signature is ambiguous")
    if report["short_notes"]:
        report["errors"].append("one or more notes are below the meaningful-length threshold")
    if report["embedded_note_mismatches"]:
        report["errors"].append(
            "one or more embedded notes differ from the authoritative source"
        )
    if report["forbidden_language_hits"]:
        report["errors"].append("forbidden language appears in source or embedded notes")
    if report["source_errors"]:
        report["errors"].append("notes source schema is invalid")
    report["errors"] = sorted(set(report["errors"]))
    report["status"] = "PASS" if not report["errors"] else "FAIL"
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pptx", type=Path, default=DEFAULT_DECK)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_QA_DIR)
    args = parser.parse_args()
    report = audit(args.pptx.resolve(), args.source.resolve())
    args.report_dir.resolve().mkdir(parents=True, exist_ok=True)
    (args.report_dir.resolve() / "core-speaker-notes-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.report_dir.resolve() / "core-speaker-notes-audit.md").write_text(
        markdown_report(report), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
