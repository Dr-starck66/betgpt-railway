#!/usr/bin/env python3
"""Crop royalty-free photos to Google Discover 1200×675 (16:9) JPEGs."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path("/workspace/public/blog")
RAW = ROOT / "raw"
RAW2 = ROOT / "raw2"
OUT = ROOT / "discover"
W, H = 1200, 675


def crop_16x9(im: Image.Image, focus: str = "center") -> Image.Image:
    im = ImageOps.exif_transpose(im)
    if im.mode != "RGB":
        im = im.convert("RGB")
    w, h = im.size
    target = 16 / 9
    cur = w / h
    if cur > target:
        nw = int(h * target)
        left = (w - nw) // 2
        im = im.crop((left, 0, left + nw, h))
    elif cur < target:
        nh = int(w / target)
        if focus == "top":
            top = int((h - nh) * 0.12)
        elif focus == "bottom":
            top = h - nh
        else:
            top = (h - nh) // 2
        top = max(0, min(top, h - nh))
        im = im.crop((0, top, w, top + nh))
    return im.resize((W, H), Image.Resampling.LANCZOS)


def save(src: Path, dest: Path, focus: str = "center") -> None:
    with Image.open(src) as im:
        out = crop_16x9(im, focus)
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "JPEG", quality=86, optimize=True, progressive=True, subsampling=0)


# slug -> (source relative to /workspace/public/blog, focus)
COVERS: dict[str, tuple[str, str]] = {
    "pronostic-football-aujourdhui": ("raw2/p-3621104.jpg", "center"),
    "meilleures-cotes-football": ("raw2/u-laptop.jpg", "center"),
    "value-bet-football": ("raw2/u-charts.jpg", "center"),
    "score-en-direct-ligue-1": ("raw2/p-16014450.jpg", "center"),
    "pronostic-ligue-des-champions": ("raw2/u-stad3.jpg", "center"),
    "pronostic-ligue-europa": ("raw2/p-1884574.jpg", "center"),
    "classement-ligue-1": ("raw2/p-34242380.jpg", "center"),
    "pari-couverture-score-exact": ("raw2/u-ball2.jpg", "center"),
    "cote-1n2-ou-moins-de-2-5": ("raw2/p-46798.jpg", "center"),
    "jeu-responsable-paris-sportifs": ("raw2/u-think.jpg", "top"),
    "meilleur-site-paris-sportif-en-ligne": ("raw2/u-phone.jpg", "center"),
    "sites-paris-sportifs-legaux-france": ("raw2/u-pro.jpg", "top"),
    "comparatif-bookmakers-football-france": ("raw2/u-desk.jpg", "center"),
    "meilleures-cotes-ou-bonus-paris-sportifs": ("raw2/u-calc.jpg", "center"),
    "meilleur-site-parier-ligue-1": ("raw/src-04.jpg", "center"),
    "meilleur-site-parier-ligue-des-champions": ("raw2/u-kick.jpg", "center"),
    "unibet-betclic-netbet-winamax-cotes": ("raw2/u-papers.jpg", "center"),
    "comment-choisir-site-paris-sportifs": ("raw2/u-pro.jpg", "top"),
    "liens-affiliation-paris-sportifs": ("raw2/u-money.jpg", "center"),
    "paris-sportifs-live-meilleur-site": ("raw2/p-32190705.jpg", "center"),
    "pronostic-football-gratuit": ("raw2/u-kick2.jpg", "center"),
    "pronostic-ligue-1-gratuit": ("raw/src-15.jpg", "center"),
    "pronostic-c1-gratuit": ("raw/src-29.jpg", "center"),
    "pronostic-europa-gratuit": ("raw2/p-1884576.jpg", "center"),
    "pronostic-football-gratuit-fiable": ("raw/src-21.jpg", "center"),
    "pronostic-gratuit-vs-payant": ("raw2/u-stocks.jpg", "center"),
    "pronostic-gratuit-value-bet": ("raw2/u-charts.jpg", "center"),
    "pronostic-football-du-jour-gratuit": ("raw2/u-action.jpg", "center"),
    "pronostic-score-exact-gratuit": ("raw2/p-19436350.jpg", "center"),
    "pronostic-1n2-gratuit": ("raw2/p-3651674.jpg", "center"),
    "xg-football-cest-quoi": ("raw2/p-3148452b.jpg", "center"),
    "xg-vs-buts": ("raw2/p-114296.jpg", "center"),
    "xg-ligue-1": ("raw2/u-stadium-pack.jpg", "center"),
    "xg-ligue-des-champions": ("raw2/p-38546952.jpg", "center"),
    "xg-et-pronostic-football": ("raw/src-11.jpg", "center"),
    "xg-et-cotes": ("raw2/p-598889.jpg", "center"),
    "xg-domicile-exterieur": ("raw2/p-38587211.jpg", "center"),
    "xg-pour-xg-contre": ("raw/src-32.jpg", "center"),
    "xg-en-direct": ("raw2/p-3148452.jpg", "center"),
    "limites-du-xg": ("raw2/u-stad4.jpg", "center"),
}

# comment-choisir reused u-pro — swap to a distinct leftover
COVERS["comment-choisir-site-paris-sportifs"] = ("raw2/u-think.jpg", "top")
# jeu-responsable would collide with think — use empty night stadium (calm, not hype)
COVERS["jeu-responsable-paris-sportifs"] = ("raw/src-19.jpg", "center")
# value-bet and gratuit-value-bet both used charts — split
COVERS["pronostic-gratuit-value-bet"] = ("raw2/u-laptop.jpg", "center")
# meilleures-cotes already laptop — swap that one to remaining ball/pitch that's still "price of the game"
COVERS["meilleures-cotes-football"] = ("raw2/p-47354.jpg", "center")

INLINES: dict[str, tuple[str, str]] = {
    "inline-shot": ("raw/src-11.jpg", "center"),
    "inline-action": ("raw/src-08.jpg", "center"),
    "inline-ball": ("raw/src-01.jpg", "center"),
    "inline-crowd": ("raw/src-14.jpg", "center"),
    "inline-night": ("raw/src-24.jpg", "center"),
    "inline-pitch": ("raw/src-07.jpg", "center"),
    "inline-aerial": ("raw2/p-33703.jpg", "center"),
    "inline-empty": ("raw/src-23.jpg", "center"),
    "inline-live": ("raw2/p-29348229.jpg", "center"),
    "inline-flags": ("raw/src-18.jpg", "center"),
    "inline-desk": ("raw2/u-desk.jpg", "center"),
    "inline-phone": ("raw2/u-phone.jpg", "center"),
    "inline-goal": ("raw2/p-47730.jpg", "center"),
    "inline-ref": ("raw2/p-3651674.jpg", "center"),
    "inline-money": ("raw2/u-calc.jpg", "center"),
    "inline-packed": ("raw/src-09.jpg", "center"),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    used_src: dict[str, str] = {}
    for slug, (rel, focus) in COVERS.items():
        src = ROOT / rel
        dest = OUT / f"{slug}.jpg"
        if not src.exists():
            raise SystemExit(f"missing {src}")
        save(src, dest, focus)
        kb = dest.stat().st_size // 1024
        with Image.open(dest) as im:
            print(f"COVER {slug:44} {im.size[0]}x{im.size[1]} {kb:4}KB  <- {rel}")
        if rel in used_src and used_src[rel] != slug:
            print(f"  WARN duplicate source {rel} also used by {used_src[rel]}")
        used_src[rel] = slug
    for name, (rel, focus) in INLINES.items():
        src = ROOT / rel
        dest = OUT / f"{name}.jpg"
        if not src.exists():
            raise SystemExit(f"missing {src}")
        save(src, dest, focus)
        kb = dest.stat().st_size // 1024
        print(f"INLINE {name:20} {kb:4}KB  <- {rel}")


if __name__ == "__main__":
    main()
