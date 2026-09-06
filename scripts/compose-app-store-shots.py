#!/usr/bin/env python3
"""Compose App Store marketing frames from live simulator captures.

Paper-journal frames (cream + ink), not pastel marketing templates.
Outputs 6.5" (1284×2778) and 6.9" (1320×2868).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from paper_frame import (
    ROOT,
    INK,
    INK_SOFT,
    PAPER,
    WATER_LIGHT,
    draw_centered,
    gothic,
    make_phone,
    myungjo,
    paper_canvas,
    round_icon,
)

LIVE = ROOT / "docs/app-store/screenshots/live"
OUT_65 = ROOT / "docs/app-store/screenshots/1284x2778"
OUT_69 = ROOT / "docs/app-store/screenshots/1320x2868"

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
