# Changelog

## 0.3.0 - 2026-05-11

- Aggiunge la generazione dell'indice OpenCUP SQLite chunked con manifest e puntatore latest.
- Integra nella web app il lookup locale del dataset OpenCUP con `sql.js`, cache browser e fallback cautelativo.
- Pubblica il workflow mensile/manuale per creare la release dataset e aggiornare GitHub Pages dal web pinnato.
- Aggiunge `OpenCupChecker` Python con lookup OpenCUP su indice SQLite locale o scaricato in cache.
- Aggiunge i contratti Python per manifest e latest dataset, piu test locali e di integrazione sul dataset pubblicato.
- Chiarisce nella web app i limiti dello strumento in sviluppo e del dataset OpenCUP mensile.
- Documenta la strategia statica via GitHub Releases e Pages con ADR, roadmap e specifiche aggiornate.

## 0.2.2 - 2026-05-09

- Aggiorna il workflow Pages per includere il dataset OpenCUP più recente nel deploy.

## 0.2.1 - 2026-05-09

- Aggiunge favicon, manifest collegato e `robots.txt` per stabilizzare Lighthouse su web.
- Aggiunge fallback statico `404.html` con redirect alla homepage per GitHub Pages.
- Rafforza il test Lighthouse con un controllo esplicito della superficie PWA.

## 0.2.0 - 2026-05-09

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
