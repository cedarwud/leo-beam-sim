#!/usr/bin/env python3
"""Build the Part A interim deck from the exact educate source-slide shell.

This builder deliberately uses OOXML rather than concatenating donor slides:
every slide is cloned from template slide 2, every slide relationship points to
slideLayout2.xml, and template master/footer/background parts remain intact.
"""

from __future__ import annotations

import copy
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

from lxml import etree as ET


ROOT = Path(__file__).resolve().parent
ALT_ROOT = ROOT.parent
REPO_ROOT = ROOT.parents[3]
TEMPLATE = Path("/home/u24/pptx-wrap/assets/templates/educate.pptx")
SOURCE_TEMPLATE = ROOT / "src" / "educate.pptx"
UNPACKED = ROOT / "unpacked" / "part-a-build"
BUILD_DIR = ROOT / "build"
QA_DIR = ROOT / "qa"
ROOT_OUTPUT = ALT_ROOT / "LoRaEnergySim-LEO-ALT-PART-A-REVIEW.pptx"
LOCAL_OUTPUT = BUILD_DIR / "LoRaEnergySim-LEO-ALT-PART-A-REVIEW.pptx"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PR_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"p": P_NS, "a": A_NS, "r": R_NS, "pr": PR_NS}
EMU_PER_IN = 914400

ET.register_namespace("a", A_NS)
ET.register_namespace("r", R_NS)
ET.register_namespace("p", P_NS)

NAVY = "102A43"
INK = "243B53"
TEAL = "0F766E"
TEAL_LIGHT = "D9F0EC"
PURPLE = "5B4B8A"
PURPLE_LIGHT = "ECE8F6"
BLUE_LIGHT = "E6F0FA"
SAND = "F4EFE6"
MINT = "E2F4EA"
RED_LIGHT = "F8E4E4"
WHITE = "FFFFFF"
GREY = "60758A"


