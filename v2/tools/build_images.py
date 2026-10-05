"""Palmiye Home V2 — production image builder.

Reads the 18 approved retouched originals (never modified), writes metadata-free
AVIF + WebP variants (plus one JPEG fallback per image) into v2/public/assets/img/
and records everything in v2/src/assets-manifest.json.

Usage:
    python v2/tools/build_images.py            # build (skips up-to-date outputs)
    python v2/tools/build_images.py --force    # rebuild everything
    python v2/tools/build_images.py --verify   # only verify outputs + metadata
"""
import hashlib
import json
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]           # v2/
SRC_DIR = Path(r"D:\ProjelerFinal\WebProjesi\YeniResimlerWebProject\Rutuslular")
OUT_DIR = ROOT / "public" / "assets" / "img"
MANIFEST = ROOT / "src" / "assets-manifest.json"

# Quality settings: visually clean at photo sizes, far below the 2–3 MB PNG originals.
AVIF_Q = 52
WEBP_Q = 78
JPEG_Q = 80
WIDTHS = [480, 800, 1200, 1600]

# slug, source file, role, crop (None = full frame)
# Crops are (left, top, right, bottom) in source pixels.
IMAGES = [
    ("hero-pool-mountain", "DagManzaraliModernHavuzluTatilKoyu.png", "hero", None),
    ("house-mountain", "ModernVillaHavuzuveDagManzarasi.png", "home", None),
    ("pool-loungers", "DagManzaraliHuzurluHavuzAlani.png", "pool", None),
    ("pool-palms-house", "DagManzaraliModernHavuzluTatilTesisi.png", "pool", None),
    ("pool-garden-mountain", "DogalYeşilliklerIcindeDagManzaraliHavuz.png", "pool", None),
    ("exterior-pool", "DagManzaraliModernHavuzluSite.png", "gallery", None),
    ("aerial-pool", "SimetrikModernSiteveHavuzManzarasi.png", "gallery", None),
    ("terrace-seating", "GünesliBahceTerasındaSikOturmaGrubu.png", "outdoor", None),
    ("terrace-pool", "ModernHavuzluVillaTerası.png", "outdoor", None),
    ("garden", "ModernEvveYemyesilBahcesi.png", "outdoor", None),
    ("living-room", "AydinlikModernGriSalon.png", "apartment", None),
    ("living-kitchen", "AydinlikModernSalonveMutfak.png", "apartment", None),
    ("kitchen", "ModernAhsapTonluKompaktMutfak.png", "apartment", None),
    ("kitchen-entrance", "ModernAhsapTonluAcıkMutfakveAntre.png", "gallery", None),
    ("bedroom", "AydinlikModernYatakOdasi.png", "apartment", None),
    ("bedroom-wardrobe", "AydinlikMinimalistYatakOdasi.png", "gallery", None),
    ("bathroom", "ModernGriFayansiBanyo.png", "gallery", None),
    ("bathroom-laundry", "ModernGriMermerBanyoveCamasirAlani.png", "gallery", None),
]

# Extra art-directed crops of the hero (IMG_0167 retouch).
HERO_MOBILE = ("hero-pool-mountain-portrait", "DagManzaraliModernHavuzluTatilKoyu.png",
               "hero-mobile", (244, 0, 997, 941), [480, 753])
OG_IMAGE = ("og-image", "DagManzaraliModernHavuzluTatilKoyu.png", "og", 1200, 630)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def clean_rgb(im):
    """Return a pixel-only RGB copy: no EXIF, ICC, XMP, text chunks or GPS."""
    rgb = im.convert("RGB")
    out = Image.new("RGB", rgb.size)
    out.paste(rgb)
    return out


