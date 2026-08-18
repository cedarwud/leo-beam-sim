#!/usr/bin/env python3
"""Build labeled contact sheets from the already-rendered 144 dpi slides."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
RENDER_DIR = HERE / "final-render"
OUTPUT_DIR = RENDER_DIR / "contact-sheets"
COLS = 3
ROWS = 4
THUMB_W = 420
PAD = 16
LABEL_H = 30


def main() -> None:
    slides = sorted(RENDER_DIR.glob("slide-*.png"))
    if len(slides) != 116:
        raise SystemExit(f"expected 116 slide renders, found {len(slides)}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=20)

    for sheet_index, start in enumerate(range(0, len(slides), COLS * ROWS), start=1):
        chunk = slides[start:start + COLS * ROWS]
        with Image.open(chunk[0]) as sample:
            thumb_h = round(THUMB_W * sample.height / sample.width)
        canvas = Image.new(
            "RGB",
            (COLS * THUMB_W + (COLS + 1) * PAD,
             ROWS * (thumb_h + LABEL_H) + (ROWS + 1) * PAD),
            "white",
        )
        draw = ImageDraw.Draw(canvas)
        for offset, path in enumerate(chunk):
            row, col = divmod(offset, COLS)
            x = PAD + col * (THUMB_W + PAD)
            y = PAD + row * (thumb_h + LABEL_H + PAD)
            with Image.open(path) as image:
                thumb = image.convert("RGB").resize((THUMB_W, thumb_h), Image.Resampling.LANCZOS)
            canvas.paste(thumb, (x, y + LABEL_H))
            logical_number = start + offset + 1
            draw.text((x, y + 3), f"Slide {logical_number:03d}", fill="black", font=font)
        output = OUTPUT_DIR / f"contact-{sheet_index:02d}.jpg"
        canvas.save(output, "JPEG", quality=94)

    print(f"created {sheet_index} contact sheets in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
