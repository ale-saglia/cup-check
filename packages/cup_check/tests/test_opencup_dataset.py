from __future__ import annotations

import io
import logging
import sqlite3
import warnings
from datetime import date
from pathlib import Path
from zipfile import ZipFile

import pytest

from cup_check import opencup_dataset
from cup_check.dataset import load_dataset_latest, load_dataset_manifest
from cup_check.opencup_dataset import (
    _first_date,
    _joined_text,
    _load_schema,
    _mapped_value,
    _source_value,
    _text_in_values,
    build_dataset_release,
    build_sqlite_from_projects_zip,
    chunk_file,
    dataset_tag_for_snapshot,
    download_projects_zip,
    iter_project_records,
    sha256_file,
)


def test_iter_project_records_reads_semicolon_delimited_utf8_csv(tmp_path: Path) -> None:
    source_zip = write_projects_zip(tmp_path)

    records = tuple(iter_project_records(source_zip))

    assert [record.cup for record in records] == [
        "G17H03000130001",
        "G17H03000130001",
        "H11B22001230001",
    ]
    assert records[0].natura == "Lavori pubblici"
    assert records[0].year_suffix == 3
    assert records[2].costo_progetto_cents == 123456
    assert records[2].finanziamento_progetto_cents == 100000
    assert records[2].descrizione_full == "Acquisto beni per servizi digitali"
    assert records[2].piva_cf_titolare == "01234567890"
    assert records[2].piva_cf_beneficiario == "RSSMRA80A01H501U"
    assert records[1].data_chiusura_revoca == date(2024, 1, 31)
    assert records[2].attivo is True
    assert records[2].cup_master == "M11B22001230001"


def test_build_sqlite_from_projects_zip_deduplicates_cups(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    source_zip = write_projects_zip(tmp_path)
    sqlite_path = tmp_path / "cup-index.sqlite"

    with caplog.at_level(logging.INFO, logger=opencup_dataset.__name__), pytest.warns(
        UserWarning, match="CUP duplicati"
    ):
        n_records = build_sqlite_from_projects_zip(source_zip, sqlite_path)
    stage_yaml = (tmp_path / "dataset-stage.yaml").read_text(encoding="utf-8")
    captured = capsys.readouterr()

    with sqlite3.connect(sqlite_path) as connection:
        schema = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cup_index'"
        ).fetchone()[0]
        stage_table = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cups_stage'"
        ).fetchone()
        rows = connection.execute(
            """
            SELECT cup, detail_chunk
            FROM cup_index
            ORDER BY cup
            """
        ).fetchall()

    assert n_records == 2
    assert captured.out == ""
    assert captured.err == ""
    assert "3 record letti - inserimento completato." in caplog.text
    assert "WITHOUT ROWID" in schema
    assert "cup TEXT PRIMARY KEY" in schema
    assert "detail_chunk INTEGER" in schema
    assert "natura_index" not in schema
    assert "year_suffix" not in schema
    assert "attivo" not in schema
    assert "data_chiusura_revoca" not in schema
    assert "area" not in schema
    assert stage_table is None
    assert 'source_zip: "' in stage_yaml
    assert "total_records: 3" in stage_yaml
    assert "n_records: 2" in stage_yaml
    assert "duplicate_cups: 1" in stage_yaml
    assert '  - "Lavori pubblici"' in stage_yaml
    assert rows == [
        ("G17H03000130001", None),
        ("H11B22001230001", None),
    ]


def test_build_dataset_release_writes_chunks_and_manifest(tmp_path: Path) -> None:
    source_zip = write_projects_zip(tmp_path)
    output_dir = tmp_path / "release"

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        result = build_dataset_release(
            source_zip,
            output_dir,
            dataset_tag="dataset-2026-05",
            sources_snapshot_date="2026-05-01",
            release_base_url=(
                "https://github.com/ale-saglia/cup-check/releases/download/dataset-2026-05"
            ),
            chunk_size_bytes=64,
        )
    manifest = load_dataset_manifest(result.manifest_path)
    latest = load_dataset_latest(result.latest_path)

    assert result.sqlite_path.exists()
    assert result.sqlite_path.name == "cup-index.sqlite"
    assert manifest.dataset_tag == "dataset-2026-05"
    assert manifest.sources_snapshot_date == "2026-05-01"
    assert manifest.schema.table == "cup_index"
    assert manifest.n_records == 2
    assert manifest.natura_categories == ("Lavori pubblici", "Acquisto beni")
    assert manifest.sha256 == sha256_file(result.sqlite_path)
    assert len(manifest.cup_index.files) > 1
    assert all((output_dir / file_name).exists() for file_name in manifest.cup_index.files)
    assert len(manifest.cup_index.files_sha256) == len(manifest.cup_index.files)
    assert all(
        manifest.cup_index.files_sha256[i] == sha256_file(output_dir / manifest.cup_index.files[i])
        for i in range(len(manifest.cup_index.files))
    )
    assert latest.dataset_tag == "dataset-2026-05"
    assert latest.manifest_url.endswith("/dataset-2026-05/dataset-manifest.json")


