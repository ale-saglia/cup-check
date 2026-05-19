# TODO — Code Review 2026-05-16

Nota: questo file e un dump interno di code review AI, non una lista di task disponibili. Se vuoi proporre o lavorare su un punto, apri prima una issue per coordinare priorita e ambito.

Punti emersi dalla code review del repository, ordinati per priorità decrescente.

## Alta priorità

### ~~1. Correggere la discrepanza coverage Python: pyproject.toml vs documentazione~~ ✅

`pyproject.toml` dichiara `--cov-fail-under=95`, ma `development.md` e `codecov.yml` dichiarano 100%. Allineare la soglia reale alla documentazione o viceversa; la discrepanza genera fiducia falsa sulla copertura effettiva.

- File: `packages/cup_check/pyproject.toml`, `docs/development.md`

### ~~2. Eliminare la duplicazione dei polyfill tra index.html e polyfills.js~~ ✅

I polyfill in `index.html` sono copiati manualmente da `src/polyfills.js`. Se uno diverge dall'altro, i test unitari non lo catturano. Estrarre un unico file sorgente (o generare il blocco inline dal modulo testato durante la build Vite).

- File: `packages/web/index.html`, `packages/web/src/polyfills.js`

### ~~3. Documentare lo schema YAML del mapping OpenCUP~~ ✅

Il mini-DSL in `opencup_dataset_schema.yaml` (tipi `cup_year_suffix`, `joined_text`, `first_date`, `bool_equals`, ecc.) è potente ma sotto-documentato. Aggiungere una sezione in `docs/data-sources.md` o un file dedicato `docs/dataset-schema.md` che descriva ogni tipo, i campi accettati e un esempio. Diventa critico nella milestone `0.6.0` dove `schema_path` custom diventa parte dell'API pubblica.

- File: `packages/cup_check/src/cup_check/opencup_dataset_schema.yaml`, `docs/data-sources.md`

## Media priorità

### ~~4. Aggiungere cancellazione al dataset loader web~~ ✅

Se l'utente naviga via dalla vista verificatore durante il download dei chunk, il download continua in background senza possibilità di annullamento. Esporre un `AbortController` da `loadLatestDataset` e invocarne l'abort nell'`unmount` della validator-view. Diventa un problema reale con la milestone `0.5.0` (batch >100k con Web Worker).

- File: `packages/web/src/lib/data/dataset-loader.ts`, `packages/web/src/routes/Validator.svelte`

Risolto 2026-05-18: `AbortSignal` propagato su tutta la catena di fetch in `dataset-loader.ts` (`discoverLatestDataset`, `downloadCupIndex`, `fetchAndVerifyChunk`, `fetchJson`); `Validator.svelte` crea un `AbortController` su `onMount` e lo annulla su `onDestroy`. Aggiunta contestualmente la cache `CacheStorage` con invalidazione per hash SHA-256: il manifest viene sempre fetchato dalla rete, il suo `cup_index.sha256` viene confrontato con l'hash in cache — download solo se diverso, con fallback offline se la rete non è disponibile.

### ~~5. Ridurre la complessità di pdf-extract-view.js~~ ✅

Il modulo gestisce stato (`_entries`, `_processing`, `_queue`, `_generation`), rendering, event binding e logica di business in un unico file con variabili a livello di modulo. Il debounce manuale con `_renderPending` / `_debounceTimer` è corretto ma fragile. Valutare almeno l'estrazione di:

- stato e operazioni sulle entry in un modulo dedicato (`pdf-extract-state.js`);
- logica di rendering in un modulo separato (`pdf-extract-render.js`);
- CSV builders in un modulo condiviso o nel modulo report esistente.

Non richiede un framework; è un refactor di separazione responsabilità.

- File: `packages/web/src/views/pdf-extract-view.js`

Risolto 2026-05-19 tramite Fase C della migrazione Svelte: `pdf-extract-view.js` (597 righe) è stato sostituito da `PdfExtract.svelte` + `EntryList.svelte` + `QueueControls.svelte`. Lo stato usa Svelte Runes, il debounce manuale è sparito, i CSV builder sono stati estratti in `src/lib/pdf/pdf-csv.ts`.

### ~~6. Documentare la scelta di skipWaiting incondizionato nel service worker~~ ✅

`self.skipWaiting()` è appropriato per l'architettura attuale (tutto locale, nessun backend), ma la milestone `0.9.0` (Worker Cloudflare) cambierà il contesto. Un aggiornamento del SW che modifica il comportamento di rete durante una sessione attiva potrebbe creare inconsistenze. Documentare la scelta in un ADR o in una nota nel codice, prima di arrivarci.

- File: `packages/web/src/sw.js`, eventuale `docs/adr/`

