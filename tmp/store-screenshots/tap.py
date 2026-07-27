#!/usr/bin/env python3
"""Click inside the iPhone Simulator device content area (points)."""
from __future__ import annotations

import subprocess
import sys
import time

# Measured: Simulator window at (100,50) size 494x1054 pts;
# device content in window screenshot 540x1100 px: L50 T96 R489 B1051.
WX, WY, WW, WH = 100, 50, 494, 1054
PX_W, PX_H = 540, 1100
L, T, R, B = 50, 96, 489, 1051

CX = WX + L / PX_W * WW
CY = WY + T / PX_H * WH
CW = (R - L) / PX_W * WW
CH = (B - T) / PX_H * WH


def ensure_window() -> None:
    subprocess.run(
        [
            "osascript",
            "-e",
            'tell application "Simulator" to activate',
            "-e",
            'tell application "System Events" to tell process "Simulator" to set frontmost to true',
            "-e",
            'tell application "System Events" to tell process "Simulator" to set position of window 1 to {100, 50}',
        ],
        check=False,
    )
    time.sleep(0.35)


def xy(nx: float, ny: float) -> tuple[int, int]:
    return int(round(CX + nx * CW)), int(round(CY + ny * CH))


def tap(nx: float, ny: float, wait: float = 1.0) -> None:
    x, y = xy(nx, ny)
    print(f"tap {nx:.3f},{ny:.3f} -> {x},{y}", flush=True)
    subprocess.run(["cliclick", "-r", f"c:{x},{y}"], check=True)
    time.sleep(wait)


def drag(nx1: float, ny1: float, nx2: float, ny2: float, steps: int = 12) -> None:
    x1, y1 = xy(nx1, ny1)
    x2, y2 = xy(nx2, ny2)
    print(f"drag {nx1},{ny1} -> {nx2},{ny2}", flush=True)
    subprocess.run(["cliclick", "-r", f"dd:{x1},{y1}"], check=True)
    time.sleep(0.08)
    for i in range(1, steps + 1):
        t = i / steps
        xi = int(round(x1 + (x2 - x1) * t))
        yi = int(round(y1 + (y2 - y1) * t))
        subprocess.run(["cliclick", "-r", f"m:{xi},{yi}"], check=True)
        time.sleep(0.04)
    subprocess.run(["cliclick", "-r", f"du:{x2},{y2}"], check=True)
    time.sleep(1.2)


def shot(path: str) -> None:
    udid = "9F1A2723-D1F2-4845-9CC2-D6EBF325ED2A"
    subprocess.run(["xcrun", "simctl", "io", udid, "screenshot", path], check=True)
    print(f"shot {path}", flush=True)


def main() -> None:
    ensure_window()
    cmd = sys.argv[1]
    if cmd == "tap":
        tap(float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]) if len(sys.argv) > 4 else 1.0)
    elif cmd == "drag":
        drag(float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]))
    elif cmd == "shot":
        shot(sys.argv[2])
    else:
        raise SystemExit(f"unknown {cmd}")


if __name__ == "__main__":
    main()
