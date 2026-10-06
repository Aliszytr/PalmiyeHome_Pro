"""Palmiye Home 2027 — deterministic release packager (stdlib only).

    python v2/tools/package_release.py --version 1.0.0-rc1 --date 2026-10-06 \
        --root "D:\\ProjelerFinal\\WebProjesi\\PalmiyeHome_2027_RELEASES"

Creates <root>/<date>_v<version>/ with
    publish/      byte-for-byte copy of the production files in v2/public (the deploy root)
    deployment/   secret TEMPLATE + selftest fixtures (never inside the web root)
    checksums/    SHA256SUMS.txt (relative POSIX paths of publish/) + RELEASE_META.sha256
    reports/      (filled by the release report)
    RELEASE_MANIFEST.json, VERSION.txt

Refuses to run unless: the git working tree is clean, v2/public is up to date with the sources,
and every test suite passes. Refuses to overwrite an existing release folder. Never touches the
live server, the legacy PalmiyeHome_Pro/publish folder or anything outside the new release folder.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
V2 = Path(__file__).resolve().parents[1]
REPO = V2.parent
PUB = V2 / "public"
CONFIG = json.loads((REPO / "config" / "site-config.json").read_text(encoding="utf-8"))

SUITES = [
    ("verify_v2", [sys.executable, str(V2 / "tools" / "verify_v2.py")], r"(\d+)/(\d+) checks passed"),
    ("verify_master", [sys.executable, str(REPO / "tools" / "verify_master.py")], r"(\d+)/(\d+) checks passed"),
    ("availability", [sys.executable, str(V2 / "tools" / "test_availability.py")], r"(\d+)/(\d+) availability tests passed"),
    ("market", [sys.executable, str(V2 / "tools" / "test_market.py")], r"(\d+)/(\d+) market tests passed"),
]
# Anything that must never reach the web root.
FORBIDDEN_PATH = re.compile(r"(^|/)(\.git|\.mock|fixtures|tests?|screenshots|reports|node_modules|__pycache__)(/|$)|"
                            r"\.(py|pyc|md|ics|map|bak|log|tmp|env)$|(^|/)\.env|(^|/)(Thumbs\.db|desktop\.ini)$", re.I)
SECRET = re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|api\.telegram\.org/bot\d"
                    r"|admin\.booking\.com/hotel/hoteladmin/ical|airbnb\.[a-z.]+/calendar/ical/\d"
                    r"|calendar\.google\.com/calendar/ical/[^\s'\"]+/private-|define\('(TELEGRAM_BOT_TOKEN|PALMIYE_ICAL_[A-Z]+|"
                    r"PALMIYE_AVAILABILITY_ADMIN_HASH)',\s*'(?![A-Z_]*_HERE')[^']+'|\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}")


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, encoding="utf-8").stdout.strip()


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fail(msg):
    print("ABORT:", msg)
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True)
    ap.add_argument("--date", required=True)
    ap.add_argument("--root", required=True)
    a = ap.parse_args()
    if not re.fullmatch(r"\d+\.\d+\.\d+(-rc\d+)?", a.version) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", a.date):
        fail("bad --version / --date")

    # 1. Git + build preconditions
    if git("status", "--porcelain"):
        fail("git working tree is not clean")
    r = subprocess.run([sys.executable, str(V2 / "tools" / "build_site.py"), "--check"], capture_output=True, text=True)
    if r.returncode != 0:
        fail("v2/public is not up to date with the sources:\n" + r.stdout[-600:])
    build_date = (V2 / "src" / "BUILD_DATE").read_text().strip()
    if build_date != a.date:
        fail(f"v2/src/BUILD_DATE is {build_date}, release date is {a.date}")

    # 2. Test suites (all must pass)
    tests = {}
    for name, cmd, pat in SUITES:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                           env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8"})
        m = re.search(pat, r.stdout)
        tests[name] = f"{m.group(1)}/{m.group(2)}" if m else "no result"
        if r.returncode != 0 or not m or m.group(1) != m.group(2):
            fail(f"test suite {name} failed: {tests[name]}\n{r.stdout[-800:]}")
        print(f"PASS {name} {tests[name]}")

    # 3. Release folder (never overwrite)
    rc_root = Path(a.root) / f"{a.date}_v{a.version}"
    if rc_root.exists() and any(rc_root.iterdir()):
        fail(f"{rc_root} already exists and is not empty")
    publish, deployment, checks = rc_root / "publish", rc_root / "deployment", rc_root / "checksums"
    for d in (publish, deployment, checks, rc_root / "reports"):
        d.mkdir(parents=True, exist_ok=True)

    # 4. publish/ = production files of v2/public, byte for byte
    files = sorted(p for p in PUB.rglob("*") if p.is_file())
    bad = [p.relative_to(PUB).as_posix() for p in files if FORBIDDEN_PATH.search(p.relative_to(PUB).as_posix())]
    if bad:
        fail("dev/test material in v2/public: " + ", ".join(bad))
    for p in files:
        dest = publish / p.relative_to(PUB)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, dest)

    # 5. Secret scan of the package
    leaks = []
    for p in sorted(publish.rglob("*")):
        if p.is_file() and p.suffix not in {".avif", ".webp", ".jpg", ".png", ".ico"}:
            if SECRET.search(p.read_text(encoding="utf-8", errors="ignore")):
                leaks.append(p.relative_to(publish).as_posix())
    if leaks:
        shutil.rmtree(rc_root)
        fail("secret pattern found in publish: " + ", ".join(leaks))

    # 6. deployment/ — templates and selftest fixtures only (no real values)
    shutil.copyfile(V2 / "deploy" / "palmiye-secrets" / "env.example.php", deployment / "env.example.php")
    (deployment / "selftest-fixtures").mkdir()
    for f in sorted((V2 / "tests" / "fixtures").glob("*")):
        shutil.copyfile(f, deployment / "selftest-fixtures" / f.name)

    # 7. Checksums (relative POSIX paths, sha256sum format)
    pub_files = sorted(p for p in publish.rglob("*") if p.is_file())
    lines = [f"{sha256(p)}  {p.relative_to(publish).as_posix()}" for p in pub_files]
    sums = "\n".join(lines) + "\n"
    (checks / "SHA256SUMS.txt").write_text(sums, encoding="utf-8", newline="\n")
    total = sum(p.stat().st_size for p in pub_files)

    # 8. Manifest + VERSION
    commit = git("rev-parse", "HEAD")
    rb = CONFIG["ratings"]["booking"]
    manifest = {
        "product": "Palmiye Home",
        "release": "2027 Website",
        "version": a.version,
        "build_date": a.date,
        "canonical_git_repository": str(REPO),
        "canonical_v2_source": str(V2),
        "qa_archive": r"D:\ProjelerFinal\WebProjesi\_PalmiyeHome_2027_BASELINE\v2-build",
        "release_branch": git("branch", "--show-current"),
        "git_commit_full": commit,
        "git_commit_short": commit[:7],
        "rc_root": str(rc_root),
        "publish_path": str(publish),
        "publish_file_count": len(pub_files),
        "publish_total_bytes": total,
        "publish_sha256sums_sha256": hashlib.sha256(sums.encode("utf-8")).hexdigest(),
        "supported_languages": [l.upper() for l in CONFIG["site"]["languages"]],
        "booking_score": f'{rb["score"]} / {rb["scale"]}',
        "booking_score_last_verified": rb["last_verified"],
        "booking_review_count_shown": False,
        "booking_turkey_restriction": {"enabled": CONFIG["booking_turkey_restriction"]["enabled"],
                                       "last_verified": CONFIG["booking_turkey_restriction"]["last_verified"]},
        "availability_sources": ["Booking.com iCal", "Airbnb iCal"],
        "consent_mode": CONFIG["site"]["consent_mode"],
        "google_ads_id": CONFIG["tracking"]["google_ads_id"],
        "ga4_measurement_id": CONFIG["tracking"]["ga4_measurement_id"],
        "tests": tests,
        "build_status": "PASS_LOCAL",
        "deploy_status": "NOT_DEPLOYED",
    }
    mjson = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    (rc_root / "RELEASE_MANIFEST.json").write_text(mjson, encoding="utf-8", newline="\n")
    version_txt = (f"Palmiye Home 2027 Website\nVersion: {a.version}\nBuild date: {a.date}\nGit commit: {commit}\n"
                   f"Status: {'RELEASE CANDIDATE — NOT DEPLOYED' if '-rc' in a.version else 'RELEASE — NOT DEPLOYED'}\n")
    (rc_root / "VERSION.txt").write_text(version_txt, encoding="utf-8", newline="\n")
    meta = "".join(f"{sha256(rc_root / n)}  {n}\n" for n in ("RELEASE_MANIFEST.json", "VERSION.txt"))
    (checks / "RELEASE_META.sha256").write_text(meta, encoding="utf-8", newline="\n")

    print(f"\nRelease folder : {rc_root}")
    print(f"publish        : {len(pub_files)} files, {total} bytes ({total / 1024 / 1024:.2f} MB)")
    print(f"commit         : {commit}")
    print(f"SHA256SUMS sha : {manifest['publish_sha256sums_sha256']}")


if __name__ == "__main__":
    main()
