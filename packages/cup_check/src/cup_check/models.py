from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Outcome(StrEnum):
    INVALIDO_FORMATO = "INVALIDO_FORMATO"
    FORMATO_VALIDO_DA_VERIFICARE = "FORMATO_VALIDO_DA_VERIFICARE"
    TROVATO_OPENCUP = "TROVATO_OPENCUP"
    NON_TROVATO_OPENCUP_DA_VERIFICARE = "NON_TROVATO_OPENCUP_DA_VERIFICARE"


class Rule(StrEnum):
    R0 = "R0"
    R1 = "R1"
    R2 = "R2"
    R3 = "R3"
    R4 = "R4"
    R5 = "R5"


class Warning(StrEnum):
    N1 = "N1"
    N2 = "N2"
    N3 = "N3"


@dataclass(frozen=True)
class ValidationResult:
    input_row: int | None
    raw_value: str
    normalized_value: str
    outcome: Outcome
    failed_rules: tuple[Rule, ...]
    warnings: tuple[Warning, ...]
