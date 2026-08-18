#!/usr/bin/env python3
"""Build the C-120 classroom deck from the v2 page script.

This is deliberately project-local and self-contained.  The first stage uses
PPT Master's native-template-fill route with the six-layout educate sampler;
the second stage removes the sampler's body placeholders and composes editable
DrawingML text, lines, timelines, ledgers, and command ribbons on the cloned
slides.  The sampler's title anchors remain so that native Office Math can be
inserted and the original master/theme/background remain attached to every
slide.

Only the v2 project directory is written by this script.  Existing course
sources and earlier deck projects are read-only inputs.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
SCRIPT_PATH = ROOT / "full-deck-v2-classroom-script.md"
SAMPLER_PATH = ROOT / "projects/native-layout-proof_ppt169_20260811/sources/educate-layout-sampler-v2.pptx"
EQUATION_SVG = ROOT / "projects/native-layout-proof_ppt169_20260811/assets/energy-equations.svg"
PPT_MASTER = Path("/home/u24/.agents/skills/ppt-master/scripts/template_fill_pptx.py")
PROJECT = ROOT / "projects/full-deck-v2_ppt169_20260811"

LATEX_ENDPOINT = r"E_{endpoint}=\\sum_{s\\in\\mathcal{S}}P_s t_s"
LATEX_EE = r"\\eta_E=\\frac{D_{delivered}}{E_{endpoint}}"

FORBIDDEN_WORD = "學生"
MINUTE_RE = re.compile(r"(?:分鐘|\b\d+\s*(?:min|mins|minute|minutes)\b)", re.I)

# Keep accent use restrained so that the educate template remains visually
# dominant.  These are only object strokes / small markers, never slide fills.
NAVY = RGBColor(38, 63, 81)
TEAL = RGBColor(47, 111, 112)
GOLD = RGBColor(183, 125, 45)
INK = RGBColor(42, 52, 58)
MUTED = RGBColor(89, 104, 111)
PALE = RGBColor(230, 236, 236)
WHITE = RGBColor(255, 255, 255)


@dataclass
class Page:
    number: int
    title: str
    layout: str
    evidence: str
    on_slide: str
    visual: str
    notes: str
    recovery: str
    archetype: int = 2


def _field(block: str, name: str) -> str:
    match = re.search(rf"(?m)^{re.escape(name)}:\s*(.*?)\s*$", block)
    if not match:
        raise ValueError(f"missing {name} field")
    return match.group(1).strip()


def parse_script(path: Path = SCRIPT_PATH) -> list[Page]:
    text = path.read_text(encoding="utf-8")
    chunks = re.split(r"(?m)^## (P\d{3}) — (.+)$", text)
    pages: list[Page] = []
    for index in range(1, len(chunks), 3):
        pid, title, block = chunks[index], chunks[index + 1], chunks[index + 2]
        page = Page(
            number=int(pid[1:]),
            title=title.strip(),
            layout=_field(block, "Layout"),
            evidence=_field(block, "Evidence"),
            on_slide=_field(block, "On-slide"),
            visual=_field(block, "Visual"),
            notes=_field(block, "Notes"),
            recovery=_field(block, "Recovery"),
        )
        pages.append(page)
    if [p.number for p in pages] != list(range(1, 109)):
        raise ValueError("v2 script must contain P001 through P108 exactly once")
    for page in pages:
        serial = " ".join((page.title, page.layout, page.evidence, page.on_slide, page.visual, page.notes, page.recovery))
        if FORBIDDEN_WORD in serial:
            raise ValueError(f"page {page.number}: forbidden exact word {FORBIDDEN_WORD!r}")
        if MINUTE_RE.search(serial):
            raise ValueError(f"page {page.number}: minute/duration label is forbidden")
        if not all(v.strip() for v in (page.title, page.layout, page.evidence, page.on_slide, page.visual, page.notes, page.recovery)):
            raise ValueError(f"page {page.number}: empty required field")
    return pages


def _layout_family(page: Page) -> int:
    """Map the authored Layout/Visual semantics to one sampler archetype."""

    text = f"{page.layout} {page.visual}".lower()
    if page.number == 1:
        return 1  # cover
    if any(k in text for k in ("compare", "split", "three-card", "domain cards", "two-lane", "counterexample")):
        return 4  # compare / four-open-frame
    if any(k in text for k in ("terminal", "command", "code", "api card", "input/output", "guarded file", "before/after")):
        return 2  # title + one operational object
    if any(k in text for k in ("equation", "formula", "area chart", "unit ladder")):
        return 6  # title + left scope / right equation canvas
    if any(k in text for k in ("hero", "claim shield", "glossary", "single annotated", "verdict card", "exit gate")):
        return 5  # chapter-like title anchor plus composed hero object
    if any(k in text for k in ("timeline", "flow", "loop", "spine", "ladder", "route", "chain", "identity", "lineage", "validation", "path", "window")):
        return 3  # two-column / flow
    if any(k in text for k in ("ledger", "evidence", "replay", "workbook", "receipt", "checkpoint", "record")):
        return 6
    return 2


def assign_archetypes(pages: list[Page]) -> None:
    previous: int | None = None
    run = 0
    for page in pages:
        proposed = _layout_family(page)
        if proposed == previous:
            run += 1
        else:
            run = 1
        if run > 2:
            # Preserve the semantic family as much as possible, but force a
            # visual break after two repeated source archetypes.
            alternatives = [3, 4, 6, 2, 5]
            proposed = next((x for x in alternatives if x != previous), 2)
            run = 1
        page.archetype = proposed
        previous = proposed


def _strip_code(value: str) -> str:
    return value.replace("`", "")


def split_tokens(value: str, limit: int = 6) -> list[str]:
    value = _strip_code(value)
    value = value.replace("：", ":")
    pieces = [piece.strip() for piece in re.split(r"[；;]", value) if piece.strip()]
    if len(pieces) <= limit:
        return pieces
    return pieces[: limit - 1] + ["；".join(pieces[limit - 1 :])]


def display_evidence(value: str) -> str:
    if "IMPLEMENTED NOT VERIFIED" in value:
        value = value.replace("IMPLEMENTED NOT VERIFIED", "IMPLEMENTED / NOT VERIFIED")
    if value.strip() == "PLACEHOLDER" or value.startswith("PLACEHOLDER;"):
        value = value.replace("PLACEHOLDER", "EVIDENCE PLACEHOLDER", 1)
    return _strip_code(value)


def _pretty_latex(value: str) -> str:
    # Never put source markup on screen.  This is an intentionally compact
    # readable fallback; exact source is retained in native shape metadata.
    if "E_{endpoint}" in value and "sum" in value:
        return "Eₑₙdₚₒᵢₙₜ = Σₛ Pₛ tₛ"
    if "eta_E" in value or "\\eta" in value:
        return "ηₑ = Ddelivered / Eₑₙdₚₒᵢₙₜ"
    return value


def plan_body(page: Page) -> str:
    items = split_tokens(page.on_slide, 4)
    if any("LaTeX source" in item for item in items):
        items = [_pretty_latex(item.replace("LaTeX source:", "公式：")) for item in items]
    return "\n".join(items[:4])


def build_fill_plan(pages: list[Page], source_pptx: Path) -> dict[str, object]:
    slides: list[dict[str, object]] = []
    for page in pages:
        if page.number == 1:
            replacements = [
                {"slot_id": "s01_sh2", "text": page.title},
                {"slot_id": "s01_sh3", "text": "C-120｜LoRaEnergySim × 智慧節能與物聯網應用"},
            ]
            source_slide = 1
        else:
            source_slide = page.archetype
            title_slot = f"s{source_slide:02d}_sh2"
            replacements = [{"slot_id": title_slot, "text": page.title}]
            body = plan_body(page)
            if source_slide == 2:
                replacements.append({"slot_id": "s02_sh3", "text": body})
            elif source_slide == 3:
                cols = split_tokens(page.on_slide, 4)
                replacements.extend([
                    {"slot_id": "s03_sh3", "text": cols[0] if cols else body},
                    {"slot_id": "s03_sh4", "text": "\n".join(cols[1:]) or page.visual},
                ])
            elif source_slide == 4:
                cols = split_tokens(page.on_slide, 4)
                for slot, text in zip(("s04_sh3", "s04_sh4", "s04_sh5", "s04_sh6"), cols + [page.visual] * 4):
                    replacements.append({"slot_id": slot, "text": text})
            elif source_slide == 6:
                cols = split_tokens(page.on_slide, 4)
                replacements.extend([
                    {"slot_id": "s06_sh3", "text": "\n".join(cols[:2]) or body},
                    {"slot_id": "s06_sh4", "text": "\n".join(cols[2:]) or page.visual},
                ])
            # Source slide 5 intentionally has a title-only shell; content is
            # composed as editable shapes in the post-compose pass.
        slides.append(
            {
                "source_slide": source_slide,
                "purpose": page.layout,
                "layout_rationale": {
                    "layout_pattern": f"educate sampler archetype {source_slide}",
                    "why_fit": f"Authored Layout '{page.layout}' maps to a matching native shell; Visual '{page.visual}' is composed after fill.",
                    "risk": "Post-compose render QA governs text capacity and evidence-image scope.",
                },
                "replacements": replacements,
                "notes": f"{page.notes} 恢復提示：{page.recovery}",
                "table_edits": [],
                "chart_edits": [],
            }
        )
    return {
        "schema": "template_fill_pptx_plan.v1",
        "status": "confirmed",
        "source_pptx": str(source_pptx.resolve()),
        "accepted_warnings": [
            {"code": "post_compose", "reason": "Native body placeholders are only an initial Fill Native base; post-compose replaces them with editable DrawingML objects."}
        ],
        "slides": slides,
    }


def _qn(ns: str, local: str) -> str:
    return f"{{{ns}}}{local}"


A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PR_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"


def _set_run_font(run, size: int, *, bold: bool = False, italic: bool = False, color: RGBColor = INK) -> None:
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rpr = run._r.get_or_add_rPr()
    rpr.set("sz", str(size * 100))
    rpr.set("b", "1" if bold else "0")
    rpr.set("i", "1" if italic else "0")
    for tag, typeface in (("latin", "Times New Roman"), ("ea", "標楷體"), ("cs", "Times New Roman")):
        node = rpr.find(_qn(A_NS, tag))
        if node is None:
            node = OxmlElement(f"a:{tag}")
            rpr.append(node)
        node.set("typeface", typeface)


def _chunks(text: str, *, code_italic: bool = False) -> Iterable[tuple[str, bool]]:
    parts = re.split(r"(`[^`]*`)", text)
    for part in parts:
        if not part:
            continue
        marked = part.startswith("`") and part.endswith("`")
        raw = part[1:-1] if marked else part
        for chunk in re.findall(r"[\u3400-\u9fff\uF900-\uFAFF]+|[^\u3400-\u9fff\uF900-\uFAFF]+", raw):
            # Formula/variable tokens are italic; prose and command ribbons
            # remain roman even when they came from Markdown code spans.
            italic = marked and code_italic and not re.match(r"(?:bash |course[.]|uv |sudo |curl |py |wsl |Get-FileHash|sha256sum|PYTHON_BIN|[.]\\|/)", chunk)
            yield chunk, italic


def _write_rich(tf, text: str, size: int, *, bold: bool = False, color: RGBColor = INK, italic_code: bool = True, align=PP_ALIGN.LEFT) -> None:
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.08)
    tf.margin_top = Inches(0.04)
    tf.margin_bottom = Inches(0.04)
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    for chunk, italic in _chunks(text, code_italic=italic_code):
        run = p.add_run()
        run.text = chunk
        font_size = 18 if size == 18 else size
        _set_run_font(run, font_size, bold=bold, italic=italic, color=color)


def add_text(slide, x: float, y: float, w: float, h: float, text: str, size: int = 24, *, bold: bool = False, color: RGBColor = INK, italic_code: bool = True, align=PP_ALIGN.LEFT, name: str = ""):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name or "Editable text"
    shape.fill.background()
    shape.line.fill.background()
    shape.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    _write_rich(shape.text_frame, text, size, bold=bold, color=color, italic_code=italic_code, align=align)
    return shape


def add_frame(slide, x: float, y: float, w: float, h: float, *, color: RGBColor = NAVY, width: float = 1.2, name: str = "Open frame"):
    shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.background()
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    return shape


def add_circle(slide, x: float, y: float, d: float, *, color: RGBColor = TEAL, name: str = "State marker"):
    shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.color.rgb = color
    return shape


def add_line(slide, x1: float, y1: float, x2: float, y2: float, *, color: RGBColor = NAVY, width: float = 1.2, name: str = "Causal arrow"):
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    shape.name = name
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    shape.line.end_arrowhead = True
    return shape


def add_title(slide, title: str) -> object:
    title_shape = None
    for shape in slide.shapes:
        if not shape.is_placeholder:
            continue
        name = shape.name.lower()
        if "title" in name or "ctrtitle" in name:
            title_shape = shape
            break
    if title_shape is None:
        title_shape = slide.shapes.add_textbox(Inches(0.62), Inches(0.15), Inches(12.1), Inches(0.65))
        title_shape.name = "Native title anchor"
    title_shape.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    _write_rich(title_shape.text_frame, title, 28, bold=True, color=NAVY, italic_code=False)
    return title_shape


def remove_body_placeholders(slide) -> None:
    for shape in list(slide.shapes):
        if shape.is_placeholder:
            name = shape.name.lower()
            if "title" not in name and "ctrtitle" not in name:
                shape._element.getparent().remove(shape._element)


def _cue_text(page: Page) -> tuple[str, str, str]:
    on = _strip_code(page.on_slide)
    if "READY" in on:
        expected = "READY receipt"
    elif "result_path" in on or "stdout" in on or "run --lab" in on:
        expected = "stdout JSON + result_path"
    elif "policy SHA" in on or "freeze" in page.layout.lower():
        expected = "policy SHA + freeze receipt"
    elif "reopen" in on.lower() or "Workbook" in page.title:
        expected = "workbook reopens with provenance"
    elif "mismatch" in page.title.lower() or "fail closed" in page.layout.lower():
        expected = "reject; no partial update"
    else:
        expected = "consequential diff across state / packet / service / J"
    if "IMPLEMENTED NOT VERIFIED" in page.evidence:
        stop = "IMPLEMENTED / NOT VERIFIED；保留錯誤"
    elif "PLACEHOLDER" in page.evidence:
        stop = "EVIDENCE PLACEHOLDER；不得補填"
    else:
        stop = "identity / unit / service 不一致就停止"
    recovery = _strip_code(page.recovery).split("；", 1)[0].split("。", 1)[0]
    recovery = recovery[:54] + ("…" if len(recovery) > 54 else "")
    return expected, stop, recovery


def add_cues(slide, page: Page) -> None:
    operational = bool(re.search(r"bash |course[.]cmd|course[.]sh|uv |setup|verify|run --lab|Get-FileHash|sha256sum|wsl |PYTHON_BIN|\.venv|import|reopen|mismatch|restore|freeze", page.on_slide + page.layout + page.title, re.I))
    if not operational:
        return
    expected, stop, recovery = _cue_text(page)
    x, y, w, h = 0.85, 6.18, 11.65, 0.92
    add_frame(slide, x, y, w, h, color=MUTED, width=0.8, name="Operational cue frame")
    add_text(slide, x + 0.10, y + 0.03, w - 0.20, 0.26, f"EXPECT｜{expected}", 18, color=TEAL, name="Expected state cue")
    add_text(slide, x + 0.10, y + 0.30, w - 0.20, 0.26, f"STOP｜{stop}", 18, color=GOLD, name="Stop cue")
    add_text(slide, x + 0.10, y + 0.57, w - 0.20, 0.27, f"RECOVER｜{recovery}", 18, color=NAVY, name="Recovery cue")


def draw_flow(slide, page: Page) -> None:
    items = split_tokens(page.on_slide, 5)
    y = 2.65
    start = 0.82
    gap = 0.10
    box_w = (11.70 - gap * (len(items) - 1)) / max(1, len(items))
    for i, item in enumerate(items):
        x = start + i * (box_w + gap)
        add_frame(slide, x, y, box_w, 1.15, color=TEAL if i % 2 == 0 else NAVY, name=f"Flow stage {i + 1}")
        add_text(slide, x + 0.05, y + 0.10, box_w - 0.10, 0.95, item, 20, bold=i == 0, align=PP_ALIGN.CENTER, name=f"Flow label {i + 1}")
        if i < len(items) - 1:
            add_line(slide, x + box_w, y + 0.58, x + box_w + gap, y + 0.58, color=GOLD, name="Flow arrow")
    add_text(slide, 0.92, 1.65, 11.5, 0.60, _strip_code(page.visual), 20, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Visual caption")


def draw_compare(slide, page: Page) -> None:
    items = split_tokens(page.on_slide, 4)
    add_text(slide, 0.9, 1.55, 11.5, 0.55, _strip_code(page.visual), 20, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Comparison caption")
    for i in range(2):
        x = 0.90 + i * 6.05
        add_frame(slide, x, 2.20, 5.55, 3.30, color=TEAL if i == 0 else NAVY, name=f"Comparison panel {i + 1}")
        heading = items[i] if i < len(items) else ("baseline" if i == 0 else "candidate")
        add_text(slide, x + 0.15, 2.40, 5.20, 0.65, heading, 24, bold=True, color=TEAL if i == 0 else NAVY, align=PP_ALIGN.CENTER, name=f"Comparison heading {i + 1}")
        body = "\n".join(items[i + 2 :]) if i == 0 and len(items) > 2 else (page.evidence if i == 1 else page.layout)
        add_text(slide, x + 0.20, 3.15, 5.10, 1.95, _strip_code(body), 20, color=INK, name=f"Comparison detail {i + 1}")
    add_line(slide, 6.67, 2.30, 6.67, 5.25, color=GOLD, width=1.8, name="Comparison boundary")


def draw_timeline(slide, page: Page) -> None:
    add_text(slide, 0.90, 1.48, 11.5, 0.70, _strip_code(page.visual), 20, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Timeline caption")
    add_line(slide, 1.15, 3.40, 12.0, 3.40, color=NAVY, width=2.0, name="Service window axis")
    items = split_tokens(page.on_slide, 5)
    positions = [1.10 + i * (10.80 / max(1, len(items) - 1)) for i in range(len(items))]
    for i, (x, item) in enumerate(zip(positions, items)):
        add_circle(slide, x, 3.12, 0.56, color=TEAL if i % 2 == 0 else GOLD, name=f"Timeline point {i + 1}")
        add_text(slide, x - 0.60, 2.20 if i % 2 == 0 else 4.02, 1.75, 0.75, item, 20, align=PP_ALIGN.CENTER, name=f"Timeline label {i + 1}")
    add_frame(slide, 1.15, 5.12, 10.85, 0.55, color=GOLD, width=1.0, name="Timeline service band")
    add_text(slide, 1.30, 5.18, 10.55, 0.40, "service window / action opportunity / endpoint ledger", 18, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Timeline band label")


def draw_terminal(slide, page: Page) -> None:
    items = split_tokens(page.on_slide, 5)
    add_frame(slide, 0.90, 1.55, 8.00, 4.35, color=NAVY, width=1.4, name="Terminal operation frame")
    add_text(slide, 1.10, 1.72, 7.60, 0.35, "copyable operation", 18, color=TEAL, italic_code=False, name="Terminal label")
    command_items = [item for item in items if re.search(r"bash |course[.]|uv |py |sudo |curl |Get-FileHash|sha256sum|wsl |PYTHON_BIN|[.]\\|run --lab", item, re.I)]
    shown = command_items or items[:3]
    y = 2.25
    for i, item in enumerate(shown[:4]):
        add_text(slide, 1.15, y, 7.35, 0.72, _strip_code(item), 18 if len(item) > 60 else 20, color=INK, italic_code=False, name=f"Command line {i + 1}")
        y += 0.82
    add_frame(slide, 9.25, 1.55, 3.05, 4.35, color=TEAL, width=1.1, name="Terminal state rail")
    add_text(slide, 9.48, 1.82, 2.60, 0.55, "state / receipt", 20, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="State rail heading")
    rail = ["input", "run", "result", "recovery"]
    for i, label in enumerate(rail):
        y2 = 2.62 + i * 0.72
        add_circle(slide, 9.60, y2, 0.36, color=GOLD if i == 2 else NAVY, name=f"State rail marker {i + 1}")
        add_text(slide, 10.10, y2 - 0.03, 1.85, 0.40, label, 20, color=INK, italic_code=False, name=f"State rail label {i + 1}")
        if i < len(rail) - 1:
            add_line(slide, 9.78, y2 + 0.36, 9.78, y2 + 0.69, color=MUTED, width=0.9, name="State rail connector")


def draw_formula(slide, page: Page) -> None:
    add_frame(slide, 0.92, 1.55, 11.45, 3.25, color=TEAL, width=1.3, name="Native equation canvas")
    add_text(slide, 1.15, 4.98, 11.0, 0.48, "scope → numerator / denominator → units → evidence", 20, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Equation reading ladder")
    add_text(slide, 1.20, 5.48, 10.9, 0.52, _strip_code(page.on_slide).replace("LaTeX source:", "formula source metadata:"), 18, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Equation metadata cue")


def draw_ladder(slide, page: Page) -> None:
    add_text(slide, 0.95, 1.50, 11.4, 0.62, _strip_code(page.visual), 20, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Ladder caption")
    add_line(slide, 2.10, 2.15, 2.10, 5.55, color=NAVY, width=2.0, name="Ladder spine")
    items = split_tokens(page.on_slide, 5)
    for i, item in enumerate(items):
        y = 2.05 + i * (3.20 / max(1, len(items) - 1))
        add_circle(slide, 1.82, y, 0.56, color=TEAL if i % 2 == 0 else GOLD, name=f"Ladder rung {i + 1}")
        add_frame(slide, 2.65, y - 0.05, 8.85, 0.68, color=TEAL if i % 2 == 0 else NAVY, name=f"Ladder label frame {i + 1}")
        add_text(slide, 2.85, y + 0.02, 8.45, 0.50, item, 22, color=INK, name=f"Ladder label {i + 1}")


def draw_ledger(slide, page: Page) -> None:
    add_text(slide, 0.90, 1.48, 11.5, 0.58, _strip_code(page.visual), 20, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Ledger caption")
    x, y, w, h = 0.92, 2.15, 11.45, 3.55
    add_frame(slide, x, y, w, h, color=NAVY, width=1.3, name="Evidence ledger")
    cols = [0, 2.45, 5.25, 8.10, 11.45]
    rows = [0, 0.74, 1.65, 2.56, 3.55]
    for c in cols[1:-1]:
        add_line(slide, x + c, y, x + c, y + h, color=MUTED, width=0.8, name="Ledger column")
    for r in rows[1:-1]:
        add_line(slide, x, y + r, x + w, y + r, color=MUTED, width=0.8, name="Ledger row")
    items = split_tokens(page.on_slide, 6)
    headers = ["observation", "action", "mechanism", "evidence"]
    for i, (cx, header) in enumerate(zip(cols[:-1], headers)):
        add_text(slide, x + cx + 0.08, y + 0.10, cols[i + 1] - cx - 0.16, 0.40, header, 18, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="Ledger header")
    for i, item in enumerate(items[:4]):
        cx = cols[i]
        add_text(slide, x + cx + 0.10, y + 0.90, cols[i + 1] - cx - 0.20, 1.40, item, 20, color=INK, align=PP_ALIGN.CENTER, name="Ledger value")


def draw_cards(slide, page: Page) -> None:
    add_text(slide, 0.90, 1.48, 11.5, 0.58, _strip_code(page.visual), 20, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Cards caption")
    items = split_tokens(page.on_slide, 4)
    for i in range(3):
        x = 0.90 + i * 4.05
        add_frame(slide, x, 2.20, 3.55, 3.25, color=(TEAL if i == 0 else GOLD if i == 1 else NAVY), width=1.2, name=f"Open card {i + 1}")
        heading = items[i] if i < len(items) else ["input", "mechanism", "verdict"][i]
        add_text(slide, x + 0.15, 2.45, 3.25, 0.65, heading, 24, bold=True, color=TEAL if i == 0 else GOLD if i == 1 else NAVY, align=PP_ALIGN.CENTER, name=f"Card heading {i + 1}")
        body = [page.layout, page.evidence, "recovery / transfer"][i]
        add_text(slide, x + 0.20, 3.30, 3.15, 1.55, _strip_code(body), 19, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name=f"Card body {i + 1}")


def draw_standard(slide, page: Page) -> None:
    add_frame(slide, 0.90, 1.55, 5.10, 4.35, color=TEAL, width=1.2, name="Concept frame")
    add_frame(slide, 6.30, 1.55, 6.00, 4.35, color=NAVY, width=1.2, name="Dominant visual frame")
    add_text(slide, 1.12, 1.82, 4.65, 0.42, "read the mechanism", 20, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="Concept label")
    add_text(slide, 1.15, 2.42, 4.60, 2.90, "\n".join(split_tokens(page.on_slide, 4)), 22, color=INK, name="Concept text")
    add_text(slide, 6.60, 1.82, 5.40, 0.42, "one dominant operation object", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Visual label")
    add_text(slide, 6.72, 2.52, 5.15, 2.40, _strip_code(page.visual), 24, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Visual description")
    add_line(slide, 5.98, 3.65, 6.30, 3.65, color=GOLD, width=1.8, name="Concept to visual arrow")


def add_evidence_image(slide, page: Page, image_path: Path) -> None:
    # Current evidence only; the image is explicitly scoped and never used as
    # a made-up KPI or a live network claim.
    add_text(slide, 6.65, 1.62, 5.25, 0.30, "SERVER PREVIEW / FIXTURE HOST ONLY", 16, color=GOLD, bold=True, align=PP_ALIGN.CENTER, italic_code=False, name="Evidence scope label")
    slide.shapes.add_picture(str(image_path), Inches(6.75), Inches(2.00), width=Inches(5.10), height=Inches(3.15))
    slide.shapes[-1].name = "Current browser-server-preview evidence"


def compose_page(slide, page: Page, image_path: Path | None = None) -> None:
    add_title(slide, page.title)
    remove_body_placeholders(slide)
    if page.archetype == 1:
        draw_timeline(slide, page)
    elif image_path is not None:
        draw_standard(slide, page)
        # Replace the generic right visual with the current scoped evidence.
        for shape in list(slide.shapes):
            if shape.name == "Dominant visual frame" or shape.name in {"Visual label", "Visual description"}:
                shape._element.getparent().remove(shape._element)
        add_evidence_image(slide, page, image_path)
    elif page.archetype == 2:
        draw_terminal(slide, page)
    elif page.archetype == 3:
        draw_flow(slide, page)
    elif page.archetype == 4:
        draw_compare(slide, page)
    elif page.archetype == 5:
        draw_cards(slide, page)
    elif page.archetype == 6 and "equation" in page.layout.lower():
        draw_formula(slide, page)
    elif page.archetype == 6:
        draw_ledger(slide, page)
    else:
        draw_standard(slide, page)
    # Evidence status is visible as a compact, non-footer tag near the title.
    add_text(slide, 9.15, 0.86, 3.20, 0.30, display_evidence(page.evidence), 16, color=GOLD, align=PP_ALIGN.RIGHT, italic_code=False, name="Evidence status tag")
    add_cues(slide, page)


def copy_project_sources() -> None:
    (PROJECT / "sources").mkdir(parents=True, exist_ok=True)
    (PROJECT / "analysis").mkdir(parents=True, exist_ok=True)
    (PROJECT / "exports").mkdir(parents=True, exist_ok=True)
    (PROJECT / "validation").mkdir(parents=True, exist_ok=True)
    (PROJECT / "evidence/browser-server-preview").mkdir(parents=True, exist_ok=True)
    shutil.copy2(SCRIPT_PATH, PROJECT / "sources/full-deck-v2-classroom-script.md")
    shutil.copy2(SAMPLER_PATH, PROJECT / "sources/educate-layout-sampler-v2.pptx")
    if EQUATION_SVG.exists():
        (PROJECT / "assets").mkdir(parents=True, exist_ok=True)
        shutil.copy2(EQUATION_SVG, PROJECT / "assets/energy-equations.svg")
    evidence_root = ROOT / "evidence/browser-server-preview"
    for source in sorted(evidence_root.glob("*.png")):
        shutil.copy2(source, PROJECT / "evidence/browser-server-preview" / source.name)


def run_command(command: list[str], *, cwd: Path, stdout_path: Path | None = None) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=str(cwd), text=True, capture_output=True)
    if stdout_path is not None:
        stdout_path.parent.mkdir(parents=True, exist_ok=True)
        stdout_path.write_text(result.stdout + ("\nSTDERR:\n" + result.stderr if result.stderr else ""), encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}\n{result.stdout}\n{result.stderr}")
    return result


def native_fill(pages: list[Page]) -> Path:
    source = PROJECT / "sources/educate-layout-sampler-v2.pptx"
    library = PROJECT / "analysis/educate-layout-sampler-v2.slide_library.json"
    run_command([sys.executable, str(PPT_MASTER), "analyze", str(source), "-o", str(library)], cwd=ROOT, stdout_path=PROJECT / "analysis/analyze_report.txt")
    plan = build_fill_plan(pages, source)
    plan_path = PROJECT / "analysis/fill_plan.json"
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    run_command([sys.executable, str(PPT_MASTER), "check-plan", str(library), str(plan_path), "-o", str(PROJECT / "analysis/check_report.json")], cwd=ROOT, stdout_path=PROJECT / "analysis/check_report.txt")
    requested = PROJECT / "exports/native-layout-base_20260811_000000.pptx"
    run_command([sys.executable, str(PPT_MASTER), "apply", str(source), str(plan_path), "-o", str(requested)], cwd=ROOT, stdout_path=PROJECT / "analysis/apply_report.txt")
    candidates = sorted(PROJECT.glob("exports/native-layout-base*.pptx"), key=lambda p: p.stat().st_mtime)
    if not candidates:
        raise RuntimeError("Fill Native did not produce a base PPTX")
    base = candidates[-1]
    retained = PROJECT / "validation/native-layout-base.pptx"
    shutil.copy2(base, retained)
    if base.exists() and base.parent == (PROJECT / "exports"):
        base.unlink()
    return retained


def postcompose(base: Path, pages: list[Page]) -> Path:
    prs = Presentation(str(base))
    if len(prs.slides) != 108:
        raise RuntimeError(f"Fill Native base has {len(prs.slides)} slides, expected 108")
    image_map = {
        78: "01-import-panel-initial.png",
        79: "02-endpoint-replay-imported.png",
        81: "02-endpoint-replay-imported.png",
        82: "02-endpoint-replay-imported.png",
        83: "03-workbook-exported.png",
        84: "03-workbook-exported.png",
        85: "04-mismatch-rejected.png",
    }
    for slide, page in zip(prs.slides, pages):
        image = None
        if page.number in image_map:
            candidate = PROJECT / "evidence/browser-server-preview" / image_map[page.number]
            image = candidate if candidate.exists() else None
        compose_page(slide, page, image)
    composed = PROJECT / "validation/post-composed-editable.pptx"
    prs.save(str(composed))
    return composed


def apply_native_equations(input_pptx: Path, pages: list[Page]) -> Path:
    """Use the existing OOXML native-equation tool and patch exact script metadata."""

    tool = ROOT / "insert-native-equations.py"
    current = input_pptx
    for logical_slide in (33, 34):
        output = PROJECT / "validation" / f"formula-slide-{logical_slide}.pptx"
        report = PROJECT / "validation" / f"formula-slide-{logical_slide}.json"
        run_command(
            [sys.executable, str(tool), str(current), str(output), "--logical-slide", str(logical_slide), "--fallback-svg", str(PROJECT / "assets/energy-equations.svg"), "--report", str(report)],
            cwd=ROOT,
            stdout_path=PROJECT / "validation" / f"formula-slide-{logical_slide}.log",
        )
        current = output
    # The reusable proof tool keeps the visually equivalent source strings.
    # This final metadata pass records the exact LaTeX strings authored in the
    # v2 script without changing OMML or its fallback choice.
    patched = PROJECT / "exports/c120-lora-leo-classroom-v2-editable.pptx"
    patch_formula_metadata(current, patched)
    return patched


def patch_formula_metadata(input_pptx: Path, output_pptx: Path) -> None:
    with zipfile.ZipFile(input_pptx, "r") as source:
        members = {info.filename: source.read(info.filename) for info in source.infolist()}
        infos = {info.filename: copy.copy(info) for info in source.infolist()}
    for name, data in list(members.items()):
        if not name.startswith("ppt/slides/slide") or not name.endswith(".xml"):
            continue
        try:
            root = ET.fromstring(data)
        except ET.ParseError:
            continue
        changed = False
        for node in root.findall(f".//{_qn(P_NS, 'cNvPr')}"):
            label = node.get("name", "")
            if "E_endpoint" in label:
                node.set("descr", LATEX_ENDPOINT)
                changed = True
            elif "eta_E" in label:
                node.set("descr", LATEX_EE)
                changed = True
        if changed:
            members[name] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    strip_inherited_footer_parts(members)
    output_pptx.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_pptx, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for name, data in members.items():
            info = infos[name]
            target.writestr(info, data)


def strip_inherited_footer_parts(members: dict[str, bytes]) -> None:
    """Remove template page-number/footer placeholders without changing the theme.

    The educate sampler carries a ``‹#›`` slide-number placeholder on several
    layouts and on the master.  It is inherited even when no slide-level
    footer exists, so removing only slide XML is insufficient for classroom
    output.  The original master/layout parts remain in the package; only the
    page-number/footer shape nodes are pruned.
    """

    for name, data in list(members.items()):
        if not (
            name.startswith("ppt/slides/slide")
            or name.startswith("ppt/slideLayouts/")
            or name.startswith("ppt/slideMasters/")
        ) or not name.endswith(".xml"):
            continue
        try:
            root = ET.fromstring(data)
        except ET.ParseError:
            continue
        changed = False
        candidates = list(root.findall(f".//{_qn(P_NS, 'sp')}"))
        # The educate sampler's authority banner is a bottom ``p:pic`` on
        # every layout (and on the master), not a slide-level shape.  Keep the
        # full-slide wave artwork and top-right logo, but remove this exact
        # bottom strip from inherited structure.
        if name.startswith("ppt/slideLayouts/") or name.startswith("ppt/slideMasters/"):
            candidates.extend(root.findall(f".//{_qn(P_NS, 'pic')}"))
        for sp in candidates:
            ph = sp.find(f"./{_qn(P_NS, 'nvSpPr')}/{_qn(P_NS, 'nvPr')}/{_qn(P_NS, 'ph')}")
            text = "".join(node.text or "" for node in sp.findall(f".//{_qn(A_NS, 't')}"))
            ph_type = ph.get("type", "") if ph is not None else ""
            xfrm = sp.find(f"./{_qn(P_NS, 'spPr')}/{_qn(A_NS, 'xfrm')}")
            if xfrm is None:
                xfrm = sp.find(f"./{_qn(P_NS, 'spPr')}/{_qn(A_NS, 'xfrm')}")
            off = xfrm.find(_qn(A_NS, "off")) if xfrm is not None else None
            ext = xfrm.find(_qn(A_NS, "ext")) if xfrm is not None else None
            try:
                y = int(off.get("y", "0")) if off is not None else 0
                cx = int(ext.get("cx", "0")) if ext is not None else 0
                cy = int(ext.get("cy", "0")) if ext is not None else 0
            except (TypeError, ValueError):
                y, cx, cy = 0, 0, 0
            is_bottom_banner = (name.startswith("ppt/slideLayouts/") or name.startswith("ppt/slideMasters/")) and y >= int(6858000 * 0.80) and cx >= int(12192000 * 0.90) and cy <= int(6858000 * 0.15)
            if ph_type in {"sldNum", "ftr", "dt", "slideNum", "footer", "date"} or "‹#›" in text or is_bottom_banner:
                parent = next((node for node in root.iter() if sp in list(node)), None)
                if parent is not None:
                    parent.remove(sp)
                    changed = True
        if changed:
            members[name] = ET.tostring(root, encoding="utf-8", xml_declaration=True)


def make_render_surrogate(final_pptx: Path) -> Path:
    """Create a clearly labeled fallback-only deck for non-Office renderers.

    LibreOffice in this environment may reject a PPTX containing the native
    ``a14:m`` choice even when an SVG fallback is present.  The authoritative
    editable deck remains untouched; this surrogate replaces only the two
    equation ``mc:AlternateContent`` carriers with the supplied PNG fallback.
    The raw package is opened and re-saved through python-pptx before render so
    the output follows the same normalization path used by the host preview.
    """

    fallback_png = PROJECT / "assets/energy-equations-preview.png"
    if not fallback_png.exists():
        raise RuntimeError(f"missing render fallback: {fallback_png}")
    with zipfile.ZipFile(final_pptx, "r") as source:
        members = {info.filename: source.read(info.filename) for info in source.infolist()}
        infos = {info.filename: copy.copy(info) for info in source.infolist()}
        ordered = _ordered_slide_parts(source)
    members["ppt/media/c120-lora-leo-equations-render-fallback.png"] = fallback_png.read_bytes()
    for logical_slide in (33, 34):
        part = ordered[logical_slide - 1]
        root = ET.fromstring(members[part])
        tree = root.find(f"./{_qn(P_NS, 'cSld')}/{_qn(P_NS, 'spTree')}")
        if tree is None:
            continue
        rels_name = part.rsplit("/", 1)[0] + "/_rels/" + part.rsplit("/", 1)[1] + ".rels"
        rels_root = ET.fromstring(members[rels_name])
        used = {rel.get("Id", "") for rel in rels_root.findall(f"{{{PR_NS}}}Relationship")}
        rid_index = 1
        while f"rIdRender{rid_index}" in used:
            rid_index += 1
        render_rid = f"rIdRender{rid_index}"
        ET.SubElement(rels_root, _qn(PR_NS, "Relationship"), {
            "Id": render_rid,
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
            "Target": "../media/c120-lora-leo-equations-render-fallback.png",
        })
        replaced = False
        for alternate in list(tree.findall(_qn(MC_NS, "AlternateContent"))):
            fallback = alternate.find(_qn(MC_NS, "Fallback"))
            picture = fallback.find(_qn(P_NS, "pic")) if fallback is not None else None
            if picture is None:
                continue
            blip = picture.find(f".//{_qn(A_NS, 'blip')}")
            if blip is None:
                continue
            blip.set(_qn(R_NS, "embed"), render_rid)
            tree.remove(alternate)
            tree.append(picture)
            replaced = True
        if replaced:
            members[part] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            members[rels_name] = ET.tostring(rels_root, encoding="utf-8", xml_declaration=True)
    raw = PROJECT / "validation/render-surrogate-fallback-only-raw.pptx"
    with zipfile.ZipFile(raw, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for name, data in members.items():
            target.writestr(infos.get(name, zipfile.ZipInfo(name)), data)
    repacked_tmp = Path("/tmp/c120-lora-leo-classroom-v2-render-surrogate-repacked.pptx")
    Presentation(str(raw)).save(str(repacked_tmp))
    surrogate = PROJECT / "validation/c120-lora-leo-classroom-v2-render-surrogate.pptx"
    shutil.copy2(repacked_tmp, surrogate)
    report = {
        "schema": "c120-render-surrogate-v1",
        "status": "PASS",
        "authoritative_editable_deck": str(final_pptx),
        "surrogate": str(surrogate),
        "mode": "fallback-only; native equation choices replaced only on logical slides 33 and 34",
        "fallback_png": str(fallback_png),
        "reason": "LibreOffice preview path rejects or cannot render a14:m native choice; final editable PPTX remains authoritative.",
    }
    (PROJECT / "validation/render-surrogate-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return surrogate


def _ordered_slide_parts(z: zipfile.ZipFile) -> list[str]:
    P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    PR = "http://schemas.openxmlformats.org/package/2006/relationships"
    presentation = ET.fromstring(z.read("ppt/presentation.xml"))
    rels = ET.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
    targets = {node.get("Id"): node.get("Target") for node in rels.findall(f"{{{PR}}}Relationship")}
    parts = []
    for node in presentation.findall(f"./{{{P}}}sldIdLst/{{{P}}}sldId"):
        target = targets.get(node.get(f"{{{R}}}id"))
        if target:
            parts.append(os.path.normpath(os.path.join("ppt", target)).replace(os.sep, "/"))
    return parts


def _hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def qa_deck(final_pptx: Path, pages: list[Page], base_template: Path) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    overflow_candidates: list[dict[str, object]] = []
    footer_nodes: list[str] = []
    with zipfile.ZipFile(final_pptx, "r") as deck, zipfile.ZipFile(base_template, "r") as template:
        if deck.testzip():
            errors.append("corrupt ZIP member")
        ordered = _ordered_slide_parts(deck)
        if len(ordered) != 108:
            errors.append(f"slide_count={len(ordered)} expected=108")
        visible = []
        native_math = 0
        exact_latex = set()
        no_bg = 0
        for index, part in enumerate(ordered, start=1):
            root = ET.fromstring(deck.read(part))
            text = "".join(node.text or "" for node in root.findall(f".//{_qn(A_NS, 't')}"))
            visible.append(text)
            if FORBIDDEN_WORD in text:
                errors.append(f"slide {index}: forbidden exact word")
            if MINUTE_RE.search(text):
                errors.append(f"slide {index}: visible minute/duration label")
            if root.find(f"./{_qn(P_NS, 'cSld')}/{_qn(P_NS, 'bg')}") is None:
                no_bg += 1
            else:
                errors.append(f"slide {index}: slide-level background node")
            for sp in root.findall(f"./{_qn(P_NS, 'cSld')}/{_qn(P_NS, 'spTree')}/*"):
                xfrm = sp.find(f"./{_qn(P_NS, 'spPr')}/{_qn(A_NS, 'xfrm')}")
                if xfrm is None:
                    continue
                off = xfrm.find(_qn(A_NS, "off"))
                ext = xfrm.find(_qn(A_NS, "ext"))
                if off is None or ext is None:
                    continue
                try:
                    x, y = int(off.get("x", "0")), int(off.get("y", "0"))
                    cx, cy = int(ext.get("cx", "0")), int(ext.get("cy", "0"))
                except ValueError:
                    continue
                if x < 0 or y < 0 or x + cx > 12192000 or y + cy > 6858000:
                    overflow_candidates.append({"slide": index, "x": x, "y": y, "cx": cx, "cy": cy})
            native_math += len(root.findall(f".//{_qn('http://schemas.microsoft.com/office/drawing/2010/main', 'm')}"))
            for node in root.findall(f".//{_qn(P_NS, 'cNvPr')}"):
                descr = node.get("descr", "")
                if descr in {LATEX_ENDPOINT, LATEX_EE}:
                    exact_latex.add(descr)
        note_parts = [name for name in deck.namelist() if name.startswith("ppt/notesSlides/notesSlide") and name.endswith(".xml")]
        note_texts = []
        for name in note_parts:
            root = ET.fromstring(deck.read(name))
            note_texts.append("".join(node.text or "" for node in root.findall(f".//{_qn(A_NS, 't')}")))
        for index, note in enumerate(note_texts, start=1):
            if FORBIDDEN_WORD in note or MINUTE_RE.search(note):
                errors.append(f"notes {index}: forbidden word/minute")
        if len(note_texts) != 108:
            errors.append(f"notes_count={len(note_texts)} expected=108")
        if native_math < 4:
            errors.append(f"native_math_shapes={native_math} expected>=4")
        if exact_latex != {LATEX_ENDPOINT, LATEX_EE}:
            errors.append("exact LaTeX metadata incomplete")
        for name in sorted(n for n in deck.namelist() if n.startswith("ppt/slideLayouts/") or n.startswith("ppt/slideMasters/")):
            if not name.endswith(".xml"):
                continue
            xml = deck.read(name).decode("utf-8", "ignore")
            if "‹#›" in xml or "sldNum" in xml or "type=\"ftr\"" in xml or "type=\"dt\"" in xml:
                footer_nodes.append(name)
                errors.append(f"inherited footer/page-number node remains: {name}")
        for name in sorted(n for n in template.namelist() if n.startswith("ppt/theme/") or n.startswith("ppt/media/")):
            if name not in deck.namelist() or _hash(template.read(name)) != _hash(deck.read(name)):
                errors.append(f"template asset changed/missing: {name}")
        # Confirm all title anchors remain on each logical slide.
        for index, part in enumerate(ordered, start=1):
            root = ET.fromstring(deck.read(part))
            title = root.find(f".//{_qn(P_NS, 'ph')}[@type='title']")
            if title is None:
                title = root.find(f".//{_qn(P_NS, 'ph')}[@type='ctrTitle']")
            if title is None:
                warnings.append(f"slide {index}: title anchor is not explicit in XML")
        serial = [page.archetype for page in pages]
        longest = 1
        current = 1
        for a, b in zip(serial, serial[1:]):
            current = current + 1 if a == b else 1
            longest = max(longest, current)
        if longest > 2:
            errors.append(f"archetype adjacency longest_run={longest}")
        evidence_files = sorted((PROJECT / "evidence/browser-server-preview").glob("*.png"))
        if [p.name for p in evidence_files] != [
            "01-import-panel-initial.png", "02-endpoint-replay-imported.png", "03-workbook-exported.png", "04-mismatch-rejected.png"
        ]:
            errors.append("evidence image set is not the four current browser-server-preview images")
    report = {
        "schema": "c120-full-deck-v2-qa-v1",
        "status": "PASS" if not errors else "FAIL",
        "input": str(final_pptx),
        "slide_count": len(ordered),
        "notes_count": len(note_texts),
        "native_math_shapes": native_math,
        "exact_latex_metadata": sorted(exact_latex),
        "slide_background_nodes": 108 - no_bg,
        "forbidden_word_or_minutes": len(errors),
        "archetype_longest_run": longest,
        "overflow_candidates": overflow_candidates,
        "inherited_footer_nodes": footer_nodes,
        "errors": errors,
        "warnings": warnings,
        "limitations": [
            "Native Office Math edit/save/reopen in Microsoft PowerPoint is not exercised here; OMML plus an SVG fallback is embedded.",
            "Rendered pixels require human acceptance; contact sheets and targeted page renders are provided.",
        ],
    }
    (PROJECT / "validation/qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def render_and_contacts(final_pptx: Path) -> None:
    render_dir = PROJECT / "validation/render-final"
    render_dir.mkdir(parents=True, exist_ok=True)
    pdf = render_dir / "c120-lora-leo-classroom-v2.pdf"
    soffice = shutil.which("libreoffice")
    if not soffice:
        (PROJECT / "validation/render-status.md").write_text("LibreOffice unavailable; PDF render not produced.\n", encoding="utf-8")
        return
    user_dir = Path("/tmp/c120-lora-leo-render-profile")
    out_dir = Path("/tmp/c120-lora-leo-render-out")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    if user_dir.exists():
        shutil.rmtree(user_dir)
    command = [soffice, f"-env:UserInstallation=file://{user_dir}", "--headless", "--norestore", "--nodefault", "--nolockcheck", "--nofirststartwizard", "--convert-to", "pdf", "--outdir", str(out_dir), str(final_pptx)]
    result = subprocess.run(command, text=True, capture_output=True)
    produced = out_dir / (final_pptx.stem + ".pdf")
    if result.returncode != 0 or not produced.exists():
        surrogate = make_render_surrogate(final_pptx)
        # A host-level rerun may be needed when sandboxed LibreOffice cannot
        # start; keep the exact surrogate path and failure evidence in-project.
        (PROJECT / "validation/render-status.md").write_text(f"LibreOffice native render failed; fallback-only surrogate emitted at {surrogate}.\nstdout={result.stdout}\nstderr={result.stderr}\n", encoding="utf-8")
        return
    shutil.copy2(produced, pdf)
    run_command(["pdftoppm", "-jpeg", "-r", "100", str(pdf), str(render_dir / "slide")], cwd=ROOT)
    images = sorted(render_dir.glob("slide-*.jpg"), key=lambda p: int(re.search(r"(\d+)", p.stem).group(1)))
    if len(images) != 108:
        (PROJECT / "validation/render-status.md").write_text(f"PDF rendered {len(images)} pages; expected 108.\n", encoding="utf-8")
        return
    from PIL import Image, ImageDraw

    contact_dir = PROJECT / "validation/contact-sheets"
    contact_dir.mkdir(parents=True, exist_ok=True)
    thumb_w, thumb_h = 320, 180
    for start in range(0, len(images), 18):
        subset = images[start : start + 18]
        sheet = Image.new("RGB", (thumb_w * 6, (thumb_h + 24) * 3), "white")
        draw = ImageDraw.Draw(sheet)
        for offset, image_path in enumerate(subset):
            image = Image.open(image_path).convert("RGB")
            image.thumbnail((thumb_w, thumb_h))
            x = (offset % 6) * thumb_w
            y = (offset // 6) * (thumb_h + 24)
            sheet.paste(image, (x, y))
            draw.text((x + 4, y + thumb_h + 2), f"P{start + offset + 1:03d}", fill="black")
        sheet.save(contact_dir / f"contact-{start + 1:03d}-{start + len(subset):03d}.jpg", quality=88)
    targeted = list(range(10, 28)) + list(range(43, 50)) + list(range(56, 61)) + list(range(69, 76)) + list(range(77, 89)) + [33, 34, 80, 82, 85, 91, 92, 93, 100, 104, 108]
    lines = ["# Targeted visual review inputs", "", "PDF and 108 page JPEG render completed.", "", "Inspect these setup, command, formula, evidence, and recovery pages at original size:"]
    for number in sorted(set(targeted)):
        lines.append(f"- P{number:03d}: validation/render-final/slide-{number:02d}.jpg")
    (PROJECT / "validation/targeted-visual-review.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_readme(pages: list[Page], final: Path | None = None) -> None:
    text = f"""# C-120 classroom deck v2 native-template project

