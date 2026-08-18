#!/usr/bin/env python3
"""Build labelled contact sheets from the original-size slide renders."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size: int):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ):
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_sheet(render_dir: Path, out_dir: Path, deck_id: str, start: int, end: int) -> Path:
    cell_w, cell_h = 320, 200
    cols, rows = 4, 5
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "#101923")
    draw = ImageDraw.Draw(sheet)
    label_font = font(16)
    small_font = font(12)
    for offset, slide_no in enumerate(range(start, end + 1)):
        path = render_dir / f"slide-{slide_no:03d}.png"
        x = (offset % cols) * cell_w
        y = (offset // cols) * cell_h
        if path.is_file():
            image = Image.open(path).convert("RGB")
            image.thumbnail((cell_w - 12, 166), Image.Resampling.LANCZOS)
            ix = x + (cell_w - image.width) // 2
            iy = y + 28 + (166 - image.height) // 2
            sheet.paste(image, (ix, iy))
            draw.rectangle((x + 2, y + 2, x + cell_w - 3, y + cell_h - 3), outline="#59758b", width=1)
            draw.text((x + 8, y + 6), f"{slide_no:03d}", fill="#f4c56e", font=label_font)
            draw.text((x + 50, y + 8), path.name, fill="#a8bbc9", font=small_font)
        else:
            draw.rectangle((x + 2, y + 2, x + cell_w - 3, y + cell_h - 3), outline="#a33a4e", width=2)
            draw.text((x + 8, y + 8), f"{slide_no:03d} MISSING", fill="#ff7b8e", font=label_font)
    output = out_dir / f"{deck_id}-{start:03d}-{end:03d}.jpg"
    sheet.save(output, quality=92, optimize=True)
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    out_dir = args.root / "contact-sheets"
    out_dir.mkdir(parents=True, exist_ok=True)
    for deck_id in ("e2", "delivery"):
        render_dir = args.root / "renders" / deck_id
        for start in range(1, 115, 20):
            end = min(start + 19, 114)
            make_sheet(render_dir, out_dir, deck_id, start, end)


if __name__ == "__main__":
    main()
