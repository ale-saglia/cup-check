# ADR 0009: Migrazione a TypeScript + Svelte 5 per il frontend web

## Status

Accepted

## Context

A partire dalla `0.4.0` la web app gestisce: hash router, tools-registry, due viste autonome (verificatore e PDF), dataset-loader multi-cache, service worker con pre-cache, OCR locale con Tesseract.js. Il codebase vanilla JS ha raggiunto il punto dove la gestione manuale di stato, event binding e rendering diverge in ogni modulo senza un contratto comune.

La milestone `0.5.0` aggiunge quattro feature che richiedono tutte componenti reattivi:

- **Web Worker**: progress bar percentuale, cancellazione asincrona, streaming risultati.
- **Drag-drop multi-file**: feedback visivo dipendente da stato (attivo, errore, sovraccarico).
- **WCAG 2.1 AA**: live region ARIA per avanzamento asincrono; focus management al cambio vista.
- **i18n**: caricamento dinamico di file JSON di traduzione; aggiornamento reattivo di ogni stringa UI.

Costruire queste feature in vanilla JS richiede la stessa infrastruttura (segnali, store, effetti) che un framework fornisce come primitiva. Il costo di non avere un layer reattivo ha superato il costo di introdurlo.

Vite è già il build tool del progetto. `@sveltejs/vite-plugin-svelte` è un singolo plugin da aggiungere.

Il progetto **non cambia natura**: resta una web app statica, local-first, senza backend applicativo obbligatorio. La migrazione è una scelta di architettura interna, non un cambio di modello.

## Decision

Adottiamo **TypeScript** per tutta la logica e **Svelte 5** (Runes) per tutta la UI.

**TypeScript** (`tsconfig.json` + `typescript` come devDep): tutti i moduli JS esistenti diventano `.ts`. Vite traspila TypeScript nativamente senza passi aggiuntivi. Il guadagno principale è contratti espliciti tra moduli — i tipi degli esiti (`Outcome`), dei risultati (`ValidationResult`), del manifest dataset e della struttura parsed diventano definizioni condivise invece di convenzioni implicite.

**Svelte 5 Runes** con `@sveltejs/vite-plugin-svelte` e `svelte-check`: le due viste diventano `.svelte` con `<script lang="ts">`. I Runes (`$state`, `$derived`, `$effect`) rimpiazzano la gestione manuale di stato, event binding e rendering. Svelte compila a JS puro senza runtime pesante.

La migrazione è **incrementale e vincolata**: prima l'infrastruttura (TS + plugin Svelte), poi le viste una alla volta, poi le feature `0.5.0`. Nessuna feature viene avviata prima che entrambe le viste siano migrate.

### Perimetro

**Diventano `.svelte`** (rendering + stato locale):

- `views/validator-view.js` → `routes/Validator.svelte`
- `views/pdf-extract-view.js` → `routes/PdfExtract.svelte` + sottocomponenti (`EntryList.svelte`, `QueueControls.svelte`)
- Nuovi componenti `0.5.0`: `DropZone.svelte`, `ProgressBar.svelte`, `LanguageSwitcher.svelte`

**Diventano `.ts`** (logica pura, nessun rendering):

- `parser.js`, `validator.js`, `results.js`, `report.js` — logica core; i tipi pubblici vanno in `lib/types.ts`
- `dataset-loader.js`, `transfer.js` — fetch + sql.js
- `router.js`, `tools-registry.js`, `main.js`, `version.js`
- `pdf/extract-cups.js`, `pdf/extract-text.js`, `pdf/ocr.js`
- `dialogs.js`, `dom.js`, `layout.js`, `render.js`, `text-input.js` — moduli DOM helper; da riassorbire nelle viste Svelte dove possibile

**Gestione speciale:**

- `sw.js` — il service worker viene mantenuto come file JS separato (il plugin SW di Vite non gestisce TS per i SW); i tipi rimangono in JSDoc se necessari
- `polyfills.js` — invariato: viene iniettato come IIFE nel build, non ha tipi utili

### Struttura target

```
src/
  lib/
    types.ts               Outcome, ValidationResult, ParsedFile, DatasetManifest, …
    core/                  parser.ts  validator.ts  results.ts  report.ts
    data/                  dataset-loader.ts  transfer.ts
    pdf/                   extract-cups.ts  extract-text.ts  ocr.ts
  components/              DropZone.svelte  ProgressBar.svelte  LanguageSwitcher.svelte
  routes/
    Validator.svelte
    PdfExtract.svelte
  sw.js
  router.ts
  main.ts
  polyfills.js
  styles.css
```

## Consequences

**Positivi:**

- Tipi espliciti sui contratti tra moduli: `Outcome`, `ValidationResult`, `ParsedFile`. Gli errori di integrazione diventano errori di compilazione invece di bug runtime.
- Stato reattivo esplicito con Runes; il modulo globale `state.js` viene assorbito nelle viste.
- Live region ARIA e progress bar gestibili con binding dichiarativi, senza listener manuali.
- `pdf-extract-view.js` si scompone naturalmente in sottocomponenti tipati: risolve il TODO #5 come effetto collaterale della migrazione.
- i18n: le stringhe diventano `$derived` aggiornate automaticamente al cambio lingua.
- Svelte compila a JS puro; il bundle non cresce in modo significativo.
- I test acceptance con Playwright restano invariati: testano il DOM, non l'implementazione.

**Negativi/Trade-off:**

- TypeScript + Svelte sono dipendenze non rimovibili senza rewrite. La scelta è definitiva.
- La finestra di convivenza JS/TS + vanilla/Svelte va contenuta al singolo sprint di migrazione; moduli parzialmente tipati sono peggio di nessun tipo.
- I test unitari delle viste devono essere aggiornati (`@testing-library/svelte`).
- La coverage di linee/branch dei `.svelte` va ricalibrata: v8 non copre i template Svelte come i moduli JS.
- `svelte-check` va aggiunto al gate CI per non perdere il vantaggio dei tipi.

## Alternative scartate

**React / Vue**: dipendenze più pesanti, nessun compilatore a JS puro, non allineate con il profilo del progetto (app statica, zero SSR, bundle minimo).

**TypeScript senza Svelte**: risolve i tipi ma non la complessità di rendering di `pdf-extract-view.js` e non fornisce le primitive reattive necessarie a WCAG AA e i18n.

**Svelte senza TypeScript**: perde metà del guadagno. I contratti tra moduli core restano impliciti proprio nel momento in cui il progetto diventa una suite di strumenti.

**Nessuna migrazione, vanilla JS esteso**: percorribile rinunciando a WCAG AA completa e i18n come feature di prima classe nella `0.5.0`. Non accettabile.
