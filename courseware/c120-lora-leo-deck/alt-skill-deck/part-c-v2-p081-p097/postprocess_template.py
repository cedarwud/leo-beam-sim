#!/usr/bin/env python3
"""Apply the exact educate template parts and force slideLayout2 ownership."""

from __future__ import annotations

import posixpath
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
PPTX = Path(
    __import__("os").environ.get(
        "C120_OUTPUT",
        str(ROOT.parent / "latest" / "LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW.pptx"),
    )
).resolve()
TEMPLATE = next(
    (
        candidate
        for candidate in (
            Path("/home/u24/pptx-wrap/assets/templates/educate.pptx"),
            Path("/home/sat/pptx-wrap/assets/templates/educate.pptx"),
        )
        if candidate.is_file()
    ),
    Path("/home/u24/pptx-wrap/assets/templates/educate.pptx"),
)
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


def copy_tree(src_root: Path, dst_root: Path, relative: str) -> None:
    source = src_root / relative
    target = dst_root / relative
    if relative != "ppt/media" and target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target, dirs_exist_ok=relative == "ppt/media")


def patch_slide_relationships(root: Path) -> None:
    rel_dir = root / "ppt/slides/_rels"
    for rel_path in sorted(rel_dir.glob("slide*.xml.rels")):
        tree = ET.parse(rel_path)
        changed = False
        for rel in tree.getroot().findall(f"{{{REL_NS}}}Relationship"):
            if rel.get("Type", "").endswith("/slideLayout"):
                rel.set("Target", "../slideLayouts/slideLayout2.xml")
                changed = True
        if changed:
            tree.write(rel_path, encoding="utf-8", xml_declaration=True)


def normalize_presentation_order(root: Path) -> None:
    """Restore the schema order used by the educate template.

    The managed PptxGenJS export used by this lane placed ``notesMasterIdLst``
    after ``sldIdLst``.  PowerPoint's presentation schema requires the notes
    master list immediately after the slide-master list.  Reordering the
    existing nodes keeps all slide and note relationships intact while making
    the package acceptable to Office validators.
    """
    presentation = root / "ppt/presentation.xml"
    tree = ET.parse(presentation)
    pres = tree.getroot()
    order = ("sldMasterIdLst", "notesMasterIdLst", "sldIdLst", "sldSz", "notesSz", "defaultTextStyle")
    children = {local: [] for local in order}
    other = []
    for child in list(pres):
        local = child.tag.rsplit("}", 1)[-1]
        if local in children:
            children[local].append(child)
        else:
            other.append(child)
    for child in list(pres):
        pres.remove(child)
    for local in order:
        for child in children[local]:
            pres.append(child)
    for child in other:
        pres.append(child)
    tree.write(presentation, encoding="utf-8", xml_declaration=True)


def sync_content_types(root: Path, template_root: Path) -> None:
    """Build content-type overrides from the clean template plus authored parts.

    The generated CJS package carried stale overrides for removed slide
    masters/layouts and omitted the template's notes theme.  Start with the
    exact template manifest, then add the authored slide/note parts that exist
    in the rebuilt package.  This deliberately leaves the template's layout
    family present but every authored slide still points only to layout 2.
    """
    types_path = root / "[Content_Types].xml"
    template_types_path = template_root / "[Content_Types].xml"
    types = ET.parse(template_types_path).getroot()
    existing = {node.get("PartName") for node in types.findall(f"{{{CT_NS}}}Override")}

    slide_ct = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
    notes_ct = "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"
    for pattern, content_type in (("ppt/slides/slide*.xml", slide_ct), ("ppt/notesSlides/notesSlide*.xml", notes_ct)):
        for part in sorted(root.glob(pattern), key=lambda p: int(re.search(r"(\d+)", p.stem).group(1))):
            part_name = "/" + part.relative_to(root).as_posix()
            if part_name in existing:
                continue
            node = ET.Element(f"{{{CT_NS}}}Override", PartName=part_name, ContentType=content_type)
            types.append(node)
            existing.add(part_name)
    ET.register_namespace("", CT_NS)
    ET.ElementTree(types).write(types_path, encoding="utf-8", xml_declaration=True)


def remove_unreferenced_generated_media(root: Path) -> None:
    """Remove image fragments left by the failed CJS image deduplication path."""
    referenced: set[str] = set()
    for rel_path in (root / "ppt").rglob("*.rels"):
        tree = ET.parse(rel_path)
        rel_dir = rel_path.parent
        rel_name = rel_path.name
        source_name = rel_dir.parent / rel_name[:-5]
        source_part = source_name.relative_to(root).as_posix()
        base = posixpath.dirname(source_part)
        for rel in tree.getroot().findall(f"{{{REL_NS}}}Relationship"):
            if rel.get("TargetMode") == "External":
                continue
            target = rel.get("Target", "")
            referenced.add(posixpath.normpath(posixpath.join(base, target)).lstrip("/"))
    media_dir = root / "ppt/media"
    for media in media_dir.glob("*"):
        if media.is_file() and media.relative_to(root).as_posix() not in referenced:
            media.unlink()