Risolto 2026-05-19: creato `docs/adr/0010-service-worker-skip-waiting.md` con contesto, precondizioni di sicurezza, opzioni da valutare alla 0.9.0 e alternative scartate. Aggiunto commento in `sw.js` che rimanda all'ADR.

### ~~7. Migrazione TypeScript + Svelte 5 (milestone 0.5.0)~~ ✅

Decisione in [ADR 0009](docs/adr/0009-svelte-frontend-migration.md). Piano dettagliato in [docs/migration-0.5.0.md](docs/migration-0.5.0.md).

- File: `packages/web/src/`, `packages/web/vite.config.js`, `packages/web/package.json`

Nota 2026-05-18: C6 ha potato `render.js`, `dom.js` e `dialogs.js` con i relativi test morti e ha incluso i componenti Svelte nella coverage V8 sul codice vivo. Restano da assorbire in Fase D `src/layout.js` e il router artigianale (`router.ts`), ancora usati dall'app.

Nota 2026-05-18 (D1): Web Worker per batch >100k implementato — `validation-worker.ts`, `validator.worker.ts`, `ProgressBar.svelte`, integrazione in `Validator.svelte` con `AbortController` e pulsante Annulla. Mancano D2–D5.

Nota 2026-05-18 (TODO #4 chiuso): `AbortSignal` per il dataset loader e cache `CacheStorage` con invalidazione SHA-256 implementati e testati in `dataset-loader.ts`; `Validator.svelte` annulla il caricamento su `onDestroy`.

Nota 2026-05-19: Migrazione TS completata per tutti i file JS restanti — `extract-cups.ts`, `extract-text.ts`, `ocr.ts`, `layout.ts`, `tools-registry.ts`, `version.ts`. Rimangono intenzionalmente `.js`: `polyfills.js` (IIFE iniettato da Vite) e `sw.js` (service worker non compilato da TS).

Risolto 2026-05-19: tutte le fasi A–D5 completate (D2–D5 implementate nella stessa giornata di D1). `layout.ts` e `router.ts` rimangono intenzionalmente moduli TS puri — la scelta architetturale è logica in TS, solo UI in Svelte.

## Bassa priorità

### ~~8. Rafforzare la robustezza di drainQueue nel PDF view~~ ✅

Il pattern try/catch-per-entry con stato mutabile a livello modulo funziona e il caso critico (clearAll durante elaborazione) è coperto da test, ma il design resta fragile se due file falliscono in rapida successione. Considerare un approccio a coda immutabile o un generatore asincrono che semplifichi il ragionamento sul flusso.

- File: `packages/web/src/views/pdf-extract-view.js`

Risolto 2026-05-19: il file è già stato migrato a `PdfExtract.svelte` (TODO #5). `drainQueue` avvolgeva il loop senza `try/finally`: se `processEntry` avesse lanciato inaspettatamente, `processing` sarebbe rimasto `true` per sempre bloccando la coda. Aggiunto `try/finally` che garantisce il reset di `processing` in ogni caso. Aggiunto test "due file che falliscono in successione non bloccano la coda" che copriva il caso mancante.

### ~~9. Aggiungere test di regressione per il drift polyfill~~ ✅

Anche dopo aver risolto il punto 2, aggiungere un test che verifichi che il blocco inline in `index.html` (o il suo sostituto generato) e il modulo `polyfills.js` producano lo stesso comportamento. Un test di build che confronti i due output previene regressioni future.

- File: `packages/web/tests/`

Risolto 2026-05-19: aggiunto describe block `polyfills build regression` in `polyfills.test.js` con 4 test: (1) la trasformazione `export`→IIFE produce JS valido, (2) `applyAllPolyfills()` chiama tutti i gruppi `apply*` esportati (static analysis), (3) l'IIFE si esegue senza errori in un contesto legacy, (4) l'IIFE applica gli stessi polyfill del modulo. La funzione `buildPolyfillsScript()` è replicata nel test con la stessa logica di `vite.config.ts` per rilevare immediatamente qualsiasi divergenza.

### ~~10. Considerare un manifest di compatibilità browser esplicito~~ ✅

Il supporto a Chrome 109 e browser legacy è testato via acceptance con Chromium legacy, ma non esiste un documento che dichiari esplicitamente i browser supportati e le limitazioni note. Una sezione in `docs/technical-spec.md` o nel README eviterebbe domande ricorrenti.

- File: `docs/technical-spec.md` o `README.md`

Risolto 2026-05-19: aggiunta sezione "Compatibilità Browser" in `docs/technical-spec.md` con tabella versioni minime per browser, elenco polyfill e relative versioni di introduzione nativa, limitazioni note su Chromium 109 (pdf.js single-thread, OCR lento, batch via postMessage), e tabella feature/degrado per Service Worker, CacheStorage, WebAssembly e Web Worker.
