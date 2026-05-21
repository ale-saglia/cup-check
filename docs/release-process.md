# Processo di release

Questa checklist coordina release software, package Python, web app statica e
dataset OpenCUP. I tag software e dataset sono indipendenti: i tag `vX.Y.Z`
pubblicano codice web e package Python, mentre i tag `dataset-YYYY-MM`
pubblicano solo asset dati e ridistribuiscono Pages partendo dalla web app
pinnata all'ultima release software.

## Principi

- Mantieni `CHANGELOG.md` come fonte delle note di release software.
- Non taggare una release software con la sezione `## Unreleased` ancora usata
  per le note della versione da pubblicare.
- Aggiorna `README.md` e `docs/roadmap.md` nello stesso commit di preparazione
  della release quando cambiano stato o versione corrente.
- Crea commit e tag firmati: usa `git commit -S` e `git tag -s`.
- Non pubblicare codice web da `main` tramite release dataset: Pages deve
  essere ricostruito da `web-dist.tar.gz` dell'ultima release `v*` o dal
  checkout della stessa tag.

## Release software `vX.Y.Z`

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

## Recupero publish Python

Usa `workflow_dispatch` di `release-python.yml` solo per recuperare un tag
software già esistente, per esempio se il publish PyPI è fallito dopo la build.
Il valore deve essere un tag `vX.Y.Z` già presente nel repository.

Prima del rilancio, verifica che il tag sia quello corretto e che il workflow
non stia pubblicando una versione diversa da quella attesa.

## Release dataset `dataset-YYYY-MM`

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

Il workflow conserva su GitHub Releases i dataset degli ultimi 3 mesi
(`DATASET_RETENTION_MONTHS`) e rimuove automaticamente release e tag
`dataset-YYYY-MM` più vecchi. Pages espone solo il dataset corrente tramite
`dataset-latest.json` e `datasets/dataset-YYYY-MM/`.

## Verifiche post-release

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
