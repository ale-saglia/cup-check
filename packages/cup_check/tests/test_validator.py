from __future__ import annotations

from pathlib import Path

import yaml

from cup_check import Outcome, Rule, Warning, normalize_cup, validate_format, validate_many

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "tests" / "fixtures"
FIXTURE_FILES = ["valid-cases.yaml", "invalid-cases.yaml", "edge-cases.yaml"]


def fixture_cases() -> list[dict[str, object]]:
    cases = []
    for file_name in FIXTURE_FILES:
        cases.extend(yaml.safe_load((FIXTURE_DIR / file_name).read_text(encoding="utf-8")))
    return cases


def test_fixture_parity() -> None:
    for test_case in fixture_cases():
        result = validate_format(test_case["input"], current_year=2026)
        expected = test_case["expected"]

        assert result.outcome == expected["outcome"], test_case["id"]
        assert [rule.value for rule in result.failed_rules] == expected["failed_rules"], (
            test_case["id"]
        )
        assert [warning.value for warning in result.warnings] == expected.get("warnings", []), (
            test_case["id"]
        )


def test_empty_value_has_only_empty_rule() -> None:
    result = validate_format(None, current_year=2026)

    assert result.raw_value == ""
    assert result.normalized_value == ""
    assert result.outcome is Outcome.INVALIDO_FORMATO
    assert result.failed_rules == (Rule.R0,)
    assert result.warnings == ()


def test_normalize_cup_trims_and_uppercases() -> None:
    assert normalize_cup("  g17h03000130001  ") == "G17H03000130001"


def test_validate_many_assigns_input_rows() -> None:
    results = validate_many(["G17H03000130001", "117H03000130001"], current_year=2026)

    assert [result.input_row for result in results] == [1, 2]
    assert results[0].outcome is Outcome.FORMATO_VALIDO_DA_VERIFICARE
    assert results[1].failed_rules == (Rule.R3,)


def test_warning_types_are_public() -> None:
    result = validate_format("  g17h03000130001  ", current_year=2026)

    assert result.warnings == (Warning.N1, Warning.N2)
