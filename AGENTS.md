# AGENTS.md

Istruzioni operative per agenti di coding su questo repo.

- Prima di modifiche sostanziali leggere la documentazione tematica pertinente in `docs/`; almeno `docs/product.md`, `docs/architecture.md`, `docs/technical-spec.md` e `docs/roadmap.md`.
- I fixture in `tests/fixtures/*.yaml` sono la specifica funzionale: aggiornali prima di cambiare il validatore.
- Nel validatore formale non introdurre esiti di verifica esistenza: gli unici outcome ammessi sono `INVALIDO_FORMATO` e `FORMATO_VALIDO_DA_VERIFICARE`. Il lookup OpenCUP resta separato.
- Tenere il web package statico e deployabile su GitHub Pages.
- Preferire modifiche piccole, testate e coerenti con la roadmap.
- Non aggiungere servizi server-side al web package: il lookup usa asset statici e dataset pubblici. Il Cloudflare Worker per la verifica remota opzionale è un micro-backend separato (fuori da `packages/web`); la web app non gestisce né conserva credenziali MEF.

## Eseguire i test Python

Il package usa `uv`. Dalla root del repo:

```bash
cd packages/cup_check && uv run pytest
```

Per un sottoinsieme di test:

```bash
cd packages/cup_check && uv run pytest tests/test_checker.py
```

Se le dipendenze non sono ancora installate: `cd packages/cup_check && uv sync --dev`.

## Firma di commit e tag

Tutti i commit e i tag di rilascio devono essere firmati con GPG (o SSH key configurata come signing key):

- commit: `git commit -S …`
- tag: `git tag -s <versione> -m "<versione>"` (mai `git tag -a` senza `-s`)

Non usare `--no-gpg-sign` né bypassare la firma in altro modo. Se la chiave non è disponibile nell'ambiente, segnalarlo prima di procedere anziché omettere la firma.

## Pre-commit

`pre-commit` è una dipendenza dev Python del progetto. Il hook git viene installato
automaticamente da `make setup` (eseguito dal devcontainer al primo avvio). Per
reinstallarlo manualmente dopo un clone:

```bash
cd packages/cup_check && uv run pre-commit install
```

Per eseguire i check su tutti i file senza fare un commit:

```bash
cd packages/cup_check && uv run pre-commit run --all-files
```

## Aggiornare il CHANGELOG

Prima di ogni release, generare un draft della sezione da aggiungere a `CHANGELOG.md` con:

```bash
make draft-changelog VERSION=0.x.y
```

Lo script legge la git history dall'ultimo tag e raggruppa i commit per tipo (feat, fix, …), escludendo merge e commit `chore(release)`/`docs(changelog)`. Rivedere e accorpare le voci prima di incollarle in cima al file.

In alternativa, per esplorare i commit non ancora rilasciati:

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges
```

## Messaggi di commit

Usare Conventional Commits con descrizioni in italiano. Il `type` resta quello standard in inglese (`feat`, `fix`, `docs`, ecc.):

```text
<type>(<scope>): <descrizione breve>
```

Regole:

- usare descrizioni brevi, in minuscolo, all'imperativo o forma verbale semplice;
- preferire scope utili quando chiariscono l'area (`web`, `docs`, `fixtures`, `ci`, `release`);
- non mettere il punto finale nella prima riga;
- se la modifica cambia comportamento utente, fixture o roadmap, aggiungere un body sintetico con il razionale;
- tenere commit piccoli e tematici: docs separati da codice quando possibile.

Type consigliati:

- `feat`: nuova funzionalità utente;
- `fix`: correzione bug;
- `docs`: documentazione;
- `test`: fixture o test;
- `chore`: manutenzione senza comportamento utente;
- `ci`: workflow GitHub Actions;
- `refactor`: riorganizzazione senza cambio funzionale;
- `build`: dipendenze o build tooling.

Esempi:

```text
docs: dividi la documentazione di progetto
chore: rimuovi placeholder python dal workspace
fix(web): stabilizza soglia di accettazione in ci
test(fixtures): aggiungi caso cup minuscolo
feat(web): aggiungi input cup incollato
```
