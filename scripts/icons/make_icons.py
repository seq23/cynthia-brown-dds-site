#!/usr/bin/env python3
"""Regenerate the site's icon set from the brand palette. Run by hand when the
brand changes; the build only copies the committed PNGs in assets/icons/.

    python3 scripts/icons/make_icons.py

Brand: hunter #143d2c ground, cream #fbf6ee monogram (assets/css/styles.css).
Writes favicon.ico (16/32/48), icon-192.png, icon-512.png, apple-touch-icon.png
(180, opaque, no transparency: iOS composites transparent icons on black).
"""
import os
from PIL import Image, ImageDraw, ImageFont

HUNTER = (20, 61, 44, 255)
CREAM = (251, 246, 238, 255)
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "icons")
FONT = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"


def tile(size, pad_ratio=0.0):
    """A hunter-green square with a cream 'CB' monogram, drawn at 4x and downsampled."""
    s = size * 4
    im = Image.new("RGBA", (s, s), HUNTER)
    d = ImageDraw.Draw(im)
    if pad_ratio:  # a cream hairline inset, so the mark reads as a plate on light ground
        inset = int(s * pad_ratio)
        d.rectangle([inset, inset, s - inset - 1, s - inset - 1], outline=CREAM, width=max(1, s // 64))
    font = ImageFont.truetype(FONT, int(s * 0.52))
    box = d.textbbox((0, 0), "CB", font=font)
    d.text(((s - box[2] - box[0]) / 2, (s - box[3] - box[1]) / 2 - s * 0.01), "CB", font=font, fill=CREAM)
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png")):
        tile(size, 0.06).save(os.path.join(OUT, name), optimize=True)
    # apple-touch-icon: opaque RGB, no inset hairline (iOS applies its own mask).
    tile(180).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
    tile(512, 0.06).save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png to assets/icons/")


if __name__ == "__main__":
    main()