def test_dataset_tag_for_snapshot() -> None:
    assert dataset_tag_for_snapshot(date(2026, 5, 1)) == "dataset-2026-05"


def test_chunk_file_requires_positive_chunk_size(tmp_path: Path) -> None:
    source = tmp_path / "cup-index.sqlite"
    source.write_text("sqlite", encoding="ascii")

    with pytest.raises(ValueError, match="chunk_size_bytes must be positive"):
        chunk_file(source, tmp_path, chunk_size_bytes=0)


def test_project_records_tolerate_missing_and_invalid_optional_values(tmp_path: Path) -> None:
    source_zip = tmp_path / "OpendataProgetti.zip"
    csv_content = "\n".join(
        [
            '"CUP";"NATURA";"ANNO";"DATA_CHIUSURA_REVOCA"',
            '"";"Lavori pubblici";"2003";""',
            '"ABCDE";"Lavori pubblici";"2003";""',
            '"H11B22001230001";"";"non disponibile";""',
        ]
    )
    with ZipFile(source_zip, "w") as archive:
        archive.writestr("OpenData_Complessivo.csv", csv_content.encode("utf-8"))

    records = tuple(iter_project_records(source_zip))

    assert len(records) == 1
    assert records[0].natura is None
    assert records[0].year_suffix == 22


def test_project_records_normalize_opencup_placeholders(tmp_path: Path) -> None:
    source_zip = tmp_path / "OpendataProgetti.zip"
    csv_content = "\n".join(
        [
            '"CUP";"NATURA";"COSTO_PROGETTO";"PIVA_CF_BENEFICIARIO"',
            '"H11B22001230001";"DATO NON PRESENTE";"***************";"***************"',
        ]
    )
    with ZipFile(source_zip, "w") as archive:
        archive.writestr("OpenData_Complessivo.csv", csv_content.encode("utf-8"))

    records = tuple(iter_project_records(source_zip))

    assert records[0].natura is None
    assert records[0].costo_progetto_cents is None
    assert records[0].piva_cf_beneficiario is None


def test_project_records_are_independent_from_geographic_area_filename(tmp_path: Path) -> None:
    source_zip = tmp_path / "OpendataProgetti.zip"
    csv_content = "\n".join(
        [
            '"CUP";"NATURA";"ANNO";"DATA_CHIUSURA_REVOCA"',
            '"A11B22001230001";"Servizi";"2022";""',
        ]
    )
    file_names = (
        "OpenData_Nord_Est.csv",
        "OpenData_NordOvest.csv",
        "OpenData_Centro.csv",
        "OpenData_Isole.csv",
    )

    with ZipFile(source_zip, "w") as archive:
        for file_name in file_names:
            archive.writestr(file_name, csv_content.encode("utf-8"))

    records = tuple(iter_project_records(source_zip))

    assert len(records) == len(file_names)
    assert {record.natura for record in records} == {"Servizi"}


def test_download_projects_zip_writes_response_body(tmp_path: Path) -> None:
    class Response:
        def __init__(self):
            self._content = io.BytesIO(b"dataset")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return None

        def read(self, size=-1):
            return self._content.read(size)

    def fake_urlopen(source_url: str, *, timeout: float | None = None):
        assert source_url == "https://example.test/opencup.zip"
        assert timeout == opencup_dataset.OPENCUP_DOWNLOAD_TIMEOUT_SECONDS
        return Response()

    destination = download_projects_zip(
        tmp_path / "nested" / "OpendataProgetti.zip",
        source_url="https://example.test/opencup.zip",
        _opener=fake_urlopen,
    )

    assert destination.read_bytes() == b"dataset"


