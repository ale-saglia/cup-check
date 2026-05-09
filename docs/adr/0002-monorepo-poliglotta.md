# ADR 0002: Monorepo Poliglotta

## Status

Accepted

## Context

Il browser richiede JavaScript per l'app statica, mentre la libreria importabile e Python.

## Decision

Usiamo un monorepo con `packages/web` per JavaScript e `packages/cup_check` per la libreria Python pubblicata su PyPI come `cup-check`.

## Consequences

I fixture YAML diventano il contratto condiviso tra implementazioni.
