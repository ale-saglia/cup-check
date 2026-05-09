# Architecture

## MVP 0.1.0

```text
GitHub repo
  ├─ packages/web
  ├─ tests/fixtures
  └─ GitHub Actions
        │ release v*
        ▼
GitHub Pages
  └─ HTML + vanilla JS + Service Worker
        │
        ▼
Browser utente
```

Nel MVP tutta la validazione avviene nel browser:

- `packages/web/src/parser.js` legge CSV e XLSX;
- `packages/web/src/validator.js` applica le regole formali `R0`-`R5`;
- `packages/web/src/report.js` costruisce report e link OpenCUP;
- `tests/fixtures/*.yaml` definisce il comportamento atteso.

Non esistono componenti server-side nell'MVP.

## Architettura 0.3.0 (implementata)

La release `0.2.0` introduce il package Python importabile `packages/cup_check` con parity test sugli stessi fixture.

Da `0.3.0` il dataset OpenCUP viene pubblicato come SQLite chunked su GitHub Pages e la web app esegue la verifica di esistenza direttamente nel browser:

```text
GitHub repo
  ├─ packages/web
  ├─ packages/cup_check
  ├─ tests/fixtures
  └─ GitHub Actions
        │ release v* o dataset published
        ▼
GitHub Pages
  ├─ HTML + vanilla JS + Service Worker
  └─ dataset/
       ├─ dataset-manifest.json
       ├─ cups.sqlite.000
       └─ cups.sqlite.00N
              │ fetch (CORS nativo da Pages)
              ▼
        Browser utente
          └─ sql.js (SQLite/WASM)
               └─ SELECT 1 FROM cups WHERE cup = ?
```

Flusso di deploy:

1. `release-dataset.yml` (mensile o manuale) scarica OpenCUP, compila SQLite chunked, pubblica su GitHub Releases e crea una release `dataset-YYYY-MM`.
2. La pubblicazione della release triggera `release-web.yml` via `release: published`.
3. `release-web.yml` builda la web app, scarica i chunk da GitHub Releases, riscrive `base_url` del manifest con l'URL di Pages, deploya il tutto su GitHub Pages.
4. Il browser scarica il manifest da Pages, poi i chunk in sequenza con progress, assembla il buffer in memoria, apre il database con sql.js.
5. Il service worker cacha tutti i chunk dopo il primo download; le visite successive sono completamente offline.

Componenti principali aggiunti in `0.3.0`:

- `packages/web/src/dataset-loader.js` — fetch manifest, download chunk con progress, inizializzazione sql.js, prepared statement per lookup.
- `packages/web/src/results.js#applyDbLookup` — trasforma esiti `FORMATO_VALIDO_DA_VERIFICARE` in `TROVATO`/`NON_TROVATO`.
- `packages/cup_check/src/cup_check/opencup_dataset.py` — build pipeline Python per SQLite chunked.
- Test di integrazione (`INTEGRATION_TESTS=1 pytest -m integration`) verificano manifest e chunk del release pubblicato.

## Architettura Target

Una futura verifica autoritativa potra aggiungere un endpoint/proxy API o un checker Python con credenziali fornite dall'utente. Questa parte resta fuori dallo scope attuale e deve preservare la regola centrale: nessun esito di esistenza senza fonte autoritativa o dataset esatto.