def test_download_projects_zip_skips_existing_destination(tmp_path: Path) -> None:
    destination = tmp_path / "OpendataProgetti.zip"
    destination.write_bytes(b"cached-dataset")

    def fake_urlopen(source_url: str, *, timeout: float | None = None):
        raise AssertionError("download should be skipped")

    result = download_projects_zip(
        destination,
        source_url="https://example.test/opencup.zip",
        skip_if_exists=True,
        _opener=fake_urlopen,
    )

    assert result == destination
    assert destination.read_bytes() == b"cached-dataset"


def test_download_projects_zip_overwrites_existing_by_default(tmp_path: Path) -> None:
    destination = tmp_path / "OpendataProgetti.zip"
    destination.write_bytes(b"stale-dataset")

    downloaded = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def read(self, n: int) -> bytes:
            if not downloaded:
                downloaded.append(True)
                return b"fresh-dataset"
            return b""

    def fake_urlopen(source_url: str, *, timeout: float | None = None):
        return FakeResponse()

    download_projects_zip(
        destination,
        source_url="https://example.test/opencup.zip",
        _opener=fake_urlopen,
    )

    assert destination.read_bytes() == b"fresh-dataset"


def test_download_projects_zip_reports_progress_every_interval(tmp_path: Path) -> None:
    class ChunkedResponse:
        def __init__(self):
            self._chunks = iter((b"aa", b"bb", b"bb", b"c"))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return None

        def read(self, size=-1):
            return next(self._chunks, b"")

    def fake_urlopen(source_url: str, *, timeout: float | None = None):
        assert source_url == "https://example.test/opencup.zip"
        assert timeout == 123
        return ChunkedResponse()

    progress_calls: list[int] = []

    destination = download_projects_zip(
        tmp_path / "OpendataProgetti.zip",
        source_url="https://example.test/opencup.zip",
        timeout=123,
        progress_interval_bytes=3,
        on_progress=progress_calls.append,
        _opener=fake_urlopen,
    )

    assert destination.read_bytes() == b"aabbbbc"
    assert progress_calls == [3, 6]


def test_download_projects_zip_retries_open_failures(tmp_path: Path, monkeypatch) -> None:
    class Response:
        def __init__(self):
            self._content = io.BytesIO(b"dataset")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return None

        def read(self, size=-1):
            return self._content.read(size)

    attempts = 0
    sleep_calls: list[float] = []

    def fake_urlopen(source_url: str, *, timeout: float | None = None):
        nonlocal attempts
        attempts += 1
        assert source_url == "https://example.test/opencup.zip"
        assert timeout == 123
        if attempts == 1:
            raise OSError("temporary network failure")
        return Response()

    monkeypatch.setattr(opencup_dataset.time, "sleep", sleep_calls.append)

    destination = download_projects_zip(
        tmp_path / "OpendataProgetti.zip",
        source_url="https://example.test/opencup.zip",
        timeout=123,
        retries=2,
        retry_backoff_seconds=0.5,
        _opener=fake_urlopen,
    )

    assert destination.read_bytes() == b"dataset"
    assert attempts == 2
    assert sleep_calls == [0.5]


def test_download_projects_zip_raises_after_retry_exhaustion(tmp_path: Path) -> None:
    attempts = 0

    def fake_urlopen(source_url: str, *, timeout: float | None = None):
        nonlocal attempts
        attempts += 1
        raise OSError("network unavailable")

    with pytest.raises(OSError, match="network unavailable"):
        download_projects_zip(
            tmp_path / "OpendataProgetti.zip",
            source_url="https://example.test/opencup.zip",
            retries=2,
            retry_backoff_seconds=0,
            _opener=fake_urlopen,
        )

    assert attempts == 2


def test_download_projects_zip_requires_positive_progress_interval_when_reporting(
    tmp_path: Path,
) -> None:
    with pytest.raises(ValueError, match="progress_interval_bytes must be positive"):
        download_projects_zip(
            tmp_path / "OpendataProgetti.zip",
            source_url="https://example.test/opencup.zip",
            progress_interval_bytes=0,
            on_progress=lambda downloaded_bytes: None,
        )


def test_download_projects_zip_requires_positive_retries(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="retries must be positive"):
        download_projects_zip(
            tmp_path / "OpendataProgetti.zip",
            source_url="https://example.test/opencup.zip",
            retries=0,
        )


