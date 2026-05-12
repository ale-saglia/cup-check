from __future__ import annotations

import io
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
    _mapped_value,
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


def test_build_sqlite_from_projects_zip_deduplicates_cups(tmp_path: Path) -> None:
    source_zip = write_projects_zip(tmp_path)
    sqlite_path = tmp_path / "cup-index.sqlite"

    with pytest.warns(UserWarning, match="CUP duplicati"):
        n_records = build_sqlite_from_projects_zip(source_zip, sqlite_path)
    stage_yaml = (tmp_path / "dataset-stage.yaml").read_text(encoding="utf-8")

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


def test_download_projects_zip_writes_response_body(tmp_path: Path, monkeypatch) -> None:
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

    monkeypatch.setattr(opencup_dataset, "urlopen", fake_urlopen)

    destination = download_projects_zip(
        tmp_path / "nested" / "OpendataProgetti.zip",
        source_url="https://example.test/opencup.zip",
    )

    assert destination.read_bytes() == b"dataset"


def test_download_projects_zip_reports_progress_every_interval(
    tmp_path: Path, monkeypatch
) -> None:
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

    monkeypatch.setattr(opencup_dataset, "urlopen", fake_urlopen)
    progress_calls: list[int] = []

    destination = download_projects_zip(
        tmp_path / "OpendataProgetti.zip",
        source_url="https://example.test/opencup.zip",
        timeout=123,
        progress_interval_bytes=3,
        on_progress=progress_calls.append,
    )

    assert destination.read_bytes() == b"aabbbbc"
    assert progress_calls == [3, 6]


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
