"""Reproducibly generate 1600×900 HalalDL 0.6.0 release narrative cards.

These cards explain the release. The companion screenshots/ directory contains
the real rendered app proof images captured by capture-marketing-screenshots.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
BRAND = ROOT.parents[3] / "src" / "assets" / "brand"
W, H = 1600, 900
FONT = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def palette(theme):
    return ({"bg": (8, 14, 23), "panel": (20, 32, 48), "ink": (245, 247, 251), "muted": (151, 177, 207), "line": (58, 82, 112), "accent": (38, 224, 198)}
            if theme == "dark" else
            {"bg": (245, 247, 251), "panel": (255, 255, 255), "ink": (8, 14, 23), "muted": (75, 102, 136), "line": (196, 210, 226), "accent": (11, 127, 114)})


def paste_logo(image, theme, x, y, width=54):
    """Place the shipped HalalDL mark with its intended background variant."""
    filename = "halaldl-symbol-dark-background.png" if theme == "dark" else "halaldl-symbol-light-background.png"
    logo = Image.open(BRAND / filename).convert("RGBA")
    ratio = width / logo.width
    logo = logo.resize((width, round(logo.height * ratio)), Image.Resampling.LANCZOS)
    image.alpha_composite(logo, (x, y))


def wrapped(draw, text, x, y, width, size, color, bold=False, gap=10):
    words, line, lines = text.split(), "", []
    f = font(size, bold)
    for word in words:
        test = f"{line} {word}".strip()
        if draw.textbbox((0, 0), test, font=f)[2] <= width:
            line = test
        else:
            lines.append(line); line = word
    if line: lines.append(line)
    for item in lines:
        draw.text((x, y), item, font=f, fill=color)
        y += size + gap
    return y


def card(theme, name, eyebrow, title, body, points):
    c = palette(theme)
    image = Image.new("RGBA", (W, H), (*c["bg"], 255))
    draw = ImageDraw.Draw(image)
    for coordinate in range(0, W, 40): draw.line((coordinate, 0, coordinate, H), fill=(*c["line"],), width=1)
    for coordinate in range(0, H, 40): draw.line((0, coordinate, W, coordinate), fill=(*c["line"],), width=1)
    draw.ellipse((-260, -230, 610, 610), fill=tuple(min(255, v + 12) for v in c["panel"]))
    draw.ellipse((1080, 480, 1840, 1190), fill=tuple(min(255, v + 18) for v in c["panel"]))
    paste_logo(image, theme, 74, 44)
    draw.text((146, 51), "HALALDL", font=font(20, True), fill=c["ink"])
    draw.text((74, 152), eyebrow.upper(), font=font(18, True), fill=c["accent"])
    y = wrapped(draw, title, 74, 205, 650, 66, c["ink"], True, 14)
    wrapped(draw, body, 74, y + 25, 610, 26, c["muted"], False, 10)
    panel = (810, 142, 1518, 755)
    draw.rounded_rectangle(panel, radius=28, fill=c["panel"], outline=c["line"], width=2)
    draw.text((850, 190), "The Download, Organize & Create Update", font=font(24, True), fill=c["ink"])
    y = 278
    for number, heading, detail in points:
        draw.rounded_rectangle((850, y, 900, y + 50), radius=12, fill=c["accent"])
        draw.text((866, y + 12), number, font=font(17, True), fill=c["bg"])
        draw.text((924, y + 3), heading, font=font(25, True), fill=c["ink"])
        y = wrapped(draw, detail, 924, y + 37, 510, 17, c["muted"], False, 6) + 26
    draw.rounded_rectangle((74, 778, 610, 828), radius=12, fill=c["panel"], outline=c["line"])
    draw.text((96, 792), "v0.6.0  •  Stable release after draft-release QA", font=font(17, True), fill=c["ink"])
    image.convert("RGB").save(ROOT / f"{name}-{theme}.png")


CARDS = [
    ("hero", "Choose. Organize. Create.", "Choose exact downloads.\nOrganize local media.\nCreate useful clips.", "A more capable local-first workflow, with control at every step and no cloud account required.", [("01", "Choose", "Preview links, select playlist entries, and select queued work before removing it."), ("02", "Organize", "Keep local media in folders and follow YouTube sources on your own schedule."), ("03", "Create", "Turn completed local video or audio into a new clip without changing the original.")]),
    ("playlist", "Download with more control", "Pick the exact videos\nyou want.", "Preview a playlist, keep only selected entries, then add them using the preset and queue behavior you choose.", [("01", "Preview", "See the playlist before committing a queue."), ("02", "Select", "Selected entries are explicit and easy to review."), ("03", "Queue", "Keep control through presets, cookies, SponsorBlock, and queue selection.")]),
    ("library", "Organize what you keep", "Follow sources\non your schedule.", "Library follows are editable per source, and the six-hour interval is clearly recommended for most channels and playlists.", [("01", "Follow", "Use YouTube channel or playlist links."), ("02", "Schedule", "Six hours is recommended; choose the interval that fits the source."), ("03", "Keep local", "Folders and presets help route completed media where you expect it.")]),
    ("doctor", "Recover without guessing", "A safe next step\nfor common failures.", "Download Doctor explains a failure in plain language and offers safe recovery paths without sending your link or sign-in data.", [("01", "Read", "See the actual failure in a clearer form."), ("02", "Choose", "Try cookies, an alternate format, or another safe next step."), ("03", "Retry", "Retry only when you are ready.")]),
    ("clips", "Create from completed media", "Turn local media\ninto shareable clips.", "Choose a range or chapter from a completed download and export a new local file beside the original.", [("01", "Open", "Start with an existing completed download."), ("02", "Trim", "Use known duration and chapters to choose the useful part."), ("03", "Export", "The original file is never changed.")]),
    ("reliability", "Reliability and polish", "More clarity when\nthe details matter.", "The quick panel, clipboard flow, package detection, and download fallbacks received focused cleanup alongside the major tools.", [("01", "Tools", "Better Full and Portable detection guidance."), ("02", "Queue", "Selection and clearing are deliberate actions."), ("03", "Updates", "Portable updates stay a manual ZIP replacement by design.")]),
]

for theme in ("light", "dark"):
    for args in CARDS:
        card(theme, *args)

print(f"Wrote {len(CARDS) * 2} cards to {ROOT}")
