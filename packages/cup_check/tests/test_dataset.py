from __future__ import annotations

import json

import pytest

from cup_check import DatasetManifest, load_dataset_latest, load_dataset_manifest


def manifest_mapping() -> dict[str, object]:
    return {
        "schema_version": 1,
        "dataset_tag": "dataset-2026-05",
        "released_at": "2026-05-05T03:14:00Z",
        "sources_snapshot_date": "2026-05-01",
        "schema": {
            "table": "cup_index",
            "version": 1,
        },
        "cup_index": {
            "base_url": "https://github.com/ale-saglia/cup-check/releases/download/dataset-2026-05",
            "files": ["cup-index.sqlite.000", "cup-index.sqlite.001"],
            "chunk_size_bytes": 52428800,
            "total_size_bytes": 104857600,
            "sha256": "abcd",
        },
        "n_records": 9842317,
        "min_software_version": "0.3.0",
        "natura_categories": ["Acquisto beni", "Lavori pubblici"],
    }


def test_dataset_manifest_from_mapping() -> None:
    manifest = DatasetManifest.from_mapping(manifest_mapping())

    assert manifest.schema_version == 1
    assert manifest.dataset_tag == "dataset-2026-05"
    assert manifest.schema.table == "cup_index"
    assert manifest.schema.version == 1
    assert manifest.chunks is manifest.cup_index
    assert manifest.cup_index.files == ("cup-index.sqlite.000", "cup-index.sqlite.001")
    assert manifest.sha256 == "abcd"
    assert manifest.cup_index.files_sha256 == ()
    assert manifest.n_records == 9842317
    assert manifest.natura_categories == ("Acquisto beni", "Lavori pubblici")


def test_dataset_manifest_from_mapping_with_files_sha256() -> None:
    mapping = manifest_mapping()
    mapping["cup_index"]["files_sha256"] = ["sha-of-chunk-0", "sha-of-chunk-1"]

    manifest = DatasetManifest.from_mapping(mapping)

    assert manifest.cup_index.files_sha256 == ("sha-of-chunk-0", "sha-of-chunk-1")


def test_load_dataset_manifest_from_json_file(tmp_path) -> None:
    manifest_path = tmp_path / "dataset-manifest.json"
    manifest_path.write_text(json.dumps(manifest_mapping()), encoding="utf-8")

    manifest = load_dataset_manifest(manifest_path)

    assert manifest.cup_index.base_url.endswith("/dataset-2026-05")
    assert manifest.min_software_version == "0.3.0"


def test_load_dataset_latest_from_json_file(tmp_path) -> None:
    latest_path = tmp_path / "dataset-latest.json"
    latest_path.write_text(
        json.dumps(
            {
                "dataset_tag": "dataset-2026-05",
                "manifest_url": "https://example.test/dataset-manifest.json",
                "sources_snapshot_date": "2026-05-01",
                "released_at": "2026-05-05T03:14:00Z",
            }
        ),
        encoding="utf-8",
    )

    latest = load_dataset_latest(latest_path)

    assert latest.dataset_tag == "dataset-2026-05"
    assert latest.manifest_url.endswith("dataset-manifest.json")


def test_manifest_requires_top_level_keys() -> None:
    value = manifest_mapping()
    del value["cup_index"]

    with pytest.raises(ValueError, match="missing keys: cup_index"):
        DatasetManifest.from_mapping(value)


def test_manifest_requires_non_empty_chunk_files() -> None:
    value = manifest_mapping()
    value["cup_index"] = {
        "base_url": "https://example.test/dataset",
        "files": [],
        "chunk_size_bytes": 52428800,
        "total_size_bytes": 104857600,
        "sha256": "abcd",
    }

    with pytest.raises(ValueError, match="cup_index.files"):
        DatasetManifest.from_mapping(value)


def test_manifest_requires_object_fields() -> None:
    value = manifest_mapping()
    value["schema"] = "cups"

    with pytest.raises(ValueError, match="schema must be an object"):
        DatasetManifest.from_mapping(value)


def test_manifest_requires_non_empty_strings() -> None:
    value = manifest_mapping()
    value["dataset_tag"] = ""

    with pytest.raises(ValueError, match="dataset_tag must be a non-empty string"):
        DatasetManifest.from_mapping(value)


@pytest.mark.parametrize(
    "tag",
    [
        "../../etc",
        "../dataset-2026-05",
        "dataset-2026-05/malicious",
        "dataset-2026",
        "dataset-26-05",
        "DATASET-2026-05",
    ],
)
def test_manifest_rejects_invalid_dataset_tag(tag: str) -> None:
    value = manifest_mapping()
    value["dataset_tag"] = tag

    with pytest.raises(ValueError, match="dataset_tag must match dataset-YYYY-MM"):
        DatasetManifest.from_mapping(value)


def test_manifest_requires_non_negative_integers() -> None:
    value = manifest_mapping()
    value["n_records"] = -1

    with pytest.raises(ValueError, match="n_records must be a non-negative integer"):
        DatasetManifest.from_mapping(value)


def test_manifest_requires_list_of_non_empty_strings_for_natura_categories() -> None:
    value = manifest_mapping()
    value["natura_categories"] = ["Lavori pubblici", ""]

    with pytest.raises(ValueError, match="natura_categories must be a list of non-empty strings"):
        DatasetManifest.from_mapping(value)
