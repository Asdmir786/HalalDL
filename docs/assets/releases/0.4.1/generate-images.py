from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PROMO = ROOT / "promo"
SCREENSHOTS = ROOT / "screenshots"
W, H = 1600, 900

FONT = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")
SEMIBOLD = Path("C:/Windows/Fonts/seguisb.ttf")


def font(size, weight="regular"):
    source = {"regular": FONT, "bold": BOLD, "semibold": SEMIBOLD}.get(weight, FONT)
    return ImageFont.truetype(str(source), size)


def text_size(draw, text, fnt):
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw, text, fnt, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if text_size(draw, trial, fnt)[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def multiline(draw, xy, text, fnt, fill, max_width, line_gap=10):
    x, y = xy
    for line in wrap(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += text_size(draw, line, fnt)[1] + line_gap
    return y


def theme_values(theme):
    if theme == "dark":
        return {
            "bg": (8, 11, 10),
            "bg2": (13, 18, 16),
            "ink": (245, 250, 248),
            "muted": (159, 176, 169),
            "panel": (18, 23, 21),
            "panel2": (26, 33, 30),
            "line": (58, 72, 66),
            "chip": (29, 42, 37),
            "shadow": (0, 0, 0, 85),
            "accent": (18, 209, 142),
            "accent2": (34, 199, 216),
            "warn": (242, 189, 66),
            "rose": (240, 90, 122),
        }
    return {
        "bg": (246, 248, 247),
        "bg2": (226, 239, 234),
        "ink": (17, 19, 18),
        "muted": (86, 100, 94),
        "panel": (255, 255, 255),
        "panel2": (239, 244, 242),
        "line": (203, 214, 209),
        "chip": (232, 240, 236),
        "shadow": (30, 50, 42, 34),
        "accent": (14, 174, 118),
        "accent2": (20, 158, 172),
        "warn": (190, 130, 24),
        "rose": (210, 70, 102),
    }


def make_canvas(theme):
    c = theme_values(theme)
    img = Image.new("RGB", (W, H), c["bg"])
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(0, H, 38):
        draw.line((0, y, W, y), fill=(*c["line"], 42), width=1)
    for x in range(0, W, 38):
        draw.line((x, 0, x, H), fill=(*c["line"], 42), width=1)
    draw.ellipse((-220, -180, 540, 540), fill=(*c["accent"], 42))
    draw.ellipse((1120, 540, 1840, 1180), fill=(*c["rose"], 28))
    draw.ellipse((1020, -260, 1730, 440), fill=(*c["accent2"], 28))
    return img, draw, c


def shadow(draw, box, c, radius=22):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1 + 10, y1 + 18, x2 + 10, y2 + 18), radius=radius, fill=c["shadow"])


def rr(draw, box, c, fill=None, outline=None, width=1, radius=12):
    draw.rounded_rectangle(box, radius=radius, fill=fill or c["panel"], outline=outline or c["line"], width=width)


def header(draw, c, label):
    draw.rounded_rectangle((64, 57, 80, 73), radius=5, fill=c["accent"])
    draw.text((96, 52), "HALALDL", font=font(19, "bold"), fill=c["ink"])
    tw, _ = text_size(draw, label, font(15, "bold"))
    rr(draw, (W - tw - 94, 45, W - 64, 86), c, fill=(*c["panel"], 225), radius=8)
    draw.text((W - tw - 79, 57), label, font=font(15, "bold"), fill=c["muted"])


def title_block(draw, c, title, body, tag, x=74, y=252, width=620):
    rr(draw, (x, y - 70, x + 260, y - 29), c, fill=(*c["accent"], 34), outline=(*c["accent"], 85), radius=8)
    draw.text((x + 15, y - 60), tag, font=font(15, "bold"), fill=c["accent"])
    draw.text((x, y), title, font=font(74, "bold"), fill=c["ink"], spacing=0)
    multiline(draw, (x, y + 185), body, font(27, "semibold"), c["muted"], width, 12)


