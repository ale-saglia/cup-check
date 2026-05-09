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

## Architettura 0.3.0

La release `0.2.0` introduce il package Python importabile `packages/cup_check` con parity test sugli stessi fixture.

Da `0.3.0` il dataset OpenCUP viene pubblicato su Cloudflare D1 e la web app interroga un Cloudflare Worker con una singola richiesta batch:

```text
GitHub repo
  ├─ packages/web
  ├─ packages/cup_check
  ├─ packages/worker       (nuovo)
  ├─ tests/fixtures
  └─ GitHub Actions
        │ release dataset-YYYY-MM
        ├──────────────────────────────────────┐
        ▼                                      ▼
GitHub Releases                       Cloudflare D1
  └─ cups.sqlite.* + manifest            └─ tabella cups

        │ release v*
        ▼
GitHub Pages
  └─ HTML + vanilla JS + Service Worker
        │ POST /lookup { cups: [...] }
        ▼
  Cloudflare Worker
        │ SELECT cup FROM cups WHERE cup IN (...)
        ▼
  Cloudflare D1
```

Flusso di deploy:

1. `release-dataset.yml` (mensile o manuale) scarica OpenCUP, compila SQLite, pubblica chunk su GitHub Releases (`dataset-YYYY-MM`) e carica il dataset su D1 tramite Wrangler.
2. La pubblicazione della release triggera `release-web.yml` via `release: published`.
3. `release-web.yml` builda la web app e deploya su GitHub Pages.
4. Il browser invia una singola `POST /lookup` al Worker con tutti i CUP unici; riceve una mappa `{ [cup]: boolean }`.
5. La libreria Python scarica e cacia localmente i chunk da GitHub Releases per uso offline.

Componenti principali aggiunti in `0.3.0`:

- `packages/worker/` — Cloudflare Worker con endpoint `POST /lookup`.
- `packages/web/src/dataset-loader.js` — singola fetch al Worker, nessun WASM.
- `packages/web/src/results.js#applyDbLookup` — trasforma esiti `FORMATO_VALIDO_DA_VERIFICARE` in `TROVATO`/`NON_TROVATO`.
- `packages/cup_check/src/cup_check/opencup_dataset.py` — build pipeline Python per SQLite chunked.
- Test di integrazione (`INTEGRATION_TESTS=1 pytest -m integration`) verificano manifest e chunk del release pubblicato.

## Architettura Target

Una futura verifica autoritativa potra aggiungere un endpoint/proxy API o un checker Python con credenziali fornite dall'utente. Questa parte resta fuori dallo scope attuale e deve preservare la regola centrale: nessun esito di esistenza senza fonte autoritativa o dataset esatto.
