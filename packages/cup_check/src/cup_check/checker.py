from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import tempfile
from collections.abc import Iterable
from dataclasses import replace
from importlib.metadata import version as _pkg_version
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from cup_check.dataset import (
    DatasetLatest,
    DatasetManifest,
    load_dataset_latest,
    load_dataset_manifest,
)
from cup_check.models import Outcome, ValidationResult
from cup_check.validator import validate_format

DEFAULT_LATEST_DATASET_URL = "https://ale-saglia.github.io/cup-check/dataset-latest.json"
_SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)")
_DATASET_JSON_TIMEOUT_SECONDS = 30
_DATASET_CHUNK_TIMEOUT_SECONDS = 300


class DatasetError(ValueError):
    """Errore nel dataset OpenCUP (download, verifica integrità, compatibilità)."""


class OpenCupChecker:
    """Verifica CUP formalmente validi contro un indice OpenCUP SQLite locale."""

    def __init__(
        self,
        connection: sqlite3.Connection | None,
        *,
        manifest: DatasetManifest | None = None,
        fallback_reason: str | None = None,
    ) -> None:
        self._connection = connection
        self.manifest = manifest
        self.fallback_reason = fallback_reason

    @classmethod
    def from_manifest(
        cls,
        path_or_manifest: str | Path | DatasetManifest,
        *,
        sqlite_path: str | Path,
    ) -> OpenCupChecker:
        manifest = (
            path_or_manifest
            if isinstance(path_or_manifest, DatasetManifest)
            else load_dataset_manifest(path_or_manifest)
        )
        connection = _connect_sqlite_index(Path(sqlite_path))
        try:
            _assert_supported_index(connection, manifest)
        except Exception:
            connection.close()
            raise
        return cls(connection, manifest=manifest)

    @classmethod
    def from_latest(
        cls,
        latest_url_or_path: str | Path = DEFAULT_LATEST_DATASET_URL,
        *,
        cache_dir: str | Path | None = None,
        opener=urlopen,
    ) -> OpenCupChecker:
        """Costruisce un checker usando l'ultimo dataset OpenCUP disponibile.

        Se la discovery del dataset, il download dei chunk, la verifica hash o
        l'apertura dell'indice SQLite falliscono, restituisce un checker senza
        indice e salva il dettaglio in ``fallback_reason``. In quel caso
        ``check()`` degrada in modo cautelativo alla sola validazione formale,
        lasciando i CUP formalmente validi come ``FORMATO_VALIDO_DA_VERIFICARE``.
        """
        try:
            latest = _load_latest_pointer(latest_url_or_path, opener=opener)
            manifest = _load_manifest(latest.manifest_url, opener=opener)
            sqlite_path = _ensure_cached_index(manifest, _cache_root(cache_dir), opener=opener)
            return cls.from_manifest(manifest, sqlite_path=sqlite_path)
        except (OSError, ValueError, sqlite3.Error) as exc:
            return cls(None, fallback_reason=str(exc))

    @property
    def is_available(self) -> bool:
        return self._connection is not None

    def check(
        self,
        value: object,
        input_row: int | None = None,
        *,
        current_year: int | None = None,
    ) -> ValidationResult:
        result = validate_format(value, input_row=input_row, current_year=current_year)
        if result.outcome is not Outcome.FORMATO_VALIDO_DA_VERIFICARE or self._connection is None:
            return result

        return replace(
            result,
            outcome=(
                Outcome.TROVATO_OPENCUP
                if self._has_cup(result.normalized_value)
                else Outcome.NON_TROVATO_OPENCUP_DA_VERIFICARE
            ),
        )

    def check_many(
        self,
        values: Iterable[object],
        *,
        current_year: int | None = None,
    ) -> tuple[ValidationResult, ...]:
        return tuple(
            self.check(value, input_row=index, current_year=current_year)
            for index, value in enumerate(values, start=1)
        )

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    def __enter__(self) -> OpenCupChecker:
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        self.close()

    def _has_cup(self, cup: str) -> bool:
        assert self._connection is not None  # noqa: S101
        cursor = self._connection.execute(
            "SELECT 1 FROM cup_index WHERE cup = ? LIMIT 1",
            (cup,),
        )
        return cursor.fetchone() is not None


def _version_tuple(v: str) -> tuple[int, ...]:
    m = _SEMVER_RE.match(v)
    if m is None:
        msg = f"cannot parse version: {v!r}"
        raise DatasetError(msg)
    return tuple(int(x) for x in m.groups())


