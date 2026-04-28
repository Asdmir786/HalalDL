from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / "dist"
PROMO_DIR = ROOT / "docs" / "assets" / "releases" / "0.5.0" / "promo"
SERVER_SCRIPT = ROOT / "scripts" / "release-promo-server.cjs"
NPX_CMD = Path(r"C:\nvm4w\nodejs\npx.cmd")
HOST = "127.0.0.1"
PORT = 4173
BASE_URL = f"http://{HOST}:{PORT}/?releasePromo=0.5.0"
HASH_BASE_URL = f"http://{HOST}:{PORT}/#/release-promo/0.5.0"
SCENES = {
    "hero": "hero",
    "portable-mode": "portable-mode",
    "instagram-reliability": "instagram-reliability",
    "archive-contact-sheets": "archive-contact-sheets",
}

THEMES = ("light", "dark")


def wait_for_server() -> None:
    deadline = time.time() + 15
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urlopen(f"http://{HOST}:{PORT}/", timeout=2) as response:
                if response.status == 200:
                    return
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(0.5)
    raise RuntimeError(f"Server did not start in time: {last_error}")


def main() -> int:
    if not DIST_DIR.exists():
        raise FileNotFoundError("dist directory does not exist. Run `pnpm build` first.")

    PROMO_DIR.mkdir(parents=True, exist_ok=True)

    server = subprocess.Popen(
        ["node", str(SERVER_SCRIPT), str(DIST_DIR), HOST, str(PORT)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_server()
        for scene, scene_param in SCENES.items():
            for theme in THEMES:
                destination = PROMO_DIR / f"{scene}-{theme}.png"
                url = f"{HASH_BASE_URL}/{scene_param}/{theme}"
                subprocess.run(
                    [
                        "cmd",
                        "/c",
                        str(NPX_CMD),
                        "playwright",
                        "screenshot",
                        "--browser=chromium",
                        "--device=Desktop Chrome HiDPI",
                        "--wait-for-timeout=1200",
                        url,
                        str(destination),
                    ],
                    check=True,
                    cwd=ROOT,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                print(f"captured {destination.relative_to(ROOT)}")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    return 0


if __name__ == "__main__":
    sys.exit(main())
