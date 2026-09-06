#!/usr/bin/env python3
"""Compose the Instagram feed carousel for 한달음.

Six slides, 1080×1350 (4:5). Real app captures from
docs/app-store/screenshots/live/ dropped into the same paper-journal
frame as the App Store shots (see paper_frame.py). Dummy data only —
the live captures already run on the __DEV__ nationwide sample album.

Run:  scripts/.venv/bin/python3 scripts/compose-instagram-shots.py
Out:  docs/instagram/carousel/01..06.png
"""

from __future__ import annotations

from PIL import Image, ImageDraw, ImageEnhance

from paper_frame import (
    ROOT,
    INK,
    INK_SOFT,
    PAPER,
    SUBTLE,
    WATER_LIGHT,
    gothic,
    make_phone,
    myungjo,
    paper_canvas,
    round_icon,
)

LIVE = ROOT / "docs/app-store/screenshots/live"
KOREA = ROOT / "assets/images/korea-illustrated-map.png"
OUT = ROOT / "docs/instagram/carousel"

W, H = 1080, 1350
S = W / 1080  # authored at 1080; kept for parity with the store script

BRAND = "한달음"
HANDLE = "@handaleum"  # TODO: confirm real handle
STORE_LINE = "App Store에서 ‘한달음’ 검색"  # TODO: swap for real link / badge

# Hook headline — "A가 아니다, B다" positioning line. LINE1 sets up, LINE2 lands.
HOOK_LINE1 = "카메라롤이 아니다"
HOOK_LINE2 = "한 달의 지도다"
HOOK_CAPTION = "매달, 사진으로 쓰는 한 장짜리 일기"

# Screenshot slides. wash tints the dawn wash behind the phone.
SHOTS = [
    {
        "out": "02-map.png",
        "src": "01-home.png",
        "wash": WATER_LIGHT,
        "eyebrow": "지도",
        "title": "한 달의 사진이\n지도가 됩니다",
        "sub": "위치 있는 사진만 모아 그달의 동선을",
    },
    {
        "out": "03-playback.png",
        "src": "03-playback.png",
        "wash": (242, 236, 214),
        "eyebrow": "몰아보기",
        "title": "흩어진 하루를\n한곳에서",
        "sub": "장소별로 다시 따라가는 한 달",
    },
    {
        "out": "04-stamps.png",
        "src": "04-stamps.png",
        "wash": (226, 232, 238),
        "eyebrow": "발도장",
        "title": "발 닿은 동네마다\n도장 하나",
        "sub": "서울 25구, 전국 곳곳",
    },
    {
        "out": "05-card.png",
        "src": "05-card.png",
        "wash": (232, 238, 228),
        "eyebrow": "회고 카드",
        "title": "한 달을\n카드 한 장으로",
        "sub": "그대로 인스타에 올릴 수 있게",
    },
]

TOTAL = len(SHOTS) + 2  # hook + shots + cta