def normalize_slide_authored_typography(root: Path) -> None:
    """Normalize authored runs to the course's bilingual font contract.

    PptxGenJS writes the selected ``fontFace`` into both the Latin and East
    Asian slots.  That makes a Chinese run advertise 標楷體 as its Latin font
    and an English run advertise Times New Roman as its East Asian font.  The
    other V2 lanes use the stable pair on every run, letting Office choose the
    correct glyph face by script: Times New Roman for Latin/complex script and
    標楷體 for East Asian text.

    The generated runtime also leaves empty body/slide-number placeholders on
    each slide.  They are not authored content and their inherited 14 pt
    default can be reported as a text-floor violation.  Keep the title shell,
    remove the empty extras, and let the template master retain the footer.
    """
    ET.register_namespace("a", A_NS)
    ET.register_namespace("p", P_NS)
    for slide_path in sorted((root / "ppt/slides").glob("slide*.xml")):
        tree = ET.parse(slide_path)
        slide = tree.getroot()
        for sp in list(slide.findall(f".//{{{P_NS}}}sp")):
            ph = sp.find(f".//{{{P_NS}}}ph")
            if ph is not None and ph.get("type") != "title":
                parent = next((node for node in slide.iter() if sp in list(node)), None)
                if parent is not None:
                    parent.remove(sp)
        for rpr in slide.iter(f"{{{A_NS}}}rPr"):
            latin = rpr.find(f"{{{A_NS}}}latin")
            ea = rpr.find(f"{{{A_NS}}}ea")
            cs = rpr.find(f"{{{A_NS}}}cs")
            if latin is not None:
                latin.set("typeface", "Times New Roman")
            if ea is not None:
                ea.set("typeface", "標楷體")
            if cs is not None:
                cs.set("typeface", "Times New Roman")
        for def_rpr in slide.iter(f"{{{A_NS}}}defRPr"):
            # The only authored default in these slides is the removable
            # slide-number placeholder; retain a safe footer-sized minimum if
            # a template-derived default remains in a custom text body.
            if def_rpr.get("sz") == "1400":
                def_rpr.set("sz", "1600")
            latin = def_rpr.find(f"{{{A_NS}}}latin")
            ea = def_rpr.find(f"{{{A_NS}}}ea")
            cs = def_rpr.find(f"{{{A_NS}}}cs")
            if latin is not None:
                latin.set("typeface", "Times New Roman")
            if ea is not None:
                ea.set("typeface", "標楷體")
            if cs is not None:
                cs.set("typeface", "Times New Roman")
        tree.write(slide_path, encoding="utf-8", xml_declaration=True)


def make_creation_ids_unique(root: Path) -> None:
    """Avoid repeated p14 creationId values emitted by the managed runtime."""
    for index, slide_path in enumerate(sorted((root / "ppt/slides").glob("slide*.xml")), start=1):
        tree = ET.parse(slide_path)
        for node in tree.getroot().iter():
            if node.tag.rsplit("}", 1)[-1] == "creationId":
                node.set("val", str(2000000000 + index))
        tree.write(slide_path, encoding="utf-8", xml_declaration=True)
    for index, note_path in enumerate(sorted((root / "ppt/notesSlides").glob("notesSlide*.xml")), start=1):
        tree = ET.parse(note_path)
        for node in tree.getroot().iter():
            if node.tag.rsplit("}", 1)[-1] == "creationId":
                node.set("val", str(3000000000 + index))
        tree.write(note_path, encoding="utf-8", xml_declaration=True)


def main() -> None:
    if not PPTX.is_file():
        raise SystemExit(f"missing output: {PPTX}")
    with tempfile.TemporaryDirectory(prefix="c120-partc-template-") as temp_name:
        temp = Path(temp_name)
        generated = temp / "generated"
        template = temp / "template"
        generated.mkdir()
        template.mkdir()
        with zipfile.ZipFile(PPTX) as archive:
            archive.extractall(generated)
        with zipfile.ZipFile(TEMPLATE) as archive:
            archive.extractall(template)

        for relative in (
            "ppt/slideLayouts",
            "ppt/slideMasters",
            "ppt/theme",
            "ppt/notesMasters",
            "ppt/media",
        ):
            copy_tree(template, generated, relative)
        patch_slide_relationships(generated)
        normalize_presentation_order(generated)
        sync_content_types(generated, template)
        remove_unreferenced_generated_media(generated)
        normalize_slide_authored_typography(generated)
        make_creation_ids_unique(generated)

        patched = PPTX.with_suffix(".template-overlay.pptx")
        with zipfile.ZipFile(patched, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(generated.rglob("*")):
                if path.is_file():
                    archive.write(path, path.relative_to(generated).as_posix())
        patched.replace(PPTX)
    print(PPTX)


if __name__ == "__main__":
    main()
