# Changelog

## Unreleased

- Avvia lo scaffold `0.2.0` della libreria Python `cup-check`.
- Aggiunge API `validate_format` e `validate_many` con tipi pubblici per outcome, regole, warning e risultato.
- Aggiunge parity test Python sugli stessi fixture YAML del web.
- Aggiunge il workflow di publish PyPI con Trusted Publishing OIDC.

## 0.1.1 - 2026-05-08

- Accetta i CUP minuscoli dopo normalizzazione e segnala gli avvisi non bloccanti.
- Corregge il filtro dell'input testuale per ignorare solo l'intestazione `CUP`.
- Migliora la gestione delle intestazioni CSV/XLSX con toggle di correzione.
- Mostra il conteggio dei CUP unici nel riepilogo risultati.
- Limita i link OpenCUP ai valori cercabili manualmente.
- Protegge l'export CSV da celle formula-like.
- Chiarisce privacy e limiti della verifica solo formale.
- Rafforza i test parser, report e acceptance.

## 0.1.0 - 2026-05-08

- MVP web statico per validazione formale CUP.
- Supporto input CSV, XLSX e testo incollato.
- Report CSV esportabile.
- Service Worker offline-first.
- Fixture YAML come specifica funzionale.
