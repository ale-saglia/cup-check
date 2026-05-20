from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_DATASET_TAG_RE = re.compile(r"^dataset-\d{4}-\d{2}$")


@dataclass(frozen=True)
class DatasetSchema:
    table: str
    version: int


@dataclass(frozen=True)
class DatasetChunks:
    base_url: str
    files: tuple[str, ...]
    chunk_size_bytes: int
    total_size_bytes: int
    sha256: str
    files_sha256: tuple[str, ...] = ()


DatasetCupIndex = DatasetChunks


@dataclass(frozen=True)
class DatasetLatest:
    dataset_tag: str
    manifest_url: str
    sources_snapshot_date: str
    released_at: str


@dataclass(frozen=True)
class DatasetManifest:
    schema_version: int
    dataset_tag: str
    released_at: str
    sources_snapshot_date: str
    schema: DatasetSchema
    cup_index: DatasetCupIndex
    n_records: int
    min_software_version: str
    natura_categories: tuple[str, ...]

    @property
    def chunks(self) -> DatasetCupIndex:
        return self.cup_index

    @property
    def sha256(self) -> str:
        return self.cup_index.sha256

    @classmethod
    def from_mapping(cls, value: dict[str, Any]) -> DatasetManifest:
        _require_keys(
            value,
            {
                "schema_version",
                "dataset_tag",
                "released_at",
                "sources_snapshot_date",
                "schema",
                "cup_index",
                "n_records",
                "min_software_version",
                "natura_categories",
            },
        )

        schema_value = _mapping(value["schema"], "schema")
        cup_index_value = _mapping(value["cup_index"], "cup_index")
        files = cup_index_value.get("files")
        if (
            not isinstance(files, list)
            or not files
            or not all(isinstance(file, str) for file in files)
        ):
            raise ValueError("cup_index.files must be a non-empty list of strings")

        dataset_tag = _string(value["dataset_tag"], "dataset_tag")
        if not _DATASET_TAG_RE.match(dataset_tag):
            raise ValueError("dataset_tag must match dataset-YYYY-MM")

        return cls(
            schema_version=_integer(value["schema_version"], "schema_version"),
            dataset_tag=dataset_tag,
            released_at=_string(value["released_at"], "released_at"),
            sources_snapshot_date=_string(
                value["sources_snapshot_date"], "sources_snapshot_date"
            ),
            schema=DatasetSchema(
                table=_string(schema_value.get("table"), "schema.table"),
                version=_integer(schema_value.get("version"), "schema.version"),
            ),
            cup_index=DatasetCupIndex(
                base_url=_string(cup_index_value.get("base_url"), "cup_index.base_url"),
                files=tuple(files),
                chunk_size_bytes=_integer(
                    cup_index_value.get("chunk_size_bytes"), "cup_index.chunk_size_bytes"
                ),
                total_size_bytes=_integer(
                    cup_index_value.get("total_size_bytes"), "cup_index.total_size_bytes"
                ),
                sha256=_string(cup_index_value.get("sha256"), "cup_index.sha256"),
                files_sha256=_string_tuple(
                    cup_index_value.get("files_sha256", []), "cup_index.files_sha256"
                ),
            ),
            n_records=_integer(value["n_records"], "n_records"),
            min_software_version=_string(
                value["min_software_version"], "min_software_version"
            ),
            natura_categories=_string_tuple(
                value["natura_categories"], "natura_categories"
            ),
        )


def load_dataset_manifest(path: str | Path) -> DatasetManifest:
    manifest_path = Path(path)
    return DatasetManifest.from_mapping(
        json.loads(manifest_path.read_text(encoding="utf-8"))
    )


def load_dataset_latest(path: str | Path) -> DatasetLatest:
    latest_path = Path(path)
    value = json.loads(latest_path.read_text(encoding="utf-8"))
    _require_keys(value, {"dataset_tag", "manifest_url", "sources_snapshot_date", "released_at"})
    return DatasetLatest(
        dataset_tag=_string(value["dataset_tag"], "dataset_tag"),
        manifest_url=_string(value["manifest_url"], "manifest_url"),
        sources_snapshot_date=_string(value["sources_snapshot_date"], "sources_snapshot_date"),
        released_at=_string(value["released_at"], "released_at"),
    )


def _require_keys(value: dict[str, Any], keys: set[str]) -> None:
    missing_keys = sorted(keys - value.keys())
    if missing_keys:
        raise ValueError(f"dataset manifest is missing keys: {', '.join(missing_keys)}")


def _mapping(value: Any, field_name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} must be an object")
    return value


def _string(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or value == "":
        raise ValueError(f"{field_name} must be a non-empty string")
    return value


def _integer(value: Any, field_name: str) -> int:
    if not isinstance(value, int) or value < 0:
        raise ValueError(f"{field_name} must be a non-negative integer")
    return value


def _string_tuple(value: Any, field_name: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(
        isinstance(item, str) and item != "" for item in value
    ):
        raise ValueError(f"{field_name} must be a list of non-empty strings")
    return tuple(value)
