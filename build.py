#!/usr/bin/env python3
"""Bundles src/ into one self-contained index.html (no external dependencies)."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / "src"
js = "\n".join((src / f).read_text(encoding="utf-8") for f in ["data.js", "engine.js", "marking.js", "pages.js", "app.js"])
assert "</script" not in js.lower()
html = (src / "template.html").read_text(encoding="utf-8")
html = html.replace("/*CSS*/", (src / "style.css").read_text(encoding="utf-8")).replace("/*JS*/", js)
(root / "index.html").write_text(html, encoding="utf-8")
print("built index.html", len(html), "bytes")
