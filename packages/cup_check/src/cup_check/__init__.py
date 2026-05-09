"""Validazione formale locale dei Codici Unici di Progetto."""

from cup_check.models import Outcome, Rule, ValidationResult, Warning
from cup_check.validator import normalize_cup, validate_format, validate_many

__all__ = [
    "Outcome",
    "Rule",
    "ValidationResult",
    "Warning",
    "normalize_cup",
    "validate_format",
    "validate_many",
]
