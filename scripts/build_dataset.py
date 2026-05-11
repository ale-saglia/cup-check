#!/usr/bin/env python3
"""Build the OpenCUP dataset release files.

Usage:
    python scripts/build_dataset.py <snapshot_date> <output_dir> <cup_index_base_url>

Arguments:
    snapshot_date     Data snapshot OpenCUP, formato YYYY-MM-DD
    output_dir        Directory di output per i file generati
    cup_index_base_url  URL base per i chunk nel manifest (es. https://<owner>.github.io/cup-check/datasets/tag)
"""

from __future__ import annotations

import sys
import time
from datetime import date, datetime, UTC
from pathlib import Path

from cup_check.opencup_dataset import (
    build_dataset_release,
    dataset_tag_for_snapshot,
    download_projects_zip,
)


def _log(msg: str) -> None:
    ts = datetime.now(UTC).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def _mb(n_bytes: int) -> str:
    return f"{n_bytes / 1024 / 1024:.1f} MB"


def main(snapshot_date_str: str, output_dir: str, cup_index_base_url: str) -> None:
    snapshot_date = date.fromisoformat(snapshot_date_str)
    dataset_tag = dataset_tag_for_snapshot(snapshot_date)
    output_path = Path(output_dir)

    _log(f"=== Build dataset {dataset_tag} ===")
    _log(f"Snapshot: {snapshot_date_str}")
    _log(f"Output:   {output_path.resolve()}")
    _log(f"Base URL: {cup_index_base_url}")

    # Download
    zip_path = output_path / "OpendataProgetti.zip"
    _log(f"[1/3] Download ZIP OpenCUP -> {zip_path}")
    t0 = time.monotonic()
    download_projects_zip(zip_path)
    elapsed = time.monotonic() - t0
    _log(f"[1/3] Download completato in {elapsed:.0f}s ({_mb(zip_path.stat().st_size)})")

    # Build SQLite + chunks + manifest
    _log("[2/3] Build SQLite, chunk e manifest...")
    t0 = time.monotonic()
    result = build_dataset_release(
        zip_path,
        output_path,
        dataset_tag=dataset_tag,
        sources_snapshot_date=snapshot_date_str,
        release_base_url=cup_index_base_url,
    )
    elapsed = time.monotonic() - t0
    manifest = result.manifest
    _log(f"[2/3] Build completato in {elapsed:.0f}s")
    _log(f"      Record unici: {manifest.n_records:,}")
    _log(f"      SQLite:       {_mb(result.sqlite_path.stat().st_size)}")
    _log(f"      Chunk:        {len(manifest.cup_index.files)} file da ~{_mb(manifest.cup_index.chunk_size_bytes)} ciascuno")

    # Summary
    _log("[3/3] Pulizia ZIP sorgente...")
    zip_path.unlink()
    _log("[3/3] File pronti per la release:")
    for name in [result.manifest_path.name, result.latest_path.name, *manifest.cup_index.files]:
        path = output_path / name
        _log(f"      {name} ({_mb(path.stat().st_size)})")
    _log("=== Completato ===")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(f"Uso: {sys.argv[0]} <snapshot_date> <output_dir> <cup_index_base_url>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
