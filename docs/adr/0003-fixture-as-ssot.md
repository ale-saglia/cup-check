# ADR 0003: Fixture As SSoT

## Status

Accepted

## Context

Le regole CUP devono restare allineate tra web e libreria Python.

## Decision

I casi YAML in `tests/fixtures` sono normativi e vengono letti dai test automatici.

## Consequences

Cambiare comportamento richiede prima cambiare fixture, poi implementazione.
