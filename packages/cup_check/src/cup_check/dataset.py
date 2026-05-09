from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


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


@dataclass(frozen=True)
class DatasetManifest:
    schema_version: int
    dataset_tag: str
    released_at: str
    sources_snapshot_date: str
    schema: DatasetSchema
    chunks: DatasetChunks
    sha256: str
    n_records: int
    min_software_version: str
    natura_categories: tuple[str, ...]

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
                "chunks",
                "sha256",
                "n_records",
                "min_software_version",
                "natura_categories",
            },
        )

        schema_value = _mapping(value["schema"], "schema")
        chunks_value = _mapping(value["chunks"], "chunks")
        files = chunks_value.get("files")
        if (
            not isinstance(files, list)
            or not files
            or not all(isinstance(file, str) for file in files)
        ):
            raise ValueError("chunks.files must be a non-empty list of strings")

        return cls(
            schema_version=_integer(value["schema_version"], "schema_version"),
            dataset_tag=_string(value["dataset_tag"], "dataset_tag"),
            released_at=_string(value["released_at"], "released_at"),
            sources_snapshot_date=_string(
                value["sources_snapshot_date"], "sources_snapshot_date"
            ),
            schema=DatasetSchema(
                table=_string(schema_value.get("table"), "schema.table"),
                version=_integer(schema_value.get("version"), "schema.version"),
            ),
            chunks=DatasetChunks(
                base_url=_string(chunks_value.get("base_url"), "chunks.base_url"),
                files=tuple(files),
                chunk_size_bytes=_integer(
                    chunks_value.get("chunk_size_bytes"), "chunks.chunk_size_bytes"
                ),
                total_size_bytes=_integer(
                    chunks_value.get("total_size_bytes"), "chunks.total_size_bytes"
                ),
            ),
            sha256=_string(value["sha256"], "sha256"),
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
