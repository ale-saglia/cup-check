# Changelog

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
