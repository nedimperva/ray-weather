#!/usr/bin/env python3
"""Render Raycast store screenshots (2000x1250 PNG) for Forecast Pilot.

These are high-fidelity mockups of the extension's List UI built from the same
content the commands produce. Output goes to metadata/forecast-pilot-{n}.png.
Rendered at 2x and downsampled for crisp anti-aliasing.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

SCALE = 2
W, H = 2000, 1250
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "metadata")

# Raycast-ish palette
BG = (26, 26, 28)
ROW_SEL = (45, 45, 48)
SEP = (58, 58, 62)
TEXT = (242, 242, 245)
SUB = (148, 148, 155)
SECTION = (120, 120, 128)

COL = {
    "green": (95, 202, 80),
    "blue": (66, 145, 255),
    "orange": (255, 159, 10),
    "yellow": (255, 199, 60),
    "red": (255, 96, 96),
    "magenta": (214, 93, 177),
    "purple": (180, 96, 224),
    "gray": (150, 150, 158),
}

_fonts = {}


def font(size, bold=False):
    key = (size, bold)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(FONT_BOLD if bold else FONT, size * SCALE)
    return _fonts[key]


def s(v):
    return int(v * SCALE)


def blend(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lighten(c, t):
    return blend(c, (255, 255, 255), t)


def text_w(draw, txt, fnt):
    return draw.textbbox((0, 0), txt, font=fnt)[2]


# ---------------------------------------------------------------- backgrounds
def gradient(c1, c2):
    base = Image.new("RGB", (W * SCALE, H * SCALE), c1)
    top = Image.new("RGB", (W * SCALE, H * SCALE), c2)
    mask = Image.new("L", (W * SCALE, H * SCALE))
    md = mask.load()
    diag = (W + H) * SCALE
    for y in range(H * SCALE):
        for x in range(0, W * SCALE, 4):
            v = int(255 * (x + y) / diag)
            md[x, y] = v
            md[min(x + 1, W * SCALE - 1), y] = v
            md[min(x + 2, W * SCALE - 1), y] = v
            md[min(x + 3, W * SCALE - 1), y] = v
    base.paste(top, (0, 0), mask)
    return base


# ---------------------------------------------------------------- icons
def draw_icon(d, name, cx, cy, r, tint):
    """Vector weather/status icons centered at (cx,cy) with radius r (logical)."""
    cx, cy, r = s(cx), s(cy), s(r)
    white = (245, 245, 248)

    def circle(x, y, rad, fill):
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=fill)

    if name == "sun":
        for i in range(8):
            a = i * math.pi / 4
            x1 = cx + math.cos(a) * r * 0.95
            y1 = cy + math.sin(a) * r * 0.95
            x2 = cx + math.cos(a) * r * 1.4
            y2 = cy + math.sin(a) * r * 1.4
            d.line([x1, y1, x2, y2], fill=tint, width=s(3))
        circle(cx, cy, r * 0.72, tint)
    elif name == "partly":
        circle(cx + r * 0.35, cy - r * 0.35, r * 0.55, COL["yellow"])
        for i in range(8):
            a = i * math.pi / 4
            d.line(
                [
                    cx + r * 0.35 + math.cos(a) * r * 0.7,
                    cy - r * 0.35 + math.sin(a) * r * 0.7,
                    cx + r * 0.35 + math.cos(a) * r * 0.95,
                    cy - r * 0.35 + math.sin(a) * r * 0.95,
                ],
                fill=COL["yellow"],
                width=s(2),
            )
        _cloud(d, cx, cy + r * 0.2, r, (210, 214, 222))
    elif name == "cloud":
        _cloud(d, cx, cy, r, (200, 205, 214))
    elif name == "rain":
        _cloud(d, cx, cy - r * 0.25, r, (200, 205, 214))
        for i in range(3):
            x = cx - r * 0.5 + i * r * 0.5
            d.line(
                [x, cy + r * 0.55, x - r * 0.18, cy + r * 1.0],
                fill=COL["blue"],
                width=s(3),
            )
    elif name == "snow":
        _cloud(d, cx, cy - r * 0.25, r, (200, 205, 214))
        for i in range(3):
            x = cx - r * 0.5 + i * r * 0.5
            circle(x, cy + r * 0.8, s(0) + r * 0.1, white)
    elif name == "warning":
        pts = [(cx, cy - r), (cx + r, cy + r * 0.85), (cx - r, cy + r * 0.85)]
        d.polygon(pts, fill=tint)
        d.line([cx, cy - r * 0.35, cx, cy + r * 0.25], fill=BG, width=s(4))
        d.ellipse(
            [cx - s(2.5), cy + r * 0.45, cx + s(2.5), cy + r * 0.45 + s(5)], fill=BG
        )
    elif name == "check":
        circle(cx, cy, r, tint)
        d.line(
            [cx - r * 0.45, cy, cx - r * 0.1, cy + r * 0.4],
            fill=BG,
            width=s(4),
        )
        d.line(
            [cx - r * 0.1, cy + r * 0.4, cx + r * 0.5, cy - r * 0.4],
            fill=BG,
            width=s(4),
        )
    elif name == "pin":
        circle(cx, cy - r * 0.2, r * 0.85, tint)
        d.polygon(
            [
                (cx - r * 0.45, cy + r * 0.1),
                (cx + r * 0.45, cy + r * 0.1),
                (cx, cy + r),
            ],
            fill=tint,
        )
        circle(cx, cy - r * 0.2, r * 0.32, BG)
    elif name == "car":
        d.rounded_rectangle(
            [cx - r, cy - r * 0.1, cx + r, cy + r * 0.55],
            radius=s(4),
            fill=tint,
        )
        d.rounded_rectangle(
            [cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy], radius=s(4), fill=tint
        )
        circle(cx - r * 0.55, cy + r * 0.55, r * 0.22, BG)
        circle(cx + r * 0.55, cy + r * 0.55, r * 0.22, BG)
    elif name == "calendar":
        d.rounded_rectangle(
            [cx - r, cy - r * 0.8, cx + r, cy + r], radius=s(4), fill=tint
        )
        d.rectangle([cx - r, cy - r * 0.8, cx + r, cy - r * 0.35], fill=lighten(tint, 0.2))
        circle(cx - r * 0.5, cy + r * 0.2, r * 0.14, BG)
        circle(cx, cy + r * 0.2, r * 0.14, BG)
        circle(cx + r * 0.5, cy + r * 0.2, r * 0.14, BG)
    elif name == "chart":
        for i, hgt in enumerate([0.5, 0.9, 0.65]):
            x = cx - r * 0.7 + i * r * 0.7
            d.rounded_rectangle(
                [x - r * 0.2, cy + r - r * 2 * hgt, x + r * 0.2, cy + r],
                radius=s(2),
                fill=tint,
            )
    elif name == "search":
        d.ellipse(
            [cx - r * 0.8, cy - r * 0.8, cx + r * 0.3, cy + r * 0.3],
            outline=tint,
            width=s(3),
        )
        d.line(
            [cx + r * 0.2, cy + r * 0.2, cx + r * 0.8, cy + r * 0.8],
            fill=tint,
            width=s(3),
        )
    elif name == "moon":
        circle(cx, cy, r * 0.85, tint)
        circle(cx + r * 0.4, cy - r * 0.25, r * 0.8, BG)
    elif name == "clock":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=tint, width=s(3))
        d.line([cx, cy, cx, cy - r * 0.6], fill=tint, width=s(3))
        d.line([cx, cy, cx + r * 0.45, cy], fill=tint, width=s(3))
    elif name == "wind":
        for i, yo in enumerate([-0.4, 0.05, 0.5]):
            d.line(
                [cx - r, cy + r * yo, cx + r * 0.5, cy + r * yo],
                fill=tint,
                width=s(3),
            )
            d.arc(
                [cx + r * 0.3, cy + r * yo - r * 0.3, cx + r * 0.9, cy + r * yo + r * 0.3],
                -90,
                120,
                fill=tint,
                width=s(3),
            )
    elif name == "list":
        for i in range(3):
            y = cy - r * 0.6 + i * r * 0.6
            d.ellipse([cx - r, y - s(2), cx - r + s(5), y + s(3)], fill=tint)
            d.line([cx - r * 0.55, y, cx + r, y], fill=tint, width=s(3))


def _cloud(d, cx, cy, r, color):
    cx, cy, r = (cx, cy, r)  # already scaled by caller
    d.ellipse([cx - r, cy - r * 0.2, cx, cy + r * 0.6], fill=color)
    d.ellipse([cx - r * 0.4, cy - r * 0.6, cx + r * 0.5, cy + r * 0.5], fill=color)
    d.ellipse([cx + r * 0.1, cy - r * 0.2, cx + r, cy + r * 0.6], fill=color)
    d.rounded_rectangle(
        [cx - r, cy + r * 0.1, cx + r, cy + r * 0.6], radius=s(6), fill=color
    )


# ---------------------------------------------------------------- components
def tag(d, x_right, cy, text, color):
    """Draw a right-aligned pill, return its left x."""
    fnt = font(15, bold=True)
    tw = text_w(d, text, fnt)
    padx = s(14)
    pill_w = tw + padx * 2
    h = s(34)
    x0 = x_right - pill_w
    y0 = cy - h // 2
    d.rounded_rectangle(
        [x0, y0, x_right, y0 + h], radius=h // 2, fill=blend(BG, color, 0.22)
    )
    d.text((x0 + padx, cy), text, font=fnt, fill=lighten(color, 0.25), anchor="lm")
    return x0


def plain(d, x_right, cy, text):
    fnt = font(15)
    tw = text_w(d, text, fnt)
    d.text((x_right, cy), text, font=fnt, fill=SUB, anchor="rm")
    return x_right - tw


def render(spec, path):
    img = gradient(*spec["gradient"])
    d = ImageDraw.Draw(img)

    # window frame
    wx0, wy0, wx1, wy1 = 250, 120, 1750, 1130
    # soft-ish drop shadow: a few translucent offset layers
    shadow = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i, off in enumerate((26, 18, 10)):
        sd.rounded_rectangle(
            [s(wx0) - s(off // 3), s(wy0) + s(off), s(wx1) + s(off // 3), s(wy1) + s(off)],
            radius=s(30),
            fill=(0, 0, 0, 40),
        )
    img = Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([s(wx0), s(wy0), s(wx1), s(wy1)], radius=s(24), fill=BG)

    pad = 40
    inner_l = wx0 + pad
    inner_r = wx1 - pad

    # search bar
    sby = wy0 + 56
    draw_icon(d, "search", inner_l + 14, sby, 13, SUB)
    d.text(
        (s(inner_l + 44), s(sby)),
        spec["search"],
        font=font(21),
        fill=SUB,
        anchor="lm",
    )
    if spec.get("dropdown"):
        dt = spec["dropdown"] + "  ⌄"
        fnt = font(18, bold=True)
        tw = text_w(d, dt, fnt)
        x0 = inner_r - tw / SCALE - 36
        d.rounded_rectangle(
            [s(x0), s(sby - 20), s(inner_r), s(sby + 20)],
            radius=s(20),
            fill=ROW_SEL,
        )
        d.text((s(inner_r - 18), s(sby)), dt, font=fnt, fill=TEXT, anchor="rm")
    d.line(
        [s(wx0), s(wy0 + 112), s(wx1), s(wy0 + 112)], fill=SEP, width=s(1)
    )

    # body
    y = wy0 + 136
    for section in spec["sections"]:
        st = section["title"].upper()
        d.text((s(inner_l), s(y)), st, font=font(13, bold=True), fill=SECTION, anchor="lm")
        if section.get("subtitle"):
            d.text(
                (s(inner_r), s(y)),
                section["subtitle"].upper(),
                font=font(13, bold=True),
                fill=SECTION,
                anchor="rm",
            )
        y += 34
        for row in section["rows"]:
            rh = 78
            if row.get("selected"):
                d.rounded_rectangle(
                    [s(inner_l - 12), s(y - rh / 2 + 4), s(inner_r + 12), s(y + rh / 2 - 4)],
                    radius=s(12),
                    fill=ROW_SEL,
                )
            draw_icon(d, row["icon"], inner_l + 22, y, 18, row.get("tint", COL["gray"]))
            d.text(
                (s(inner_l + 58), s(y - 14)),
                row["title"],
                font=font(20, bold=True),
                fill=TEXT,
                anchor="lm",
            )
            if row.get("subtitle"):
                d.text(
                    (s(inner_l + 58), s(y + 16)),
                    row["subtitle"],
                    font=font(16),
                    fill=SUB,
                    anchor="lm",
                )
            # accessories right-to-left
            xr = inner_r
            for acc in reversed(row.get("acc", [])):
                if acc[0] == "tag":
                    x0 = tag(d, s(xr), s(y), acc[1], COL[acc[2]])
                else:
                    x0 = plain(d, s(xr), s(y), acc[1])
                xr = x0 / SCALE - 10
            y += rh
        y += 16

    # footer
    fy = wy1 - 30
    d.line([s(wx0), s(wy1 - 60), s(wx1), s(wy1 - 60)], fill=SEP, width=s(1))
    d.rounded_rectangle(
        [s(inner_l), s(fy - 12), s(inner_l + 24), s(fy + 12)],
        radius=s(5),
        fill=COL["red"],
    )
    d.text((s(inner_l + 38), s(fy)), "Forecast Pilot", font=font(16, bold=True), fill=TEXT, anchor="lm")
    d.text((s(inner_r), s(fy)), "Actions  ⌘ K", font=font(16), fill=SUB, anchor="rm")

    out = img.resize((W, H), Image.LANCZOS)
    out.save(path)
    print("wrote", path)


# ---------------------------------------------------------------- data
GRADS = {
    "indigo": ((46, 49, 146), (109, 71, 209)),
    "sky": ((22, 93, 173), (47, 167, 198)),
    "sunset": ((201, 86, 64), (199, 60, 122)),
    "teal": ((15, 110, 110), (44, 150, 120)),
    "violet": ((88, 50, 168), (171, 71, 188)),
    "amber": ((176, 110, 30), (199, 78, 86)),
}

screens = [
    {
        "filename": "forecast-pilot-1.png",
        "gradient": GRADS["indigo"],
        "search": "Forecast for Oslo",
        "sections": [
            {
                "title": "Now",
                "rows": [
                    {
                        "icon": "partly",
                        "tint": COL["orange"],
                        "title": "14°C - Partly Cloudy",
                        "subtitle": "Calm and settled - feels like 13°C - updated 09:00",
                        "selected": True,
                        "acc": [
                            ("tag", "Comfort 88", "green"),
                            ("tag", "Rain 0.0 mm", "gray"),
                            ("text", "2.4 m/s"),
                            ("tag", "AQI 21", "green"),
                            ("tag", "UV 3", "yellow"),
                        ],
                    }
                ],
            },
            {
                "title": "Oslo, Oslo, Norway",
                "subtitle": "59.91, 10.75",
                "rows": [
                    {
                        "icon": "partly",
                        "tint": COL["orange"],
                        "title": "Today (Jun 6)",
                        "subtitle": "Calm and settled - Drier than tomorrow",
                        "acc": [
                            ("tag", "Great outside", "green"),
                            ("tag", "Comfort 88", "green"),
                            ("tag", "20° / 12°", "orange"),
                        ],
                    },
                    {
                        "icon": "rain",
                        "tint": COL["blue"],
                        "title": "Tomorrow (Jun 7)",
                        "subtitle": "Patchy rain - Rain likely 14:00-18:00, peak 16:00",
                        "acc": [
                            ("tag", "Rain likely 70%", "blue"),
                            ("tag", "Comfort 61", "yellow"),
                            ("tag", "18° / 11°", "orange"),
                        ],
                    },
                    {
                        "icon": "cloud",
                        "tint": COL["gray"],
                        "title": "Saturday (Jun 8)",
                        "subtitle": "Patchy rain - Cooler than previous day",
                        "acc": [
                            ("tag", "Rain 45%", "blue"),
                            ("tag", "Comfort 70", "yellow"),
                            ("tag", "16° / 10°", "green"),
                        ],
                    },
                    {
                        "icon": "sun",
                        "tint": COL["orange"],
                        "title": "Sunday (Jun 9)",
                        "subtitle": "Bright with strong sun - Warmer than previous day",
                        "acc": [
                            ("tag", "High UV", "orange"),
                            ("tag", "Comfort 82", "green"),
                            ("tag", "23° / 13°", "orange"),
                        ],
                    },
                    {
                        "icon": "sun",
                        "tint": COL["orange"],
                        "title": "Monday (Jun 10)",
                        "subtitle": "Calm and settled",
                        "acc": [
                            ("tag", "Great outside", "green"),
                            ("tag", "Comfort 90", "green"),
                            ("tag", "22° / 12°", "orange"),
                        ],
                    },
                ],
            },
        ],
    },
    {
        "filename": "forecast-pilot-2.png",
        "gradient": GRADS["amber"],
        "search": "Weather alerts",
        "sections": [
            {
                "title": "Default - Bergen, Vestland, Norway",
                "subtitle": "2 active",
                "rows": [
                    {
                        "icon": "warning",
                        "tint": COL["red"],
                        "title": "Gale",
                        "subtitle": "Strong gale, southwest 20 m/s with gusts to 30 m/s",
                        "acc": [("tag", "Severe", "orange"), ("text", "Vestland")],
                    },
                    {
                        "icon": "warning",
                        "tint": COL["yellow"],
                        "title": "Heavy Rain",
                        "subtitle": "Locally 40-60 mm over 12 hours, risk of flooding",
                        "acc": [("tag", "Moderate", "yellow"), ("text", "Bergen")],
                    },
                ],
            },
            {
                "title": "Favorite Locations",
                "rows": [
                    {
                        "icon": "warning",
                        "tint": COL["red"],
                        "title": "Tromso",
                        "subtitle": "1 active - Snow",
                        "acc": [("tag", "Severe", "orange")],
                    },
                    {
                        "icon": "check",
                        "tint": COL["green"],
                        "title": "Oslo",
                        "subtitle": "No active alerts",
                        "acc": [],
                    },
                    {
                        "icon": "check",
                        "tint": COL["green"],
                        "title": "London",
                        "subtitle": "No active alerts",
                        "acc": [],
                    },
                    {
                        "icon": "warning",
                        "tint": COL["yellow"],
                        "title": "Berlin",
                        "subtitle": "1 active - Thunderstorm",
                        "acc": [("tag", "Moderate", "yellow")],
                    },
                ],
            },
            {
                "title": "Sources",
                "rows": [
                    {
                        "icon": "warning",
                        "tint": COL["orange"],
                        "title": "Weather Alerts",
                        "subtitle": "met.no MetAlerts",
                        "acc": [],
                    }
                ],
            },
        ],
    },
    {
        "filename": "forecast-pilot-3.png",
        "gradient": GRADS["teal"],
        "search": "Comfort ranking for Oslo",
        "dropdown": "Oslo",
        "sections": [
            {
                "title": "Best Day",
                "rows": [
                    {
                        "icon": "sun",
                        "tint": COL["orange"],
                        "title": "Monday, Jun 10 looks best",
                        "subtitle": "Calm and settled - No meaningful rain window",
                        "selected": True,
                        "acc": [("tag", "Comfort 90", "green")],
                    }
                ],
            },
            {
                "title": "Oslo, Oslo, Norway",
                "rows": [
                    {
                        "icon": "sun",
                        "tint": COL["orange"],
                        "title": "Best - Monday, Jun 10",
                        "subtitle": "Calm and settled",
                        "acc": [
                            ("tag", "Comfort 90", "green"),
                            ("tag", "22° / 12°", "orange"),
                            ("tag", "0.0 mm", "gray"),
                        ],
                    },
                    {
                        "icon": "partly",
                        "tint": COL["orange"],
                        "title": "Second - Today, Jun 6",
                        "subtitle": "Calm and settled",
                        "acc": [
                            ("tag", "Comfort 88", "green"),
                            ("tag", "20° / 12°", "orange"),
                            ("tag", "0.0 mm", "gray"),
                        ],
                    },
                    {
                        "icon": "sun",
                        "tint": COL["orange"],
                        "title": "Third - Sunday, Jun 9",
                        "subtitle": "Bright with strong sun",
                        "acc": [
                            ("tag", "Comfort 82", "green"),
                            ("tag", "23° / 13°", "orange"),
                            ("tag", "UV 7", "orange"),
                        ],
                    },
                    {
                        "icon": "cloud",
                        "tint": COL["gray"],
                        "title": "#4 - Saturday, Jun 8",
                        "subtitle": "Patchy rain",
                        "acc": [
                            ("tag", "Comfort 70", "yellow"),
                            ("tag", "16° / 10°", "green"),
                            ("tag", "1.2 mm", "blue"),
                        ],
                    },
                    {
                        "icon": "rain",
                        "tint": COL["blue"],
                        "title": "#5 - Tomorrow, Jun 7",
                        "subtitle": "Patchy rain - Rain likely 14:00-18:00",
                        "acc": [
                            ("tag", "Comfort 61", "yellow"),
                            ("tag", "18° / 11°", "orange"),
                            ("tag", "3.4 mm", "orange"),
                        ],
                    },
                ],
            },
        ],
    },
    {
        "filename": "forecast-pilot-4.png",
        "gradient": GRADS["violet"],
        "search": "Weekend planner for Oslo",
        "dropdown": "Oslo",
        "sections": [
            {
                "title": "Recommendation",
                "rows": [
                    {
                        "icon": "check",
                        "tint": COL["green"],
                        "title": "Sunday looks best",
                        "subtitle": "12 comfort points higher, less rain, warmer",
                        "selected": True,
                        "acc": [("tag", "Comfort 82", "green"), ("tag", "UV 7", "orange")],
                    }
                ],
            },
            {
                "title": "Weekend Days",
                "subtitle": "Updated 09:00",
                "rows": [
                    {
                        "icon": "cloud",
                        "tint": COL["gray"],
                        "title": "Saturday, Jun 8",
                        "subtitle": "Patchy rain - Rain likely around 15:00",
                        "acc": [
                            ("tag", "Comfort 70", "yellow"),
                            ("tag", "Rain 45%", "blue"),
                            ("tag", "16° / 10°", "green"),
                        ],
                    },
                    {
                        "icon": "sun",
                        "tint": COL["orange"],
                        "title": "Sunday, Jun 9",
                        "subtitle": "Bright with strong sun",
                        "acc": [
                            ("tag", "Comfort 82", "green"),
                            ("tag", "High UV", "orange"),
                            ("tag", "23° / 13°", "orange"),
                        ],
                    },
                ],
            },
            {
                "title": "Planner Details",
                "rows": [
                    {
                        "icon": "chart",
                        "tint": COL["blue"],
                        "title": "Saturday, Jun 8",
                        "subtitle": "Rain likely around 15:00",
                        "acc": [("tag", "1.2 mm", "blue"), ("tag", "5.0 m/s", "orange")],
                    },
                    {
                        "icon": "chart",
                        "tint": COL["blue"],
                        "title": "Sunday, Jun 9",
                        "subtitle": "No meaningful rain window",
                        "acc": [("tag", "0.0 mm", "gray"), ("tag", "3.1 m/s", "green"), ("tag", "UV 7", "orange")],
                    },
                ],
            },
        ],
    },
    {
        "filename": "forecast-pilot-5.png",
        "gradient": GRADS["sky"],
        "search": "Oslo vs Bergen",
        "sections": [
            {
                "title": "Recommendation",
                "rows": [
                    {
                        "icon": "check",
                        "tint": COL["green"],
                        "title": "Oslo looks better",
                        "subtitle": "27 comfort points higher, less rain, fewer alerts",
                        "selected": True,
                        "acc": [("tag", "Comfort 88", "green")],
                    }
                ],
            },
            {
                "title": "Locations",
                "rows": [
                    {
                        "icon": "partly",
                        "tint": COL["orange"],
                        "title": "Oslo, Oslo, Norway",
                        "subtitle": "Calm and settled - 14°C now - updated 09:00",
                        "acc": [("tag", "Comfort 88", "green"), ("tag", "Great outside", "green")],
                    },
                    {
                        "icon": "rain",
                        "tint": COL["blue"],
                        "title": "Bergen, Vestland, Norway",
                        "subtitle": "Wet and unsettled - 11°C now - updated 09:00",
                        "acc": [("tag", "Comfort 61", "yellow"), ("tag", "2 alerts", "red")],
                    },
                ],
            },
            {
                "title": "Metrics",
                "rows": [
                    {
                        "icon": "chart",
                        "tint": COL["blue"],
                        "title": "Oslo",
                        "subtitle": "No meaningful rain window",
                        "acc": [("tag", "20° / 12°", "orange"), ("tag", "0.0 mm", "gray"), ("tag", "AQI 21", "green")],
                    },
                    {
                        "icon": "chart",
                        "tint": COL["blue"],
                        "title": "Bergen",
                        "subtitle": "Rain likely 12:00-20:00, peak 16:00",
                        "acc": [("tag", "15° / 10°", "green"), ("tag", "8.0 mm", "red"), ("tag", "2 alerts", "red")],
                    },
                ],
            },
        ],
    },
    {
        "filename": "forecast-pilot-6.png",
        "gradient": GRADS["sunset"],
        "search": "Weather brief for Oslo",
        "dropdown": "Oslo",
        "sections": [
            {
                "title": "Brief",
                "rows": [
                    {
                        "icon": "partly",
                        "tint": COL["orange"],
                        "title": "14°C - Partly Cloudy",
                        "subtitle": "Calm and settled - feels like 13°C - updated 09:00",
                        "selected": True,
                        "acc": [
                            ("tag", "Comfort 88", "green"),
                            ("tag", "Rain 0.0 mm", "gray"),
                            ("tag", "AQI 21", "green"),
                            ("tag", "UV 3", "yellow"),
                        ],
                    }
                ],
            },
            {
                "title": "Decisions",
                "rows": [
                    {
                        "icon": "check",
                        "tint": COL["green"],
                        "title": "Today's Calls",
                        "subtitle": "Great outside - Calm",
                        "acc": [("tag", "Great outside", "green"), ("tag", "Calm", "green")],
                    }
                ],
            },
            {
                "title": "Timing",
                "rows": [
                    {
                        "icon": "clock",
                        "tint": COL["gray"],
                        "title": "Temperature Range",
                        "subtitle": "Low 12°C at 04:00 - High 20°C at 15:00",
                        "acc": [],
                    },
                    {
                        "icon": "rain",
                        "tint": COL["blue"],
                        "title": "Rain Window",
                        "subtitle": "No meaningful rain window",
                        "acc": [],
                    },
                    {
                        "icon": "sun",
                        "tint": COL["orange"],
                        "title": "Sunrise / Sunset",
                        "subtitle": "04:12 / 22:46",
                        "acc": [],
                    },
                ],
            },
        ],
    },
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for spec in screens:
        render(spec, os.path.join(OUT_DIR, spec["filename"]))


if __name__ == "__main__":
    main()
