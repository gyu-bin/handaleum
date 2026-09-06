"""Shared paper-journal frame kit for 한달음 marketing images.

Cream paper + ink, Myungjo titles, a survey-card phone bezel. Used by
compose-app-store-shots.py (store frames) and compose-instagram-shots.py
(feed carousel) so both outputs read as one brand.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
GRAIN = ROOT / "assets/map/paper-grain.png"
ICON = ROOT / "assets/images/icon.png"

GOTHIC = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
MYUNGJO = "/System/Library/Fonts/Supplemental/AppleMyungjo.ttf"

# Dawn Survey tokens
PAPER = (247, 241, 232)
SURFACE = (255, 251, 245)
INK = (44, 62, 80)
INK_SOFT = (90, 107, 122)
SUBTLE = (147, 161, 173)
WATER = (203, 224, 239)
WATER_LIGHT = (220, 234, 244)
LAND_DEEP = (235, 228, 216)
BEZEL = (51, 71, 91)


def gothic(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(GOTHIC, size=size, index=index)


def myungjo(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(MYUNGJO, size=size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255
    )
    return mask


def tile_grain(size: tuple[int, int]) -> Image.Image:
    src = Image.open(GRAIN).convert("L")
    tiled = Image.new("L", size)
    gw, gh = src.size
    for y in range(0, size[1], gh):
        for x in range(0, size[0], gw):
            tiled.paste(src, (x, y))
    return tiled


def paper_canvas(w: int, h: int, wash: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGB", (w, h), PAPER)
    blob = Image.new("RGB", (w, h), PAPER)
    bdraw = ImageDraw.Draw(blob)
    # Dawn horizon — a soft water wash sitting under the phone.
    bdraw.ellipse((-int(w * 0.18), int(h * 0.42), int(w * 1.18), int(h * 1.12)), fill=wash)
    blob = blob.filter(ImageFilter.GaussianBlur(radius=int(h * 0.08)))
    canvas = Image.blend(canvas, blob, 0.55)
    grain = Image.merge("RGB", [tile_grain((w, h))] * 3)
    canvas = Image.blend(canvas, ImageChops.multiply(canvas, grain), 0.11)
    return canvas


def draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: float,
    font_obj: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    canvas_w: int,
    line_gap: int,
) -> float:
    cy = y
    for line in text.split("\n"):
        bbox = draw.textbbox((0, 0), line, font=font_obj)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text(((canvas_w - tw) / 2, cy), line, font=font_obj, fill=fill)
        cy += th + line_gap
    return cy


def round_icon(size: int) -> Image.Image:
    icon = Image.open(ICON).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    icon.putalpha(rounded_mask((size, size), int(size * 0.22)))
    return icon


def make_phone(screen: Image.Image, inner_w: int, s: float) -> tuple[Image.Image, Image.Image]:
    scale = inner_w / screen.width
    inner_h = int(screen.height * scale)
    screen = screen.resize((inner_w, inner_h), Image.Resampling.LANCZOS)

    bezel = max(10, int(14 * s))
    radius = max(48, int(64 * s))
    frame_w = inner_w + bezel * 2
    frame_h = inner_h + bezel * 2

    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(frame)
    fdraw.rounded_rectangle((0, 0, frame_w - 1, frame_h - 1), radius=radius, fill=(*BEZEL, 255))
    # Inner highlight — paper rim, like a survey card edge.
    inset = max(2, int(3 * s))
    fdraw.rounded_rectangle(
        (inset, inset, frame_w - 1 - inset, frame_h - 1 - inset),
        radius=radius - inset,
        outline=(*LAND_DEEP, 180),
        width=max(1, int(1.5 * s)),
    )

    screen_masked = Image.new("RGBA", screen.size)
    screen_masked.paste(screen, (0, 0))
    screen_masked.putalpha(rounded_mask(screen.size, radius - bezel + 2))
    frame.paste(screen_masked, (bezel, bezel), screen_masked)

    pad = int(64 * s)
    shadow = Image.new("RGBA", (frame_w + pad * 2, frame_h + pad * 2), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        (int(pad * 0.45), int(pad * 0.7), frame_w + int(pad * 1.35), frame_h + int(pad * 1.45)),
        radius=radius + 8,
        fill=(44, 62, 80, 36),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(18 * s)))
    return frame, shadow