def qn(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


def emu(value: float) -> str:
    return str(int(round(value * EMU_PER_IN)))


def xfrm(parent, x: float, y: float, w: float, h: float) -> None:
    node = ET.SubElement(parent, qn(A_NS, "xfrm"))
    ET.SubElement(node, qn(A_NS, "off"), x=emu(x), y=emu(y))
    ET.SubElement(node, qn(A_NS, "ext"), cx=emu(w), cy=emu(h))


def solid_fill(parent, colour: str) -> None:
    fill = ET.SubElement(parent, qn(A_NS, "solidFill"))
    ET.SubElement(fill, qn(A_NS, "srgbClr"), val=colour)


def line_style(parent, colour: str = "D0D9E2", width: int = 12700) -> None:
    line = ET.SubElement(parent, qn(A_NS, "ln"), w=str(width))
    solid_fill(line, colour)


def is_cjk(text: str) -> bool:
    return any("\u2e80" <= ch <= "\u9fff" for ch in text)


def add_run(paragraph, text: str, size: int = 24, bold: bool = False,
            italic: bool = False, colour: str = INK) -> None:
    if not text:
        return
    # Keep punctuation with the closest script. This makes Traditional Chinese
    # use 標楷體 while ASCII tokens use Times New Roman.
    pieces = re.findall(r"[\u2e80-\u9fff]+|[^\u2e80-\u9fff]+", text)
    for piece in pieces:
        run = ET.SubElement(paragraph, qn(A_NS, "r"))
        lang = "zh-TW" if is_cjk(piece) else "en-US"
        attrs = {"lang": lang, "altLang": "en-US" if lang == "zh-TW" else "zh-TW",
                 "sz": str(size * 100), "dirty": "0"}
        if bold:
            attrs["b"] = "1"
        if italic:
            attrs["i"] = "1"
        rpr = ET.SubElement(run, qn(A_NS, "rPr"), **attrs)
        solid_fill(rpr, colour)
        ET.SubElement(rpr, qn(A_NS, "latin"), typeface="Times New Roman")
        ET.SubElement(rpr, qn(A_NS, "ea"), typeface="標楷體")
        ET.SubElement(rpr, qn(A_NS, "cs"), typeface="Times New Roman")
        t = ET.SubElement(run, qn(A_NS, "t"))
        if piece[:1].isspace() or piece[-1:].isspace():
            t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        t.text = piece


def add_marked_text(paragraph, text: str, size: int = 24, colour: str = INK,
                    bold: bool = False) -> None:
    """Add text; backtick spans are code/variable spans and render italic."""
    cursor = 0
    for match in re.finditer(r"`([^`]+)`", text):
        add_run(paragraph, text[cursor:match.start()], size, bold, False, colour)
        add_run(paragraph, match.group(1), size, bold, True, colour)
        cursor = match.end()
    add_run(paragraph, text[cursor:], size, bold, False, colour)


def replace_text_body(shape, paragraphs: list[str], size: int = 24,
                      colour: str = INK, compact: bool = False) -> None:
    tx = shape.find(qn(P_NS, "txBody"))
    if tx is None:
        tx = ET.SubElement(shape, qn(P_NS, "txBody"))
    for child in list(tx):
        tx.remove(child)
    body_pr = ET.SubElement(tx, qn(A_NS, "bodyPr"), wrap="square", anchor="t",
                             lIns="0", rIns="0", tIns="0", bIns="0")
    body_pr.set("rtlCol", "0")
    ET.SubElement(body_pr, qn(A_NS, "noAutofit"))
    ET.SubElement(tx, qn(A_NS, "lstStyle"))
    line_pts = 1900 if size <= 18 else (2200 if size <= 20 else 2700)
    for idx, paragraph_text in enumerate(paragraphs):
        p = ET.SubElement(tx, qn(A_NS, "p"))
        ppr = ET.SubElement(p, qn(A_NS, "pPr"), algn="l", marL="0", indent="0")
        # The source slide inherits a bullet-capable body style. Part A uses
        # formal paragraphs and native cards, so explicitly disable bullets.
        ET.SubElement(ppr, qn(A_NS, "buNone"))
        ln = ET.SubElement(ppr, qn(A_NS, "lnSpc"))
        ET.SubElement(ln, qn(A_NS, "spcPts"), val=str(line_pts))
        if idx < len(paragraphs) - 1:
            aft = ET.SubElement(ppr, qn(A_NS, "spcAft"))
            ET.SubElement(aft, qn(A_NS, "spcPts"), val="550")
        add_marked_text(p, paragraph_text, size, colour)
        ET.SubElement(p, qn(A_NS, "endParaRPr"), lang="zh-TW", altLang="en-US",
                      sz=str(size * 100), dirty="0")


def replace_title(shape, title: str) -> None:
    replace_text_body(shape, [title], 28, NAVY, compact=True)
    tx = shape.find(qn(P_NS, "txBody"))
    body_pr = tx.find(qn(A_NS, "bodyPr"))
    body_pr.set("anchor", "ctr")


def set_transform(shape, x: float, y: float, w: float, h: float,
                  transparent: bool = True) -> None:
    sppr = shape.find(qn(P_NS, "spPr"))
    if sppr is None:
        sppr = ET.SubElement(shape, qn(P_NS, "spPr"))
    for child in list(sppr):
        sppr.remove(child)
    xfrm(sppr, x, y, w, h)
    geom = ET.SubElement(sppr, qn(A_NS, "prstGeom"), prst="rect")
    ET.SubElement(geom, qn(A_NS, "avLst"))
    if transparent:
        ET.SubElement(sppr, qn(A_NS, "noFill"))
        ln = ET.SubElement(sppr, qn(A_NS, "ln"))
        ET.SubElement(ln, qn(A_NS, "noFill"))


def shape_base(sp_tree, shape_id: int, name: str, x: float, y: float,
               w: float, h: float, fill: str | None = None,
               line: str | None = None, geom: str = "roundRect"):
    sp = ET.SubElement(sp_tree, qn(P_NS, "sp"))
    nv = ET.SubElement(sp, qn(P_NS, "nvSpPr"))
    ET.SubElement(nv, qn(P_NS, "cNvPr"), id=str(shape_id), name=name)
    ET.SubElement(nv, qn(P_NS, "cNvSpPr"), txBox="1")
    ET.SubElement(nv, qn(P_NS, "nvPr"))
    sppr = ET.SubElement(sp, qn(P_NS, "spPr"))
    xfrm(sppr, x, y, w, h)
    geom_el = ET.SubElement(sppr, qn(A_NS, "prstGeom"), prst=geom)
    ET.SubElement(geom_el, qn(A_NS, "avLst"))
    if fill:
        solid_fill(sppr, fill)
    else:
        ET.SubElement(sppr, qn(A_NS, "noFill"))
    if line:
        line_style(sppr, line, 12700)
    else:
        ln = ET.SubElement(sppr, qn(A_NS, "ln"))
        ET.SubElement(ln, qn(A_NS, "noFill"))
    return sp


def textbox(sp_tree, shape_id: int, text: str, x: float, y: float, w: float,
            h: float, size: int = 17, colour: str = NAVY,
            bold: bool = False, italic: bool = False,
            fill: str | None = None, line: str | None = None,
            align: str = "ctr"):
    sp = shape_base(sp_tree, shape_id, f"Text {shape_id}", x, y, w, h,
                    fill, line, "roundRect" if fill else "rect")
    tx = ET.SubElement(sp, qn(P_NS, "txBody"))
    ET.SubElement(tx, qn(A_NS, "bodyPr"), wrap="square", anchor="ctr",
                  lIns="72000", rIns="72000", tIns="36000", bIns="36000")
    ET.SubElement(tx, qn(A_NS, "lstStyle"))
    p = ET.SubElement(tx, qn(A_NS, "p"))
    ET.SubElement(p, qn(A_NS, "pPr"), algn=align)
    if italic:
        add_run(p, text, size, bold, True, colour)
    else:
        add_marked_text(p, text, size, colour, bold)
    ET.SubElement(p, qn(A_NS, "endParaRPr"), lang="zh-TW", altLang="en-US",
                  sz=str(size * 100), dirty="0")
    return sp


def card(sp_tree, shape_id: int, label: str, x: float, y: float, w: float,
         h: float, fill: str = BLUE_LIGHT, size: int = 16,
         accent: str = TEAL) -> None:
    shape_base(sp_tree, shape_id, f"Card {shape_id}", x, y, w, h, fill, accent)
    textbox(sp_tree, shape_id + 1, label, x + 0.04, y + 0.05, w - 0.08,
            h - 0.1, size=size, colour=NAVY, bold=True, fill=None)


def draw_cards(sp_tree, start_id: int, labels: list[str], x: float, y: float,
               w: float, h: float, vertical: bool = False) -> int:
    palette = [TEAL_LIGHT, BLUE_LIGHT, PURPLE_LIGHT, SAND, MINT, RED_LIGHT]
    if vertical:
        gap = 0.16
        ch = (h - gap * (len(labels) - 1)) / max(1, len(labels))
        for i, label in enumerate(labels):
            card(sp_tree, start_id + i * 2, label, x, y + i * (ch + gap), w, ch,
                 palette[i % len(palette)], 16, [TEAL, PURPLE, "47759B"][i % 3])
        return start_id + len(labels) * 2
    gap = 0.16
    cw = (w - gap * (len(labels) - 1)) / max(1, len(labels))
    for i, label in enumerate(labels):
        card(sp_tree, start_id + i * 2, label, x + i * (cw + gap), y, cw, h,
             palette[i % len(palette)], 16, [TEAL, PURPLE, "47759B"][i % 3])
    return start_id + len(labels) * 2


def draw_visual(sp_tree, visual: dict, x: float, y: float, w: float, h: float,
                start_id: int = 100) -> None:
    kind = visual.get("kind", "field")
    labels = visual.get("labels", [])
    if kind == "field":
        if w < 1.0:
            return
        shape_base(sp_tree, start_id, "Field accent", x + 0.03, y, 0.12, h, TEAL, None, "rect")
        badge = visual.get("badge", "field contract")
        textbox(sp_tree, start_id + 2, badge, x + 0.35, y + 0.15, w - 0.5, 0.5,
                16, TEAL, True, fill=TEAL_LIGHT, line=TEAL)
        return
    if kind == "hero":
        card(sp_tree, start_id, labels[0], x, y + 0.9, 1.6, 1.6, TEAL_LIGHT, 17, TEAL)
        card(sp_tree, start_id + 2, labels[1], x + 1.95, y + 1.2, 1.4, 1.0, SAND, 17, PURPLE)
        card(sp_tree, start_id + 4, labels[2], x + 3.7, y + 0.55, 1.7, 2.25, PURPLE_LIGHT, 17, PURPLE)
        textbox(sp_tree, start_id + 6, "封包路徑", x + 1.5, y + 2.8, 2.7, 0.45, 16, TEAL, True)
        shape_base(sp_tree, start_id + 7, "Path", x + 1.58, y + 2.5, 2.2, 0.06, TEAL, None, "rect")
        return
    if visual.get("compact"):
        draw_cards(sp_tree, start_id, labels, x, y + 0.12, w, min(0.72, h), vertical=False)
        return
    if kind in {"triptych", "compare", "timeline"}:
        draw_cards(sp_tree, start_id, labels, x, y + 1.1, w, 1.25)
        if kind == "timeline":
            shape_base(sp_tree, start_id + 20, "Timeline", x + 0.4, y + 0.65, w - 0.8, 0.06, TEAL, None, "rect")
            for i in range(len(labels)):
                shape_base(sp_tree, start_id + 22 + i * 2, "Node", x + 0.35 + i * (w - 0.7) / max(1, len(labels) - 1), y + 0.5, 0.28, 0.28, TEAL, TEAL, "ellipse")
        return
    if kind == "flow":
        draw_cards(sp_tree, start_id, labels, x, y + 1.0, w, 1.05, vertical=(len(labels) > 4))
        return
    if kind == "ledger":
        for i, label in enumerate(labels):
            yy = y + i * 0.75
            shape_base(sp_tree, start_id + i * 3, "Ledger row", x, yy, w, 0.55,
                       [TEAL_LIGHT, BLUE_LIGHT, SAND, PURPLE_LIGHT][i % 4], TEAL, "roundRect")
            textbox(sp_tree, start_id + i * 3 + 1, label, x + 0.12, yy + 0.03, w - 0.24, 0.48, 16, NAVY, True)
        return
    if kind == "loop":
        coords = [(x + 0.05, y + 0.45), (x + 2.7, y + 0.45), (x + 2.7, y + 2.2), (x + 0.05, y + 2.2)]
        for i, label in enumerate(labels[:4]):
            card(sp_tree, start_id + i * 2, label, coords[i][0], coords[i][1], 2.1, 0.9,
                 [TEAL_LIGHT, BLUE_LIGHT, PURPLE_LIGHT, SAND][i], 16, TEAL if i % 2 == 0 else PURPLE)
        textbox(sp_tree, start_id + 12, "policy → evidence", x + 1.0, y + 1.55, 2.0, 0.5, 16, TEAL, True)
        return
    if kind == "shield":
        draw_cards(sp_tree, start_id, labels, x + 0.25, y + 0.35, w - 0.5, h - 0.7, vertical=True)
        return
    if kind == "anatomy":
        card(sp_tree, start_id, labels[0], x + 1.25, y + 0.2, 2.6, 0.8, TEAL_LIGHT, 17, TEAL)
        draw_cards(sp_tree, start_id + 3, labels[1:], x, y + 1.55, w, 0.85)
        return
    if kind in {"gate", "ladder"}:
        draw_cards(sp_tree, start_id, labels, x + 0.25, y + 0.15, w - 0.5, h - 0.3, vertical=True)
        return
    if kind == "path":
        draw_cards(sp_tree, start_id, labels, x, y + 1.15, w, 1.0)
        textbox(sp_tree, start_id + 20, "同一 platform boundary", x + 0.8, y + 2.6, w - 1.6, 0.45, 16, PURPLE, True)
        return
    if kind == "receipt":
        draw_cards(sp_tree, start_id, labels, x + 0.1, y + 0.25, w - 0.2, h - 0.5, vertical=True)
        return
    if kind == "branch":
        card(sp_tree, start_id, labels[0], x + 1.35, y + 0.15, 2.1, 0.75, BLUE_LIGHT, 16, TEAL)
        card(sp_tree, start_id + 2, labels[1], x, y + 1.55, 2.25, 0.85, TEAL_LIGHT, 16, TEAL)
        card(sp_tree, start_id + 4, labels[2], x + 2.7, y + 1.55, 2.25, 0.85, PURPLE_LIGHT, 16, PURPLE)
        if len(labels) > 3:
            card(sp_tree, start_id + 6, labels[3], x + 1.35, y + 3.0, 2.1, 0.85, SAND, 16, PURPLE)
        return
    if kind == "guard":
        draw_cards(sp_tree, start_id, labels, x + 0.1, y + 0.4, w - 0.2, h - 0.8, vertical=True)
        return
    if kind == "api":
        card(sp_tree, start_id, labels[0], x, y + 1.1, 1.6, 1.25, BLUE_LIGHT, 16, TEAL)
        card(sp_tree, start_id + 2, labels[1], x + 1.9, y + 1.45, 1.8, 0.55, TEAL_LIGHT, 16, TEAL)
        card(sp_tree, start_id + 4, labels[2], x + 4.0, y + 1.1, 1.5, 1.25, PURPLE_LIGHT, 16, PURPLE)
        return
    if kind == "knobs":
        draw_cards(sp_tree, start_id, labels, x, y + 0.75, w, 1.3)
        textbox(sp_tree, start_id + 20, "一次一個受控常數", x + 0.7, y + 2.65, w - 1.4, 0.5, 17, TEAL, True)
        return
    if kind == "code":
        shape_base(sp_tree, start_id, "Code panel", x, y + 0.2, w, 2.6, NAVY, TEAL, "roundRect")
        textbox(sp_tree, start_id + 2, "observation\n   ↓ branch\nreturn action", x + 0.25, y + 0.5, w - 0.5, 1.9, 17, WHITE, False, fill=None)
        return
    if kind == "baseline":
        card(sp_tree, start_id, labels[0], x + 1.5, y + 0.1, 2.1, 0.75, TEAL_LIGHT, 17, TEAL)
        card(sp_tree, start_id + 2, labels[1], x, y + 1.55, 2.3, 1.0, BLUE_LIGHT, 16, TEAL)
        card(sp_tree, start_id + 4, labels[2], x + 2.8, y + 1.55, 2.5, 1.0, PURPLE_LIGHT, 16, PURPLE)
        textbox(sp_tree, start_id + 6, labels[3], x + 0.9, y + 3.2, 3.6, 0.55, 16, TEAL, True)
        return
    draw_cards(sp_tree, start_id, labels, x, y + 0.8, w, 1.2)


def body_geometry(layout: str) -> tuple[float, float, float, float, float, float, float, float]:
    if layout == "wide":
        return 0.72, 1.10, 12.1, 4.35, 0.72, 5.52, 12.1, 0.82
    if layout in {"split", "code", "api"}:
        return 0.72, 1.10, 6.05, 5.20, 7.15, 1.18, 5.35, 4.85
    if layout in {"field"}:
        return 0.85, 1.18, 11.95, 5.22, 0.2, 1.2, 0.4, 4.9
    if layout in {"flow", "loop", "triptych", "compare", "timeline", "ledger", "shield", "anatomy", "gate", "ladder", "path", "receipt", "branch", "guard", "knobs", "baseline"}:
        return 0.72, 1.10, 6.1, 4.92, 7.1, 1.18, 5.42, 4.75
    return 0.72, 1.10, 12.25, 5.25, 0.2, 1.2, 0.4, 4.8


def find_ph_shape(sp_tree, ph_type: str | None = None, ph_idx: str | None = None):
    for shape in sp_tree.findall(qn(P_NS, "sp")):
        ph = shape.find(".//" + qn(P_NS, "ph"))
        if ph is None:
            continue
        if ph_type is not None and ph.get("type") == ph_type:
            return shape
        if ph_idx is not None and ph.get("idx") == ph_idx:
            return shape
    return None


def clone_slide_shell(base_root, slide: dict, slide_index: int):
    root = copy.deepcopy(base_root)
    c_sld = root.find(qn(P_NS, "cSld"))
    sp_tree = c_sld.find(qn(P_NS, "spTree"))
    title_shape = find_ph_shape(sp_tree, ph_type="title")
    body_shape = find_ph_shape(sp_tree, ph_idx="1")
    for child in list(sp_tree):
        if child is not sp_tree[0] and child is not sp_tree[1] and child not in {title_shape, body_shape}:
            sp_tree.remove(child)
    if title_shape is None or body_shape is None:
        raise RuntimeError("template slide 2 lost title/body placeholders")
    replace_title(title_shape, slide["title"])
    bx, by, bw, bh, vx, vy, vw, vh = body_geometry(slide.get("layout", "wide"))
    set_transform(body_shape, bx, by, bw, bh)
    compact = slide.get("layout") in {"field", "receipt", "branch", "guard", "knobs"}
    default_size = 18 if slide.get("layout") in {"split", "code", "api"} else (18 if compact else 20)
    body_size = int(slide.get("body_size", default_size))
    replace_text_body(body_shape, slide["body"], body_size, INK, compact=compact)
    draw_visual(sp_tree, slide.get("visual", {}), vx, vy, vw, vh, 100 + slide_index * 30)
    return root


def note_xml(text: str) -> bytes:
    root = ET.Element(qn(P_NS, "notes"), nsmap={"a": A_NS, "r": R_NS, "p": P_NS})
    c_sld = ET.SubElement(root, qn(P_NS, "cSld"))
    tree = ET.SubElement(c_sld, qn(P_NS, "spTree"))
    nvgrp = ET.SubElement(tree, qn(P_NS, "nvGrpSpPr"))
    ET.SubElement(nvgrp, qn(P_NS, "cNvPr"), id="1", name="")
    ET.SubElement(nvgrp, qn(P_NS, "cNvGrpSpPr"))
    ET.SubElement(nvgrp, qn(P_NS, "nvPr"))
    grp = ET.SubElement(tree, qn(P_NS, "grpSpPr"))
    xfrm(grp, 0, 0, 0, 0)
    sp = ET.SubElement(tree, qn(P_NS, "sp"))
    nv = ET.SubElement(sp, qn(P_NS, "nvSpPr"))
    ET.SubElement(nv, qn(P_NS, "cNvPr"), id="3", name="Notes Placeholder 2")
    ET.SubElement(nv, qn(P_NS, "cNvSpPr"))
    nvp = ET.SubElement(nv, qn(P_NS, "nvPr"))
    ET.SubElement(nvp, qn(P_NS, "ph"), type="body", sz="quarter", idx="3")
    ET.SubElement(sp, qn(P_NS, "spPr"))
    tx = ET.SubElement(sp, qn(P_NS, "txBody"))
    ET.SubElement(tx, qn(A_NS, "bodyPr"), wrap="square")
    ET.SubElement(tx, qn(A_NS, "lstStyle"))
    for para_text in text.split("\n"):
        p = ET.SubElement(tx, qn(A_NS, "p"))
        ET.SubElement(p, qn(A_NS, "pPr"), algn="l")
        add_marked_text(p, para_text, 18, INK)
        ET.SubElement(p, qn(A_NS, "endParaRPr"), lang="zh-TW", altLang="en-US", dirty="0")
    ET.SubElement(root, qn(P_NS, "clrMapOvr"))
    return ET.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True, pretty_print=True)


