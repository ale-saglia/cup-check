# ADR 0011: test TypeScript end-to-end e gate type-check

## Status

Accepted

## Context

Il package web usa TypeScript strict per il codice applicativo, Svelte 5 e `svelte-check` come gate locale e CI. Prima di questa decisione, però, la suite Vitest era composta da file `.test.js` e `.svelte.test.js`, quindi restava fuori dal controllo statico.

Questa asimmetria rendeva i test meno disciplinati del codice che verificano: un refactor di tipi pubblici come `ValidationResult`, `ImportedCupRow` o le props dei componenti Svelte poteva rompere mock e helper senza essere intercettato da `tsc`, emergendo solo a runtime o solo sui percorsi effettivamente esercitati.

Nel workflow del progetto, dove gli agenti di coding producono patch sotto revisione umana, il problema è anche di governance: i test tipati riducono la classe di regressioni in cui un agente aggiorna il source e i test nel contesto immediato, ma lascia mock o fixture helper non allineati altrove.

## Decision

I test web Vitest vengono migrati a TypeScript:

- i test unitari e component test passano da `.test.js` / `.svelte.test.js` a `.test.ts` / `.svelte.test.ts`;
- gli script Node lineari (`acceptance.mjs`, `lighthouse.mjs`, `chrome-path.mjs`) restano JavaScript ESM;
- `tsconfig.test.json` estende il `tsconfig.json` del package web e include `tests/**/*.test.ts`;
- `npm run check:tests` esegue `tsc --noEmit -p tsconfig.test.json`;
- CI, `make check` e pre-commit/pre-push includono il gate di type-check sui test.

Il `tsconfig.json` principale resta dedicato al codice applicativo e a `svelte-check`, così il build mantiene il proprio perimetro e il type-check dei test resta un gate esplicito.

La migrazione iniziale accetta una strictness più pragmatica sul perimetro test (`strict: false`, `noImplicitAny: false`) e usa `@ts-nocheck` sui test DOM-heavy o sui casi che costruiscono deliberatamente fixture parziali o malformate. Questo conserva il comportamento della suite durante la rinomina e rende esplicito il debito da ridurre in PR successive.

## Consequences

**Positivi:**

- I mock di test devono seguire i contratti TypeScript del codice applicativo.
- I refactor di firme e tipi pubblici falliscono prima del runtime quando i test non sono aggiornati.
- Il feedback loop degli agenti diventa più robusto: `tsc` segnala errori strutturali anche nei test non letti nel contesto immediato.
- La postura di qualità dichiarata dal progetto copre sia source sia validazione.

**Trade-off:**

- Alcuni helper di test richiedono annotazioni o narrowing espliciti.
- I component test Svelte possono esporre più attrito sui tipi delle props rispetto ai test unitari puri.
- Il gate CI aggiunge un passaggio, anche se Vitest già transpila TypeScript durante l'esecuzione.
- La prima iterazione non è ancora strict end-to-end: i file marcati con `@ts-nocheck` vanno ridotti progressivamente partendo da fixture core, mock dataset e component test Svelte.

## Alternative scartate

**Lasciare i test in JavaScript**: mantiene basso il costo immediato, ma conserva il gap tra codice applicativo tipato e test non tipati.

**Includere i test nel `tsconfig.json` principale**: semplifica i file di configurazione, ma allarga il perimetro del type-check applicativo e interagisce peggio con `rootDir: ./src`.

**Migrare anche gli script `.mjs`**: possibile, ma il ritorno è minore. Gli script acceptance e Lighthouse sono entrypoint Node lineari e non fanno parte della suite Vitest che costruisce mock e oggetti applicativi.
