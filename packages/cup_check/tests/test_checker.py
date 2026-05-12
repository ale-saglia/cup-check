from __future__ import annotations

import hashlib
import io
import json
import sqlite3
from pathlib import Path

from cup_check import OpenCupChecker, Outcome
from cup_check import checker as checker_module
from cup_check.dataset import DatasetManifest


def test_open_cup_checker_checks_local_sqlite_index(tmp_path: Path) -> None:
    sqlite_path = write_cup_index(tmp_path, ["G17H03000130001"])
    manifest = manifest_for_sqlite(sqlite_path)

    with OpenCupChecker.from_manifest(manifest, sqlite_path=sqlite_path) as checker:
        found = checker.check("g17h03000130001", current_year=26)
        missing = checker.check("H11B22001230001", current_year=26)
        invalid = checker.check("not-a-cup", current_year=26)

    assert found.outcome is Outcome.TROVATO_OPENCUP
    assert found.normalized_value == "G17H03000130001"
    assert [warning.value for warning in found.warnings] == ["N2"]
    assert missing.outcome is Outcome.NON_TROVATO_OPENCUP_DA_VERIFICARE
    assert invalid.outcome is Outcome.INVALIDO_FORMATO


def test_open_cup_checker_check_many_preserves_input_rows_and_warnings(tmp_path: Path) -> None:
    sqlite_path = write_cup_index(tmp_path, ["G17H03000130001"])
    manifest = manifest_for_sqlite(sqlite_path)

    with OpenCupChecker.from_manifest(manifest, sqlite_path=sqlite_path) as checker:
        results = checker.check_many([" g17h03000130001 ", "bad"], current_year=26)

    assert [result.input_row for result in results] == [1, 2]
    assert results[0].outcome is Outcome.TROVATO_OPENCUP
    assert [warning.value for warning in results[0].warnings] == ["N1", "N2"]
    assert results[1].outcome is Outcome.INVALIDO_FORMATO


def test_open_cup_checker_downloads_and_reuses_cached_index(tmp_path: Path, monkeypatch) -> None:
    sqlite_path = write_cup_index(tmp_path, ["G17H03000130001"])
    sqlite_bytes = sqlite_path.read_bytes()
    first_chunk = sqlite_bytes[:20]
    second_chunk = sqlite_bytes[20:]
    latest_url = "https://example.test/dataset-latest.json"
    manifest_url = "https://example.test/dataset-manifest.json"
    base_url = "https://example.test/dataset"
    manifest = manifest_for_chunks(
        base_url=base_url,
        files=("cup-index.sqlite.000", "cup-index.sqlite.001"),
        sqlite_bytes=sqlite_bytes,
    )
    payloads = {
        latest_url: json.dumps(
            {
                "dataset_tag": manifest.dataset_tag,
                "manifest_url": manifest_url,
                "sources_snapshot_date": manifest.sources_snapshot_date,
                "released_at": manifest.released_at,
            }
        ).encode("utf-8"),
        manifest_url: json.dumps(manifest_mapping(manifest)).encode("utf-8"),
        f"{base_url}/cup-index.sqlite.000": first_chunk,
        f"{base_url}/cup-index.sqlite.001": second_chunk,
    }
    requests: list[tuple[str, float | None]] = []

    def fake_urlopen(url: str, *, timeout: float | None = None):
        requests.append((url, timeout))
        return BytesResponse(payloads[url])

    monkeypatch.setattr(checker_module, "urlopen", fake_urlopen)

    with OpenCupChecker.from_latest(latest_url, cache_dir=tmp_path / "cache") as checker:
        assert checker.is_available is True
        assert checker.check("G17H03000130001", current_year=26).outcome is Outcome.TROVATO_OPENCUP
    with OpenCupChecker.from_latest(latest_url, cache_dir=tmp_path / "cache") as cached_checker:
        assert cached_checker.is_available is True

    assert requests == [
        (latest_url, 30),
        (manifest_url, 30),
        (f"{base_url}/cup-index.sqlite.000", 300),
        (f"{base_url}/cup-index.sqlite.001", 300),
        (latest_url, 30),
        (manifest_url, 30),
    ]


