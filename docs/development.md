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

## Release

La checklist operativa per release software, package Python, web app statica e
dataset OpenCUP è in [Processo di release](release-process.md).

## Svelte 5 — note e gotcha

### Identità dei proxy reattivi con `$state`

Quando un plain object viene pushato in **due array `$state` distinti**, Svelte crea due proxy reattivi separati. Mutazioni fatte tramite il proxy di un array non aggiornano i dipendenti dell'altro.

```typescript
// BAD: entries e queue hanno proxy distinti per lo stesso oggetto
entries.push(...newEntries);
queue.push(...newEntries);  // proxy separati — entry.status mutato dalla queue
                            // non fa re-render del template di entries
```

La soluzione è pushare nella queue i proxy già creati da `entries`, non i plain object originali:

```typescript
// GOOD: queue referenzia gli stessi proxy di entries
const startIdx = entries.length;
newEntries.forEach(e => entries.push(e));
queue.push(...entries.slice(startIdx));
```

**Perché:** `proxy()` di Svelte usa `STATE_SYMBOL in value` per riconoscere oggetti già proxati. Un plain `{}` non ha il simbolo, quindi ogni chiamata a `proxy(stessoOggetto)` crea un `Proxy` fresco con la propria `sources` Map interna.

## Matrice Python CI

Il workflow CI testa il package su più versioni Python. La matrice viene generata da
`scripts/python_matrix.py`, che interroga il [manifest ufficiale di
`actions/python-versions`](https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json)
con fallback su `scripts/python-versions-manifest.json` (committato, 950 righe circa).

Il file di fallback **non viene aggiornato da Dependabot**; aggiornalo manualmente
una volta al mese circa o prima di una release:

```bash
make refresh-python-matrix
git add scripts/python-versions-manifest.json
git commit -m "chore: aggiorna fallback matrice versioni Python"
```

## Coverage e Codecov

I test Python generano `coverage.xml` tramite `pytest-cov`; i test web generano `coverage/lcov.info` tramite Vitest e `@vitest/coverage-v8`. Entrambi i report sono ignorati da Git e vengono caricati su Codecov dal workflow `ci.yml` usando il secret GitHub Actions `CODECOV_TOKEN`.

La soglia locale Python (minimo per non bloccare la build) è definita in `packages/cup_check/pyproject.toml` con `--cov-fail-under=95`; il target aspirazionale è 100% ed è applicato da Codecov tramite `codecov.yml`. La soglia locale web è definita in `packages/web/vite.config.ts`: line coverage ≥ 95%, branch coverage ≥ 90%. Codecov riceve report separati con flag `python` e `web`; le regole di stato sono dichiarate in `codecov.yml`.
