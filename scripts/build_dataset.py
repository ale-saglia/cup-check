#!/usr/bin/env python3
"""Build the OpenCUP dataset release files.

Usage:
    python scripts/build_dataset.py [--skip-if-exists] <snapshot_date> <output_dir> <cup_index_base_url> [source_zip]

Arguments:
    snapshot_date       Data snapshot OpenCUP, formato YYYY-MM-DD
    output_dir          Directory di output per i file generati
    cup_index_base_url  URL base per i chunk nel manifest (es. https://<owner>.github.io/cup-check/datasets/tag)
    source_zip          Percorso del dump OpenCUP scaricato/cacheato
                        (default: data/OpendataProgetti.zip)

Options:
    --skip-if-exists    Salta il download se source_zip e' gia' presente su disco
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import UTC, date, datetime
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


def main(
    snapshot_date_str: str,
    output_dir: str,
    cup_index_base_url: str,
    source_zip: str = "data/OpendataProgetti.zip",
    *,
    skip_if_exists: bool = False,
) -> None:
    snapshot_date = date.fromisoformat(snapshot_date_str)
    dataset_tag = dataset_tag_for_snapshot(snapshot_date)
    output_path = Path(output_dir)
    zip_path = Path(source_zip)

    _log(f"=== Build dataset {dataset_tag} ===")
    _log(f"Snapshot: {snapshot_date_str}")
    _log(f"Output:   {output_path.resolve()}")
    _log(f"Base URL: {cup_index_base_url}")
    _log(f"Sorgente: {zip_path.resolve()}")

    # Download
    _log(f"[1/3] Download ZIP OpenCUP -> {zip_path}")
    t0 = time.monotonic()
    had_cached_zip = zip_path.exists()
    download_projects_zip(
        zip_path,
        skip_if_exists=skip_if_exists,
        on_progress=lambda downloaded_bytes: _log(
            f"      Download in corso: {_mb(downloaded_bytes)}"
        ),
    )
    elapsed = time.monotonic() - t0
    if skip_if_exists and had_cached_zip:
        _log(f"[1/3] ZIP gia presente, download saltato ({_mb(zip_path.stat().st_size)})")
    else:
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
    if result.duplicate_cups > 0:
        _log(f"      Attenzione: {result.duplicate_cups} CUP duplicati rimossi dal bulk OpenCUP")
    _log(f"      Record unici: {manifest.n_records:,}")
    _log(f"      SQLite:       {_mb(result.sqlite_path.stat().st_size)}")
    _log(
        "      Chunk:        "
        f"{len(manifest.cup_index.files)} file da "
        f"~{_mb(manifest.cup_index.chunk_size_bytes)} ciascuno"
    )

    # Summary
    _log("[3/3] File pronti per la release:")
    for name in [result.manifest_path.name, result.latest_path.name, *manifest.cup_index.files]:
        path = output_path / name
        _log(f"      {name} ({_mb(path.stat().st_size)})")
    _log("=== Completato ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Build the OpenCUP dataset release files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("snapshot_date", help="Data snapshot OpenCUP (YYYY-MM-DD)")
    parser.add_argument("output_dir", help="Directory di output per i file generati")
    parser.add_argument("cup_index_base_url", help="URL base per i chunk nel manifest")
    parser.add_argument(
        "source_zip",
        nargs="?",
        default="data/OpendataProgetti.zip",
        help="Percorso del dump OpenCUP (default: data/OpendataProgetti.zip)",
    )
    parser.add_argument(
        "--skip-if-exists",
        action="store_true",
        help="Salta il download se source_zip e' gia' presente su disco",
    )
    args = parser.parse_args()
    main(
        args.snapshot_date,
        args.output_dir,
        args.cup_index_base_url,
        args.source_zip,
        skip_if_exists=args.skip_if_exists,
    )