def rels_xml(slide_num: int) -> bytes:
    root = ET.Element(qn(PR_NS, "Relationships"), nsmap={None: PR_NS})
    ET.SubElement(root, qn(PR_NS, "Relationship"), Id="rId1",
                  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
                  Target="../slideLayouts/slideLayout2.xml")
    ET.SubElement(root, qn(PR_NS, "Relationship"), Id="rId2",
                  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide",
                  Target=f"../notesSlides/notesSlide{slide_num}.xml")
    return ET.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True, pretty_print=True)


def notes_rels_xml(slide_num: int) -> bytes:
    root = ET.Element(qn(PR_NS, "Relationships"), nsmap={None: PR_NS})
    ET.SubElement(root, qn(PR_NS, "Relationship"), Id="rId1",
                  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster",
                  Target="../notesMasters/notesMaster1.xml")
    ET.SubElement(root, qn(PR_NS, "Relationship"), Id="rId2",
                  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
                  Target=f"../slides/slide{slide_num}.xml")
    return ET.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True, pretty_print=True)


def update_relationships_and_presentation(slide_nums: list[int]) -> None:
    pres_path = UNPACKED / "ppt" / "presentation.xml"
    root = ET.parse(str(pres_path)).getroot()
    sld_ids = root.find(qn(P_NS, "sldIdLst"))
    if sld_ids is None:
        sld_ids = ET.SubElement(root, qn(P_NS, "sldIdLst"))
    for child in list(sld_ids):
        sld_ids.remove(child)
    for idx, slide_num in enumerate(slide_nums):
        ET.SubElement(sld_ids, qn(P_NS, "sldId"), id=str(300 + idx),
                      **{qn(R_NS, "id"): f"rId{20 + idx}"})
    pres_path.write_bytes(ET.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True, pretty_print=True))

    rel_path = UNPACKED / "ppt" / "_rels" / "presentation.xml.rels"
    rel_root = ET.parse(str(rel_path)).getroot()
    for rel in list(rel_root):
        if rel.get("Type", "").endswith("/slide"):
            rel_root.remove(rel)
    for idx, slide_num in enumerate(slide_nums):
        ET.SubElement(rel_root, qn(PR_NS, "Relationship"), Id=f"rId{20 + idx}",
                      Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
                      Target=f"slides/slide{slide_num}.xml")
    rel_path.write_bytes(ET.tostring(rel_root, xml_declaration=True, encoding="UTF-8", standalone=True, pretty_print=True))


