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

### 4. Aggiungere cancellazione al dataset loader web

Se l'utente naviga via dalla vista verificatore durante il download dei chunk, il download continua in background senza possibilità di annullamento. Esporre un `AbortController` da `loadLatestDataset` e invocarne l'abort nell'`unmount` della validator-view. Diventa un problema reale con la milestone `0.5.0` (batch >100k con Web Worker).

- File: `packages/web/src/dataset-loader.js`, `packages/web/src/views/validator-view.js`

### 5. Ridurre la complessità di pdf-extract-view.js

Il modulo gestisce stato (`_entries`, `_processing`, `_queue`, `_generation`), rendering, event binding e logica di business in un unico file con variabili a livello di modulo. Il debounce manuale con `_renderPending` / `_debounceTimer` è corretto ma fragile. Valutare almeno l'estrazione di:

- stato e operazioni sulle entry in un modulo dedicato (`pdf-extract-state.js`);
- logica di rendering in un modulo separato (`pdf-extract-render.js`);
- CSV builders in un modulo condiviso o nel modulo report esistente.

Non richiede un framework; è un refactor di separazione responsabilità.

- File: `packages/web/src/views/pdf-extract-view.js`

### 6. Documentare la scelta di skipWaiting incondizionato nel service worker

`self.skipWaiting()` è appropriato per l'architettura attuale (tutto locale, nessun backend), ma la milestone `0.9.0` (Worker Cloudflare) cambierà il contesto. Un aggiornamento del SW che modifica il comportamento di rete durante una sessione attiva potrebbe creare inconsistenze. Documentare la scelta in un ADR o in una nota nel codice, prima di arrivarci.

- File: `packages/web/src/sw.js`, eventuale `docs/adr/`

### 7. Migrazione TypeScript + Svelte 5 (milestone 0.5.0)

Decisione in [ADR 0009](docs/adr/0009-svelte-frontend-migration.md). Piano dettagliato in [docs/migration-0.5.0.md](docs/migration-0.5.0.md).

- File: `packages/web/src/`, `packages/web/vite.config.js`, `packages/web/package.json`

Nota 2026-05-18: C6 ha potato `render.js`, `dom.js` e `dialogs.js` con i relativi test morti e ha incluso i componenti Svelte nella coverage V8 sul codice vivo. Restano da assorbire in Fase D `src/layout.js` e il router artigianale (`router.ts`), ancora usati dall'app.

## Bassa priorità

### 8. Rafforzare la robustezza di drainQueue nel PDF view

Il pattern try/catch-per-entry con stato mutabile a livello modulo funziona e il caso critico (clearAll durante elaborazione) è coperto da test, ma il design resta fragile se due file falliscono in rapida successione. Considerare un approccio a coda immutabile o un generatore asincrono che semplifichi il ragionamento sul flusso.

- File: `packages/web/src/views/pdf-extract-view.js`

### 9. Aggiungere test di regressione per il drift polyfill

Anche dopo aver risolto il punto 2, aggiungere un test che verifichi che il blocco inline in `index.html` (o il suo sostituto generato) e il modulo `polyfills.js` producano lo stesso comportamento. Un test di build che confronti i due output previene regressioni future.

- File: `packages/web/tests/`

### 10. Considerare un manifest di compatibilità browser esplicito

Il supporto a Chrome 109 e browser legacy è testato via acceptance con Chromium legacy, ma non esiste un documento che dichiari esplicitamente i browser supportati e le limitazioni note. Una sezione in `docs/technical-spec.md` o nel README eviterebbe domande ricorrenti.

- File: `docs/technical-spec.md` o `README.md`
