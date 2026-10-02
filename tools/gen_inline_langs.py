"""Regenerate the INLINE_LANGS fallback block in script.js from lang/*.json.

lang/*.json is the single source for translations; INLINE_LANGS is only the
offline/file:// fallback and must never be edited by hand.

Usage:  python tools/gen_inline_langs.py           (rewrite script.js)
        python tools/gen_inline_langs.py --check   (exit 1 if out of date)
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ["en", "tr", "de", "ru"]
BLOCK = re.compile(r"const INLINE_LANGS = \{\n.*?\n\};", re.S)


def build():
    lines = ["const INLINE_LANGS = {"]
    for i, lang in enumerate(LANGS):
        with open(os.path.join(ROOT, "lang", lang + ".json"), encoding="utf-8-sig") as fh:
            data = json.load(fh)
        comma = "," if i < len(LANGS) - 1 else ""
        lines.append(f'  "{lang}": {json.dumps(data, ensure_ascii=False, separators=(",", ":"))}{comma}')
    lines.append("};")
    return "\n".join(lines)


def main():
    path = os.path.join(ROOT, "script.js")
    with open(path, encoding="utf-8") as fh:
        src = fh.read()
    if len(BLOCK.findall(src)) != 1:
        sys.exit("INLINE_LANGS block not found exactly once in script.js")
    new = BLOCK.sub(lambda _: build(), src)
    if "--check" in sys.argv:
        sys.exit(0 if new == src else 1)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(new)
    print("INLINE_LANGS regenerated from lang/*.json")


if __name__ == "__main__":
    main()