def feature(draw, c, x, y, badge, title, body, width=620):
    rr(draw, (x, y, x + width, y + 92), c, fill=(*c["panel"], 225), radius=8)
    rr(draw, (x + 18, y + 21, x + 58, y + 61), c, fill=c["ink"], outline=c["ink"], radius=8)
    draw.text((x + 30, y + 27), badge, font=font(14, "bold"), fill=c["bg"])
    draw.text((x + 76, y + 18), title, font=font(21, "bold"), fill=c["ink"])
    multiline(draw, (x + 76, y + 49), body, font(16), c["muted"], width - 100, 5)


def app_card(draw, c, box, title="Recent Results"):
    shadow(draw, box, c)
    rr(draw, box, c, fill=c["panel"], radius=8)
    x1, y1, x2, _ = box
    draw.rectangle((x1, y1, x2, y1 + 58), fill=c["panel2"])
    draw.text((x1 + 24, y1 + 18), title, font=font(17, "bold"), fill=c["ink"])
    for i, color in enumerate((c["rose"], c["warn"], c["accent"])):
        draw.ellipse((x2 - 75 + i * 19, y1 + 25, x2 - 64 + i * 19, y1 + 36), fill=color)


def thumb(draw, c, box):
    rr(draw, box, c, fill=c["chip"], outline=c["line"], radius=8)
    x1, y1, x2, y2 = box
    draw.polygon([(x1 + 28, y2 - 22), (x1 + 58, y1 + 25), (x2 - 20, y2 - 22)], fill=(*c["accent2"], 85))
    draw.rectangle((x1 + 18, y1 + 18, x2 - 22, y2 - 18), outline=(*c["ink"], 120), width=2)


def chip(draw, c, x, y, text, good=False):
    f = font(13, "bold")
    tw, th = text_size(draw, text, f)
    fill = (*c["accent"], 34) if good else c["chip"]
    outline = (*c["accent"], 100) if good else c["line"]
    rr(draw, (x, y, x + tw + 20, y + 28), c, fill=fill, outline=outline, radius=8)
    draw.text((x + 10, y + 6), text, font=f, fill=c["accent"] if good else c["muted"])
    return x + tw + 28


def result_row(draw, c, box, name, chips, latest=False):
    x1, y1, x2, y2 = box
    fill = (*c["accent"], 32) if latest else (*c["panel2"], 210)
    outline = (*c["accent"], 180) if latest else c["line"]
    rr(draw, box, c, fill=fill, outline=outline, width=2 if latest else 1, radius=8)
    if latest:
        draw.rounded_rectangle((x2 - 120, y1 - 16, x2 - 20, y1 + 18), radius=8, fill=c["accent"])
        draw.text((x2 - 96, y1 - 8), "LATEST", font=font(12, "bold"), fill=(5, 20, 14))
    thumb(draw, c, (x1 + 18, y1 + 16, x1 + 132, y1 + 80))
    draw.text((x1 + 150, y1 + 20), name, font=font(22, "bold"), fill=c["ink"])
    cx = x1 + 150
    for item in chips:
        cx = chip(draw, c, cx, y1 + 55, item, item in ("Done", "Saved"))
    chip(draw, c, x2 - 84, y1 + 34, "Done", True)


def hero(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "v0.4.1 - Precision Polish")
    title_block(
        draw,
        c,
        "Sharper\ndownloads.\nCleaner flow.",
        "Finished cards show size and duration, the quick panel fits better, settings persist, and presets can name files their own way.",
        "Small release. Real daily fixes.",
    )
    app_card(draw, c, (748, 252, 1530, 690))
    result_row(draw, c, (768, 332, 1510, 454), "Build BIGGER 3D Forearms", ["Done", "182.4 MB total", "12:45"], True)
    result_row(draw, c, (768, 474, 1510, 560), "Instagram carousel export", ["8 files", "48.2 MB", "Saved"])
    result_row(draw, c, (768, 580, 1510, 666), "Clip: lecture highlights", ["01:30 to 03:15", "MP4"])
    return img


