"""Encrypt an entire Markdown note locally; never print plaintext or key material.

Requires Python 3.10+ and cryptography. See docs/encrypted-notes.md.
"""
import argparse
import base64
from datetime import date
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.private' / 'encrypted-notes'
MAX_BYTES = 5 * 1024 * 1024
MANIFEST = ROOT / 'encrypted-notes.json'


def b64(value):
    return base64.b64encode(value).decode('ascii')


def aad(document_id):
    return f'inkroam-note:v1:AES-256-GCM:{document_id}'.encode('ascii')


def seal(plaintext, key, document_id):
    nonce = os.urandom(12)
    return {'version': 1, 'algorithm': 'AES-256-GCM', 'id': document_id,
            'iv': b64(nonce), 'ciphertext': b64(AESGCM(key).encrypt(nonce, plaintext, aad(document_id)))}


def unseal(envelope, key, document_id):
    if (envelope['version'], envelope['algorithm'], envelope['id']) != (1, 'AES-256-GCM', document_id):
        raise ValueError('Unsupported or mismatched encrypted document')
    return AESGCM(key).decrypt(base64.b64decode(envelope['iv'], validate=True),
                              base64.b64decode(envelope['ciphertext'], validate=True), aad(document_id))


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('xb') as stream:
            stream.write(data)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['encrypt', 'refresh', 'recover'])
    parser.add_argument('note', help='The public content/notes/<course>/<slug>.md path')
    args = parser.parse_args()
    note = Path(args.note).resolve()
    relative = note.relative_to(ROOT)
    if not re.fullmatch(r'content/(?:notes/[a-z0-9-]+|posts)/[a-z0-9-]+\.md', relative.as_posix()):
        raise ValueError('Expected a Markdown path inside content/posts or content/notes/<course>')
    backup = PRIVATE / 'originals' / relative
    key_path = (PRIVATE / 'keys' / relative).with_suffix('.key')
    # Do not rely on an informal convention: require Git to confirm exclusion.
    for private_path in (backup, key_path):
        ignored = subprocess.run(['git', 'check-ignore', '--quiet', '--', str(private_path)], cwd=ROOT)
        if ignored.returncode:
            raise ValueError('Private directory must be Git-ignored and untracked before proceeding')

    source = note.read_bytes()
    registry = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    marker = re.search(rb'^encryptedDocument: ([a-f0-9]{32})\r?$', source, re.M)
    if args.action == 'encrypt':
        if marker:
            raise ValueError('Already encrypted; edit the private original and use refresh')
        # New encryption is intentionally refused for tracked/history-bearing files.
        tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', '--', relative.as_posix()],
                                 cwd=ROOT, capture_output=True)
        history = subprocess.run(['git', 'log', '--all', '-1', '--format=%H', '--', relative.as_posix()],
                                 cwd=ROOT, capture_output=True, check=True)
        if tracked.returncode == 0 or history.stdout.strip():
            raise ValueError('File is tracked or has local Git history; resolve prior plaintext exposure first')
        if backup.exists() or key_path.exists():
            raise ValueError('Private backup/key already exists; refusing to overwrite it')
        if not source or len(source) > MAX_BYTES:
            raise ValueError('Markdown must be nonempty and at most 5 MiB')
        source.decode('utf-8-sig')
        document_id = uuid.uuid4().hex
        key = AESGCM.generate_key(bit_length=256)
        # Preserve the original exact bytes BEFORE replacing the public Markdown.
        atomic_write(backup, source)
        if backup.read_bytes() != source:
            raise ValueError('Backup verification failed')
        atomic_write(key_path, (b64(key) + '\n').encode('ascii'))
        registry[relative.as_posix()] = document_id
        # Register first: an interrupted encryption must block the next build.
        atomic_write(MANIFEST, (json.dumps(registry, indent=2) + '\n').encode('utf-8'))
    else:
        if not marker:
            raise ValueError('Expected an encrypted public stub')
        document_id = marker.group(1).decode('ascii')
        key = base64.b64decode(key_path.read_text(encoding='ascii').strip(), validate=True)
        if len(key) != 32:
            raise ValueError('Expected a 256-bit key')

    ciphertext_path = ROOT / 'public' / 'encrypted-notes' / (document_id + '.json')
    if args.action == 'recover':
        plaintext = unseal(json.loads(ciphertext_path.read_bytes()), key, document_id)
        recovered = backup.with_name(backup.stem + '.recovered.md')
        if recovered.exists():
            raise ValueError('Recovered file already exists; refusing to overwrite it')
        atomic_write(recovered, plaintext)
        print('Recovered locally:', recovered)
        return
    if args.action == 'refresh':
        source = backup.read_bytes()
        if not source or len(source) > MAX_BYTES:
            raise ValueError('Markdown must be nonempty and at most 5 MiB')
        source.decode('utf-8-sig')
    envelope = seal(source, key, document_id)
    if unseal(envelope, key, document_id) != source:
        raise ValueError('Encryption round-trip verification failed')
    atomic_write(ciphertext_path, (json.dumps(envelope, separators=(',', ':')) + '\n').encode('ascii'))
    if args.action == 'encrypt':
        stub = ('---\ntitle: 加密笔记\ndescription: 输入密钥后阅读。\n'
                f'date: {date.today().isoformat()}\nreadingTime: —\ntags: []\n'
                f'encryptedDocument: {document_id}\n---\n\n此文档已在本地加密。\n')
        atomic_write(note, stub.encode('utf-8'))
    print('Encrypted document:', relative)
    print('Private original:', backup)
    print('Private key file:', key_path)
    print('Verified: exact-byte backup and AES-GCM round trip. No secret values printed.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Third-party errors may include input fragments; only controlled errors are printed.
        if isinstance(error, ValueError) and type(error) is ValueError:
            print('Stopped:', str(error), file=sys.stderr)
        else:
            print('Stopped safely:', type(error).__name__, '(no plaintext/key output)', file=sys.stderr)
        sys.exit(1)
