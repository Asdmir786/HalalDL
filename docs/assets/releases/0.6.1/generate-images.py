"""Reproducibly generate HalalDL v0.6.1 release artwork."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
BRAND = ROOT.parents[3] / "src" / "assets" / "brand"
WIDTH, HEIGHT = 1600, 900
FONT = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")


def font(size: int, bold: bool = False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def palette(theme: str):
    if theme == "dark":
        return {
            "bg": (7, 13, 22),
            "panel": (18, 31, 47),
            "ink": (245, 248, 252),
            "muted": (155, 177, 202),
            "line": (47, 72, 99),
            "accent": (42, 226, 198),
        }
    return {
        "bg": (244, 248, 250),
        "panel": (255, 255, 255),
        "ink": (8, 17, 29),
        "muted": (73, 98, 126),
        "line": (190, 208, 220),
        "accent": (8, 126, 111),
    }


def paste_logo(image: Image.Image, theme: str, x: int, y: int, width: int = 56):
    filename = (
        "halaldl-symbol-dark-background.png"
        if theme == "dark"
        else "halaldl-symbol-light-background.png"
    )
    logo = Image.open(BRAND / filename).convert("RGBA")
    ratio = width / logo.width
    logo = logo.resize((width, round(logo.height * ratio)), Image.Resampling.LANCZOS)
    image.alpha_composite(logo, (x, y))


def wrapped(draw, text, x, y, width, size, color, bold=False, gap=10):
    lines = []
    current = ""
    text_font = font(size, bold)
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=text_font)[2] <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    for line in lines:
        draw.text((x, y), line, font=text_font, fill=color)
        y += size + gap
    return y


def render(theme: str):
    colors = palette(theme)
    image = Image.new("RGBA", (WIDTH, HEIGHT), (*colors["bg"], 255))
    draw = ImageDraw.Draw(image)

    for coordinate in range(0, WIDTH, 40):
        draw.line((coordinate, 0, coordinate, HEIGHT), fill=colors["line"], width=1)
    for coordinate in range(0, HEIGHT, 40):
        draw.line((0, coordinate, WIDTH, coordinate), fill=colors["line"], width=1)

    draw.ellipse((-310, -280, 620, 650), fill=colors["panel"])
    draw.ellipse((1110, 520, 1780, 1190), fill=colors["panel"])
    paste_logo(image, theme, 76, 48)
    draw.text((150, 54), "HALALDL", font=font(21, True), fill=colors["ink"])

    draw.text((76, 160), "V0.6.1 MAINTENANCE RELEASE", font=font(19, True), fill=colors["accent"])
    y = wrapped(draw, "Privacy and Security Maintenance", 76, 216, 700, 66, colors["ink"], True, 15)
    wrapped(
        draw,
        "A smaller, safer release for local-first downloading on Windows.",
        76,
        y + 26,
        650,
        27,
        colors["muted"],
        False,
        10,
    )

    panel = (820, 142, 1520, 756)
    draw.rounded_rectangle(panel, radius=30, fill=colors["panel"], outline=colors["line"], width=2)
    items = [
        ("01", "Telemetry removed", "The legacy identifier is cleaned up without touching downloads or history."),
        ("02", "Queue-only links", "Website handoffs add a link to HalalDL and wait for your confirmation."),
        ("03", "Tighter boundaries", "Restricted capabilities, content policy, and safe local file opening."),
    ]
    y = 205
    for number, heading, detail in items:
        draw.rounded_rectangle((862, y, 914, y + 52), radius=13, fill=colors["accent"])
        draw.text((877, y + 13), number, font=font(17, True), fill=colors["bg"])
        draw.text((940, y + 2), heading, font=font(27, True), fill=colors["ink"])
        y = wrapped(draw, detail, 940, y + 43, 500, 18, colors["muted"], False, 7) + 34

    draw.rounded_rectangle((76, 780, 650, 832), radius=13, fill=colors["panel"], outline=colors["line"])
    draw.text((99, 795), "Full  •  Lite  •  Portable  |  Windows 10 + 11", font=font(18, True), fill=colors["ink"])
    image.convert("RGB").save(ROOT / f"hero-{theme}.png")


for selected_theme in ("light", "dark"):
    render(selected_theme)

print(f"Wrote release artwork to {ROOT}")
