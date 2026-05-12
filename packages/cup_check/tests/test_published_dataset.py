"""Integration tests against the latest published dataset release.

Discovers the latest dataset-YYYY-MM release from GitHub at test-collection
time; falls back to the pinned release below if discovery fails.

Hit la rete reale. Esegui con:
    INTEGRATION_TESTS=1 pytest -m integration -p no:cov
"""
from __future__ import annotations

import json
import os
import re
from urllib.request import Request, urlopen

import pytest

from cup_check import DatasetManifest

_GITHUB_RELEASES_URL = (
    "https://api.github.com/repos/ale-saglia/cup-check/releases"
)
_DATASET_TAG_RE = re.compile(r"^dataset-\d{4}-\d{2}$")
_BASE_URL = "https://github.com/ale-saglia/cup-check/releases/download"

# Pinned fallback — aggiorna questi valori a ogni nuova release dataset.
_FALLBACK_TAG = "dataset-2026-05"
_FALLBACK_N_RECORDS = 11641560
_FALLBACK_SHA256 = "0a14e6e4a4253f4d5989ee2c44dfce7ae3fc73a3d78943c87e59c1bd34f00ee0"
_FALLBACK_CHUNK_COUNT = 6

SQLITE_MAGIC = b"SQLite format 3\x00"


def _discover_latest_tag(timeout: int = 10) -> str | None:
    """Return the most recent dataset-YYYY-MM tag from GitHub, or None."""
    try:
        req = Request(
            _GITHUB_RELEASES_URL,
            headers={"User-Agent": "cup-check-integration-tests/1"},
        )
        with urlopen(req, timeout=timeout) as resp:
            releases = json.loads(resp.read())
        tags = sorted(
            (r["tag_name"] for r in releases if _DATASET_TAG_RE.match(r.get("tag_name", ""))),
            reverse=True,
        )
        return tags[0] if tags else None
    except Exception:
        return None


# La discovery avviene solo quando si eseguono gli integration test, per non
# rallentare il collection pytest negli altri contesti.
if os.getenv("INTEGRATION_TESTS"):
    _LATEST_TAG = _discover_latest_tag() or _FALLBACK_TAG
else:
    _LATEST_TAG = _FALLBACK_TAG

_MANIFEST_URL = f"{_BASE_URL}/{_LATEST_TAG}/dataset-manifest.json"
_ON_FALLBACK = _LATEST_TAG == _FALLBACK_TAG

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("INTEGRATION_TESTS"),
        reason="set INTEGRATION_TESTS=1 to run integration tests",
    ),
]


@pytest.fixture(scope="module")
def manifest() -> DatasetManifest:
    with urlopen(_MANIFEST_URL) as response:
        return DatasetManifest.from_mapping(json.loads(response.read()))


def test_manifest_is_parseable_and_correct(manifest: DatasetManifest) -> None:
    assert _DATASET_TAG_RE.match(manifest.dataset_tag), manifest.dataset_tag
    assert manifest.schema.table == "cup_index"
    assert manifest.schema.version == 1
    if _ON_FALLBACK:
        assert manifest.dataset_tag == _FALLBACK_TAG
        assert manifest.n_records == _FALLBACK_N_RECORDS
        assert manifest.sha256 == _FALLBACK_SHA256


def test_manifest_chunk_count(manifest: DatasetManifest) -> None:
    if _ON_FALLBACK:
        assert len(manifest.cup_index.files) == _FALLBACK_CHUNK_COUNT
    else:
        assert len(manifest.cup_index.files) > 0


def test_manifest_total_size_is_consistent(manifest: DatasetManifest) -> None:
    n = len(manifest.cup_index.files)
    # Tutti i chunk tranne l'ultimo sono pieni; l'ultimo è ≤ chunk_size_bytes.
    assert manifest.cup_index.total_size_bytes <= n * manifest.cup_index.chunk_size_bytes
    assert manifest.cup_index.total_size_bytes > (n - 1) * manifest.cup_index.chunk_size_bytes


def test_all_chunks_are_reachable(manifest: DatasetManifest) -> None:
    for file_name in manifest.cup_index.files:
        url = f"{manifest.cup_index.base_url}/{file_name}"
        request = Request(url, headers={"Range": "bytes=0-15"})
        with urlopen(request) as response:
            assert response.status in (200, 206), f"{file_name}: HTTP {response.status}"
            assert len(response.read()) == len(SQLITE_MAGIC)


def test_first_chunk_has_sqlite_magic(manifest: DatasetManifest) -> None:
    first_chunk = manifest.cup_index.files[0]
    url = f"{manifest.cup_index.base_url}/{first_chunk}"
    request = Request(url, headers={"Range": "bytes=0-15"})
    with urlopen(request) as response:
        header = response.read()
    assert header == SQLITE_MAGIC
