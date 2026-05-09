# cup-check

Verifica massiva e locale del formato dei Codici Unici di Progetto (CUP).

`cup-check` include una web app statica per controllare liste di CUP direttamente nel browser e una libreria Python importabile per usare lo stesso validatore in script, pipeline e applicazioni.

La verifica e solo formale: segnala se il codice rispetta le regole strutturali note con esito `FORMATO_VALIDO_DA_VERIFICARE`, ma non attesta l'esistenza nel Sistema CUP.

## Stato

Il progetto e rilasciato come web app statica e package Python.

## Cosa Fa

- Valida CUP da file CSV.
- Valida CUP da file XLSX.
- Valida CUP incollati come testo, uno per riga.
- Mostra risultati filtrabili.
- Esporta report CSV.
- Funziona offline dopo la prima visita.
- Espone una libreria Python installabile come `cup-check`.
- Non invia i dati a server esterni nell'MVP.

## Privacy

File CSV/XLSX e testi incollati vengono elaborati localmente nel browser. L'app
non carica i CUP, i file o i report su un backend applicativo, perche nell'MVP
non esiste un backend: il sito e composto da asset statici serviti da GitHub
Pages.

Il caricamento iniziale dell'app scarica soltanto questi asset statici. I link
esterni, come OpenCUP o il repository GitHub, sono normali collegamenti aperti
solo su azione dell'utente e distinti dalla validazione locale.

## Limiti Del Controllo

Gli unici esiti della verifica formale sono:

- `INVALIDO_FORMATO`
- `FORMATO_VALIDO_DA_VERIFICARE`

Un CUP formalmente valido resta `FORMATO_VALIDO_DA_VERIFICARE` e non viene dichiarato esistente. Per attestare l'esistenza serve una fonte autoritativa o, da una versione futura, un dataset OpenCUP esatto e dichiarato nel perimetro.

## Quickstart sviluppo

```bash
cd packages/web
npm install
npm run dev
```

Per la libreria Python:

```bash
cd packages/cup_check
uv sync --dev
uv run pytest
```

Oppure apri il repo in Dev Containers / Codespaces. Il container include Node.js 22,
npm, uv, make, ripgrep, Chromium e Lighthouse; al primo avvio esegue `make setup`.

Comandi principali:

```bash
make help
make check
make release-check
make python-build
make web-dev
make web-preview
```

`make release-check` aggiunge alle verifiche veloci un test browser con upload XLSX
da 10.000 righe, reload offline PWA e controllo Lighthouse con soglie MVP.

## Regole MVP

Un CUP e `FORMATO_VALIDO_DA_VERIFICARE` solo se, dopo `trim`:

- ha 15 caratteri;
- contiene solo lettere maiuscole e cifre;
- il primo carattere e una lettera;
- le posizioni 5-6 rappresentano un anno a due cifre non futuro;
- il quarto carattere e una lettera.

In tutti gli altri casi l'esito e `INVALIDO_FORMATO`.

I fixture in `tests/fixtures/*.yaml` sono la specifica funzionale del validatore.

## Struttura

- `tests/fixtures/`: specifica funzionale YAML condivisa.
- `packages/web/`: web app Vite vanilla JS.
- `packages/cup_check/`: libreria Python pubblicata come `cup-check`.
- `docs/`: documentazione di progetto, architettura, roadmap, fonti dati e governance.
- `.github/workflows/`: CI, deploy Pages e publish PyPI su release.

## Documentazione

- [Progetto](docs/project.md)
- [Product](docs/product.md)
- [MVP 0.1.0](docs/mvp.md)
- [Architettura](docs/architecture.md)
- [Specifiche tecniche](docs/technical-spec.md)
- [Roadmap](docs/roadmap.md)
- [Fonti dati](docs/data-sources.md)
- [Governance](docs/governance.md)
- [Parity](docs/parity.md)
- [Glossario](docs/glossary.md)
- [ADR](docs/adr/)

## Licenza

EUPL-1.2. Vedi `LICENSE`.