def test_open_cup_checker_falls_back_when_latest_download_fails(monkeypatch) -> None:
    def failing_urlopen(url: str, *, timeout: float | None = None):
        assert timeout == 30
        raise OSError(f"{url}: offline")

    monkeypatch.setattr(checker_module, "urlopen", failing_urlopen)

    checker = OpenCupChecker.from_latest("https://example.test/dataset-latest.json")
    result = checker.check("G17H03000130001", current_year=26)

    assert checker.is_available is False
    assert checker.fallback_reason is not None
    assert result.outcome is Outcome.FORMATO_VALIDO_DA_VERIFICARE


def test_open_cup_checker_is_exported() -> None:
    assert OpenCupChecker.__name__ == "OpenCupChecker"
    assert Outcome.TROVATO_OPENCUP.value == "TROVATO_OPENCUP"
    assert Outcome.NON_TROVATO_OPENCUP_DA_VERIFICARE.value == "NON_TROVATO_OPENCUP_DA_VERIFICARE"


class BytesResponse:
    def __init__(self, content: bytes) -> None:
        self._content = io.BytesIO(content)

    def __enter__(self) -> BytesResponse:
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        return None

    def read(self, size: int = -1) -> bytes:
        return self._content.read(size)


def write_cup_index(tmp_path: Path, cups: list[str]) -> Path:
    sqlite_path = tmp_path / "cup-index.sqlite"
    with sqlite3.connect(sqlite_path) as connection:
        connection.execute(
            "CREATE TABLE cup_index (cup TEXT PRIMARY KEY, detail_chunk INTEGER) WITHOUT ROWID"
        )
        connection.executemany(
            "INSERT INTO cup_index (cup, detail_chunk) VALUES (?, NULL)",
            [(cup,) for cup in cups],
        )
    return sqlite_path


def manifest_for_sqlite(sqlite_path: Path) -> DatasetManifest:
    return manifest_for_chunks(
        base_url="https://example.test/dataset",
        files=("cup-index.sqlite.000",),
        sqlite_bytes=sqlite_path.read_bytes(),
    )


def manifest_for_chunks(
    *,
    base_url: str,
    files: tuple[str, ...],
    sqlite_bytes: bytes,
) -> DatasetManifest:
    return DatasetManifest.from_mapping(
        {
            "schema_version": 1,
            "dataset_tag": "dataset-2026-05",
            "released_at": "2026-05-05T03:14:00Z",
            "sources_snapshot_date": "2026-05-01",
            "schema": {"table": "cup_index", "version": 1},
            "cup_index": {
                "base_url": base_url,
                "files": list(files),
                "chunk_size_bytes": max(len(sqlite_bytes), 1),
                "total_size_bytes": len(sqlite_bytes),
                "sha256": hashlib.sha256(sqlite_bytes).hexdigest(),
            },
            "n_records": 1,
            "min_software_version": "0.3.0",
            "natura_categories": ["Lavori pubblici"],
        }
    )


def manifest_mapping(manifest: DatasetManifest) -> dict[str, object]:
    return {
        "schema_version": manifest.schema_version,
        "dataset_tag": manifest.dataset_tag,
        "released_at": manifest.released_at,
        "sources_snapshot_date": manifest.sources_snapshot_date,
        "schema": {
            "table": manifest.schema.table,
            "version": manifest.schema.version,
        },
        "cup_index": {
            "base_url": manifest.cup_index.base_url,
            "files": list(manifest.cup_index.files),
            "chunk_size_bytes": manifest.cup_index.chunk_size_bytes,
            "total_size_bytes": manifest.cup_index.total_size_bytes,
            "sha256": manifest.cup_index.sha256,
        },
        "n_records": manifest.n_records,
        "min_software_version": manifest.min_software_version,
        "natura_categories": list(manifest.natura_categories),
    }
