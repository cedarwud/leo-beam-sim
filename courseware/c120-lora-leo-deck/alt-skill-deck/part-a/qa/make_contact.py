from pathlib import Path

from PIL import Image, ImageDraw


root = Path(__file__).resolve().parents[1] / "renders" / "final"
files = sorted(root.glob("slide-*.png"))
out = root / "contact"
out.mkdir(exist_ok=True)
thumb_w = 420
thumb_h = int(thumb_w * 7.5 / 13.3333)
gap = 16
cols = 3
rows = 6
for offset in range(0, len(files), cols * rows):
    chunk = files[offset:offset + cols * rows]
    sheet = Image.new("RGB", (cols * thumb_w + (cols + 1) * gap,
                                rows * thumb_h + (rows + 1) * gap), "#EBEEF1")
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(chunk):
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w, thumb_h))
        x = gap + (i % cols) * (thumb_w + gap)
        y = gap + (i // cols) * (thumb_h + gap)
        sheet.paste(image, (x, y))
        draw.text((x + 6, y + 6), path.stem, fill="#102A43")
    sheet.save(out / f"contact-{offset // (cols * rows) + 1:02d}.png")
