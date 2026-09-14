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
        "out": "01-map.png",
        "wash": WATER_LIGHT,
        "eyebrow": "한달음",
        "title": "한 달의 순간을,\n지도 위에.",
        "sub": "사진이 남긴 장소를 따라, 지금의 하루가 특별한 한 달이 됩니다.",
    },
    {
        "src": "03-playback.png",
        "out": "02-playback.png",
        "wash": (242, 236, 214),
        "eyebrow": "한달음",
        "title": "시간순으로 돌아보는\n나의 기록.",
        "sub": "흩어진 하루를 몰아보기로 한곳에 모읍니다.",
    },
    {
        "src": "05-card.png",
        "out": "03-recap.png",
        "wash": (232, 238, 228),
        "eyebrow": "한달음",
        "title": "한 달의 여정을\n한눈에.",
        "sub": "방문한 곳과 사진을 한 화면에서 돌아봅니다.",
    },
    {
        "src": "04-stamps.png",
        "out": "04-stamps.png",
        "wash": (226, 232, 238),
        "eyebrow": "한달음",
        "title": "가본 곳이 늘어갈수록\n완성되는 발도장.",
        "sub": "발 닿은 동네마다 하나씩 찍힙니다.",
    },
    {
        "src": "02-months.png",
        "out": "05-months.png",
        "wash": (245, 232, 220),
        "eyebrow": "한달음",
        "title": "원하는 월을\n골라보세요.",
        "sub": "달마다 쌓인 기록을 다시 펼칩니다.",
    },
    {
        "src": "06-settings.png",
        "out": "06-settings.png",
        "wash": (238, 234, 228),
        "eyebrow": "한달음",
        "title": "나에게 맞게\n설정해보세요.",
        "sub": "사진·집·알림을 내 방식대로 맞춥니다.",
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
