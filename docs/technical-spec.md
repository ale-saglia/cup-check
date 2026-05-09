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
| Hosting                    | GitHub Pages                   | Vincolo MVP                                        |
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

Da `0.2.0` esiste `packages/cup_check/` per la libreria Python. Da `0.3.0` la logica riusabile per costruire il dataset OpenCUP vive nel package Python, mentre il workflow mensile produrra `dataset-manifest.json` e asset chunked fuori dal repository.

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
Outcome    = INVALIDO_FORMATO | FORMATO_VALIDO_DA_VERIFICARE
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

Implementazione web:

```javascript
export function validateCup(value, row = null, options = {}) { ... }
export function validateBatch(values, options = {}) { ... }
```

API Python:

```python
from cup_check import validate_format

result = validate_format("G17H03000130001")
```

La libreria espone anche `validate_many(iterable)` per validare iterabili di valori senza introdurre parser file nel core.

## Workflow

| Workflow              | Trigger                           | Effetto                 |
| --------------------- | --------------------------------- | ----------------------- |
| `ci.yml`              | PR e push su `main`               | lint, test, build       |
| `release-web.yml`     | push tag `v*` o release published | build e deploy Pages    |
| `release-python.yml`  | release software pubblicata       | build e publish PyPI    |
| `refresh-dataset.yml` | futuro, da `0.3.0`                | refresh dataset OpenCUP |

La build web ricava la versione dal tag software Git piu vicino che rispetta `v[0-9]*`, rimuovendo la `v` iniziale per l'UI. Se i tag non sono disponibili, usa il marker non-release `0.0.0-dev` come fallback. La stessa versione alimenta il cache name del service worker.

## Comandi

```bash
make setup
make check
make release-check
make python-build
make web-dev
make web-preview
```
