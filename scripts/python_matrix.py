#!/usr/bin/env python3
"""Generate the GitHub Actions Python matrix from package metadata."""

from __future__ import annotations

import argparse
import json
import re
import tomllib
from pathlib import Path
from urllib.request import urlopen

DEFAULT_MANIFEST_URL = (
    "https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json"
)
VERSION_RE = re.compile(r"^(\d+)\.(\d+)(?:\.(\d+))?")
SPEC_RE = re.compile(r"(>=|<=|==|>|<|~=)\s*(\d+(?:\.\d+){1,2})")


def parse_version(value: str) -> tuple[int, int, int]:
    match = VERSION_RE.match(value)
    if match is None:
        raise ValueError(f"Unsupported Python version: {value}")
    major, minor, patch = match.groups()
    return (int(major), int(minor), int(patch or 0))


def read_requires_python(pyproject_path: Path) -> str:
    with pyproject_path.open("rb") as pyproject_file:
        pyproject = tomllib.load(pyproject_file)
    return pyproject["project"]["requires-python"]


def matches_specifier(version: tuple[int, int, int], specifier: str) -> bool:
    for operator, required_value in SPEC_RE.findall(specifier):
        required = parse_version(required_value)
        if operator == ">=" and version < required:
            return False
        if operator == ">" and version <= required:
            return False
        if operator == "<=" and version > required:
            return False
        if operator == "<" and version >= required:
            return False
        if operator == "==" and version[:2] != required[:2]:
            return False
        if operator == "~=":
            upper = (required[0], required[1] + 1, 0)
            if version < required or version >= upper:
                return False
    return True


def load_manifest(manifest_source: str) -> list[dict[str, object]]:
    if manifest_source.startswith(("http://", "https://")):
        with urlopen(manifest_source, timeout=20) as response:
            return json.load(response)
    with Path(manifest_source).open(encoding="utf-8") as manifest_file:
        return json.load(manifest_file)


def latest_stable_minors(manifest: list[dict[str, object]]) -> list[tuple[int, int, int]]:
    latest: dict[tuple[int, int], tuple[int, int, int]] = {}
    for entry in manifest:
        if not entry.get("stable", False):
            continue
        version = parse_version(str(entry["version"]))
        minor = version[:2]
        latest[minor] = max(version, latest.get(minor, version))
    return sorted(latest.values())


def build_matrix(
    requires_python: str,
    available_versions: list[tuple[int, int, int]],
) -> tuple[dict[str, list[dict[str, object]]], str]:
    supported = [
        version for version in available_versions if matches_specifier(version, requires_python)
    ]
    if not supported:
        raise ValueError(f"No stable Python version found for {requires_python!r}")

    baseline = supported[0]
    include = [
        {
            "python-version": f"{version[0]}.{version[1]}",
            "experimental": version[:2] != baseline[:2],
        }
        for version in supported
    ]
    return {"include": include}, f"{baseline[0]}.{baseline[1]}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pyproject",
        default="packages/cup_check/pyproject.toml",
        type=Path,
    )
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST_URL)
    parser.add_argument("--github-output")
    args = parser.parse_args()

    requires_python = read_requires_python(args.pyproject)
    manifest = load_manifest(args.manifest)
    matrix, coverage_python_version = build_matrix(
        requires_python,
        latest_stable_minors(manifest),
    )
    matrix_json = json.dumps(matrix, separators=(",", ":"))

    if args.github_output:
        with Path(args.github_output).open("a", encoding="utf-8") as output:
            output.write(f"matrix={matrix_json}\n")
            output.write(f"coverage-python-version={coverage_python_version}\n")
    else:
        print(matrix_json)


if __name__ == "__main__":
    main()