def korea_watermark(canvas: Image.Image, opacity: float, scale: float, dy: int) -> Image.Image:
    """Faint illustrated-peninsula motif, bottom-anchored."""
    src = Image.open(KOREA).convert("RGB")
    tw = int(W * scale)
    th = int(src.height * (tw / src.width))
    src = src.resize((tw, th), Image.Resampling.LANCZOS)
    src = ImageEnhance.Color(src).enhance(0.45)
    src = ImageEnhance.Brightness(src).enhance(1.06)
    layer = src.convert("RGBA")
    layer.putalpha(int(255 * opacity))
    out = canvas.convert("RGBA")
    out.alpha_composite(layer, ((W - tw) // 2, H - th + dy))
    return out


def draw_center(draw: ImageDraw.ImageDraw, text: str, y: float, font, fill, gap: float) -> float:
    cy = y
    for line in text.split("\n"):
        bb = draw.textbbox((0, 0), line, font=font)
        draw.text(((W - (bb[2] - bb[0])) / 2 - bb[0], cy - bb[1]), line, font=font, fill=fill)
        cy += (bb[3] - bb[1]) + gap
    return cy - gap


def page_tag(draw: ImageDraw.ImageDraw, index: int) -> None:
    """Running slide counter on interior slides (bookends carry the lockup)."""
    tag = f"{index:02d}  /  {TOTAL:02d}"
    font = gothic(int(19 * S), index=4)
    bb = draw.textbbox((0, 0), tag, font=font)
    draw.text(((W - (bb[2] - bb[0])) / 2 - bb[0], int(66 * S)), tag, font=font,
              fill=SUBTLE)


def brand_lockup(base: Image.Image, y: int, icon_px: int, mark_px: int) -> Image.Image:
    """Centered icon + wordmark, returns an RGBA canvas."""
    icon = round_icon(icon_px)
    mark_font = myungjo(mark_px)
    d = ImageDraw.Draw(base)
    bb = d.textbbox((0, 0), BRAND, font=mark_font)
    mark_w, mark_h = bb[2] - bb[0], bb[3] - bb[1]
    gap = int(14 * S)
    total_w = icon_px + gap + mark_w
    x0 = (W - total_w) // 2
    out = base.convert("RGBA")
    out.alpha_composite(icon, (x0, y))
    d = ImageDraw.Draw(out)
    d.text((x0 + icon_px + gap, y + (icon_px - mark_h) / 2 - bb[1]), BRAND,
           font=mark_font, fill=INK)
    d.line(((W - int(72 * S)) / 2, y + icon_px + int(26 * S),
            (W + int(72 * S)) / 2, y + icon_px + int(26 * S)),
           fill=(*INK, 80), width=max(1, int(1.5 * S)))
    return out


def compose_shot(shot: dict, index: int) -> None:
    canvas = paper_canvas(W, H, shot["wash"])
    draw = ImageDraw.Draw(canvas)
    page_tag(draw, index)

    eyebrow_font = gothic(int(21 * S), index=4)
    title_font = myungjo(int(58 * S))
    sub_font = gothic(int(25 * S), index=2)

    y = draw_center(draw, shot["eyebrow"], int(118 * S), eyebrow_font, INK_SOFT, 0)
    y = draw_center(draw, shot["title"], y + int(24 * S), title_font, INK, int(12 * S))
    y = draw_center(draw, shot["sub"], y + int(28 * S), sub_font, INK_SOFT, 0)

    screen = Image.open(LIVE / shot["src"]).convert("RGB")
    frame, shadow = make_phone(screen, int(788 * S), S)
    phone_top = int(y + 60 * S)
    px = (W - frame.width) // 2

    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(shadow, (px - (shadow.width - frame.width) // 2,
                                         phone_top - (shadow.height - frame.height) // 2 + int(10 * S)))
    canvas_rgba.alpha_composite(frame, (px, phone_top))

    # Soft paper edge where the device bleeds off the bottom.
    fade_h = int(120 * S)
    fade = Image.new("L", (W, fade_h), 0)
    fd = ImageDraw.Draw(fade)
    for i in range(fade_h):
        fd.line((0, i, W, i), fill=int(255 * (i / fade_h) ** 2.4))
    band = Image.new("RGBA", (W, fade_h), (*PAPER, 255))
    band.putalpha(fade)
    canvas_rgba.alpha_composite(band, (0, H - fade_h))

    save(canvas_rgba, shot["out"])


def compose_hook() -> None:
    canvas = paper_canvas(W, H, WATER_LIGHT)
    canvas = korea_watermark(canvas, opacity=0.09, scale=0.92, dy=int(78 * S))
    canvas = brand_lockup(canvas, int(166 * S), int(46 * S), int(26 * S))
    draw = ImageDraw.Draw(canvas)

    line1_font = myungjo(int(58 * S))
    line2_font = myungjo(int(86 * S))
    cap_font = gothic(int(24 * S), index=2)
    kicker_font = gothic(int(18 * S), index=4)

    y = draw_center(draw, HOOK_LINE1, int(560 * S), line1_font, INK_SOFT, 0)
    y = draw_center(draw, HOOK_LINE2, y + int(20 * S), line2_font, INK, 0)

    draw.line(((W - int(64 * S)) / 2, y + int(56 * S), (W + int(64 * S)) / 2, y + int(56 * S)),
              fill=(*INK, 90), width=max(1, int(1.5 * S)))
    y = draw_center(draw, HOOK_CAPTION, y + int(84 * S), cap_font, INK_SOFT, 0)
    draw_center(draw, "M O N T H L Y   R E C A P", y + int(26 * S), kicker_font, SUBTLE, 0)

    save(canvas, "01-hook.png")


def compose_cta() -> None:
    canvas = paper_canvas(W, H, (232, 238, 228))
    canvas = korea_watermark(canvas, opacity=0.055, scale=0.92, dy=int(44 * S))
    canvas = brand_lockup(canvas, int(238 * S), int(58 * S), int(32 * S))
    draw = ImageDraw.Draw(canvas)

    title_font = myungjo(int(62 * S))
    pill_font = gothic(int(28 * S), index=6)
    note_font = gothic(int(22 * S), index=2)
    handle_font = gothic(int(21 * S), index=4)

    y = draw_center(draw, "이번 한 달을\n펼쳐 보세요", int(536 * S), title_font, INK, int(14 * S))

    # Store CTA pill — a marker, not a real tap target (carousels don't link).
    pill_w, pill_h = int(392 * S), int(94 * S)
    pill_x, pill_y = (W - pill_w) // 2, int(y + 84 * S)
    draw.rounded_rectangle((pill_x, pill_y, pill_x + pill_w, pill_y + pill_h),
                           radius=pill_h // 2, fill=INK)
    bb = draw.textbbox((0, 0), "다운로드", font=pill_font)
    draw.text(((W - (bb[2] - bb[0])) / 2 - bb[0], pill_y + (pill_h - (bb[3] - bb[1])) / 2 - bb[1]),
              "다운로드", font=pill_font, fill=PAPER)

    draw_center(draw, STORE_LINE, pill_y + pill_h + int(34 * S), note_font, INK_SOFT, 0)
    draw_center(draw, HANDLE, int(H - 210 * S), handle_font, SUBTLE, 0)

    save(canvas, "06-cta.png")


def save(canvas: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    canvas.convert("RGB").save(path, "PNG", optimize=True)
    print("wrote", path)


def main() -> None:
    compose_hook()
    for i, shot in enumerate(SHOTS, start=2):
        compose_shot(shot, i)
    compose_cta()


if __name__ == "__main__":
    main()
