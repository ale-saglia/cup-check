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

## Checklist Release

Questa checklist coordina release software, package Python, web app statica e
dataset OpenCUP. I tag software e dataset sono indipendenti: i tag `vX.Y.Z`
pubblicano codice web e package Python, mentre i tag `dataset-YYYY-MM`
pubblicano solo asset dati e ridistribuiscono Pages partendo dalla web app
pinnata all'ultima release software.

Principi:

- Mantieni `CHANGELOG.md` come fonte delle note di release software.
- Non taggare una release software con la sezione `## Unreleased` ancora usata
  per le note della versione da pubblicare.
- Aggiorna `README.md` e `docs/roadmap.md` nello stesso commit di preparazione
  della release quando cambiano stato o versione corrente.
- Crea commit e tag firmati: usa `git commit -S` e `git tag -s`.
- Non pubblicare codice web da `main` tramite release dataset: Pages deve
  essere ricostruito da `web-dist.tar.gz` dell'ultima release `v*` o dal
  checkout della stessa tag.

### Release Software `vX.Y.Z`

1. Verifica che la working tree contenga solo modifiche intenzionali per la
   release.
2. Esegui i controlli completi:

   ```bash
   make release-check
   ```

3. Genera il draft del changelog:

   ```bash
   make draft-changelog VERSION=X.Y.Z
   ```

4. Rivedi `CHANGELOG.md` e rinomina la sezione `## Unreleased` in
   `## X.Y.Z - YYYY-MM-DD`, usando la data effettiva del tag.
5. Aggiorna i riferimenti di versione e stato in `README.md` e
   `docs/roadmap.md`, inclusi eventuali passaggi da "in sviluppo" a
   "rilasciata".
6. Verifica che la sezione `## X.Y.Z - YYYY-MM-DD` contenga note non vuote:
   `release-web.yml` usa quella sezione per creare le release notes GitHub.
7. Committa la preparazione con firma:

   ```bash
   git add CHANGELOG.md README.md docs/roadmap.md
   git commit -S -m "chore(release): prepara X.Y.Z"
   ```

8. Crea il tag firmato:

   ```bash
   git tag -s vX.Y.Z -m "vX.Y.Z"
   ```

9. Pusha commit e tag:

   ```bash
   git push
   git push origin vX.Y.Z
   ```

10. Osserva i workflow `release-web.yml` e `release-python.yml`.
11. Verifica la release GitHub `vX.Y.Z`:
    - note non vuote e coerenti con `CHANGELOG.md`;
    - asset `web-dist.tar.gz` presente;
    - Pages aggiornata alla versione pubblicata;
    - package `cup-check` pubblicato su PyPI con versione `X.Y.Z`.
12. Riapri una sezione vuota in cima a `CHANGELOG.md`:

    ```markdown
    ## Unreleased
    ```

13. Committa la riapertura del ciclo di sviluppo con firma:

    ```bash
    git add CHANGELOG.md
    git commit -S -m "docs(changelog): riapri unreleased"
    git push
    ```

### Recupero Publish Python

Usa `workflow_dispatch` di `release-python.yml` solo per recuperare un tag
software già esistente, per esempio se il publish PyPI è fallito dopo la build.
Il valore deve essere un tag `vX.Y.Z` già presente nel repository.

Prima del rilancio, verifica che il tag sia quello corretto e che il workflow
non stia pubblicando una versione diversa da quella attesa.

### Release Dataset `dataset-YYYY-MM`

1. Verifica che esista una release software recente con asset
   `web-dist.tar.gz`; il workflow dataset usa quell'artefatto per ridistribuire
   Pages senza promuovere codice da `main`.
2. Per una pubblicazione manuale, avvia `release-dataset.yml` con
   `sources_snapshot_date` nel formato `YYYY-MM-DD`. La pubblicazione schedulata
   usa il primo giorno del mese UTC corrente.
3. Osserva i job `Build dataset`, `Publish GitHub Release` e
   `Publish dataset on pinned web`.
4. Verifica la release GitHub `dataset-YYYY-MM`:
   - `dataset-manifest.json` presente;
   - `dataset-latest.json` presente;
   - chunk `cup-index.sqlite.*` presenti;
   - release non marcata come latest software.
5. Verifica Pages:
   - `/dataset-latest.json` punta al nuovo `dataset_tag`;
   - `/datasets/dataset-YYYY-MM/dataset-manifest.json` è raggiungibile;
   - i chunk dichiarati dal manifest sono raggiungibili.
6. Apri la web app pubblicata e controlla che il lookup OpenCUP non degradi a
   `FORMATO_VALIDO_DA_VERIFICARE` per un CUP noto presente nel dataset.
7. Se la release dataset è errata, crea una nuova release dataset corretta o
   ripubblica lo stesso tag solo dopo aver compreso l'errore: il workflow elimina
   e ricrea la release dataset con lo stesso tag.

### Verifiche Post-Release

- Controlla che il badge "Latest release" nel README punti alla nuova release
  software.
- Controlla che la web app mostri la versione software attesa.
- Scarica `web-dist.tar.gz` dalla release e verifica che contenga la build
  statica completa.
- Installa il package Python in un ambiente pulito e importa `cup_check`.
- Esegui un controllo manuale su un CUP formalmente valido e su un CUP
  formalmente invalido.
- Per release dataset, confronta il numero di record indicizzato nel manifest
  con il riepilogo del workflow.

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

## Coverage e Codecov

I test Python generano `coverage.xml` tramite `pytest-cov`; i test web generano `coverage/lcov.info` tramite Vitest e `@vitest/coverage-v8`. Entrambi i report sono ignorati da Git e vengono caricati su Codecov dal workflow `ci.yml` usando il secret GitHub Actions `CODECOV_TOKEN`.

La soglia locale Python (minimo per non bloccare la build) è definita in `packages/cup_check/pyproject.toml` con `--cov-fail-under=95`; il target aspirazionale è 100% ed è applicato da Codecov tramite `codecov.yml`. La soglia locale web è definita in `packages/web/vite.config.ts`: line coverage ≥ 95%, branch coverage ≥ 90%. Codecov riceve report separati con flag `python` e `web`; le regole di stato sono dichiarate in `codecov.yml`.