def update_content_types(slide_nums: list[int]) -> None:
    path = UNPACKED / "[Content_Types].xml"
    root = ET.parse(str(path)).getroot()
    for child in list(root):
        part = child.get("PartName", "")
        if part.startswith("/ppt/slides/slide") or part.startswith("/ppt/notesSlides/notesSlide"):
            root.remove(child)
    for slide_num in slide_nums:
        ET.SubElement(root, "{http://schemas.openxmlformats.org/package/2006/content-types}Override",
                      PartName=f"/ppt/slides/slide{slide_num}.xml",
                      ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml")
        ET.SubElement(root, "{http://schemas.openxmlformats.org/package/2006/content-types}Override",
                      PartName=f"/ppt/notesSlides/notesSlide{slide_num}.xml",
                      ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml")
    path.write_bytes(ET.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True, pretty_print=True))


def clean_unpacked() -> None:
    clean = Path("/home/u24/.codex/skills/pptx/scripts/clean.py")
    subprocess.run([sys.executable, str(clean), str(UNPACKED)], check=True,
                   cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def pack(output: Path) -> None:
    pack_script = Path("/home/u24/.codex/skills/pptx/scripts/office/pack.py")
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, str(pack_script), str(UNPACKED), str(output),
                    "--original", str(SOURCE_TEMPLATE)], check=True,
                   cwd=str(REPO_ROOT))


