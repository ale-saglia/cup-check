# Technical Spec

## Stack

| Layer                      | Tecnologia                     | Motivazione                                        |
| -------------------------- | ------------------------------ | -------------------------------------------------- |
| Web language               | Vanilla JavaScript ES modules  | Browser-native, nessun framework necessario        |
| Web build                  | Vite                           | Dev server rapido, output statico per GitHub Pages |
| CSV parsing                | PapaParse                      | Maturo e leggero                                   |
| XLSX parsing               | read-excel-file                | MIT, evita dipendenze pesanti                      |
| PDF parsing                | pdf.js                         | Estrazione testo browser-side da PDF nativi        |
| OCR                        | Tesseract.js + lingua `ita`    | Fallback locale per PDF scansionati                |
| Service Worker             | Vanilla                        | Comportamento esplicito                            |
| Test web                   | Vitest, Playwright, Lighthouse | Unit, acceptance e quality gate                    |
| Coverage                   | pytest-cov, Vitest V8, Codecov | Soglie locali e report PR per Python e web         |
| Lint/format                | ESLint, Prettier, EditorConfig | Stile coerente                                     |
| Fixture                    | YAML                           | Leggibili e consumabili da JS/Python               |
| Dataset storage            | GitHub Releases + GitHub Pages | Release dataset versionate e asset statici consumabili dal browser |
| Lookup                     | Browser + Service Worker       | Verifica locale su dataset esatto, senza backend   |
| Hosting                    | GitHub Pages                   | CORS nativi, zero costi operativi                  |
| Python library             | Python 3.12+, uv, pytest, ruff | Integrazione applicativa e parity test             |

## Struttura Repo

```text
cup-check/
├── README.md
├── AGENTS.md
├── CONTRIBUTING.md
├── LICENSE
├── CHANGELOG.md
├── Makefile
├── docs/
│   ├── user-guide.md
│   ├── product.md
│   ├── architecture.md
│   ├── technical-spec.md
│   ├── data-sources.md
│   ├── governance.md
│   ├── roadmap.md
│   ├── development.md
│   ├── glossary.md
│   └── adr/
├── packages/
│   ├── cup_check/
│   └── web/
├── samples/
└── tests/
    └── fixtures/
```

Per la descrizione dell'evoluzione architetturale e dei componenti introdotti in ciascuna release, vedi [architecture.md](architecture.md).

## Fixture

I file `tests/fixtures/*.yaml` sono normativi. Ogni caso contiene:

```yaml
- id: valid-typical
  description: 'CUP formalmente valido tipico'
  input: 'G17H03000130001'
  expected:
    outcome: FORMATO_VALIDO_DA_VERIFICARE
    failed_rules: []
```

Regole:

- aggiornare i fixture prima dell'implementazione quando cambia una regola;
- non duplicare fixture per linguaggio;
- se un input è vuoto, l'unica regola fallita è `R0`;
- web e libreria Python devono produrre gli stessi esiti e le stesse `failedRules` sugli stessi fixture.

Per verificare la parity:

```bash
cd packages/web && npm test
cd packages/cup_check && uv run pytest
```

## Regole di Formato

Il valore viene normalizzato con `trim` + uppercase prima di applicare le regole.

| Regola | Specifica |
| ------ | --------- |
| `R0`   | valore vuoto dopo trim |
| `R1`   | lunghezza diversa da 15 caratteri dopo trim |
| `R2`   | charset diverso da lettere maiuscole A-Z e cifre 0-9 |
| `R3`   | prima posizione non alfabetica |
| `R4`   | posizioni 5-6 non sono un anno plausibile non futuro |
| `R5`   | quarta posizione non alfabetica |

### Anno a due cifre (R4) e assenza di ambiguità pre-2000

Il formato CUP espone l'anno di decisione del progetto nelle posizioni 5-6 con due sole cifre. Questa scelta non introduce ambiguità con date precedenti al 2000 perché il Sistema CUP è operativo dal 2003: nessun codice è stato generato prima di tale data.

Riferimenti normativi:

