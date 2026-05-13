"""Build e pubblicazione del dataset statico OpenCUP.

Il modulo usa logger con namespace ``cup_check`` e non configura handler o livelli
globali. Le applicazioni chiamanti possono governare la verbosita configurando
il logging standard di Python, per esempio:

    logging.getLogger("cup_check").setLevel(logging.INFO)
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import sqlite3
import time
import warnings
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from importlib.resources import files
from pathlib import Path
from typing import Any
from urllib.request import urlopen
from zipfile import ZipFile

import yaml

from cup_check.dataset import DatasetCupIndex, DatasetLatest, DatasetManifest, DatasetSchema
from cup_check.validator import normalize_cup

OPENCUP_PROJECTS_URL = (
    "https://www.opencup.gov.it/portale/documents/21195/299152/OpendataProgetti.zip/"
)
OPENCUP_DATASET_SCHEMA = "opencup_dataset_schema.yaml"
OPENCUP_DOWNLOAD_TIMEOUT_SECONDS = 60 * 60
OPENCUP_DOWNLOAD_PROGRESS_INTERVAL_BYTES = 100 * 1024 * 1024
OPENCUP_DOWNLOAD_RETRIES = 3
OPENCUP_DOWNLOAD_RETRY_BACKOFF_SECONDS = 2.0
_DOWNLOAD_BLOCK_SIZE_BYTES = 1024 * 1024

_INSERT_SQL = "INSERT OR IGNORE INTO cup_index (cup, detail_chunk) VALUES (?, NULL)"
LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class BuildDatasetResult:
    sqlite_path: Path
    manifest_path: Path
    latest_path: Path
    manifest: DatasetManifest
    latest: DatasetLatest


@dataclass(frozen=True)
class SqliteBuildResult:
    n_records: int
    natura_categories: tuple[str, ...]
    duplicate_cups: int


@dataclass(frozen=True)
class ProjectRecord:
    cup: str
    natura: str | None
    year_suffix: int
    piva_cf_titolare: str | None
    piva_cf_beneficiario: str | None
    costo_progetto_cents: int | None
    finanziamento_progetto_cents: int | None
    descrizione_full: str | None
    attivo: bool
    data_chiusura_revoca: date | None
    cup_master: str | None
    updated_on: date | None


def download_projects_zip(
    destination: str | Path,
    *,
    source_url: str = OPENCUP_PROJECTS_URL,
    timeout: float | None = OPENCUP_DOWNLOAD_TIMEOUT_SECONDS,
    retries: int = OPENCUP_DOWNLOAD_RETRIES,
    retry_backoff_seconds: float = OPENCUP_DOWNLOAD_RETRY_BACKOFF_SECONDS,
    progress_interval_bytes: int = OPENCUP_DOWNLOAD_PROGRESS_INTERVAL_BYTES,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    _download_url_to_path(
        source_url,
        destination_path,
        timeout=timeout,
        retries=retries,
        retry_backoff_seconds=retry_backoff_seconds,
        progress_interval_bytes=progress_interval_bytes,
        on_progress=on_progress,
    )
    return destination_path


def _download_url_to_path(
    source_url: str,
    destination_path: Path,
    *,
    timeout: float | None,
    retries: int,
    retry_backoff_seconds: float,
    progress_interval_bytes: int,
    on_progress: Callable[[int], None] | None = None,
) -> None:
    if on_progress is not None and progress_interval_bytes <= 0:
        raise ValueError("progress_interval_bytes must be positive")
    if retries < 1:
        raise ValueError("retries must be positive")
    if retry_backoff_seconds < 0:
        raise ValueError("retry_backoff_seconds must be non-negative")

    for attempt in range(1, retries + 1):
        try:
            _copy_download_to_path(
                source_url,
                destination_path,
                timeout=timeout,
                progress_interval_bytes=progress_interval_bytes,
                on_progress=on_progress,
            )
            return
        except Exception as exc:
            destination_path.unlink(missing_ok=True)
            if attempt == retries:
                raise
            LOGGER.warning(
                "Download fallito da %s, ritento (%s/%s): %s",
                source_url,
                attempt,
                retries,
                exc,
            )
            if retry_backoff_seconds > 0:
                time.sleep(retry_backoff_seconds)


def _copy_download_to_path(
    source_url: str,
    destination_path: Path,
    *,
    timeout: float | None,
    progress_interval_bytes: int,
    on_progress: Callable[[int], None] | None,
) -> None:
    downloaded_bytes = 0
    next_progress_bytes = progress_interval_bytes
    with _open_download_response(source_url, timeout=timeout) as response, destination_path.open(
        "wb"
    ) as output:
        while chunk := response.read(_DOWNLOAD_BLOCK_SIZE_BYTES):
            output.write(chunk)
            downloaded_bytes += len(chunk)
            while on_progress is not None and downloaded_bytes >= next_progress_bytes:
                on_progress(next_progress_bytes)
                next_progress_bytes += progress_interval_bytes


@contextmanager
def _open_download_response(
    source_url: str,
    *,
    timeout: float | None,
) -> Iterator[Any]:
    with urlopen(source_url, timeout=timeout) as response:
        yield response


def build_sqlite_from_projects_zip(
    source_zip: str | Path,
    sqlite_path: str | Path,
    *,
    schema_path: Path | None = None,
) -> int:
    return _build_sqlite_from_projects_zip(
        source_zip, sqlite_path, schema_path=schema_path
    ).n_records


def _build_sqlite_from_projects_zip(
    source_zip: str | Path,
    sqlite_path: str | Path,
    *,
    schema_path: Path | None = None,
) -> SqliteBuildResult:
    sqlite_output_path = Path(sqlite_path)
    sqlite_output_path.parent.mkdir(parents=True, exist_ok=True)
    natura_categories: list[str] = []
    natura_indexes: dict[str, int] = {}
    total_records = 0
    rows: list[tuple[str]] = []

    with sqlite3.connect(sqlite_output_path) as connection:
        connection.execute("PRAGMA journal_mode = OFF")
        connection.execute("PRAGMA synchronous = OFF")
        connection.execute("PRAGMA temp_store = MEMORY")
        connection.execute("DROP TABLE IF EXISTS cups")
        connection.execute("DROP TABLE IF EXISTS cup_index")
        connection.execute(_create_table_sql("cup_index"))
        for cup, natura in _iter_index_rows(source_zip, schema_path):
            total_records += 1
            if natura is not None and natura not in natura_indexes:
                natura_indexes[natura] = len(natura_categories)
                natura_categories.append(natura)
            rows.append((cup,))
            if len(rows) >= 10_000:
                connection.executemany(_INSERT_SQL, rows)
                rows.clear()
                LOGGER.info("%s record letti...", f"{total_records:,}")
        if rows:
            connection.executemany(_INSERT_SQL, rows)
        LOGGER.info("%s record letti - inserimento completato.", f"{total_records:,}")
        connection.commit()
        connection.execute("PRAGMA optimize")
        n_records = int(connection.execute("SELECT COUNT(*) FROM cup_index").fetchone()[0])
    duplicate_cups = total_records - n_records
    stage_yaml_path = sqlite_output_path.with_name("dataset-stage.yaml")
    _write_stage_yaml(
        stage_yaml_path,
        source_zip=source_zip,
        total_records=total_records,
        n_records=n_records,
        duplicate_cups=duplicate_cups,
        natura_categories=tuple(natura_categories),
    )
    if duplicate_cups > 0:
        warnings.warn(
            f"{duplicate_cups} CUP duplicati trovati nel bulk OpenCUP",
            stacklevel=2,
        )

    return SqliteBuildResult(
        n_records=n_records,
        natura_categories=tuple(natura_categories),
        duplicate_cups=duplicate_cups,
    )


def iter_project_records(
    source_zip: str | Path,
    *,
    schema_path: Path | None = None,
) -> Iterator[ProjectRecord]:
    schema = _load_schema(schema_path)
    with ZipFile(source_zip) as archive:
        for csv_name in sorted(_csv_names(archive)):
            with archive.open(csv_name) as csv_file, io.TextIOWrapper(
                csv_file, encoding="utf-8-sig", newline=""
            ) as text_file:
                reader = csv.DictReader(text_file, delimiter=";")
                for row in reader:
                    record = _record_from_row(row, schema)
                    if record is not None:
                        yield record


def _iter_cups_with_natura(source_zip: str | Path) -> Iterator[tuple[str, str | None]]:
    with ZipFile(source_zip) as archive:
        for csv_name in sorted(_csv_names(archive)):
            with archive.open(csv_name) as csv_file, io.TextIOWrapper(
                csv_file, encoding="utf-8-sig", newline=""
            ) as text_file:
                reader = csv.DictReader(text_file, delimiter=";")
                for row in reader:
                    cup = normalize_cup(row.get("CUP"))
                    if not cup or len(cup) < 6 or not cup[4:6].isdigit():
                        continue
                    natura = (
                        _optional_text(row.get("NATURA_DIPE")) or _optional_text(row.get("NATURA"))
                    )
                    yield cup, natura


def _iter_index_rows(
    source_zip: str | Path, schema_path: Path | None
) -> Iterator[tuple[str, str | None]]:
    if schema_path is None:
        yield from _iter_cups_with_natura(source_zip)
        return

    for record in iter_project_records(source_zip, schema_path=schema_path):
        yield record.cup, record.natura


def build_dataset_release(
    source_zip: str | Path,
    output_dir: str | Path,
    *,
    dataset_tag: str,
    sources_snapshot_date: str,
    release_base_url: str,
    chunk_size_bytes: int = 50 * 1024 * 1024,
    schema_path: Path | None = None,
) -> BuildDatasetResult:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    sqlite_path = output_path / "cup-index.sqlite"

    sqlite_result = _build_sqlite_from_projects_zip(
        source_zip, sqlite_path, schema_path=schema_path
    )
    chunk_files = chunk_file(sqlite_path, output_path, chunk_size_bytes=chunk_size_bytes)
    manifest = DatasetManifest(
        schema_version=1,
        dataset_tag=dataset_tag,
        released_at=datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        sources_snapshot_date=sources_snapshot_date,
        schema=DatasetSchema(table="cup_index", version=1),
        cup_index=DatasetCupIndex(
            base_url=release_base_url,
            files=tuple(path.name for path in chunk_files),
            chunk_size_bytes=chunk_size_bytes,
            total_size_bytes=sqlite_path.stat().st_size,
            sha256=sha256_file(sqlite_path),
            files_sha256=tuple(sha256_file(path) for path in chunk_files),
        ),
        n_records=sqlite_result.n_records,
        min_software_version="0.3.0",
        natura_categories=sqlite_result.natura_categories,
    )
    latest = DatasetLatest(
        dataset_tag=dataset_tag,
        manifest_url=f"{release_base_url}/dataset-manifest.json",
        sources_snapshot_date=sources_snapshot_date,
        released_at=manifest.released_at,
    )
    manifest_path = output_path / "dataset-manifest.json"
    manifest_path.write_text(
        json.dumps(asdict(manifest), ensure_ascii=True, indent=2) + "\n",
        encoding="utf-8",
    )
    latest_path = output_path / "dataset-latest.json"
    latest_path.write_text(
        json.dumps(asdict(latest), ensure_ascii=True, indent=2) + "\n",
        encoding="utf-8",
    )
    return BuildDatasetResult(
        sqlite_path=sqlite_path,
        manifest_path=manifest_path,
        latest_path=latest_path,
        manifest=manifest,
        latest=latest,
    )


def chunk_file(
    source_path: str | Path,
    output_dir: str | Path,
    *,
    chunk_size_bytes: int,
) -> tuple[Path, ...]:
    if chunk_size_bytes <= 0:
        raise ValueError("chunk_size_bytes must be positive")

    source = Path(source_path)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    chunks = []
    with source.open("rb") as input_file:
        index = 0
        while True:
            data = input_file.read(chunk_size_bytes)
            if not data:
                break
            chunk_path = output / f"{source.name}.{index:03d}"
            chunk_path.write_bytes(data)
            chunks.append(chunk_path)
            index += 1
    return tuple(chunks)


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as input_file:
        for block in iter(lambda: input_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _create_table_sql(table_name: str) -> str:
    columns = "          cup TEXT PRIMARY KEY,\n          detail_chunk INTEGER"
    return f"""
        CREATE TABLE {table_name} (
{columns}
        ) WITHOUT ROWID
        """


def _csv_names(archive: ZipFile) -> tuple[str, ...]:
    return tuple(
        name
        for name in archive.namelist()
        if name.lower().endswith(".csv") and not name.endswith("/")
    )


def _record_from_row(row: dict[str, str | None], schema: dict[str, Any]) -> ProjectRecord | None:
    values = _mapped_record_values(row, schema)
    cup = values["cup"]
    if cup == "" or len(cup) < 6 or not cup[4:6].isdigit():
        return None

    return ProjectRecord(
        cup=cup,
        natura=values["natura"],
        year_suffix=values["year_suffix"],
        piva_cf_titolare=values["piva_cf_titolare"],
        piva_cf_beneficiario=values["piva_cf_beneficiario"],
        costo_progetto_cents=values["costo_progetto_cents"],
        finanziamento_progetto_cents=values["finanziamento_progetto_cents"],
        descrizione_full=values["descrizione_full"],
        attivo=values["attivo"],
        data_chiusura_revoca=values["data_chiusura_revoca"],
        cup_master=values["cup_master"],
        updated_on=values["updated_on"],
    )


def _load_schema(schema_path: Path | None = None) -> dict[str, Any]:
    if schema_path is not None:
        return yaml.safe_load(Path(schema_path).read_text(encoding="utf-8"))
    return yaml.safe_load(
        files("cup_check").joinpath(OPENCUP_DATASET_SCHEMA).read_text(encoding="utf-8")
    )


def _mapped_record_values(row: dict[str, str | None], schema: dict[str, Any]) -> dict[str, Any]:
    return {
        column["target"]: _mapped_value(row, column)
        for column in schema["columns"]
    }


def _mapped_value(row: dict[str, str | None], column: dict[str, Any]) -> object:
    value_type = column["type"]
    source = column.get("source")

    if value_type == "cup":
        return normalize_cup(_source_value(row, source))
    if value_type == "optional_cup":
        return normalize_cup(_source_value(row, source)) or None
    if value_type == "cup_year_suffix":
        cup = normalize_cup(_source_value(row, source))
        return _cup_year_suffix(cup) if len(cup) >= 6 and cup[4:6].isdigit() else None
    if value_type in {"optional_text", "category"}:
        return _optional_text(_source_value(row, source))
    if value_type == "money_cents":
        return _money_cents(_source_value(row, source))
    if value_type == "joined_text":
        return _joined_text(row, source)
    if value_type == "bool_equals":
        return _text_in_values(_source_value(row, source), column.get("true_values", ()))
    if value_type == "date":
        return _optional_date(_source_value(row, source))
    if value_type == "first_date":
        return _first_date(row, source)

    raise ValueError(f"unsupported OpenCUP mapping type: {value_type}")


def _source_value(row: dict[str, str | None], source: object) -> str | None:
    if isinstance(source, str):
        return row.get(source)
    if isinstance(source, list):
        for source_name in source:
            value = _optional_text(row.get(source_name))
            if value is not None:
                return value
    return None


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if trimmed in {"***************", "DATO NON PRESENTE"}:
        return None
    return trimmed or None


def _cup_year_suffix(cup: str) -> int:
    return int(cup[4:6])


def _money_cents(value: str | None) -> int | None:
    text = _optional_text(value)
    if text is None:
        return None
    normalized = text.replace(".", "").replace(",", ".")
    try:
        return int((Decimal(normalized) * 100).to_integral_value())
    except InvalidOperation:
        return None


def _joined_text(row: dict[str, str | None], source: object) -> str | None:
    if not isinstance(source, list):
        return _optional_text(_source_value(row, source))
    parts = tuple(_optional_text(row.get(source_name)) for source_name in source)
    description = " ".join(part for part in parts if part is not None)
    return description or None


def _first_date(row: dict[str, str | None], source: object) -> date | None:
    if not isinstance(source, list):
        return _optional_date(_source_value(row, source))
    for source_name in source:
        parsed_date = _optional_date(row.get(source_name))
        if parsed_date is not None:
            return parsed_date
    return None


def _optional_date(value: str | None) -> date | None:
    text = _optional_text(value)
    if text is None:
        return None
    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            pass
    return None


def _text_in_values(value: str | None, candidates: object) -> bool:
    if not isinstance(candidates, list):
        return False
    normalized = (_optional_text(value) or "").upper()
    return normalized in {str(candidate).upper() for candidate in candidates}



def _write_stage_yaml(
    path: Path,
    *,
    source_zip: str | Path,
    total_records: int,
    n_records: int,
    duplicate_cups: int,
    natura_categories: tuple[str, ...],
) -> None:
    lines = [
        "schema_version: 1",
        f"source_zip: {_yaml_string(str(Path(source_zip)))}",
        f"total_records: {total_records}",
        f"n_records: {n_records}",
        f"duplicate_cups: {duplicate_cups}",
        "natura_categories:",
    ]
    lines.extend(f"  - {_yaml_string(category)}" for category in natura_categories)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=True)


def dataset_tag_for_snapshot(snapshot_date: date) -> str:
    return f"dataset-{snapshot_date:%Y-%m}"
