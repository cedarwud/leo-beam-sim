#!/usr/bin/env python3
"""Geometry-oriented QA when the server has no installed office renderer."""

from __future__ import annotations

import json
import os
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
DEFAULT_PPTX = ROOT.parent / "latest" / "LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW.pptx"
PPTX = Path(os.environ.get("C120_OUTPUT", str(DEFAULT_PPTX))).resolve()
REPORT = Path(os.environ.get("C120_GEOMETRY_REPORT", str(ROOT / "qa-geometry.json"))).resolve()
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
EMU = 914400.0
BODY = (0.718057, 1.05, 12.286111, 5.577083)
TITLE = (0.718057, 0.204514, 10.34861, 0.525)
FOOTER_TOP = 6.6858


@dataclass
class Shape:
    name: str
    kind: str
    x: float
    y: float
    w: float
    h: float
    text: str
    placeholder: bool


def boxes(root: ET.Element) -> list[Shape]:
    result: list[Shape] = []
    for node in root.find(f"{P}cSld/{P}spTree"):
        kind = node.tag.rsplit("}", 1)[-1]
        if kind not in {"sp", "pic", "cxnSp"}:
            continue
        c_nv = node.find(f"{P}nvSpPr/{P}cNvPr")
        xfrm = node.find(f"{P}spPr/{A}xfrm")
        if xfrm is None:
            xfrm = node.find(f"{P}xfrm")
        if c_nv is None or xfrm is None:
            continue
        off = xfrm.find(f"{A}off")
        ext = xfrm.find(f"{A}ext")
        if off is None or ext is None:
            continue
        ph = node.find(f"{P}nvSpPr/{P}nvPr/{P}ph") is not None
        text = "".join(t.text or "" for t in node.iter(f"{A}t"))
        result.append(Shape(
            name=c_nv.get("name", ""), kind=kind,
            x=int(off.get("x", "0")) / EMU, y=int(off.get("y", "0")) / EMU,
            w=int(ext.get("cx", "0")) / EMU, h=int(ext.get("cy", "0")) / EMU,
            text=text, placeholder=ph,
        ))
    return result


def intersects(a: Shape, b: Shape) -> float:
    x = max(0.0, min(a.x + a.w, b.x + b.w) - max(a.x, b.x))
    y = max(0.0, min(a.y + a.h, b.y + b.h) - max(a.y, b.y))
    return x * y


def main() -> None:
    report = {
        "output": str(PPTX),
        "slides": 0,
        "out_of_bounds": [],
        "text_overlaps": [],
        "title_logo_collisions": [],
        "text_shape_count": 0,
        "status": "FAIL",
        "renderer": os.environ.get("C120_RENDERER", "pending: render gate is recorded separately"),
    }
    with zipfile.ZipFile(PPTX) as archive:
        slide_names = sorted(
            (n for n in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
            key=lambda n: int(re.search(r"\d+", n).group()),
        )
        report["slides"] = len(slide_names)
        for index, name in enumerate(slide_names, start=1):
            shapes = boxes(ET.fromstring(archive.read(name)))
            authored = [s for s in shapes if not s.placeholder]
            text_shapes = [s for s in authored if s.text.strip()]
            report["text_shape_count"] += len(text_shapes)
            for shape in authored:
                if shape.name.startswith("Native") or "title" in shape.name.lower():
                    region = TITLE
                else:
                    region = BODY
                rx, ry, rw, rh = region
                if shape.name.startswith("Native"):
                    continue
                if shape.y + shape.h > FOOTER_TOP - 0.02:
                    report["out_of_bounds"].append({"slide": index, "shape": shape.name, "bottom": round(shape.y + shape.h, 3)})
                if shape.x < 0.55 or shape.x + shape.w > 12.98:
                    report["out_of_bounds"].append({"slide": index, "shape": shape.name, "right": round(shape.x + shape.w, 3)})
            for i, a in enumerate(text_shapes):
                for b in text_shapes[i + 1:]:
                    area = intersects(a, b)
                    if area > 0.025:
                        report["text_overlaps"].append({"slide": index, "a": a.name, "b": b.name, "area": round(area, 3)})
            title_shapes = [s for s in authored if s.y < 0.9 and s.text.strip()]
            for shape in title_shapes:
                if shape.x + shape.w > 11.1667:
                    report["title_logo_collisions"].append({"slide": index, "shape": shape.name})
    report["status"] = "PASS" if report["slides"] == 17 and not report["out_of_bounds"] and not report["text_overlaps"] and not report["title_logo_collisions"] else "FAIL"
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()