- **Delibera CIPE n. 143 del 27 dicembre 2002** (G.U. n. 87 del 14/04/2003): istituisce il Sistema CUP e ne definisce l'algoritmo di generazione come stringa alfanumerica di 15 caratteri.
- **Legge 16 gennaio 2003, n. 3, art. 11**: rende obbligatorio il CUP per tutti i progetti di investimento pubblico. L'obbligo decorre dal 1º gennaio 2003 per i nuovi progetti e dal 1º gennaio 2004 per quelli già in corso.
- **Delibera CIPE n. 63 del 26 novembre 2020**: conferma che il CUP e il suo corredo informativo restano immutati nel tempo.

La corrispondenza tra posizioni 5-6 e anno di decisione non è documentata esplicitamente nei testi normativi pubblici: l'algoritmo di generazione del CUP non è pubblicato nella delibera né nel Manuale utente del Sistema CUP (ed. aprile 2022, DIPE). La regola R4 si basa sulla verifica empirica incrociata con il campo `ANNO_DECISIONE` del dataset OpenCUP su milioni di record.

`cup-check` adotta la rappresentazione a due cifre perché è quella prodotta dal Sistema CUP nelle specifiche attuali. Se il CIPESS modificasse il formato della stringa CUP (evento che richiederebbe una nuova delibera), la regola R4 e l'architettura del validatore andrebbero aggiornati di conseguenza.

Se il valore è vuoto, l'unica regola fallita è `R0`. Se almeno una regola fallisce, l'esito è `INVALIDO_FORMATO`. Se tutte passano, l'esito è `FORMATO_VALIDO_DA_VERIFICARE`.

Avvisi non bloccanti:

| Avviso | Specifica |
| ------ | --------- |
| `N1`   | spazi bianchi rimossi dal CUP |
| `N2`   | lettere convertite in maiuscolo |

I fixture in `tests/fixtures/*.yaml` sono la specifica funzionale normativa.

## Contratto Validatore

```text
Outcome    = INVALIDO_FORMATO
           | FORMATO_VALIDO_DA_VERIFICARE        -- formato ok, dataset non disponibile
           | TROVATO_OPENCUP                      -- CUP presente nel mirror OpenCUP
           | NON_TROVATO_OPENCUP_DA_VERIFICARE    -- CUP assente dal mirror OpenCUP
           -- da 0.6.0:
           | POSSIBILE_INCOERENZA_DA_VERIFICARE   -- discrepanza con dati atto nel dataset
           -- da 0.8.0:
           | TROVATO_REMOTO                       -- CUP confermato dalla fonte remota
           | NON_TROVATO_REMOTO_DA_VERIFICARE     -- CUP non trovato dalla fonte remota
           | VERIFICA_REMOTA_NON_DISPONIBILE      -- provider remoto assente o non configurato
FailedRule = R0 | R1 | R2 | R3 | R4 | R5
Warning    = N1 | N2

ValidationResult = {
  inputRow: int | null,
  rawValue: string,
  normalizedValue: string,
  outcome: Outcome,
  failedRules: FailedRule[],
  warnings: Warning[]
}
```

`validateCup` restituisce sempre `FORMATO_VALIDO_DA_VERIFICARE` per CUP formalmente validi. Il lookup dataset è separato: quando l'indice OpenCUP statico è disponibile, la web app trasforma gli esiti formalmente validi in `TROVATO_OPENCUP` o `NON_TROVATO_OPENCUP_DA_VERIFICARE`.

Implementazione web:

```javascript
export function validateCup(value, row = null, options = {}) { ... }
export function validateBatch(values, options = {}) { ... }
```

API Python:

```python
from cup_check import OpenCupChecker, validate_format

result = validate_format("G17H03000130001")

with OpenCupChecker.from_latest(cache_dir=".cup-check-cache") as checker:
    checked = checker.check("G17H03000130001")
```

La libreria espone anche `validate_many(iterable)` per validare iterabili di valori senza introdurre parser file nel core. `validate_format` resta solo formale; `OpenCupChecker` scarica/cacha l'indice OpenCUP oppure apre un indice SQLite locale e trasforma i CUP formalmente validi in `TROVATO_OPENCUP` o `NON_TROVATO_OPENCUP_DA_VERIFICARE`. Se il dataset non è disponibile, il checker degrada a `FORMATO_VALIDO_DA_VERIFICARE`.

## Tool Estrazione PDF

Il tool PDF della `0.4.0` è un'estensione frontend del verificatore, non un nuovo backend.

Comportamento:

