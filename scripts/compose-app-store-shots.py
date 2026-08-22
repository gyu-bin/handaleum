#!/usr/bin/env python3
"""Compose App Store marketing frames from live simulator captures.

Paper-journal frames (cream + ink), not pastel marketing templates.
Outputs 6.5" (1284×2778) and 6.9" (1320×2868).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / "docs/app-store/screenshots/live"
OUT_65 = ROOT / "docs/app-store/screenshots/1284x2778"
OUT_69 = ROOT / "docs/app-store/screenshots/1320x2868"
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

SHOTS = [
    {
        "src": "01-home.png",
        "out": "01-home.png",
        "wash": WATER_LIGHT,
        "eyebrow": "한달음",
        "title": "한 달의 사진이\n지도가 됩니다",
        "sub": "위치 있는 사진만으로 이번 달 지도를 그립니다",
    },
    {
        "src": "02-months.png",
        "out": "02-months.png",
        "wash": (245, 232, 220),
        "eyebrow": "한달음",
        "title": "지난 달을\n다시 펼칩니다",
        "sub": "달마다 쌓이는 사진 일기",
    },
    {
        "src": "03-playback.png",
        "out": "03-playback.png",
        "wash": (242, 236, 214),
        "eyebrow": "한달음",
        "title": "흩어진 하루를\n한곳에",
        "sub": "몰아보기로 한 달을 다시 따라갑니다",
    },
    {
        "src": "04-stamps.png",
        "out": "04-stamps.png",
        "wash": (226, 232, 238),
        "eyebrow": "한달음",
        "title": "동네마다\n발도장",
        "sub": "발 닿은 동마다 하나씩",
    },
    {
        "src": "05-card.png",
        "out": "05-card.png",
        "wash": (232, 238, 228),
        "eyebrow": "한달음",
        "title": "한 달을\n한눈에",
        "sub": "곳마다 모아 둔 그달의 회고",
    },
]

SIZES = [
    (1284, 2778, OUT_65),
    (1320, 2868, OUT_69),
]


def gothic(size: int, index: int) -> ImageFont.FreeTypeFont:
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


def compose(shot: dict, w: int, h: int, out_dir: Path) -> None:
    s = w / 1284
    canvas = paper_canvas(w, h, shot["wash"])
    draw = ImageDraw.Draw(canvas)

    title_font = myungjo(int(72 * s))
    sub_font = gothic(int(30 * s), index=2)
    mark_font = myungjo(int(28 * s))

    icon_s = int(52 * s)
    icon = round_icon(icon_s)
    mark = shot["eyebrow"]
    mark_bb = draw.textbbox((0, 0), mark, font=mark_font)
    mark_w = mark_bb[2] - mark_bb[0]
    mark_h = mark_bb[3] - mark_bb[1]
    gap = int(14 * s)
    brand_w = icon_s + gap + mark_w
    brand_x = (w - brand_w) // 2
    brand_y = int(96 * s)

    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(icon, (brand_x, brand_y))
    draw = ImageDraw.Draw(canvas_rgba)
    text_y = brand_y + (icon_s - mark_h) / 2 - mark_bb[1]
    draw.text((brand_x + icon_s + gap, text_y), mark, font=mark_font, fill=INK)

    rule_y = brand_y + icon_s + int(28 * s)
    rule_w = int(72 * s)
    draw.line(
        ((w - rule_w) / 2, rule_y, (w + rule_w) / 2, rule_y),
        fill=(*INK, 80),
        width=max(1, int(1.5 * s)),
    )

    title_y = rule_y + int(36 * s)
    title_y = draw_centered(draw, shot["title"], title_y, title_font, INK, w, int(10 * s))
    title_y += int(20 * s)
    draw_centered(draw, shot["sub"], title_y, sub_font, INK_SOFT, w, int(8 * s))

    screen = Image.open(LIVE / shot["src"]).convert("RGB")
    inner_w = int(940 * s)
    frame, shadow = make_phone(screen, inner_w, s)

    phone_top = int(title_y + 86 * s)
    # Bleed the device off the bottom so the frame feels like a desk photo.
    px = (w - frame.width) // 2
    shx = px - (shadow.width - frame.width) // 2
    shy = phone_top - (shadow.height - frame.height) // 2 + int(12 * s)
    canvas_rgba.alpha_composite(shadow, (shx, shy))
    canvas_rgba.alpha_composite(frame, (px, phone_top))

    # Soft sheet edge at the bottom — keep the tab bar readable.
    fade_h = int(56 * s)
    fade = Image.new("L", (w, fade_h), 0)
    fdraw = ImageDraw.Draw(fade)
    for i in range(fade_h):
        fdraw.line((0, i, w, i), fill=int(140 * (i / fade_h) ** 2.2))
    paper_band = Image.new("RGBA", (w, fade_h), (*PAPER, 255))
    paper_band.putalpha(fade)
    canvas_rgba.alpha_composite(paper_band, (0, h - fade_h))

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / shot["out"]
    canvas_rgba.convert("RGB").save(out_path, "PNG", optimize=True)
    print("wrote", out_path)


def main() -> None:
    for w, h, out_dir in SIZES:
        for shot in SHOTS:
            compose(shot, w, h, out_dir)


if __name__ == "__main__":
    main()
