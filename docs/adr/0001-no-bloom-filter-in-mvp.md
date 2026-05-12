# ADR 0001: No Bloom Filter In MVP

## Status

Accepted

## Context

Il MVP deve validare solo il formato dei CUP, senza dichiarare l'esistenza nel Sistema CUP.

## Decision

Non usiamo bloom filter o dataset derivati nel MVP.

## Consequences

Il prodotto resta onesto sui limiti: un CUP formalmente valido è sempre `FORMATO_VALIDO_DA_VERIFICARE`.
