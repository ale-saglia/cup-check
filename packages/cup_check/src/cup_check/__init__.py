"""Validazione formale locale dei Codici Unici di Progetto."""

from cup_check.checker import OpenCupChecker
from cup_check.dataset import (
    DatasetChunks,
    DatasetCupIndex,
    DatasetLatest,
    DatasetManifest,
    DatasetSchema,
    ManifestError,
    load_dataset_latest,
    load_dataset_manifest,
)
from cup_check.models import Outcome, Rule, ValidationResult, Warning
from cup_check.validator import normalize_cup, validate_format, validate_many

__all__ = [
    "DatasetChunks",
    "DatasetCupIndex",
    "DatasetLatest",
    "DatasetManifest",
    "DatasetSchema",
    "ManifestError",
    "OpenCupChecker",
    "Outcome",
    "Rule",
    "ValidationResult",
    "Warning",
    "load_dataset_latest",
    "load_dataset_manifest",
    "normalize_cup",
    "validate_format",
    "validate_many",
]
