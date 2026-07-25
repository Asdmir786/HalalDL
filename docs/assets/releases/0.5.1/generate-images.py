from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PROMO = ROOT / "promo"
SCREENSHOTS = ROOT / "screenshots"
W, H = 1600, 900

FONT = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")
SEMIBOLD = Path("C:/Windows/Fonts/seguisb.ttf")

# Locked HalalDL Steel Blue + Mint brand tokens
NAVY = (8, 14, 23)
STEEL = (44, 62, 85)
MUTED_STEEL = (91, 127, 168)
MINT = (38, 224, 198)
MINT_ACCESSIBLE = (11, 127, 114)
SOFT_LIGHT = (245, 247, 251)
WHITE = (255, 255, 255)


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


def explicit_lines(draw, xy, lines, fnt, fill, line_gap=12):
    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += text_size(draw, line, fnt)[1] + line_gap
    return y


def theme_values(theme):
    if theme == "dark":
        return {
            "bg": NAVY,
            "bg2": (12, 20, 32),
            "ink": SOFT_LIGHT,
            "muted": MUTED_STEEL,
            "panel": (20, 32, 48),
            "panel2": (28, 42, 62),
            "line": (58, 82, 112),
            "chip": (32, 48, 70),
            "shadow": (0, 0, 0, 110),
            "accent": MINT,
            "accent2": MUTED_STEEL,
            "steel": STEEL,
            "warn": (242, 189, 66),
            "rose": (240, 90, 122),
            "btn_ink": NAVY,
        }
    return {
        "bg": SOFT_LIGHT,
        "bg2": (226, 234, 244),
        "ink": NAVY,
        "muted": MUTED_STEEL,
        "panel": WHITE,
        "panel2": (232, 238, 246),
        "line": (196, 210, 226),
        "chip": (224, 232, 242),
        "shadow": (44, 62, 85, 38),
        "accent": MINT_ACCESSIBLE,
        "accent2": MUTED_STEEL,
        "steel": STEEL,
        "warn": (190, 130, 24),
        "rose": (210, 70, 102),
        "btn_ink": WHITE,
    }


def make_canvas(theme):
    c = theme_values(theme)
    img = Image.new("RGB", (W, H), c["bg"])
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(0, H, 38):
        draw.line((0, y, W, y), fill=(*c["line"], 36), width=1)
    for x in range(0, W, 38):
        draw.line((x, 0, x, H), fill=(*c["line"], 36), width=1)
    draw.ellipse((-220, -180, 540, 540), fill=(*c["steel"], 48))
    draw.ellipse((1120, 540, 1840, 1180), fill=(*c["accent"], 34))
    draw.ellipse((1020, -260, 1730, 440), fill=(*c["accent2"], 30))
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
    rr(draw, (x, y - 70, x + 300, y - 29), c, fill=(*c["accent"], 34), outline=(*c["accent"], 85), radius=8)
    draw.text((x + 15, y - 60), tag, font=font(15, "bold"), fill=c["accent"])
    title_bottom = explicit_lines(draw, (x, y), title.splitlines(), font(68, "bold"), c["ink"], 14)
    multiline(draw, (x, title_bottom + 24), body, font(25, "semibold"), c["muted"], width, 11)


def feature(draw, c, x, y, badge, title, body, width=620):
    rr(draw, (x, y, x + width, y + 92), c, fill=(*c["panel"], 225), radius=8)
    rr(draw, (x + 18, y + 21, x + 58, y + 61), c, fill=c["steel"], outline=c["steel"], radius=8)
    draw.text((x + 30, y + 27), badge, font=font(14, "bold"), fill=WHITE)
    draw.text((x + 76, y + 18), title, font=font(21, "bold"), fill=c["ink"])
    multiline(draw, (x + 76, y + 49), body, font(16), c["muted"], width - 100, 5)


def chip(draw, c, x, y, text, good=False):
    f = font(13, "bold")
    tw, _ = text_size(draw, text, f)
    fill = (*c["accent"], 34) if good else c["chip"]
    outline = (*c["accent"], 100) if good else c["line"]
    rr(draw, (x, y, x + tw + 20, y + 28), c, fill=fill, outline=outline, radius=8)
    draw.text((x + 10, y + 6), text, font=f, fill=c["accent"] if good else c["muted"])
    return x + tw + 28


