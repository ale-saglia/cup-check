# Piano di migrazione — 0.5.0 Frontend modernization

Questo documento traccia le fasi di migrazione verso TypeScript + Svelte 5, come deciso in [ADR 0009](adr/0009-svelte-frontend-migration.md). Le feature funzionali della milestone (Worker, drag-drop, WCAG AA, i18n) sono in Fase D, costruite sulla base migrata.

**Principio guida:** nessuna feature `0.5.0` parte prima che entrambe le viste siano migrate (fine Fase C). La finestra di convivenza JS/Svelte deve durare al massimo una fase.

---

## Fase A — Infrastruttura (prerequisito)

### ✅ A1. Dipendenze

```bash
npm install -D svelte @sveltejs/vite-plugin-svelte svelte-check
npm install -D typescript
```

Nuove devDependencies:
- `svelte`, `@sveltejs/vite-plugin-svelte` — compilatore e plugin Vite
- `svelte-check` — type checking dei `.svelte` in CI
- `typescript` — transpile TS; Vite lo gestisce nativamente senza passi extra

### ✅ A2. Configurazione TypeScript

Creare `packages/web/tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"]
}
```

> Se `@tsconfig/svelte` non è necessario si può usare una config custom; l'importante è `moduleResolution: "bundler"` per allinearsi a Vite.

### ✅ A3. Aggiornamento `vite.config.js` → `vite.config.ts`

- Aggiungere `svelte()` ai plugin.
- Aggiornare il blocco `test.coverage.include` per escludere `*.svelte` dalla coverage v8 (hanno pipeline separata).
- Rinominare il file in `.ts` e aggiornare i tipi.

### ✅ A4. Linting e formatting

- `eslint.config.js`: aggiungere `eslint-plugin-svelte` e il parser TS per i file `.svelte`.
- `.prettierrc.json`: aggiungere il plugin `prettier-plugin-svelte`.
- Aggiungere `svelte-check --tsconfig tsconfig.json` come script `check` in `package.json` e come step nel CI.

### ✅ A5. Riorganizzazione `src/`

Spostare i file esistenti (senza modificarli) nella struttura target. Aggiornare i path di import:

```
src/
  lib/
    types.ts               (nuovo — tipi condivisi, vedi §A6)
    core/                  parser.js → parser.ts, validator.js, results.js, report.js
    data/                  dataset-loader.js, transfer.js
    pdf/                   extract-cups.js, extract-text.js, ocr.js
  components/              (vuoto, popolato in Fase D)
  routes/                  (vuoto, popolato in Fasi B-C)
  sw.js                    (invariato — non compilato da TS)
  router.js → router.ts
  main.js → main.ts
  polyfills.js             (invariato — IIFE iniettato dal plugin Vite)
  styles.css
```

Gate: `npm run build` e `npm test` devono passare dopo lo spostamento.

### ✅ A6. Tipi condivisi (`lib/types.ts`)

Definire almeno:

```typescript
export type Outcome = 'VALIDO' | 'NON_VALIDO' | 'CHECK' | 'TROVATO_OPENCUP' | /* … */;

export interface ValidationResult {
  cup: string;
  outcome: Outcome;
  row: number;
  rules: string[];
  /* … */
}

export interface ParsedFile {
  rows: ParsedRow[];
  rawRows: string[][];
  suggestedColumnIndex: number;
  selectedSheetName?: string;
  sheetNames?: string[];
}

export interface DatasetManifest { /* … */ }
```

Questi tipi sostituiscono le convenzioni implicite tra moduli.

---

## Fase B — Migrazione `validator-view.js` → `Validator.svelte`

**Perché prima:** 254 righe, logica più semplice, nessuna coda asincrona.

### ✅ B1. Creare `src/routes/Validator.svelte`

- `<script lang="ts">` con `$state` per: `dataset`, `selectedFile`, i campi che erano in `state.js` (results, parsed, filter, query, …).
- I moduli helper DOM (`dom.js`, `render.js`, `dialogs.js`, `layout.js`) vengono riassorbiti nel template Svelte: binding dichiarativi rimpiazzano gli event listener manuali.
- `loadLatestDataset` rimane in `lib/data/dataset-loader.ts`; viene chiamato in `onMount`.
- I 6 moduli JS importati dal componente (`validator`, `results`, `report`, `dataset-loader`, `transfer`, `text-input`) sono stati convertiti in `.ts` via `git mv`.
- `router.ts` tipizzato (implicit-any eliminati); `eslint.config.js` esteso con `globals.browser` per i file `.svelte`.

### ✅ B2. Aggiornare `router.ts`

Montare `Validator.svelte` su `#/` con `mount()` di Svelte 5 invece di chiamare `validatorView.mount(container)`. L'`unmount` diventa `component.$destroy()`.

### ✅ B3. Rimuovere `validator-view.js` e `state.js`

`state.js` era un oggetto mutabile globale; con Runes lo stato è locale al componente. Verificare che nessun altro modulo importi `state.js` prima di rimuoverlo.

### ✅ B4. Test

- Aggiornare i test unitari della vista con `@testing-library/svelte`.
- Acceptance Playwright: il flusso verificatore deve passare invariato (upload CSV, validazione, export).

---

## Fase C — Migrazione `pdf-extract-view.js` → `PdfExtract.svelte`

