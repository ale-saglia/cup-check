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

Da `0.3.0` il dataset OpenCUP viene versionato su GitHub Releases e servito alla web app come asset statico su GitHub Pages. La web app resta servita da GitHub Pages e scarica un indice CUP esatto per verificare l'esistenza nel perimetro OpenCUP senza servizi server-side del progetto:

```text
GitHub repo
  ├─ packages/web
  ├─ packages/cup_check
  ├─ tests/fixtures
  └─ GitHub Actions
        │ release dataset-YYYY-MM
        ▼
GitHub Releases
  ├─ web-dist.tar.gz per le release v*
  └─ archivio dataset-manifest.json + cup-index.sqlite.* per dataset-YYYY-MM

        │ release v*
        ▼
GitHub Pages
  ├─ HTML + vanilla JS + Service Worker dall'ultima v*
  ├─ dataset-latest.json
  └─ datasets/dataset-YYYY-MM/cup-index.sqlite.*
        │ fetch dataset-latest.json, dataset-manifest.json + cup-index.sqlite.*
        ▼
Browser utente
  └─ lookup locale sui CUP unici
```

Flusso di deploy:

1. `release-web.yml` builda la web app solo su tag software `v*`, deploya Pages e allega `web-dist.tar.gz` alla release software.
2. `release-dataset.yml` (mensile o manuale) scarica OpenCUP, compila l'indice CUP esatto e pubblica manifest e chunk nella release dataset (`dataset-YYYY-MM`).
3. Lo stesso workflow dataset scarica `web-dist.tar.gz` dall'ultima release `v*` oppure, se manca, ricostruisce la web app facendo checkout di quella tag; poi aggiunge `dataset-latest.json` e `datasets/dataset-YYYY-MM/*` e ridistribuisce Pages.
4. Il browser scopre dinamicamente l'ultimo dataset da `dataset-latest.json` su Pages, scarica e cacha l'indice, poi verifica localmente i CUP unici.
5. La libreria Python usa `OpenCupChecker` per scaricare e cachare localmente gli stessi asset statici, ricomporre l'indice SQLite e verificare i CUP via `sqlite3`.

Componenti principali aggiunti in `0.3.0`:

- `packages/web/src/dataset-loader.js` — discovery ultimo dataset, download/cache dei chunk SQLite, inizializzazione `sql.js` e lookup locale.
- `packages/web/src/results.js#applyDatasetLookup` — trasforma esiti `FORMATO_VALIDO_DA_VERIFICARE` in `TROVATO_OPENCUP`/`NON_TROVATO_OPENCUP_DA_VERIFICARE`.
- `packages/cup_check/src/cup_check/opencup_dataset.py` — build pipeline Python per SQLite chunked.
- `packages/cup_check/src/cup_check/checker.py` — `OpenCupChecker` Python per lookup su indice locale o scaricato in cache.
- Test di integrazione (`INTEGRATION_TESTS=1 pytest -m integration`) verificano manifest e chunk del release pubblicato.

## Architettura 0.4.0

La release `0.4.0` separa il dataset in due livelli:

- **indice CUP**: contiene tutti i CUP pubblicati e, per ogni CUP, l'identificativo del chunk dettagli;
- **dataset dettagli**: contiene i campi necessari ai controlli di coerenza e viene scaricato solo per i chunk richiesti dai CUP caricati dall'utente.

Il browser scarica sempre l'indice solo quando serve la verifica OpenCUP. Scarica invece i chunk dettagli solo se l'utente richiede controlli sostanziali, come P.IVA/CF, importi o descrizione. Anche questa parte resta statica e distribuita tramite asset versionati.

## Architettura Target

Una futura verifica autoritativa potra aggiungere un endpoint/proxy API MEF/Sogei o un checker Python con credenziali fornite dall'utente. Questa parte resta fuori dallo scope attuale e deve preservare la regola centrale: nessun esito di esistenza senza fonte autoritativa o dataset esatto.
