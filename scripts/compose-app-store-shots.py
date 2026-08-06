#!/usr/bin/env python3
"""Compose App Store marketing frames (1284×2778) from live simulator captures."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / "docs/app-store/screenshots/live"
OUT = ROOT / "docs/app-store/screenshots/1284x2778"

W, H = 1284, 2778
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

# Soft pastels — same composition language as common App Store frames.
SHOTS = [
    {
        "src": "01-home.png",
        "out": "01-home.png",
        "bg": (214, 232, 245),  # soft blue
        "title": "한 달의 사진이\n지도가 됩니다",
        "sub": "위치 있는 사진만으로 이번 달 지도를 그려요",
    },
    {
        "src": "02-months.png",
        "out": "02-months.png",
        "bg": (250, 228, 214),  # soft peach
        "title": "지난 달을\n다시 꺼내 봐요",
        "sub": "달마다 쌓이는 나의 사진 일기",
    },
    {
        "src": "03-playback.png",
        "out": "03-playback.png",
        "bg": (245, 236, 196),  # soft yellow
        "title": "흩어진 하루를\n한곳에 모아요",
        "sub": "몰아보기로 한 달을 다시 따라가요",
    },
    {
        "src": "04-stamps.png",
        "out": "04-stamps.png",
        "bg": (230, 224, 245),  # soft lavender
        "title": "동네마다\n발도장을 모아요",
        "sub": "발 닿은 동마다 하나씩 쌓여요",
    },
    {
        "src": "05-card.png",
        "out": "05-card.png",
        "bg": (220, 236, 226),  # soft mint
        "title": "한 달을\n카드로 남겨요",
        "sub": "예쁜 회고 카드로 저장하고 공유해요",
    },
]


def font(size: int, index: int = 6) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size=size, index=index)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    font_obj: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    line_gap: int = 12,
) -> int:
    lines = text.split("\n")
    cy = y
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font_obj)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text(((W - tw) / 2, cy), line, font=font_obj, fill=fill)
        cy += th + line_gap
    return cy


def compose(shot: dict) -> None:
    canvas = Image.new("RGB", (W, H), shot["bg"])
    draw = ImageDraw.Draw(canvas)

    title_font = font(78, index=16)  # Heavy
    sub_font = font(32, index=2)  # Medium
    ink = (34, 42, 58)

    y = 130
    y = draw_centered_text(draw, shot["title"], y, title_font, ink, line_gap=8)
    y += 22
    draw_centered_text(draw, shot["sub"], y, sub_font, (70, 78, 96), line_gap=8)

    # Phone frame under copy — keep margin like App Store marketing frames.
    screen = Image.open(LIVE / shot["src"]).convert("RGB")
    phone_inner_w = 820
    scale = phone_inner_w / screen.width
    phone_inner_h = int(screen.height * scale)
    screen = screen.resize((phone_inner_w, phone_inner_h), Image.Resampling.LANCZOS)

    bezel = 16
    island_h = 30
    radius = 68
    frame_w = phone_inner_w + bezel * 2
    frame_h = phone_inner_h + bezel * 2
    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(frame)
    fdraw.rounded_rectangle(
        (0, 0, frame_w - 1, frame_h - 1),
        radius=radius,
        fill=(18, 18, 20, 255),
    )
    # Soft shadow under phone.
    shadow = Image.new("RGBA", (frame_w + 48, frame_h + 48), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        (24, 28, frame_w + 24, frame_h + 32),
        radius=radius + 4,
        fill=(0, 0, 0, 40),
    )

    screen_masked = Image.new("RGBA", screen.size)
    screen_masked.paste(screen, (0, 0))
    screen_masked.putalpha(rounded_mask(screen.size, radius - 8))

    frame.paste(screen_masked, (bezel, bezel), screen_masked)
    # Dynamic Island
    island_w = 160
    ix = (frame_w - island_w) // 2
    iy = 16
    fdraw.rounded_rectangle(
        (ix, iy, ix + island_w, iy + island_h),
        radius=16,
        fill=(8, 8, 10, 255),
    )

    # Leave ~90pt bottom margin; scale phone if needed.
    phone_top = max(470, y + 56)
    max_h = H - phone_top - 90
    if frame_h > max_h:
        shrink = max_h / frame_h
        new_size = (int(frame_w * shrink), int(frame_h * shrink))
        frame = frame.resize(new_size, Image.Resampling.LANCZOS)
        shadow = shadow.resize(
            (int(shadow.width * shrink), int(shadow.height * shrink)),
            Image.Resampling.LANCZOS,
        )
        frame_w, frame_h = frame.size
    px = (W - frame_w) // 2

    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(shadow, (px - 12, phone_top - 4))
    canvas_rgba.alpha_composite(frame, (px, phone_top))

    out_path = OUT / shot["out"]
    canvas_rgba.convert("RGB").save(out_path, "PNG", optimize=True)
    print("wrote", out_path)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for shot in SHOTS:
        compose(shot)


if __name__ == "__main__":
    main()