def quick_panel(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "Issue #6")
    panel = (130, 330, 604, 630)
    shadow(draw, panel, c)
    rr(draw, panel, c, fill=c["panel"], radius=8)
    draw.text((154, 360), "Quick Download", font=font(17, "bold"), fill=c["ink"])
    chip(draw, c, 450, 354, "Clipboard ready")
    for i, text in enumerate(("https://youtu.be/dQw4w9WgXcQ", "Preset: Best MP4")):
        y = 400 + i * 60
        rr(draw, (152, y, 584, y + 48), c, fill=c["panel2"], radius=8)
        draw.text((166, y + 14), text, font=font(14, "bold"), fill=c["muted"])
        draw.text((520, y + 14), "Paste" if i == 0 else "Change", font=font(13, "bold"), fill=c["muted"])
    cx = 152
    for item in ("Downloads folder", "Start now", "Subs off"):
        cx = chip(draw, c, cx, 520, item)
    rr(draw, (152, 556, 584, 610), c, fill=c["accent"], outline=c["accent"], radius=8)
    draw.text((322, 570), "Download", font=font(18, "bold"), fill=(5, 20, 14))
    draw.text((718, 210), "Compact where it counts.", font=font(58, "bold"), fill=c["ink"])
    multiline(draw, (718, 300), "The quick panel now keeps the action reachable instead of letting helper text push the button out of view.", font(27, "semibold"), c["muted"], 690)
    feature(draw, c, 718, 454, "1", "Less repeated metadata", "Save location, start mode, and subtitles collapse into one readable summary.")
    feature(draw, c, 718, 564, "2", "Better small-screen flow", "The download button stays easier to reach on compact Windows setups.")
    feature(draw, c, 718, 674, "E", "Keyboard friendly", "Paste, review, press Enter, move on.")
    return img


def latest_glow(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "Notification spotlight")
    title_block(draw, c, "Glow once.\nMark clearly.", "Clicked notifications now route to the right result with a finite glow and a clear latest marker.", "Latest result fixed", x=74, y=230)
    feature(draw, c, 74, 560, "1", "Just finished", "The newest completed card gets the spotlight, not the second-last result.", 570)
    feature(draw, c, 74, 670, "2", "Finite animation", "The glow calls attention, then settles down.", 570)
    app_card(draw, c, (720, 220, 1530, 716))
    result_row(draw, c, (742, 300, 1508, 400), "Instagram post DW6-Z45kJjG", ["5m ago", "Done"])
    result_row(draw, c, (742, 424, 1508, 546), "Nanami vs Haruta Shigemo", ["Now", "74 MB", "2:12"], True)
    result_row(draw, c, (742, 570, 1508, 670), "Build BIGGER 3D Forearms", ["23h ago", "Done"])
    return img


def download_details(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "File size + duration + clips")
    card = (104, 190, 782, 730)
    shadow(draw, card, c)
    rr(draw, card, c, fill=c["panel"], radius=8)
    thumb(draw, c, (132, 220, 754, 474))
    draw.text((132, 504), "Lecture highlights with subtitles", font=font(30, "bold"), fill=c["ink"])
    cx = 132
    for item in ("MP4", "English VTT", "Auto copied"):
        cx = chip(draw, c, cx, 548, item)
    labels = [("Total size", "248.7 MB"), ("Duration", "18:05"), ("Clip", "01:30-03:15")]
    for i, (label, value) in enumerate(labels):
        x = 132 + i * 203
        rr(draw, (x, 606, x + 184, 690), c, fill=c["panel2"], radius=8)
        draw.text((x + 16, 622), label.upper(), font=font(12, "bold"), fill=c["muted"])
        draw.text((x + 16, 646), value, font=font(23, "bold"), fill=c["ink"])
    draw.text((850, 214), "Cards tell the whole story.", font=font(56, "bold"), fill=c["ink"])
    multiline(draw, (850, 306), "Finished results now show practical details without opening History or checking the file manually.", font(27, "semibold"), c["muted"], 660)
    feature(draw, c, 850, 462, "MB", "Total output size", "Video, subtitles, and sidecars count together.", 600)
    feature(draw, c, 850, 572, "T", "Timeline when it exists", "Images stay clean; timed media shows duration.", 600)
    feature(draw, c, 850, 682, "C", "Clip ranges", "Use seconds, mm:ss, or hh:mm:ss for precise downloads.", 600)
    return img