def _assert_supported_index(connection: sqlite3.Connection, manifest: DatasetManifest) -> None:
    installed = _pkg_version("cup-check")
    if _version_tuple(manifest.min_software_version) > _version_tuple(installed):
        msg = (
            f"dataset requires cup-check >= {manifest.min_software_version},"
            f" installed: {installed}"
        )
        raise DatasetError(msg)
    if manifest.schema.table != "cup_index":
        msg = "unsupported dataset table"
        raise DatasetError(msg)
    table = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cup_index'"
    ).fetchone()
    if table is None:
        msg = "dataset sqlite is missing cup_index table"
        raise DatasetError(msg)


def _connect_sqlite_index(sqlite_path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)


def _load_latest_pointer(source: str | Path, *, opener=urlopen) -> DatasetLatest:
    if _is_url(source):
        return _latest_from_mapping(_json_from_url(str(source), opener=opener))
    return load_dataset_latest(source)


def _load_manifest(source: str | Path, *, opener=urlopen) -> DatasetManifest:
    if _is_url(source):
        return DatasetManifest.from_mapping(_json_from_url(str(source), opener=opener))
    return load_dataset_manifest(source)


def _latest_from_mapping(value: dict[str, Any]) -> DatasetLatest:
    return DatasetLatest(
        dataset_tag=str(value["dataset_tag"]),
        manifest_url=str(value["manifest_url"]),
        sources_snapshot_date=str(value["sources_snapshot_date"]),
        released_at=str(value["released_at"]),
    )


def _json_from_url(url: str, *, opener=urlopen) -> dict[str, Any]:
    with opener(url, timeout=_DATASET_JSON_TIMEOUT_SECONDS) as response:
        value = json.loads(response.read())
    if not isinstance(value, dict):
        msg = "dataset json response must be an object"
        raise TypeError(msg)
    return value


def _ensure_cached_index(manifest: DatasetManifest, cache_dir: Path, *, opener=urlopen) -> Path:
    dataset_dir = cache_dir / manifest.dataset_tag
    dataset_dir.mkdir(parents=True, exist_ok=True)
    sqlite_path = dataset_dir / "cup-index.sqlite"
    if _valid_cached_index(sqlite_path, manifest):
        return sqlite_path

    with tempfile.NamedTemporaryFile(
        dir=dataset_dir, delete=False, suffix=".sqlite.tmp"
    ) as tmp_file:
        tmp_path = Path(tmp_file.name)
    _download_index(manifest, tmp_path, opener=opener)
    tmp_path.replace(sqlite_path)
    return sqlite_path


def _download_index(manifest: DatasetManifest, destination: Path, *, opener=urlopen) -> None:
    try:
        _write_index_chunks(manifest, destination, opener=opener)
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def _write_index_chunks(
    manifest: DatasetManifest, destination: Path, *, opener=urlopen
) -> None:
    global_digest = hashlib.sha256()
    total_size = 0
    per_file_sha256 = manifest.cup_index.files_sha256
    with destination.open("wb") as output:
        for file_index, file_name in enumerate(manifest.cup_index.files):
            url = f"{manifest.cup_index.base_url.rstrip('/')}/{file_name}"
            chunk_digest = hashlib.sha256()
            with opener(url, timeout=_DATASET_CHUNK_TIMEOUT_SECONDS) as response:
                while True:
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    output.write(block)
                    chunk_digest.update(block)
                    global_digest.update(block)
                    total_size += len(block)
            if (
                per_file_sha256
                and file_index < len(per_file_sha256)
                and chunk_digest.hexdigest() != per_file_sha256[file_index]
            ):
                msg = f"sha256 mismatch for chunk {file_name}"
                raise DatasetError(msg)

    if total_size != manifest.cup_index.total_size_bytes:
        msg = "dataset chunk size mismatch"
        raise DatasetError(msg)
    if global_digest.hexdigest() != manifest.cup_index.sha256:
        msg = "dataset sha256 mismatch"
        raise DatasetError(msg)


def _valid_cached_index(sqlite_path: Path, manifest: DatasetManifest) -> bool:
    if (
        not sqlite_path.exists()
        or sqlite_path.stat().st_size != manifest.cup_index.total_size_bytes
    ):
        return False
    return _sha256_file(sqlite_path) == manifest.cup_index.sha256


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as input_file:
        for block in iter(lambda: input_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _cache_root(cache_dir: str | Path | None) -> Path:
    if cache_dir is not None:
        return Path(cache_dir)
    return Path.home() / ".cache" / "cup-check"


def _is_url(value: str | Path) -> bool:
    text = str(value)
    return text.startswith("http://") or text.startswith("https://")