def overlay_template_parts(path: Path) -> None:
    """Restore byte-identical native educate parts after the OOXML pack."""
    with zipfile.ZipFile(TEMPLATE) as source, zipfile.ZipFile(path, "r") as old:
        data = {info.filename: old.read(info.filename) for info in old.infolist()}
        infos = {info.filename: copy.copy(info) for info in old.infolist()}
        prefixes = (
            "ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/",
            "ppt/media/", "ppt/notesMasters/",
        )
        for info in source.infolist():
            if info.filename.startswith(prefixes):
                data[info.filename] = source.read(info.filename)
                infos[info.filename] = copy.copy(info)
    temporary = path.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as target:
        for name, payload in data.items():
            target.writestr(infos[name], payload)
    temporary.replace(path)


def build() -> None:
    if not SOURCE_TEMPLATE.exists():
        SOURCE_TEMPLATE.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TEMPLATE, SOURCE_TEMPLATE)
    data = json.loads((ROOT / "slides.json").read_text(encoding="utf-8"))
    slides = data["slides"]
    if UNPACKED.exists():
        shutil.rmtree(UNPACKED)
    UNPACKED.mkdir(parents=True)
    with zipfile.ZipFile(SOURCE_TEMPLATE) as zf:
        zf.extractall(UNPACKED)
    base_root = ET.parse(str(UNPACKED / "ppt" / "slides" / "slide2.xml")).getroot()
    slides_dir = UNPACKED / "ppt" / "slides"
    rels_dir = slides_dir / "_rels"
    notes_dir = UNPACKED / "ppt" / "notesSlides"
    notes_rels_dir = notes_dir / "_rels"
    notes_dir.mkdir(exist_ok=True)
    notes_rels_dir.mkdir(exist_ok=True)
    slide_nums: list[int] = []
    for index, slide in enumerate(slides):
        slide_num = 2 + index
        slide_nums.append(slide_num)
        slide_tree = clone_slide_shell(base_root, slide, index)
        slide_path = slides_dir / f"slide{slide_num}.xml"
        slide_path.write_bytes(ET.tostring(slide_tree, xml_declaration=True, encoding="UTF-8", standalone=True, pretty_print=True))
        (rels_dir / f"slide{slide_num}.xml.rels").write_bytes(rels_xml(slide_num))
        (notes_dir / f"notesSlide{slide_num}.xml").write_bytes(note_xml(slide["notes"]))
        (notes_rels_dir / f"notesSlide{slide_num}.xml.rels").write_bytes(notes_rels_xml(slide_num))
    # Remove original non-authoring slide/layout references from the list; only
    # the cloned source slide 2 shell is represented in the deck sequence.
    update_relationships_and_presentation(slide_nums)
    update_content_types(slide_nums)
    clean_unpacked()
    if BUILD_DIR.exists():
        BUILD_DIR.mkdir(exist_ok=True)
    pack(LOCAL_OUTPUT)
    overlay_template_parts(LOCAL_OUTPUT)
    shutil.copy2(LOCAL_OUTPUT, ROOT_OUTPUT)

    # Emit machine-readable source for the parent lane and reproducibility
    # metadata beside the deck. The source JSON itself remains the canonical
    # ordered title/body/layout/notes/donor mapping record.
    (ROOT / "slides.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    template_sha = hashlib.sha256(SOURCE_TEMPLATE.read_bytes()).hexdigest()
    contract = {
        "template": str(TEMPLATE),
        "template_sha256": template_sha,
        "shell": "source slide 2 / slideLayout2.xml only",
        "background_author_fill": "unset",
        "fonts": {"cjk": "標楷體", "latin": "Times New Roman"},
        "title_pt": 28,
        "body_baseline_pt": 24,
        "minimum_body_pt": 16,
        "minimum_used_in_builder_pt": min(int(s.get("body_size", 18 if s.get("layout") in {"split", "code", "api", "field", "receipt", "branch", "guard", "knobs"} else 20)) for s in slides),
        "slide_count": len(slides),
        "slide_layouts": ["slideLayout2.xml"],
        "output": str(ROOT_OUTPUT),
        "notes_embedded": True,
        "formulas": "none in Part A; no raster formulas",
    }
    (QA_DIR / "authoring-contract.json").write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    donor_lines = ["# Part A donor source map", "", "Source: courseware/c120-lora-leo-deck/donor-analysis/donor-insertion-map.md", "", "Donor pages are topic references only; no donor bytes, master, screenshot, KPI, or legacy evidence is concatenated.", ""]
    for s in slides:
        donor = s.get("donor-source")
        if donor:
            donor_lines.append(f"- {s['id']}: {donor['donor']} slides {donor['slides']} — {donor['mapping']}")
    (QA_DIR / "donor-source-map.md").write_text("\n".join(donor_lines) + "\n", encoding="utf-8")
    report = {
        "template_sha256": template_sha,
        "output": str(ROOT_OUTPUT),
        "local_output": str(LOCAL_OUTPUT),
        "slide_count": len(slides),
        "notes_count": len(slides),
        "layout_restriction": "all slides reference slideLayout2.xml",
        "parent_merge_source": str(ROOT / "slides.json"),
    }
    (QA_DIR / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    build()
