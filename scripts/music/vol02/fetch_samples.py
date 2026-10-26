"""Download the 12 soft piano samples used by Vol. 2, with Git blob verification."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
DEST = ROOT / 'tmp' / 'inkroam-vol02-samples'
MANIFEST = json.loads(Path(__file__).with_name('samples.json').read_text(encoding='utf-8'))


def fetch(item):
    path = DEST / item['name']
    data = path.read_bytes() if path.exists() else urllib.request.urlopen(item['url'], timeout=90).read()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if blob != item['gitBlobSha']:
        raise ValueError(f"Sample integrity mismatch: {item['name']}")
    if not path.exists():
        path.write_bytes(data)
    return item['name'], len(data)


if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for name, size in pool.map(fetch, MANIFEST['files']):
            print(name, size, flush=True)
    license_url = f"https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/{MANIFEST['commit']}/LICENSE"
    (DEST / 'LICENSE.txt').write_bytes(urllib.request.urlopen(license_url, timeout=45).read())
