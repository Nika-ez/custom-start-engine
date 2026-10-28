from pathlib import Path

BASE = Path(__file__).resolve().parent
PARTS = [
    "part1.html",
    "part2.html",
    "part3.html",
    "part4.html",
    "part5.js",
    "part6.js",
    "part7.js",
    "part8.js",
    "part9.js",
]

text = "\n".join((BASE / "parts" / name).read_text(encoding="utf-8") for name in PARTS)
output = BASE / "index.html"
output.write_text(text, encoding="utf-8", newline="\n")
print(f"Built {output} ({len(text):,} chars, {text.count(chr(10)) + 1:,} lines)")
