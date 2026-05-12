# Technical Spec

## Stack

| Layer                      | Tecnologia                     | Motivazione                                        |
| -------------------------- | ------------------------------ | -------------------------------------------------- |
| Web language               | Vanilla JavaScript ES modules  | Browser-native, nessun framework necessario        |
| Web build                  | Vite                           | Dev server rapido, output statico per GitHub Pages |
| CSV parsing                | PapaParse                      | Maturo e leggero                                   |
| XLSX parsing               | read-excel-file                | MIT, evita dipendenze pesanti                      |
| Service Worker             | Vanilla                        | Comportamento esplicito                            |
| Test web                   | Vitest, Playwright, Lighthouse | Unit, acceptance e quality gate                    |
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
├── LICENSE
├── CHANGELOG.md
├── Makefile
├── docs/
│   ├── project.md
│   ├── product.md
│   ├── mvp.md
│   ├── architecture.md
│   ├── technical-spec.md
│   ├── data-sources.md
│   ├── governance.md
│   ├── parity.md
│   ├── roadmap.md
│   ├── glossary.md
│   └── adr/
├── packages/
│   ├── cup_check/
│   └── web/
├── samples/
└── tests/
    └── fixtures/
```

Da `0.2.0` esiste `packages/cup_check/` per la libreria Python. Da `0.3.0` la logica per costruire il dataset OpenCUP vive nel package Python; il workflow mensile produce `dataset-manifest.json` e asset statici versionati su GitHub Releases e pubblicati su GitHub Pages per il consumo browser e Python.

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
- web e libreria Python devono produrre gli stessi esiti sugli stessi fixture.

## Contratto Validatore

```text
Outcome    = INVALIDO_FORMATO
           | FORMATO_VALIDO_DA_VERIFICARE   -- formato ok, dataset non disponibile
           | TROVATO_OPENCUP                 -- CUP presente nel mirror OpenCUP
           | NON_TROVATO_OPENCUP_DA_VERIFICARE -- CUP assente dal mirror OpenCUP
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

`validateCup` restituisce sempre `FORMATO_VALIDO_DA_VERIFICARE` per CUP formalmente validi. Il lookup dataset e separato: quando l'indice OpenCUP statico e disponibile, la web app trasforma gli esiti formalmente validi in `TROVATO_OPENCUP` o `NON_TROVATO_OPENCUP_DA_VERIFICARE`.

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

La libreria espone anche `validate_many(iterable)` per validare iterabili di valori senza introdurre parser file nel core. `validate_format` resta solo formale; `OpenCupChecker` scarica/cacha l'indice OpenCUP oppure apre un indice SQLite locale e trasforma i CUP formalmente validi in `TROVATO_OPENCUP` o `NON_TROVATO_OPENCUP_DA_VERIFICARE`. Se il dataset non e disponibile, il checker degrada a `FORMATO_VALIDO_DA_VERIFICARE`.

## Workflow

| Workflow               | Trigger                              | Effetto                                              |
| ---------------------- | ------------------------------------ | ---------------------------------------------------- |
| `ci.yml`               | PR e push su `main`                  | lint, test, build                                    |
| `release-web.yml`      | push tag `v*`                        | build web statica, deploy Pages e allega `web-dist.tar.gz` alla release |
| `release-python.yml`   | push tag `v*` o `workflow_dispatch`  | build e publish PyPI                                 |
| `release-dataset.yml`  | 5 del mese o `workflow_dispatch`     | scarica OpenCUP, compila asset statici, pubblica release dataset e aggiorna Pages dal web pinnato |

La web app resta pinnata alle release software `v*`. Le release dataset possono ridistribuire Pages solo partendo da `web-dist.tar.gz` dell'ultima release `v*` o da un checkout della stessa tag; non pubblicano codice web da `main`. Il browser scopre dinamicamente l'ultimo dataset da `dataset-latest.json` servito da Pages e usa la GitHub Releases API solo come fallback di discovery; anche in questo caso il `manifest_url` punta a GitHub Pages per evitare blocchi CORS. Se il dataset non è ancora pubblicato su Pages il lookup degrada in modo cautelativo.

Il download dataset e rafforzato a due livelli: il browser verifica lo SHA-256 di ogni chunk prima di ricomporre lo SQLite e ritenta i chunk falliti; il service worker usa una cache dataset dedicata, separata dalla cache app-shell, con eviction delle release `dataset-YYYY-MM` precedenti. La libreria Python usa timeout espliciti per manifest/latest, chunk dataset gia elaborati e download bulk OpenCUP.

La build web ricava la versione dal tag software Git piu vicino che rispetta `v[0-9]*`, rimuovendo la `v` iniziale per l'UI. Se i tag non sono disponibili, usa il marker non-release `0.0.0-dev` come fallback. La stessa versione alimenta il cache name del service worker.

La build Python accetta solo tag software esatti `vX.Y.Z`: il workflow pubblica su PyPI al push del tag e puo essere rilanciato manualmente con `workflow_dispatch` per recuperare un tag gia esistente. Il controllo sui file `dist/cup_check-X.Y.Z.*` blocca il publish se il versioning VCS produce una versione diversa dal tag.

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
La data snapshot predefinita e il primo giorno del mese UTC corrente; puo essere sovrascritta
con `DATASET_SNAPSHOT_DATE=YYYY-MM-DD`.

`make web-preview-dataset` richiede un dataset gia generato in `dist/dataset/`; copia
`dataset-latest.json`, `dataset-manifest.json` e i chunk nella build web con URL relativi,
cosi la preview Codespaces esercita il caricamento dataset same-origin.