- routing tramite `#/pdf-extract`;
- caricamento multi-file con input e drag-and-drop;
- estrazione testo nativa con pdf.js;
- OCR italiano locale con Tesseract.js solo quando il testo medio per pagina è sotto soglia;
- regex CUP condivisa con il validatore, in variante globale per cercare codici nel testo;
- una riga risultato per ogni coppia file/CUP, senza deduplicazione nel tool;
- possibilità di inserire o correggere manualmente un CUP, marcando il risultato come manuale;
- export CSV `file ↔ CUP` e passaggio al verificatore come file sintetico con colonne `cup,file_origine`.

Il tool PDF non introduce nuovi outcome nel validatore formale. Gli esiti restano quelli del contratto esistente; eventuali informazioni di origine (`testo`, `ocr`, `manuale`) sono metadati di UI/export.

## Workflow

| Workflow               | Trigger                              | Effetto                                              |
| ---------------------- | ------------------------------------ | ---------------------------------------------------- |
| `ci.yml`               | PR e push su `main`                  | lint, test, build, upload coverage Python e web su Codecov |
| `release-web.yml`      | push tag `v*`                        | build web statica, deploy Pages e allega `web-dist.tar.gz` alla release |
| `release-python.yml`   | push tag `v*` o `workflow_dispatch`  | build e publish PyPI                                 |
| `release-dataset.yml`  | 5 del mese o `workflow_dispatch`     | scarica OpenCUP, compila asset statici, pubblica release dataset e aggiorna Pages dal web pinnato |

La web app resta pinnata alle release software `v*`. Le release dataset possono ridistribuire Pages solo partendo da `web-dist.tar.gz` dell'ultima release `v*` o da un checkout della stessa tag; non pubblicano codice web da `main`. Il browser scopre dinamicamente l'ultimo dataset da `dataset-latest.json` servito da Pages e usa la GitHub Releases API solo come fallback di discovery; anche in questo caso il `manifest_url` punta a GitHub Pages per evitare blocchi CORS. Se il dataset non è ancora pubblicato su Pages il lookup degrada in modo cautelativo.

Il download dataset è rafforzato a due livelli: il browser verifica lo SHA-256 di ogni chunk prima di ricomporre lo SQLite e ritenta i chunk falliti; il service worker usa una cache dataset dedicata, separata dalla cache app-shell, con eviction delle release `dataset-YYYY-MM` precedenti. La libreria Python usa timeout espliciti per manifest/latest, chunk dataset già elaborati e download bulk OpenCUP.

La build web ricava la versione dal tag software Git più vicino che rispetta `v[0-9]*`, rimuovendo la `v` iniziale per l'UI. Se i tag non sono disponibili, usa il marker non-release `0.0.0-dev` come fallback. La stessa versione alimenta il cache name del service worker.

La build Python accetta solo tag software esatti `vX.Y.Z`: il workflow pubblica su PyPI al push del tag e può essere rilanciato manualmente con `workflow_dispatch` per recuperare un tag già esistente. Il controllo sui file `dist/cup_check-X.Y.Z.*` blocca il publish se il versioning VCS produce una versione diversa dal tag.

Il job Python della CI genera `packages/cup_check/coverage.xml` tramite `pytest-cov` e lo carica su Codecov con flag `python`. Il job web genera `packages/web/coverage/lcov.info` tramite Vitest e `@vitest/coverage-v8` e lo carica con flag `web`. I badge coverage nel README puntano ai report Codecov separati per flag; `codecov.yml` mantiene esplicite le soglie di stato per coverage Python, coverage web e patch.

## Comandi

```bash
make setup
make check
make release-check
make python-build
make dataset-release-local
make web-dev
make web-preview
make web-preview-dataset
```

`make dataset-release-local` genera `dist/dataset/` con `dataset-latest.json`,
`dataset-manifest.json` e chunk `cup-index.sqlite.*`, scaricando prima il dump OpenCUP.
La data snapshot predefinita è il primo giorno del mese UTC corrente; può essere sovrascritta
con `DATASET_SNAPSHOT_DATE=YYYY-MM-DD`.

`make web-preview-dataset` richiede un dataset già generato in `dist/dataset/`; copia
`dataset-latest.json`, `dataset-manifest.json` e i chunk nella build web con URL relativi,
così la preview Codespaces esercita il caricamento dataset same-origin.
