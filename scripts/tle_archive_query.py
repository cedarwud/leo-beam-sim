#!/usr/bin/env python3
"""Read-only catalog and per-object source-packet queries for the TLE archive.

The archive filename is a lookup key, not the selected object's epoch.  This
module always parses the epoch from that object's TLE line 1 and emits the raw
lines plus hashes so a downstream SGP4 producer can fail closed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Iterator


SCHEMA_VERSION = "tle-source-packet-v1"
ARCHIVE_CATALOG_VERSION = "tle-archive-catalog-v1"
CONSTELLATIONS = ("oneweb", "starlink")
ARCHIVE_NAME = re.compile(r"^(?P<constellation>[a-z0-9-]+)_(?P<date>\d{8})\.tle$")
ALPHA5_PREFIXES = "ABCDEFGHJKLMNPQRSTUVWXYZ"


class ArchiveQueryError(ValueError):
    """A fail-closed archive lookup or validation error."""


@dataclass(frozen=True)
class TleRecord:
    name: str
    line1: str
    line2: str


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def parse_catalog_token(token: str) -> int:
    normalized = token.strip().upper()
    if len(normalized) != 5:
        raise ArchiveQueryError(f"invalid TLE catalog token: {token!r}")
    if normalized.isdigit():
        return int(normalized)
    prefix = normalized[0]
    if prefix not in ALPHA5_PREFIXES or not normalized[1:].isdigit():
        raise ArchiveQueryError(f"invalid Alpha-5 catalog token: {token!r}")
    return (10 + ALPHA5_PREFIXES.index(prefix)) * 10_000 + int(normalized[1:])


def parse_epoch_utc(line1: str) -> str:
    if len(line1) < 32 or not line1.startswith("1 "):
        raise ArchiveQueryError("TLE line 1 is too short to contain an epoch")
    raw = line1[18:32].strip()
    if not re.fullmatch(r"\d{5}\.\d+", raw):
        raise ArchiveQueryError(f"invalid TLE epoch field: {raw!r}")

    year_2 = int(raw[:2])
    year = 2000 + year_2 if year_2 < 57 else 1900 + year_2
    day_value = Decimal(raw[2:])
    day_index = int(day_value)
    if day_index < 1 or day_index > 366:
        raise ArchiveQueryError(f"TLE epoch day is outside 1..366: {day_value}")
    fractional_day = day_value - Decimal(day_index)
    microseconds = int(
        (fractional_day * Decimal(86_400_000_000)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )
    epoch = datetime(year, 1, 1, tzinfo=UTC) + timedelta(
        days=day_index - 1, microseconds=microseconds
    )
    return epoch.isoformat(timespec="microseconds").replace("+00:00", "Z")


def checksum_is_valid(line: str) -> bool:
    if len(line) < 69 or not line[68].isdigit():
        return False
    checksum = sum(int(char) for char in line[:68] if char.isdigit())
    checksum += line[:68].count("-")
    return checksum % 10 == int(line[68])


def iter_tle_records(path: Path) -> Iterator[TleRecord]:
    lines = [line.rstrip("\r\n") for line in path.read_text(encoding="utf-8").splitlines()]
    lines = [line for line in lines if line.strip()]
    index = 0
    while index < len(lines):
        if lines[index].startswith("1 "):
            name = ""
            if index + 1 >= len(lines):
                raise ArchiveQueryError(f"truncated 2LE record in {path}")
            line1, line2 = lines[index], lines[index + 1]
            index += 2
        else:
            if index + 2 >= len(lines):
                raise ArchiveQueryError(f"truncated 3LE record in {path}")
            name, line1, line2 = lines[index].strip(), lines[index + 1], lines[index + 2]
            index += 3
        if not line1.startswith("1 ") or not line2.startswith("2 "):
            raise ArchiveQueryError(f"malformed TLE record near line {index} in {path}")
        yield TleRecord(name=name, line1=line1, line2=line2)


def archive_files(root: Path, constellation: str) -> list[tuple[str, Path]]:
    if constellation not in CONSTELLATIONS:
        raise ArchiveQueryError(f"unsupported constellation: {constellation}")
    directory = root / constellation / "tle"
    if not directory.is_dir():
        raise ArchiveQueryError(f"archive directory is missing: {directory}")
    result: list[tuple[str, Path]] = []
    for path in directory.glob(f"{constellation}_*.tle"):
        match = ARCHIVE_NAME.fullmatch(path.name)
        if match and match.group("constellation") == constellation:
            result.append((match.group("date"), path))
    result.sort(key=lambda item: item[0])
    if not result:
        raise ArchiveQueryError(f"no TLE snapshots found for {constellation}")
    return result


def resolve_archive_file(root: Path, constellation: str, requested_date: str) -> tuple[str, Path]:
    files = archive_files(root, constellation)
    if requested_date == "latest":
        return files[-1]
    if not re.fullmatch(r"\d{8}", requested_date):
        raise ArchiveQueryError("archive date must be YYYYMMDD or latest")
    for archive_date, path in files:
        if archive_date == requested_date:
            return archive_date, path
    raise ArchiveQueryError(f"no {constellation} snapshot for {requested_date}")


def build_catalog(root: Path, constellation: str | None = None) -> dict[str, object]:
    requested = (constellation,) if constellation else CONSTELLATIONS
    entries: list[dict[str, object]] = []
    for name in requested:
        files = archive_files(root, name)
        dates = [archive_date for archive_date, _ in files]
        entries.append(
            {
                "constellation": name,
                "snapshotCount": len(dates),
                "firstArchiveDate": dates[0],
                "lastArchiveDate": dates[-1],
                "availableDates": dates,
            }
        )
    return {"schemaVersion": ARCHIVE_CATALOG_VERSION, "constellations": entries}


def build_source_packet(
    root: Path,
    constellation: str,
    requested_date: str,
    norad_catalog_id: int,
) -> dict[str, object]:
    archive_date, path = resolve_archive_file(root, constellation, requested_date)
    selected: TleRecord | None = None
    for record in iter_tle_records(path):
        line1_id = parse_catalog_token(record.line1[2:7])
        line2_id = parse_catalog_token(record.line2[2:7])
        if line1_id != line2_id:
            raise ArchiveQueryError(f"catalog identity mismatch in {path}: {line1_id} != {line2_id}")
        if line1_id == norad_catalog_id:
            selected = record
            break
    if selected is None:
        raise ArchiveQueryError(
            f"NORAD {norad_catalog_id} is absent from {constellation}/{archive_date}"
        )
    if not checksum_is_valid(selected.line1) or not checksum_is_valid(selected.line2):
        raise ArchiveQueryError(
            f"NORAD {norad_catalog_id} has an invalid TLE checksum in {path}"
        )

    relative_path = path.relative_to(root).as_posix()
    raw_record = "\n".join((selected.name, selected.line1, selected.line2)) + "\n"
    record_hash = sha256_text(raw_record)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "sourceId": f"{constellation}-{norad_catalog_id}-{archive_date}-{record_hash[:12]}",
        "sourceKind": "archive-snapshot",
        "provenance": "SOURCE",
        "constellation": constellation,
        "requestedArchiveDate": requested_date,
        "archiveDate": archive_date,
        "archivePath": relative_path,
        "archiveSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "objectName": selected.name,
        "noradCatalogId": norad_catalog_id,
        "tleCatalogToken": selected.line1[2:7],
        "epochUtc": parse_epoch_utc(selected.line1),
        "checksumValid": True,
        "recordSha256": record_hash,
        "line0": selected.name,
        "line1": selected.line1,
        "line2": selected.line2,
        "note": "archiveDate is a lookup key; epochUtc comes from this object's TLE line 1",
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=default_root, help="tle_data archive root")
    subparsers = parser.add_subparsers(dest="command", required=True)

    catalog = subparsers.add_parser("catalog", help="list archived snapshot dates")
    catalog.add_argument("--constellation", choices=CONSTELLATIONS)

    source = subparsers.add_parser("source", help="resolve one immutable TLE source packet")
    source.add_argument("--constellation", required=True, choices=CONSTELLATIONS)
    source.add_argument("--date", required=True, help="YYYYMMDD or latest")
    source.add_argument("--norad", required=True, type=int, help="numeric NORAD catalog ID")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        if args.command == "catalog":
            result = build_catalog(args.root.resolve(), args.constellation)
        else:
            result = build_source_packet(
                args.root.resolve(), args.constellation, args.date, args.norad
            )
    except (ArchiveQueryError, OSError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