def save_variant(im, path, fmt):
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "avif":
        im.save(path, "AVIF", quality=AVIF_Q, speed=4, subsampling="4:2:0")
    elif fmt == "webp":
        im.save(path, "WEBP", quality=WEBP_Q, method=6)
    elif fmt == "jpg":
        im.save(path, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
    return path.stat().st_size


def has_metadata(path):
    with Image.open(path) as im:
        exif = im.getexif()
        keys = {k for k in im.info if k not in ("progressive", "progression", "jfif",
                                                 "jfif_version", "jfif_unit", "jfif_density",
                                                 "dpi", "loop", "duration", "background",
                                                 "timestamp")}
        return bool(len(exif)) or bool(keys & {"exif", "xmp", "icc_profile", "XML:com.adobe.xmp", "gps"})


def resize(im, width):
    if width >= im.width:
        return im
    height = round(im.height * width / im.width)
    return im.resize((width, height), Image.LANCZOS)


def build_set(slug, src_name, role, crop, widths, force, fallback_width=1200):
    src = SRC_DIR / src_name
    with Image.open(src) as raw:
        base = clean_rgb(raw)
        src_size = raw.size
    if crop:
        base = base.crop(crop)
    usable = sorted({w for w in widths if w < base.width} | {min(max(widths), base.width)})
    variants = []
    for w in usable:
        im = resize(base, w)
        for fmt in ("avif", "webp"):
            out = OUT_DIR / f"{slug}-{im.width}.{fmt}"
            size = out.stat().st_size if (out.exists() and not force) else save_variant(im, out, fmt)
            variants.append({"file": f"assets/img/{out.name}", "format": fmt,
                             "width": im.width, "height": im.height, "bytes": size})
    fb_w = max(w for w in usable if w <= max(fallback_width, min(usable)))
    fb = resize(base, fb_w)
    out = OUT_DIR / f"{slug}-{fb.width}.jpg"
    size = out.stat().st_size if (out.exists() and not force) else save_variant(fb, out, "jpg")
    variants.append({"file": f"assets/img/{out.name}", "format": "jpg",
                     "width": fb.width, "height": fb.height, "bytes": size})
    return {
        "slug": slug,
        "role": role,
        "source": {"file": src_name, "width": src_size[0], "height": src_size[1],
                   "bytes": src.stat().st_size, "sha256": sha256(src)},
        "crop": list(crop) if crop else None,
        "aspect": [base.width, base.height],
        "variants": variants,
    }


def build(force=False):
    found = sorted(p.name for p in SRC_DIR.iterdir() if p.is_file())
    listed = sorted(i[1] for i in IMAGES)
    if found != listed:
        print("SOURCE MISMATCH — nothing deleted. found-only:", set(found) - set(listed),
              "listed-only:", set(listed) - set(found))
        sys.exit(2)

    entries = [build_set(s, f, r, c, WIDTHS, force) for s, f, r, c in IMAGES]
    s, f, r, c, w = HERO_MOBILE
    entries.append(build_set(s, f, r, c, w, force, fallback_width=753))

    # Open Graph image: 1200x630 centre crop of the hero, JPEG, no text overlay.
    slug, src_name, role, ow, oh = OG_IMAGE
    with Image.open(SRC_DIR / src_name) as raw:
        base = clean_rgb(raw)
    scale = ow / base.width
    im = base.resize((ow, round(base.height * scale)), Image.LANCZOS)
    top = max(0, (im.height - oh) // 2 - 20)
    im = im.crop((0, top, ow, top + oh))
    out = OUT_DIR / f"{slug}.jpg"
    size = save_variant(im, out, "jpg")
    entries.append({"slug": slug, "role": role,
                    "source": {"file": src_name, "sha256": sha256(SRC_DIR / src_name)},
                    "crop": "centre 1200x630", "aspect": [ow, oh],
                    "variants": [{"file": f"assets/img/{out.name}", "format": "jpg",
                                  "width": ow, "height": oh, "bytes": size}]})

    MANIFEST.write_text(json.dumps({
        "_about": "Generated by v2/tools/build_images.py. Originals are read-only; outputs are metadata-free.",
        "source_dir": str(SRC_DIR),
        "settings": {"avif_quality": AVIF_Q, "webp_quality": WEBP_Q, "jpeg_quality": JPEG_Q},
        "images": entries,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: {len(entries)} image sets, manifest -> {MANIFEST.relative_to(ROOT.parent)}")


def verify():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    problems, total, count = [], 0, 0
    for e in data["images"]:
        src = SRC_DIR / e["source"]["file"]
        if sha256(src) != e["source"]["sha256"]:
            problems.append(f"source changed: {src.name}")
        for v in e["variants"]:
            p = ROOT / "public" / v["file"]
            if not p.exists():
                problems.append(f"missing: {v['file']}")
                continue
            count += 1
            total += p.stat().st_size
            if has_metadata(p):
                problems.append(f"metadata present: {v['file']}")
            with Image.open(p) as im:
                if im.size != (v["width"], v["height"]):
                    problems.append(f"size mismatch: {v['file']}")
    print(f"verified {count} files, {total/1024/1024:.2f} MB total")
    for p in problems:
        print("FAIL", p)
    return not problems


if __name__ == "__main__":
    if "--verify" in sys.argv:
        sys.exit(0 if verify() else 1)
    build(force="--force" in sys.argv)
    sys.exit(0 if verify() else 1)