def preset_filenames(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "Issue #5")
    title_block(draw, c, "Presets can\nname files now.", "Filename templates live inside the preset, so a preset can shape the final output path every time.", "Preset-level filenames", x=74, y=230)
    feature(draw, c, 74, 560, "5", "Preset-level templates", "Keep naming behavior with the preset instead of repeating it per download.", 570)
    feature(draw, c, 74, 670, "E", "Extension safety", "Leave out %(ext)s and HalalDL adds it before download.", 570)
    card = (760, 218, 1460, 704)
    shadow(draw, card, c)
    rr(draw, card, c, fill=c["panel"], radius=8)
    draw.text((792, 254), "WhatsApp Optimized", font=font(35, "bold"), fill=c["ink"])
    draw.text((792, 334), "FILENAME TEMPLATE", font=font(13, "bold"), fill=c["muted"])
    rr(draw, (792, 362, 1428, 420), c, fill=c["panel2"], radius=8)
    draw.text((810, 379), "%(uploader)s/%(title)s [%(id)s].%(ext)s", font=font(20), fill=c["ink"])
    cx = 792
    for item in ("Title", "Date", "ID", "Uploader"):
        cx = chip(draw, c, cx, 444, item)
    draw.text((792, 538), "EXAMPLE OUTPUT", font=font(13, "bold"), fill=c["muted"])
    rr(draw, (792, 566, 1428, 624), c, fill=c["panel2"], radius=8)
    draw.text((810, 583), "Creator/Clip title [a1b2c3].mp4", font=font(20), fill=c["ink"])
    return img


def settings_fix(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "Issue #7")
    panel = (96, 196, 800, 720)
    shadow(draw, panel, c)
    rr(draw, panel, c, fill=c["panel"], radius=8)
    draw.rectangle((96, 196, 800, 258), fill=c["panel2"])
    draw.text((126, 218), "Settings - Behavior", font=font(21, "bold"), fill=c["ink"])
    chip(draw, c, 690, 214, "Saved", True)
    rows = [
        ("Tray left click", "Choose what one click does.", "Open main app"),
        ("Tray double click", "Keep the tray action predictable.", "Open main app"),
        ("Quick default preset", "Used by quick downloads.", "Best MP4"),
    ]
    y = 292
    for title, body, value in rows:
        rr(draw, (126, y, 770, y + 104), c, fill=c["panel2"], radius=8)
        draw.text((146, y + 18), title, font=font(21, "bold"), fill=c["ink"])
        draw.text((146, y + 50), body, font=font(15), fill=c["muted"])
        rr(draw, (508, y + 28, 704, y + 72), c, fill=(*c["accent"], 35), outline=(*c["accent"], 120), radius=8)
        draw.text((526, y + 40), value, font=font(15, "bold"), fill=c["accent"])
        draw.text((730, y + 38), "OK", font=font(15, "bold"), fill=c["accent"])
        y += 122
    draw.text((870, 226), "Settings stay changed.", font=font(56, "bold"), fill=c["ink"])
    multiline(draw, (870, 318), "The Settings screen now commits changes automatically, so navigating away no longer silently throws away tray behavior edits.", font(27, "semibold"), c["muted"], 620)
    feature(draw, c, 870, 500, "7", "Persistence fix", "Tray click choices keep their saved value after you leave Settings.", 590)
    feature(draw, c, 870, 610, "OK", "Auto-commit", "Changes move from draft to saved state automatically.", 590)
    return img


RENDERERS = {
    "hero": hero,
    "quick-panel": quick_panel,
    "latest-glow": latest_glow,
    "download-details": download_details,
    "preset-filenames": preset_filenames,
    "settings-fix": settings_fix,
}

SCREENSHOT_MAP = {
    "download-details": "downloads-result-details",
    "quick-panel": "quick-panel-compact",
    "preset-filenames": "preset-filename-template",
    "settings-fix": "settings-persistence",
    "latest-glow": "latest-result-spotlight",
}


def main():
    PROMO.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    for theme in ("light", "dark"):
        for name, renderer in RENDERERS.items():
            img = renderer(theme)
            img.save(PROMO / f"{name}-{theme}.png", optimize=True)
            if name in SCREENSHOT_MAP:
                img.save(SCREENSHOTS / f"{SCREENSHOT_MAP[name]}-{theme}.png", optimize=True)


if __name__ == "__main__":
    main()
