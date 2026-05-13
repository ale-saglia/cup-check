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
4. Il browser scopre dinamicamente l'ultimo dataset da `dataset-latest.json` su Pages, scarica i chunk con verifica SHA-256 per-file e retry, li salva in una cache dataset dedicata distinta dalla cache app-shell, mantiene solo l'ultima release `dataset-YYYY-MM` e poi verifica localmente i CUP unici. La tabella e l'export possono espandere gli stessi risultati sulle righe originali senza ripetere lookup o validazione.
5. La libreria Python usa `OpenCupChecker` per scaricare e cachare localmente gli stessi asset statici, ricomporre l'indice SQLite e verificare i CUP via `sqlite3`.

Componenti principali aggiunti in `0.3.0`:

- `packages/web/src/dataset-loader.js` — discovery ultimo dataset, download dei chunk SQLite con verifica SHA-256 per-file, inizializzazione `sql.js` e lookup locale.
- `packages/web/src/sw.js` — cache app-shell e cache dataset separate; eviction esplicita delle release dataset superate.
- `packages/web/src/results.js` — raggruppa i CUP per lookup, trasforma esiti `FORMATO_VALIDO_DA_VERIFICARE` in `TROVATO_OPENCUP`/`NON_TROVATO_OPENCUP_DA_VERIFICARE` e produce la vista aggregata o riga per riga.
- `packages/cup_check/src/cup_check/opencup_dataset.py` — build pipeline Python per SQLite chunked.
- `packages/cup_check/src/cup_check/checker.py` — `OpenCupChecker` Python per lookup su indice locale o scaricato in cache.
- Test di integrazione (`INTEGRATION_TESTS=1 pytest -m integration`) verificano manifest e chunk del release pubblicato.

## Architettura 0.4.0

La release `0.4.0` introduce il primo tool laterale oltre al verificatore principale: estrazione CUP da fatture PDF. La web app resta statica e viene organizzata in viste indirizzabili tramite hash router:

```text
GitHub Pages
  └─ HTML + vanilla JS + Service Worker
        │
        ▼
Browser utente
  ├─ #/             verificatore CUP esistente
  └─ #/pdf-extract estrazione CUP da PDF
        ├─ pdf.js caricato all'apertura della vista
        ├─ Tesseract.js + ita.traineddata caricati solo se serve OCR
        └─ CSV sintetico cup,file_origine passato al verificatore
```

Il menu "Strumenti" è alimentato da un registro interno, così nuovi tool possono essere aggiunti senza duplicare HTML o service worker. Il tool PDF produce una riga per ogni coppia file/CUP, senza deduplicare: eventuale raggruppamento resta responsabilità del verificatore tramite il toggle già presente.

Il flusso operativo è:

1. L'utente apre `#/pdf-extract` e carica uno o più PDF.
2. La vista prova prima l'estrazione testo nativa con `pdf.js`.
3. Se il documento è scansionato, carica dinamicamente Tesseract.js e gli asset OCR locali in italiano.
4. I CUP estratti vengono validati con lo stesso validatore formale e, se disponibile, con lo stesso lookup OpenCUP del verificatore.
5. L'utente può correggere manualmente i risultati e poi esportare un CSV file/CUP oppure aprirlo nel verificatore principale come file sintetico.

Gli asset OCR e PDF restano statici, cacheabili e serviti dalla stessa app; non vengono introdotti backend o CDN obbligatorie.

## Architettura Coerenza Atto

La milestone di coerenza atto, spostata dopo `0.4.0`, separa il dataset in due livelli:

- **indice CUP**: contiene tutti i CUP pubblicati e, per ogni CUP, l'identificativo del chunk dettagli;
- **dataset dettagli**: contiene i campi necessari ai controlli di coerenza e viene scaricato solo per i chunk richiesti dai CUP caricati dall'utente.

Il browser scarica sempre l'indice solo quando serve la verifica OpenCUP. Scarica invece i chunk dettagli solo se l'utente richiede controlli sostanziali, come P.IVA/CF, importi o descrizione. Anche questa parte resta statica e distribuita tramite asset versionati.

## Architettura Target

Una futura verifica autoritativa potrà aggiungere un endpoint/proxy API MEF/Sogei o un checker Python con credenziali fornite dall'utente. Questa parte resta fuori dallo scope attuale e deve preservare la regola centrale: nessun esito di esistenza senza fonte autoritativa o dataset esatto.
