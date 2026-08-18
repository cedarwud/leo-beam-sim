#!/usr/bin/env python3
"""Create labeled contact sheets from an existing rendered slide directory."""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def slide_number(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    return int(match.group(1)) if match else 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-dir", required=True, type=Path)
    parser.add_argument("--output-prefix", required=True, type=Path)
    parser.add_argument("--cols", type=int, default=6)
    parser.add_argument("--rows", type=int, default=3)
    parser.add_argument("--thumb-width", type=int, default=260)
    args = parser.parse_args()

    paths = sorted(args.render_dir.glob("slide-*.jpg"), key=slide_number)
    if not paths:
        raise SystemExit("no slide JPG renders found")

    sample = Image.open(paths[0])
    ratio = sample.height / sample.width
    thumb_h = round(args.thumb_width * ratio)
    label_h = 28
    gap = 10
    per_sheet = args.cols * args.rows
    sheet_count = math.ceil(len(paths) / per_sheet)
    font = ImageFont.load_default()
    args.output_prefix.parent.mkdir(parents=True, exist_ok=True)

    for sheet_index in range(sheet_count):
        batch = paths[sheet_index * per_sheet : (sheet_index + 1) * per_sheet]
        width = gap + args.cols * (args.thumb_width + gap)
        height = gap + args.rows * (thumb_h + label_h + gap)
        sheet = Image.new("RGB", (width, height), "#E8E8E8")
        draw = ImageDraw.Draw(sheet)
        for index, path in enumerate(batch):
            row, col = divmod(index, args.cols)
            x = gap + col * (args.thumb_width + gap)
            y = gap + row * (thumb_h + label_h + gap)
            with Image.open(path) as image:
                thumb = image.convert("RGB").resize((args.thumb_width, thumb_h))
            sheet.paste(thumb, (x, y + label_h))
            draw.text((x + 4, y + 7), f"Slide {slide_number(path):03d}", fill="#111111", font=font)
        suffix = f"-{sheet_index + 1:02d}.jpg"
        output = args.output_prefix.with_name(args.output_prefix.name + suffix)
        sheet.save(output, quality=90)
        print(output)


if __name__ == "__main__":
    main()
