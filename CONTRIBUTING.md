# Contribuire

`cup-check` è un progetto open source orientato a controlli cautelativi sui CUP. I contributi sono benvenuti quando restano coerenti con i vincoli del progetto: web app statica, nessun servizio server-side nell'MVP, regole auditabili e separazione tra validazione formale e lookup OpenCUP.

## Contatti

Per maintainer, contributori passati e processo di riconoscimento vedi [CONTRIBUTORS.md](CONTRIBUTORS.md).

Canali di contatto:

- per bug, proposte e dubbi apri una issue nel repository, collegando eventuali contesti o fixture utili;
- per PR pronte alla review menziona `@ale-saglia` o richiedi review dalla PR;
- per vulnerabilità o segnalazioni non pubbliche usa GitHub Security Advisories, come indicato in `SECURITY.md`.

## Prima Di Aprire Una PR

- Apri una issue o commenta una issue esistente per modifiche funzionali, cambi di semantica, nuove fonti dati o interventi con impatto sulla roadmap.
- Per correzioni piccole di documentazione o refusi puoi aprire direttamente una PR.
- Leggi la documentazione pertinente in `docs/`, in particolare `docs/product.md`, `docs/architecture.md`, `docs/technical-spec.md` e `docs/roadmap.md`.

## Regola Fixture-First

I file in `tests/fixtures/*.yaml` sono la specifica funzionale condivisa tra web e Python.

Se una modifica cambia il comportamento del validatore formale:

1. aggiorna o aggiungi prima il fixture YAML;
2. implementa la modifica nel codice;
3. verifica che web e Python restino allineati sugli stessi casi.

Nel validatore formale gli unici outcome ammessi restano:

- `INVALIDO_FORMATO`
- `FORMATO_VALIDO_DA_VERIFICARE`

Gli esiti di presenza OpenCUP appartengono al lookup dataset e non devono essere introdotti nel validatore formale.

## Vincoli Di Progetto

- La web app deve restare statica e deployabile su GitHub Pages.
- Non aggiungere servizi server-side per il lookup.
- Non introdurre strutture probabilistiche come fonte primaria di esiti utente.
- Mantieni separati release software e release dataset.
- Preferisci modifiche piccole, verificabili e coerenti con la roadmap.

## Comandi Di Verifica

Dalla root del repository:

```bash
make check
```

## Hook Pre-Commit

Gli hook locali eseguono Ruff sul package Python, Prettier su web e fixture,
`end-of-file-fixer`, `trailing-whitespace` e `check-yaml` sui fixture YAML.

Installa prima le dipendenze del progetto:

```bash
make setup
```

Poi installa `pre-commit` e registra gli hook:

```bash
uv tool install pre-commit
pre-commit install
```

Per verificare tutto il repository manualmente:

```bash
pre-commit run --all-files
```

Per il package Python:

```bash
cd packages/cup_check
uv run pytest
```

Per la web app:

```bash
cd packages/web
npm test
```

Se le dipendenze Python non sono installate:

```bash
cd packages/cup_check
uv sync --dev
```

## Stile Dei Commit

Usa Conventional Commits con descrizioni in italiano:

```text
<type>(<scope>): <descrizione breve>
```

Esempi:

```text
docs: aggiungi guida utente
test(fixtures): aggiungi caso cup minuscolo
fix(web): correggi esportazione risultati aggregati
```

## Checklist PR

- La modifica è coerente con roadmap e ADR esistenti.
- I fixture sono aggiornati prima del codice, se cambia il comportamento.
- I test pertinenti sono stati eseguiti o il motivo della mancata esecuzione è indicato nella PR.
- La documentazione utente o tecnica è aggiornata quando cambia il comportamento osservabile.
