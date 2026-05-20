# Architecture

> Per lo stack tecnologico, le regole di formato, i contratti del validatore e i workflow CI/CD, vedi [technical-spec.md](technical-spec.md).

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
2. `release-dataset.yml` (mensile o manuale) scarica OpenCUP, compila l'indice CUP esatto, firma il manifest con cosign (keyless OIDC) e pubblica manifest, bundle di firma e chunk nella release dataset (`dataset-YYYY-MM`). Vedi [Verifica del manifest](governance.md#verifica-del-manifest).
3. Lo stesso workflow dataset scarica `web-dist.tar.gz` dall'ultima release `v*` oppure, se manca, ricostruisce la web app facendo checkout di quella tag; poi aggiunge `dataset-latest.json` e `datasets/dataset-YYYY-MM/*` e ridistribuisce Pages.
4. Il browser scopre dinamicamente l'ultimo dataset da `dataset-latest.json` su Pages, scarica i chunk con verifica SHA-256 per-file e retry, li salva in una cache dataset dedicata distinta dalla cache app-shell, mantiene solo l'ultima release `dataset-YYYY-MM` e poi verifica localmente i CUP unici. La tabella e l'export possono espandere gli stessi risultati sulle righe originali senza ripetere lookup o validazione.
5. La libreria Python usa `OpenCupChecker` per scaricare e cachare localmente gli stessi asset statici, ricomporre l'indice SQLite e verificare i CUP via `sqlite3`.

Componenti principali aggiunti in `0.3.0`:

- `packages/web/src/dataset-loader.js` — discovery ultimo dataset, download dei chunk SQLite con verifica SHA-256 per-file, inizializzazione `sql.js` e lookup locale.
- `packages/web/src/sw.js` — cache app-shell (`cup-check-v*`, network-first) e cache dataset (`cup-check-dataset-v1`, network-first) separate; eviction esplicita delle release dataset superate. Da `0.4.0` aggiunge cache lazy assets (`cup-check-lazy-v1`, cache-first) per pdfjs e tesseract.
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

Gli asset OCR e PDF restano statici, cacheabili e serviti dalla stessa app tramite plugin Vite che li emette da `node_modules`; non vengono introdotti backend o CDN obbligatorie. Il Service Worker li intercetta con strategia cache-first nella cache `cup-check-lazy-v1`, separata dalla cache app-shell e da quella dataset.

Componenti principali aggiunti o aggiornati in `0.4.0`:

- `packages/web/src/router.js` — hash router; monta/smonta le viste in risposta ai cambi di hash.
- `packages/web/src/tools-registry.js` — registro strumenti; alimenta il menu "Strumenti" e permette di aggiungere nuovi tool senza modificare HTML o Service Worker.
- `packages/web/src/views/pdf-extract-view.js` — vista `#/pdf-extract`; gestisce caricamento file, drag-and-drop, estrazione testo, OCR, editing manuale, export CSV e passaggio al verificatore tramite `state.pendingFile`.
- `packages/web/src/views/validator-view.js` — aggiornata per consumare `state.pendingFile` al mount e aprire direttamente l'anteprima del CSV sintetico proveniente dal tool PDF.
- `packages/web/src/pdf/extract-text.js` — caricamento lazy di pdf.js ed estrazione del testo nativo da ogni pagina.
- `packages/web/src/pdf/ocr.js` — caricamento lazy di Tesseract.js, OCR con lingua `ita`+`eng` e correzione della confusione `I`/`1` nelle posizioni alfabetiche del CUP.
- `packages/web/src/pdf/extract-cups.js` — normalizzazione alfanumerica del testo estratto, regex globale per CUP spezzati su token multipli e validazione formale.
- `packages/web/src/state.js` — stato condiviso tra le viste; espone `pendingFile` per il trasferimento CSV dal tool PDF al verificatore.

## Architettura Coerenza Atto

La milestone di coerenza atto, spostata dopo `0.4.0`, separa il dataset in due livelli:

- **indice CUP**: contiene tutti i CUP pubblicati e, per ogni CUP, l'identificativo del chunk dettagli;
- **dataset dettagli**: contiene i campi necessari ai controlli di coerenza e viene scaricato solo per i chunk richiesti dai CUP caricati dall'utente.

Il browser scarica sempre l'indice solo quando serve la verifica OpenCUP. Scarica invece i chunk dettagli solo se l'utente richiede controlli sostanziali, come P.IVA/CF, importi o descrizione. Anche questa parte resta statica e distribuita tramite asset versionati.

## Architettura Target

La verifica remota opzionale (`0.8.0`–`0.9.0`) introduce un livello aggiuntivo senza modificare la natura statica della web app:

```text
Browser utente
  ├─ verifica formale (locale, sempre)
  ├─ lookup OpenCUP (dataset statico, offline-first)
  ├─ coerenza atto (dataset dettagli, offline-first)        [tool 0.6.0]
  └─ verifica remota opzionale                              [tool 0.9.0]
        └─ Cloudflare Worker (rate limiting, no dati persistenti)
              └─ API MEF/Sogei (credenziali solo lato Worker)
```

Il frontend non gestisce né conserva credenziali. L'interfaccia `RemoteVerificationProvider` (`0.8.0`) astrae il provider remoto: la web app usa un `MockRemoteProvider` in sviluppo e il Worker in produzione; il package Python usa `RemoteMefProvider` con credenziali BYOK configurabili dall'utente.

La regola centrale resta invariata: nessun esito di esistenza senza fonte autoritativa o dataset esatto.