- Input: `sources/full-deck-v2-classroom-script.md` (P001–P108)
- Native template-fill source: `sources/educate-layout-sampler-v2.pptx`
- Fill Native plan/check/apply evidence: `analysis/fill_plan.json`, `analysis/check_report.json`, `analysis/apply_report.txt`
- Post-compose editable deck: `{final.name if final else 'exports/c120-lora-leo-classroom-v2-editable.pptx'}`
- Speaker notes: 108 embedded notes slides, generated from each page's Notes + Recovery fields
- Template boundary: original master/theme/media/background retained; no slide-level background or footer/page-number shapes
- Evidence images: only the four current files under `evidence/browser-server-preview/`, labeled `SERVER PREVIEW / FIXTURE HOST ONLY` on matching import/replay/workbook/mismatch pages
- QA: `validation/qa_report.json`; PDF and contact sheets under `validation/render-final/` and `validation/contact-sheets/`

The final editable PPTX is the authoritative artifact.  Native Office Math is
present on the formula pages with exact LaTeX metadata and an SVG fallback for
rendering.  Human visual acceptance remains a separate gate.
"""
    (PROJECT / "README.md").write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-render", action="store_true")
    args = parser.parse_args(argv)
    pages = parse_script()
    assign_archetypes(pages)
    copy_project_sources()
    base = native_fill(pages)
    composed = postcompose(base, pages)
    final = apply_native_equations(composed, pages)
    report = qa_deck(final, pages, PROJECT / "sources/educate-layout-sampler-v2.pptx")
    if not args.skip_render:
        render_and_contacts(final)
    else:
        make_render_surrogate(final)
    write_readme(pages, final)
    print(json.dumps({"final": str(final), "qa_status": report["status"], "qa_errors": report["errors"]}, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