def test_download_projects_zip_requires_non_negative_retry_backoff(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="retry_backoff_seconds must be non-negative"):
        download_projects_zip(
            tmp_path / "OpendataProgetti.zip",
            source_url="https://example.test/opencup.zip",
            retry_backoff_seconds=-1,
        )


def test_build_sqlite_logs_batch_progress(
    tmp_path: Path,
    monkeypatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def iter_cups_with_natura(source_zip: str | Path):
        assert source_zip == tmp_path / "OpendataProgetti.zip"
        for index in range(10_000):
            yield f"A00B26{index:09d}", None

    monkeypatch.setattr(opencup_dataset, "_iter_cups_with_natura", iter_cups_with_natura)

    with caplog.at_level(logging.INFO, logger=opencup_dataset.__name__):
        n_records = build_sqlite_from_projects_zip(
            tmp_path / "OpendataProgetti.zip",
            tmp_path / "cup-index.sqlite",
        )

    assert n_records == 10_000
    assert "10,000 record letti..." in caplog.text


def test_build_sqlite_skips_invalid_cups(tmp_path: Path) -> None:
    source_zip = tmp_path / "OpendataProgetti.zip"
    csv_content = "\n".join(
        [
            '"CUP";"NATURA_DIPE"',
            '"H11B22001230001";"Lavori pubblici"',
            '"SHORT";"Lavori pubblici"',
            '"ABCDEX1234";"Lavori pubblici"',
        ]
    )
    with ZipFile(source_zip, "w") as archive:
        archive.writestr("OpenData_Complessivo.csv", csv_content.encode("utf-8"))
    sqlite_path = tmp_path / "cup-index.sqlite"

    n_records = build_sqlite_from_projects_zip(source_zip, sqlite_path)

    assert n_records == 1


def test_project_records_handle_invalid_amount(tmp_path: Path) -> None:
    source_zip = tmp_path / "OpendataProgetti.zip"
    csv_content = "\n".join(
        [
            '"CUP";"COSTO_PROGETTO"',
            '"H11B22001230001";"not-a-number"',
        ]
    )
    with ZipFile(source_zip, "w") as archive:
        archive.writestr("OpenData_Complessivo.csv", csv_content.encode("utf-8"))

    records = tuple(iter_project_records(source_zip))

    assert len(records) == 1
    assert records[0].costo_progetto_cents is None


def test_project_records_handle_unrecognized_date_format(tmp_path: Path) -> None:
    source_zip = tmp_path / "OpendataProgetti.zip"
    csv_content = "\n".join(
        [
            '"CUP";"DATA_CHIUSURA_REVOCA"',
            '"H11B22001230001";"2026.05.09"',
        ]
    )
    with ZipFile(source_zip, "w") as archive:
        archive.writestr("OpenData_Complessivo.csv", csv_content.encode("utf-8"))

    records = tuple(iter_project_records(source_zip))

    assert len(records) == 1
    assert records[0].data_chiusura_revoca is None


def test_project_records_accept_custom_schema_path(tmp_path: Path) -> None:
    source_zip = tmp_path / "OpendataProgetti.zip"
    schema_path = tmp_path / "custom-schema.yaml"
    schema_path.write_text(
        "\n".join(
            [
                "schema_version: 1",
                "columns:",
                '  - {target: cup, source: CODICE_CUP, type: cup}',
                '  - {target: natura, source: TIPO, type: category}',
                '  - {target: year_suffix, source: CODICE_CUP, type: cup_year_suffix}',
                '  - {target: piva_cf_titolare, source: TITOLARE, type: optional_text}',
                '  - {target: piva_cf_beneficiario, source: BENEFICIARIO, type: optional_text}',
                '  - {target: costo_progetto_cents, source: COSTO, type: money_cents}',
                "  - target: finanziamento_progetto_cents",
                "    source: FINANZIAMENTO",
                "    type: money_cents",
                '  - {target: descrizione_full, source: DESCRIZIONE, type: joined_text}',
                '  - {target: attivo, source: STATO, type: bool_equals, true_values: [APERTO]}',
                '  - {target: data_chiusura_revoca, source: CHIUSURA, type: date}',
                '  - {target: cup_master, source: MASTER, type: optional_cup}',
                '  - {target: updated_on, source: AGGIORNATO, type: first_date}',
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    csv_content = "\n".join(
        [
            '"CODICE_CUP";"TIPO";"COSTO";"FINANZIAMENTO";"DESCRIZIONE";"STATO";"AGGIORNATO"',
            '"h11b22001230001";"Servizi";"10,50";"5,00";"Riga custom";"APERTO";"2026-05-09"',
        ]
    )
    with ZipFile(source_zip, "w") as archive:
        archive.writestr("custom.csv", csv_content.encode("utf-8"))

    records = tuple(iter_project_records(source_zip, schema_path=schema_path))

    assert len(records) == 1
    assert records[0].cup == "H11B22001230001"
    assert records[0].natura == "Servizi"
    assert records[0].costo_progetto_cents == 1050
    assert records[0].attivo is True
    assert records[0].updated_on == date(2026, 5, 9)

    sqlite_path = tmp_path / "custom-cup-index.sqlite"
    n_records = build_sqlite_from_projects_zip(
        source_zip, sqlite_path, schema_path=schema_path
    )

    with sqlite3.connect(sqlite_path) as connection:
        rows = connection.execute("SELECT cup, detail_chunk FROM cup_index").fetchall()

    assert n_records == 1
    assert rows == [("H11B22001230001", None)]


def test_load_schema_rejects_empty_yaml(tmp_path: Path) -> None:
    schema_path = tmp_path / "empty-schema.yaml"
    schema_path.write_text("", encoding="utf-8")

    with pytest.raises(ValueError, match="OpenCUP schema must be a mapping"):
        _load_schema(schema_path)


def test_load_schema_rejects_unsupported_schema_version(tmp_path: Path) -> None:
    schema_path = write_custom_schema(tmp_path, overrides=["schema_version: 2"])

    with pytest.raises(ValueError, match="schema_version must be 1"):
        _load_schema(schema_path)


def test_load_schema_rejects_non_integer_schema_version(tmp_path: Path) -> None:
    schema_path = write_custom_schema(tmp_path, overrides=['schema_version: "1"'])

    with pytest.raises(ValueError, match="schema_version must be an integer"):
        _load_schema(schema_path)


def test_load_schema_rejects_empty_columns(tmp_path: Path) -> None:
    schema_path = tmp_path / "custom-schema.yaml"
    schema_path.write_text("schema_version: 1\ncolumns: []\n", encoding="utf-8")

    with pytest.raises(ValueError, match="columns must be a non-empty list"):
        _load_schema(schema_path)


def test_load_schema_rejects_non_mapping_column(tmp_path: Path) -> None:
    schema_path = write_custom_schema(tmp_path, column_lines=["  - non-mapping-column"])

    with pytest.raises(ValueError, match=r"columns\[0\] must be a mapping"):
        _load_schema(schema_path)


def test_load_schema_rejects_column_missing_required_key(tmp_path: Path) -> None:
    schema_path = write_custom_schema(
        tmp_path,
        column_lines=[
            '  - {target: cup, source: CODICE_CUP}',
            '  - {target: natura, source: TIPO, type: category}',
        ],
    )

    with pytest.raises(ValueError, match=r"columns\[0\]\.type must be a non-empty string"):
        _load_schema(schema_path)


def test_load_schema_rejects_unsupported_column_type(tmp_path: Path) -> None:
    schema_path = write_custom_schema(
        tmp_path,
        column_lines=['  - {target: cup, source: CODICE_CUP, type: unsupported}'],
    )

    with pytest.raises(ValueError, match=r"columns\[0\]\.type is unsupported: unsupported"):
        _load_schema(schema_path)


def test_load_schema_rejects_column_without_source(tmp_path: Path) -> None:
    schema_path = write_custom_schema(
        tmp_path,
        column_lines=['  - {target: cup, type: cup}'],
    )

    with pytest.raises(ValueError, match=r"columns\[0\]\.source is required"):
        _load_schema(schema_path)


def test_load_schema_rejects_invalid_column_source(tmp_path: Path) -> None:
    schema_path = write_custom_schema(
        tmp_path,
        column_lines=['  - {target: cup, source: [], type: cup}'],
    )

    with pytest.raises(ValueError, match=r"columns\[0\]\.source must be"):
        _load_schema(schema_path)


def test_load_schema_rejects_invalid_bool_values(tmp_path: Path) -> None:
    schema_path = write_custom_schema(
        tmp_path,
        column_lines=['  - {target: attivo, source: STATO, type: bool_equals, true_values: []}'],
    )

    with pytest.raises(ValueError, match=r"columns\[0\]\.true_values must be"):
        _load_schema(schema_path)


def test_load_schema_rejects_missing_required_target(tmp_path: Path) -> None:
    schema_path = write_custom_schema(
        tmp_path,
        column_lines=[
            '  - {target: cup, source: CODICE_CUP, type: cup}',
            '  - {target: natura, source: TIPO, type: category}',
        ],
    )

    with pytest.raises(ValueError, match="missing required target"):
        _load_schema(schema_path)


def test_source_value_returns_none_for_non_str_non_list_source() -> None:
    assert _source_value({"COL": "valore"}, None) is None


def test_iter_project_records_raises_import_error_when_yaml_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sys

    monkeypatch.setitem(sys.modules, "yaml", None)  # type: ignore[arg-type]
    source_zip = write_projects_zip(tmp_path)
    with pytest.raises(ImportError, match="pip install 'cup-check\\[build\\]'"):
        tuple(iter_project_records(source_zip))


def test_mapped_value_raises_for_unsupported_type() -> None:
    with pytest.raises(ValueError, match="unsupported OpenCUP mapping type: unknown_type"):
        _mapped_value({}, {"type": "unknown_type"})


def test_joined_text_with_scalar_source() -> None:
    assert _joined_text({"COL": "valore"}, "COL") == "valore"
    assert _joined_text({"COL": None}, "COL") is None


def test_first_date_with_scalar_source() -> None:
    assert _first_date({"COL": "2026-05-09"}, "COL") == date(2026, 5, 9)
    assert _first_date({"COL": None}, "COL") is None


def test_text_in_values_with_non_list_candidates() -> None:
    assert _text_in_values("ATTIVO", ("ATTIVO",)) is False
    assert _text_in_values("ATTIVO", None) is False


def write_custom_schema(
    tmp_path: Path,
    *,
    overrides: list[str] | None = None,
    column_lines: list[str] | None = None,
) -> Path:
    schema_path = tmp_path / "custom-schema.yaml"
    lines = overrides or ["schema_version: 1"]
    lines += ["columns:"]
    lines += column_lines or [
        '  - {target: cup, source: CODICE_CUP, type: cup}',
        '  - {target: natura, source: TIPO, type: category}',
        '  - {target: year_suffix, source: CODICE_CUP, type: cup_year_suffix}',
        '  - {target: piva_cf_titolare, source: TITOLARE, type: optional_text}',
        '  - {target: piva_cf_beneficiario, source: BENEFICIARIO, type: optional_text}',
        '  - {target: costo_progetto_cents, source: COSTO, type: money_cents}',
        '  - {target: finanziamento_progetto_cents, source: FINANZIAMENTO, type: money_cents}',
        '  - {target: descrizione_full, source: DESCRIZIONE, type: joined_text}',
        '  - {target: attivo, source: STATO, type: bool_equals, true_values: [APERTO]}',
        '  - {target: data_chiusura_revoca, source: CHIUSURA, type: date}',
        '  - {target: cup_master, source: MASTER, type: optional_cup}',
        '  - {target: updated_on, source: AGGIORNATO, type: first_date}',
    ]
    schema_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return schema_path


def write_projects_zip(tmp_path: Path) -> Path:
    source_zip = tmp_path / "OpendataProgetti.zip"
    csv_content = "\n".join(
        [
            '"CUP";"NATURA_DIPE";"ANNO_DECISIONE";"DATA_CHIUSURA_REVOCA";'
            '"COSTO_PROGETTO";"FINANZIAMENTO_PROGETTO";"DESCRIZIONE_SINTETICA_CUP";'
            '"PIVA_CODFISCALE_SOG_TITOLARE";"PIVA_CF_BENEFICIARIO";"STATO_PROGETTO";'
            '"CUP_MASTER";"DATA_AGGIORNAMENTO"',
            '" g17h03000130001 ";"Lavori pubblici";"2003";"";"";"";"";"";"";"";"";'
            '"2024-01-01"',
            '"G17H03000130001";"Lavori pubblici";"2003";"2024-01-31";"";"";"";"";"";'
            '"";"";"2024-02-01"',
            '"H11B22001230001";"Acquisto beni";"2022";"";"1.234,56";"1000";'
            '"Acquisto beni per servizi digitali";"01234567890";"RSSMRA80A01H501U";'
            '"ATTIVO";"M11B22001230001";"2024-01-01"',
        ]
    )
    with ZipFile(source_zip, "w") as archive:
        archive.writestr("OpenData_Sud.csv", csv_content.encode("utf-8"))
    return source_zip
