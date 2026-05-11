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

Da `0.3.0` il dataset OpenCUP viene pubblicato come asset statico su GitHub Releases. La web app resta servita da GitHub Pages e scarica un indice CUP esatto per verificare l'esistenza nel perimetro OpenCUP senza servizi server-side del progetto:

```text
GitHub repo
  ├─ packages/web
  ├─ packages/cup_check
  ├─ tests/fixtures
  └─ GitHub Actions
        │ release dataset-YYYY-MM
        ▼
GitHub Releases
  └─ cup-index.sqlite.* + dataset-manifest.json

        │ release v*
        ▼
GitHub Pages
  └─ HTML + vanilla JS + Service Worker
        │ fetch GitHub Releases API, dataset-manifest.json + cup-index.sqlite.*
        ▼
Browser utente
  └─ lookup locale sui CUP unici
```

Flusso di deploy:

1. `release-dataset.yml` (mensile o manuale) scarica OpenCUP, compila l'indice CUP esatto e pubblica manifest e chunk su GitHub Releases (`dataset-YYYY-MM`).
2. La release dataset non ridistribuisce la web app.
3. `release-web.yml` builda e deploya GitHub Pages solo su tag software `v*`.
4. Il browser scopre dinamicamente l'ultimo dataset dalle GitHub Releases, scarica e cacha l'indice, poi verifica localmente i CUP unici.
5. La libreria Python scarica e cacha localmente gli stessi asset da GitHub Releases per uso offline.

Componenti principali aggiunti in `0.3.0`:

- `packages/web/src/dataset-loader.js` — discovery ultimo dataset, download/cache dei chunk SQLite, inizializzazione `sql.js` e lookup locale.
- `packages/web/src/results.js#applyDatasetLookup` — trasforma esiti `FORMATO_VALIDO_DA_VERIFICARE` in `TROVATO_OPENCUP`/`NON_TROVATO_OPENCUP_DA_VERIFICARE`.
- `packages/cup_check/src/cup_check/opencup_dataset.py` — build pipeline Python per SQLite chunked.
- Test di integrazione (`INTEGRATION_TESTS=1 pytest -m integration`) verificano manifest e chunk del release pubblicato.

## Architettura 0.4.0

La release `0.4.0` separa il dataset in due livelli:

- **indice CUP**: contiene tutti i CUP pubblicati e, per ogni CUP, l'identificativo del chunk dettagli;
- **dataset dettagli**: contiene i campi necessari ai controlli di coerenza e viene scaricato solo per i chunk richiesti dai CUP caricati dall'utente.

Il browser scarica sempre l'indice solo quando serve la verifica OpenCUP. Scarica invece i chunk dettagli solo se l'utente richiede controlli sostanziali, come P.IVA/CF, importi o descrizione. Anche questa parte resta statica e distribuita tramite GitHub Releases.

## Architettura Target

Una futura verifica autoritativa potra aggiungere un endpoint/proxy API MEF/Sogei o un checker Python con credenziali fornite dall'utente. Questa parte resta fuori dallo scope attuale e deve preservare la regola centrale: nessun esito di esistenza senza fonte autoritativa o dataset esatto.
