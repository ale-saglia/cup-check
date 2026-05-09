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

## Architettura Intermedia 0.3.0

La release `0.2.0` introduce il package Python importabile `packages/cup_check` con parity test sugli stessi fixture. La CLI resta eventuale e sottile, costruibile sopra la libreria se emergera un bisogno reale.

Da `0.3.0` il dataset OpenCUP verra pubblicato come SQLite chunked su GitHub Releases:

- il web legge via `sql.js-httpvfs` e HTTP Range request;
- la libreria Python usa `sqlite3` stdlib su file scaricato e cachato;
- `dataset-manifest.json` indica quale release dataset usare.

## Architettura Target

Una futura verifica autoritativa potra aggiungere un endpoint/proxy API o un checker Python con credenziali fornite dall'utente. Questa parte resta fuori dall'MVP e deve preservare la regola centrale: nessun esito di esistenza senza fonte autoritativa o dataset esatto.
