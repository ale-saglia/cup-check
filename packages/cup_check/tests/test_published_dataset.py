"""Integration tests against the published dataset-2026-05 release.

Hit la rete reale. Esegui con:
    INTEGRATION_TESTS=1 pytest -m integration -p no:cov
"""
from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen

import pytest

from cup_check import DatasetManifest

MANIFEST_URL = (
    "https://github.com/ale-saglia/cup-check"
    "/releases/download/dataset-2026-05/dataset-manifest.json"
)
EXPECTED_TAG = "dataset-2026-05"
EXPECTED_N_RECORDS = 11641560
EXPECTED_SHA256 = "28497717aaf833b9720264876b14f54fbaca0c716ecd7353cd62b5be7f98f41e"
EXPECTED_CHUNK_COUNT = 5
SQLITE_MAGIC = b"SQLite format 3\x00"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("INTEGRATION_TESTS"),
        reason="set INTEGRATION_TESTS=1 to run integration tests",
    ),
]


@pytest.fixture(scope="module")
def manifest() -> DatasetManifest:
    with urlopen(MANIFEST_URL) as response:
        return DatasetManifest.from_mapping(json.loads(response.read()))


def test_manifest_is_parseable_and_correct(manifest: DatasetManifest) -> None:
    assert manifest.dataset_tag == EXPECTED_TAG
    assert manifest.n_records == EXPECTED_N_RECORDS
    assert manifest.sha256 == EXPECTED_SHA256
    assert manifest.schema.table == "cups"
    assert manifest.schema.version == 1


def test_manifest_chunk_count(manifest: DatasetManifest) -> None:
    assert len(manifest.chunks.files) == EXPECTED_CHUNK_COUNT


def test_manifest_total_size_is_consistent(manifest: DatasetManifest) -> None:
    n = len(manifest.chunks.files)
    # Tutti i chunk tranne l'ultimo sono pieni; l'ultimo è ≤ chunk_size_bytes.
    assert manifest.chunks.total_size_bytes <= n * manifest.chunks.chunk_size_bytes
    assert manifest.chunks.total_size_bytes > (n - 1) * manifest.chunks.chunk_size_bytes


def test_all_chunks_are_reachable(manifest: DatasetManifest) -> None:
    for file_name in manifest.chunks.files:
        url = f"{manifest.chunks.base_url}/{file_name}"
        request = Request(url, headers={"Range": "bytes=0-15"})
        with urlopen(request) as response:
            assert response.status in (200, 206), f"{file_name}: HTTP {response.status}"
            assert len(response.read()) == len(SQLITE_MAGIC)


def test_first_chunk_has_sqlite_magic(manifest: DatasetManifest) -> None:
    first_chunk = manifest.chunks.files[0]
    url = f"{manifest.chunks.base_url}/{first_chunk}"
    request = Request(url, headers={"Range": "bytes=0-15"})
    with urlopen(request) as response:
        header = response.read()
    assert header == SQLITE_MAGIC
