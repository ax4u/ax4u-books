"""Extract only the approved picture book's PNGs, byte-for-byte, in source order.
Usage: python scripts/extract-exhibition.py /path/to/approved-flipbook.html
Never copy the source HTML or its private asset identifiers into the repository.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import struct
import sys

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text()
match = re.search(r'<script id="pages" type="application/json">(.*?)</script>', source, re.S)
assert match, 'Missing page array'
pages = json.loads(match.group(1))
assert len(pages) == 29 and pages[0]['asset_id'] == 'front_cover', 'Expected cover + 28 pages'
out = root / 'public/exhibition/planet-friends'
out.mkdir(parents=True, exist_ok=True)
public_pages = []
for i, page in enumerate(pages):
    assert page['src'].startswith('data:image/png;base64,')
    data = base64.b64decode(page['src'].split(',', 1)[1], validate=True)
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    width, height = struct.unpack('>II', data[16:24])
    name = 'cover.png' if i == 0 else f'page-{i:02}.png'
    target = out / name
    target.write_bytes(data)
    assert hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(data).digest()
    public_pages.append({'src': f'/exhibition/planet-friends/{name}', 'width': width, 'height': height,
                         'label': '앞표지' if i == 0 else f'본문 {i}쪽'})
metadata = root / 'src/lib/exhibition/pages.json'
metadata.parent.mkdir(parents=True, exist_ok=True)
metadata.write_text(json.dumps(public_pages, ensure_ascii=False, indent=2) + '\n')
print(f'Extracted and byte-verified {len(public_pages)} original PNGs; {sum(p.stat().st_size for p in out.glob("*.png"))} bytes')
