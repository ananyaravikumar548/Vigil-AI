"""
Downloads the full real PhysioNet/CinC Challenge 2019 training datasets
(training_setA: 20,336 patients, training_setB: 20,000 patients) from the
public AWS bucket ``s3://physionet-open`` (no credentials required).

It is used instead of the per-file HTTPS mirror because bulk-downloading
~40k small files one-by-one is far too slow. The datasets use disjoint
filename namespaces (setA p000001..p020336, setB p100001..p120000), so
every patient basename is unique and can be flattened into ``data/raw/``.

Usage:
    python3 scripts/download_dataset.py            # -> data/raw
    python3 scripts/download_dataset.py --workers 32
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

S3_ROOT = "https://s3.amazonaws.com/physionet-open"
TRAINING_ROOT = "challenge-2019/1.0.0/training/"
SETS = ["training_setA", "training_setB"]
PAGE_SIZE = 1000
DEFAULT_DEST = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"


def list_keys(session: requests.Session, prefix: str) -> list[str]:
    """Paginated ListObjectsV2 for a prefix, returns full key list."""
    keys: list[str] = []
    token: str | None = None
    while True:
        params: dict[str, str] = {
            "list-type": "2",
            "prefix": prefix,
            "max-keys": str(PAGE_SIZE),
            "fetch-owner": "false",
        }
        if token:
            params["continuation-token"] = token
        resp = session.get(S3_ROOT, params=params, timeout=60)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        for contents in root.findall(f"{NS}Contents"):
            key_el = contents.find(f"{NS}Key")
            if key_el is not None and key_el.text:
                keys.append(key_el.text)
        is_truncated = root.findtext(f"{NS}IsTruncated") == "true"
        if not is_truncated:
            break
        nxt = root.findtext(f"{NS}NextContinuationToken")
        if not nxt:
            break
        token = nxt
    return keys


def list_dataset() -> list[str]:
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    all_keys: list[str] = []
    for ds in SETS:
        prefix = f"{TRAINING_ROOT}{ds}/"
        keys = list_keys(session, prefix)
        print(f"  {ds}: {len(keys)} keys listed", file=sys.stderr)
        all_keys.extend(keys)
    return all_keys


def download_one(session: requests.Session, key: str, dest_dir: str) -> bool:
    name = os.path.basename(key)
    dest = os.path.join(dest_dir, name)
    url = f"{S3_ROOT}/{key}"
    # Resume-capable: if partial file exists, request the remainder.
    headers = {"User-Agent": UA}
    existing = os.path.exists(dest)
    if existing:
        size = os.path.getsize(dest)
        if size > 0:
            headers["Range"] = f"bytes={size}-"
    try:
        with session.get(url, headers=headers, timeout=60, stream=True) as r:
            if r.status_code == 416:  # range not satisfiable -> already full
                return True
            r.raise_for_status()
            if r.status_code == 206 and existing:
                f = open(dest, "ab")
            else:
                f = open(dest, "wb")
            with f:
                for chunk in r.iter_content(chunk_size=1 << 16):
                    if chunk:
                        f.write(chunk)
        return True
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"  FAILED {name}: {e}\n")
        # leave partial; resume next run
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", default=DEFAULT_DEST)
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--max", type=int, default=0, help="limit downloads (0 = all)")
    args = ap.parse_args()

    os.makedirs(args.dest, exist_ok=True)
    os.makedirs(os.path.join(args.dest, "..", "physionet_download"), exist_ok=True)

    print("Listing keys from s3://physionet-open ...", file=sys.stderr)
    keys = list_dataset()
    print(f"Total keys to fetch: {len(keys)}", file=sys.stderr)

    keys = [k for k in keys if k.endswith(".psv")]
    if args.max:
        keys = keys[: args.max]

    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    done = 0
    failed = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(download_one, session, k, args.dest): os.path.basename(k) for k in keys}
        for fut in as_completed(futs):
            if fut.result():
                done += 1
            else:
                failed += 1
            if (done + failed) % 1000 == 0:
                print(f"  progress: {done + failed}/{len(keys)} "
                      f"ok={done} fail={failed} elapsed={int(time.time() - t0)}s",
                      file=sys.stderr)
    print(f"Done: {done} ok, {failed} failed in {int(time.time() - t0)}s", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
