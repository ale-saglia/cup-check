# Sviluppo

## Quickstart

Web app:

```bash
cd packages/web
npm install
npm run dev
```

Libreria Python:

```bash
cd packages/cup_check
uv sync --dev
uv run pytest
```

Esempio d'uso con lookup OpenCUP locale/cacheato:

```python
from cup_check import OpenCupChecker

with OpenCupChecker.from_latest(cache_dir=".cup-check-cache") as checker:
    result = checker.check("G17H03000130001")

print(result.outcome)
```

In alternativa, apri il repo in Dev Containers / Codespaces. Il container include Node.js 22, npm, uv, make, ripgrep, GitHub CLI, Chromium e Lighthouse; al primo avvio esegue `make setup`.

## Comandi

```bash
make help
make check
make release-check
make python-build
make dataset-release-local
make web-dev
make web-preview
make web-preview-dataset
```

Vedi [Technical Spec](technical-spec.md#comandi) per la descrizione dettagliata di ciascun comando.

## Coverage e Codecov

I test Python generano `coverage.xml` tramite `pytest-cov`; i test web generano `coverage/lcov.info` tramite Vitest e `@vitest/coverage-v8`. Entrambi i report sono ignorati da Git e vengono caricati su Codecov dal workflow `ci.yml` usando il secret GitHub Actions `CODECOV_TOKEN`.

La soglia locale Python (minimo per non bloccare la build) è definita in `packages/cup_check/pyproject.toml` con `--cov-fail-under=95`; il target aspirazionale è 100% ed è applicato da Codecov tramite `codecov.yml`. La soglia locale web è definita in `packages/web/vite.config.ts`: line coverage ≥ 95%, branch coverage ≥ 90%. Codecov riceve report separati con flag `python` e `web`; le regole di stato sono dichiarate in `codecov.yml`.