def button(draw, c, box, label, primary=False):
    fill = c["accent"] if primary else c["panel2"]
    ink = c["btn_ink"] if primary else c["ink"]
    rr(draw, box, c, fill=fill, outline=c["accent"] if primary else c["line"], radius=8)
    x1, y1, x2, y2 = box
    tw, th = text_size(draw, label, font(15, "bold"))
    draw.text(((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2 - 1), label, font=font(15, "bold"), fill=ink)


def hero(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "v0.5.1 - Trust And Feedback")
    title_block(
        draw,
        c,
        "Trust first.\nFeedback easy.\nBrand locked.",
        "Copy Diagnostics, gentle support prompts after real usage, faster startup, and the official Steel Blue + Mint identity.",
        "Small release. Clearer trust.",
        width=640,
    )
    cards = [
        ("01", "Install Trust", "GitHub Releases, SmartScreen honesty, SHA256 checks."),
        ("02", "Copy Diagnostics", "Paste-ready support info for better bug reports."),
        ("03", "Faster Launch", "Skip startup tool probes. Check tools on demand."),
    ]
    y = 250
    for badge, title, body in cards:
        feature(draw, c, 820, y, badge, title, body, 680)
        y += 120
    chip(draw, c, 74, 760, "Steel Blue + Mint", True)
    chip(draw, c, 250, 760, "Full / Lite / Portable")
    chip(draw, c, 460, 760, "Unsigned for now")
    return img


def trust_diagnostics(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "Install Trust + Diagnostics")
    panel = (90, 180, 760, 760)
    shadow(draw, panel, c)
    rr(draw, panel, c, fill=c["panel"], radius=10)
    draw.rectangle((90, 180, 760, 248), fill=c["panel2"])
    draw.text((118, 202), "Settings · About", font=font(22, "bold"), fill=c["ink"])
    chip(draw, c, 620, 200, "Full · NSIS", True)

    rr(draw, (118, 280, 732, 430), c, fill=c["panel2"], radius=10)
    draw.text((142, 300), "Install Trust", font=font(24, "bold"), fill=c["ink"])
    multiline(
        draw,
        (142, 340),
        "Official HalalDL downloads come from GitHub Releases. Releases are currently unsigned, so Windows SmartScreen may appear. Verify with SHA256SUMS.txt when needed.",
        font(16),
        c["muted"],
        560,
        6,
    )
    button(draw, c, (142, 470, 330, 518), "Open latest release", False)
    button(draw, c, (348, 470, 560, 518), "Code signing policy", False)

    rr(draw, (118, 560, 732, 700), c, fill=(*c["accent"], 22), outline=(*c["accent"], 90), radius=10)
    draw.text((142, 584), "Copy Diagnostics", font=font(24, "bold"), fill=c["ink"])
    multiline(
        draw,
        (142, 626),
        "Version, mode, package, tools, history counts, and startup timings — ready for GitHub issues.",
        font(16),
        c["muted"],
        540,
        6,
    )
    button(draw, c, (560, 640, 700, 684), "Copy", True)

    draw.text((850, 220), "Trust you can\nverify.", font=font(58, "bold"), fill=c["ink"])
    multiline(
        draw,
        (850, 380),
        "About now answers the scary install questions before they become blockers, and diagnostics make feedback actually useful.",
        font(26, "semibold"),
        c["muted"],
        640,
        12,
    )
    feature(draw, c, 850, 540, "T", "Install Trust card", "Honest SmartScreen note plus official download source.", 640)
    feature(draw, c, 850, 660, "D", "Copy Diagnostics", "One paste for support instead of twenty questions.", 640)
    return img


def support_prompts(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "After 3 completed downloads")
    title_block(
        draw,
        c,
        "Ask after\nvalue, not\nbefore.",
        "Star and Feedback prompts appear only after real usage. No first-launch nag. No modal wall.",
        "Support prompts",
        y=230,
        width=560,
    )
    feature(draw, c, 74, 560, "1", "About card", "Gentle Star / Feedback / Not now in Settings.", 560)
    feature(draw, c, 74, 680, "2", "History footer", "Same low-pressure ask where finished work lives.", 560)

    card = (740, 220, 1520, 700)
    shadow(draw, card, c)
    rr(draw, card, c, fill=c["panel"], radius=10)
    draw.rectangle((740, 220, 1520, 290), fill=c["panel2"])
    draw.text((770, 244), "History · Recent results", font=font(20, "bold"), fill=c["ink"])
    chip(draw, c, 1320, 240, "3 done", True)

    rows = [
        ("Lecture clip export", "Done · 48.2 MB"),
        ("Instagram carousel", "Done · 8 files"),
        ("WhatsApp Optimized", "Done · 74 MB"),
    ]
    y = 320
    for title, meta in rows:
        rr(draw, (770, y, 1490, y + 70), c, fill=c["panel2"], radius=8)
        draw.text((794, y + 14), title, font=font(18, "bold"), fill=c["ink"])
        draw.text((794, y + 40), meta, font=font(14), fill=c["muted"])
        y += 86

    rr(draw, (770, 590, 1490, 670), c, fill=(*c["accent"], 24), outline=(*c["accent"], 100), radius=10)
    draw.text((794, 608), "Enjoying HalalDL?", font=font(18, "bold"), fill=c["ink"])
    draw.text((794, 636), "A star or a short GitHub issue helps a lot.", font=font(14), fill=c["muted"])
    button(draw, c, (1180, 610, 1268, 652), "Star", True)
    button(draw, c, (1280, 610, 1388, 652), "Feedback", False)
    button(draw, c, (1400, 610, 1478, 652), "Later", False)
    return img


def faster_startup(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "Settings · Performance")
    panel = (90, 170, 780, 760)
    shadow(draw, panel, c)
    rr(draw, panel, c, fill=c["panel"], radius=10)
    draw.rectangle((90, 170, 780, 238), fill=c["panel2"])
    draw.text((118, 192), "Performance", font=font(22, "bold"), fill=c["ink"])
    chip(draw, c, 620, 190, "Live timings", True)

    metrics = [
        ("App ready", "1.42 s"),
        ("UI hydrated", "0.68 s"),
        ("Persistence", "0.31 s"),
        ("Tools on demand", "Skipped at boot"),
    ]
    y = 280
    for label, value in metrics:
        rr(draw, (118, y, 752, y + 84), c, fill=c["panel2"], radius=8)
        draw.text((142, y + 18), label, font=font(20, "bold"), fill=c["ink"])
        draw.text((142, y + 48), "Included in Copy Diagnostics", font=font(14), fill=c["muted"])
        tw, _ = text_size(draw, value, font(18, "bold"))
        draw.text((730 - tw, y + 30), value, font=font(18, "bold"), fill=c["accent"])
        y += 100

    draw.text((860, 210), "Launch faster.\nCheck later.", font=font(56, "bold"), fill=c["ink"])
    multiline(
        draw,
        (860, 370),
        "Startup no longer probes every managed tool up front. Tools are verified when you need them, and timings stay visible for support.",
        font(25, "semibold"),
        c["muted"],
        640,
        12,
    )
    feature(draw, c, 860, 540, "P", "Performance section", "See startup timings without opening a terminal.", 640)
    feature(draw, c, 860, 660, "Q", "On-demand checks", "Skip boot probes. Keep Full / Portable reliability.", 640)
    return img


def brand_identity(theme):
    img, draw, c = make_canvas(theme)
    header(draw, c, "Official brand")
    title_block(
        draw,
        c,
        "Steel Blue\n+ Mint.",
        "The default theme, logos, and Windows icons now match the approved HalalDL identity.",
        "Brand identity",
        y=230,
        width=560,
    )

    swatches = [
        ("Deep Navy", NAVY, WHITE),
        ("Steel Blue", STEEL, WHITE),
        ("Muted Steel", MUTED_STEEL, WHITE),
        ("Mint", MINT, NAVY),
        ("Soft Light", SOFT_LIGHT, NAVY),
    ]
    x = 74
    for name, color, ink in swatches:
        rr(draw, (x, 560, x + 136, 760), c, fill=color, outline=c["ink"] if color == SOFT_LIGHT else c["line"], width=2 if color == SOFT_LIGHT else 1, radius=12)
        draw.text((x + 12, 702), name, font=font(13, "bold"), fill=ink)
        x += 150

    mark = (920, 220, 1520, 760)
    shadow(draw, mark, c)
    rr(draw, mark, c, fill=c["panel"], radius=12)
    draw.ellipse((1040, 300, 1340, 600), fill=c["steel"])
    draw.ellipse((1100, 360, 1280, 540), fill=(*c["accent"], 230))
    draw.text((1060, 640), "BrandLogo", font=font(28, "bold"), fill=c["ink"])
    draw.text((1060, 684), "Theme-aware mark · Sidebar + About", font=font(16), fill=c["muted"])
    chip(draw, c, 1060, 720, "Windows icons updated", True)
    return img


RENDERERS = {
    "hero": hero,
    "trust-diagnostics": trust_diagnostics,
    "support-prompts": support_prompts,
    "faster-startup": faster_startup,
    "brand-identity": brand_identity,
}

SCREENSHOT_MAP = {
    "trust-diagnostics": "about-trust",
    "support-prompts": "support-prompt",
    "faster-startup": "settings-performance",
    "brand-identity": "brand-logo",
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
    print(f"Wrote {len(RENDERERS) * 2} promo images and {len(SCREENSHOT_MAP) * 2} screenshot aliases to {ROOT}")


if __name__ == "__main__":
    main()
