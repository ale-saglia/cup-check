from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import UTC, datetime

from cup_check.models import Outcome, Rule, ValidationResult, Warning

_ALLOWED_CHARS = re.compile(r"^[A-Z0-9]*$")
_FIRST_POSITION = re.compile(r"^[A-Z]")
_TWO_DIGIT_YEAR = re.compile(r"^\d{2}$")


def normalize_cup(value: object) -> str:
    return str("" if value is None else value).strip().upper()


def validate_format(
    value: object,
    input_row: int | None = None,
    *,
    current_year: int | None = None,
) -> ValidationResult:
    if current_year is not None and current_year < 0:
        msg = "current_year must be non-negative"
        raise ValueError(msg)
    raw_value = str("" if value is None else value)
    trimmed_value = raw_value.strip()
    normalized_value = normalize_cup(raw_value)
    failed_rules: list[Rule] = []
    warnings = _normalization_warnings(raw_value, trimmed_value, normalized_value)

    if len(trimmed_value) == 0:
        return ValidationResult(
            input_row=input_row,
            raw_value=raw_value,
            normalized_value=normalized_value,
            outcome=Outcome.INVALIDO_FORMATO,
            failed_rules=(Rule.R0,),
            warnings=warnings,
        )

    if len(normalized_value) != 15:
        failed_rules.append(Rule.R1)

    if _ALLOWED_CHARS.fullmatch(normalized_value) is None:
        failed_rules.append(Rule.R2)

    if _FIRST_POSITION.match(normalized_value) is None:
        failed_rules.append(Rule.R3)

    year_token = normalized_value[4:6]
    two_digit_year = (current_year if current_year is not None else datetime.now(UTC).year) % 100
    # Il formato CUP espone l'anno con due sole cifre: R4 lo confronta quindi
    # con le due cifre finali dell'anno corrente, preservando questo limite intrinseco.
    if _TWO_DIGIT_YEAR.fullmatch(year_token) is None or int(year_token) > two_digit_year:
        failed_rules.append(Rule.R4)

    if not (len(normalized_value) > 3 and "A" <= normalized_value[3] <= "Z"):
        failed_rules.append(Rule.R5)

    return ValidationResult(
        input_row=input_row,
        raw_value=raw_value,
        normalized_value=normalized_value,
        outcome=(
            Outcome.FORMATO_VALIDO_DA_VERIFICARE
            if len(failed_rules) == 0
            else Outcome.INVALIDO_FORMATO
        ),
        failed_rules=tuple(failed_rules),
        warnings=warnings,
    )


def validate_many(
    values: Iterable[object],
    *,
    current_year: int | None = None,
) -> tuple[ValidationResult, ...]:
    return tuple(
        validate_format(value, input_row=index, current_year=current_year)
        for index, value in enumerate(values, start=1)
    )


def _normalization_warnings(
    raw_value: str, trimmed_value: str, normalized_value: str
) -> tuple[Warning, ...]:
    warnings = []
    if raw_value != trimmed_value:
        warnings.append(Warning.N1)
    if trimmed_value != normalized_value:
        warnings.append(Warning.N2)
    if any(c.isspace() for c in trimmed_value):
        warnings.append(Warning.N3)
    return tuple(warnings)