**Perché dopo:** 597 righe, coda asincrona, debounce manuale, stato complesso. La migrazione risolve il TODO #5 (separazione responsabilità) come effetto collaterale.

### ✅ C1. Identificare i sottocomponenti

| Componente | Responsabilità |
|---|---|
| `PdfExtract.svelte` | orchestrazione, stato globale della vista |
| `EntryList.svelte` | tabella voci: rendering, modifica manuale, rimozione |
| `QueueControls.svelte` | pulsanti coda: avvia, pausa, annulla |

### ✅ C2. Stato con Runes

```typescript
// In PdfExtract.svelte
let entries = $state<Entry[]>([]);
let processing = $state(false);
let queue = $state<File[]>([]);
let generation = $state(0);
```

Il debounce manuale (`_renderPending`, `_debounceTimer`) diventa un `$effect` con cleanup:

```typescript
$effect(() => {
  const id = setTimeout(() => { /* render */ }, 50);
  return () => clearTimeout(id);
});
```

### C3-C5. Router, rimozione `pdf-extract-view.js`, acceptance

Stessi passi di B2–B5 per la vista PDF.

### ✅ C6. Coverage `.svelte`

Ricalibrate le soglie in `vite.config.ts`: la coverage V8 include anche i file `.svelte` con `include: ['src/**/*.{js,ts,svelte}']`; `svelte-check` resta il gate separato per il type checking dei componenti.

La potatura C6 ha rimosso anche il codice morto rimasto dopo la migrazione Svelte:

- `src/render.js`, `src/dom.js`, `src/dialogs.js`;
- i relativi test `tests/render.test.js`, `tests/dom.test.js`, `tests/dialogs.test.js`, che tenevano verdi moduli non importati dall'app.

Baseline prima della rimozione: `lines 99.58%`, `branches 95.56%` con denominatore ancora inquinato da `render.js`. Dopo la rimozione e l'inclusione dei componenti Svelte nella coverage V8: `lines 99.71%`, `branches 90.11%` sul codice vivo misurato; le soglie target restano `lines: 95` e `branches: 90`.

Debito residuo per Fase D: `src/layout.js` resta vivo perché importato da `main.ts`; anche il router artigianale resta temporaneamente in `router.ts`. Entrambi vanno assorbiti nel layer Svelte durante le feature `0.5.0`, senza anticipare refactor in C6.

---

## Fase D — Feature 0.5.0

Tutte e quattro le feature vengono sviluppate sui componenti Svelte della Fase B/C.

### ✅ D1. Web Worker per batch >100k

- `src/workers/validator.worker.ts`: validazione a chunk + lookup OpenCUP delegato al main thread via `lookup-request`; streaming risultati via `postMessage`.
- `src/lib/core/validation-worker.ts`: orchestratore che sceglie inline vs worker in base alla soglia (100 k righe); espone `validateRows` con `AbortController` e callback `onProgress`.
- `src/components/ProgressBar.svelte`: progress bar percentuale.
- `Validator.svelte`: integra `validateRows`, mostra progresso e pulsante Annulla, disabilita i trigger durante la corsa; `onDestroy` interrompe batch in corso.
- Test: `validation-worker.test.js` (409 righe), `Validator.batch.test.js` (95 righe), `ProgressBar.svelte.test.js`.
- TODO #4 (cancellazione `loadLatestDataset`) non incluso in questa fase; rimane aperto in TODO.md.

### D2. Drag-drop multi-file

- `DropZone.svelte`: feedback visivo dichiarativo (active, error, overflow); accetta più CSV/XLSX.
- `Validator.svelte`: concatena le righe dei file con colonna `file_origine` aggiunta automaticamente; gestione coerente delle intestazioni tra file multipli.

### D3. WCAG 2.1 AA

- Live region `aria-live="polite"` in `Validator.svelte` (lookup, Worker progress) e `PdfExtract.svelte` (OCR, coda).
- Focus management al cambio vista in `router.ts`.
- Link "Salta al contenuto" in `main.ts` / layout.
- Contrasto colore AA verificato su tutti i componenti.
- Etichette ARIA su tabelle, input file, pulsanti icona.
- Quality gate Lighthouse a11y in CI (soglia ≥ 90).

### D4. i18n base

- File `src/i18n/it.json` e `src/i18n/en.json`: tutte le stringhe UI, etichette esiti, messaggi errore.
- `LanguageSwitcher.svelte` con persistenza `localStorage`.
- Le stringhe nel template Svelte diventano `$derived` dal file di lingua attivo.
- Fixture e contratti interni restano in italiano.

### D5. Dichiarazione di accessibilità

- `docs/accessibility.md`: conformità dichiarata, limitazioni note, contatto per segnalazioni.

---

## Checklist CI aggiuntivi dopo la migrazione

| Check | Comando |
|---|---|
| Type check TS + Svelte | `npx svelte-check --tsconfig tsconfig.json` |
| Lint Svelte | `eslint . --ext .svelte` |
| Lighthouse a11y | `npm run test:lighthouse` con gate ≥ 90 |
| Acceptance Playwright | `npm run test:acceptance` |

---

## Non in scope per 0.5.0

- Coerenza atto (0.6.0)
- Provider remoti (0.7.0+)
- Cambio del modello local-first
- Modifica al package Python
