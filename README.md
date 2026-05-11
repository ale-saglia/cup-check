# cup-check

Nella rendicontazione di progetti pubblici, fondi PNRR e programmi finanziati, un CUP scritto male puo bloccare controlli, rallentare pratiche e generare correzioni costose. `cup-check` aiuta enti, consulenti e team tecnici a intercettare subito gli errori formali prima di caricare o condividere elenchi di Codici Unici di Progetto.

Verifica massiva e locale del formato dei Codici Unici di Progetto (CUP).

`cup-check` include una web app statica per controllare liste di CUP direttamente nel browser e una libreria Python importabile per usare lo stesso validatore in script, pipeline e applicazioni.

La verifica controlla il formato (regole `R0`-`R5`) e, quando il dataset OpenCUP statico e disponibile, la presenza del CUP nel mirror pubblicato. Se il dataset non e disponibile, un CUP formalmente valido resta `FORMATO_VALIDO_DA_VERIFICARE`.

## Stato

Il progetto e rilasciato come web app statica e package Python.

## Cosa Fa

- Valida CUP da file CSV e XLSX.
- Valida CUP incollati come testo, uno per riga.
- Verifica la presenza nel dataset OpenCUP statico quando il dataset e disponibile.
- Mostra risultati filtrabili per esito e testo.
- Esporta report CSV con esito riga per riga.
- Funziona offline dopo la prima visita.
- Espone una libreria Python installabile come `cup-check`.

## Privacy

File CSV/XLSX e testi incollati vengono elaborati localmente nel browser. L'app non carica i CUP, i file o i report su un backend applicativo.

La web app recupera il dataset OpenCUP statico come asset pubblico e cacheabile, senza servizi server-side applicativi. I file caricati dagli utenti e i report restano elaborati localmente.

## Limiti Del Controllo

Gli esiti possibili sono:

- `INVALIDO_FORMATO` — il CUP non rispetta le regole strutturali.
- `FORMATO_VALIDO_DA_VERIFICARE` — il CUP rispetta le regole strutturali, ma il dataset non e disponibile.
- `TROVATO_OPENCUP` — CUP presente nel mirror OpenCUP disponibile.
- `NON_TROVATO_OPENCUP_DA_VERIFICARE` — CUP non presente nel mirror OpenCUP disponibile; richiede verifica cautelativa.

Per attestare l'esistenza di un progetto resta necessario il Sistema CUP o il portale OpenCUP.

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

Esempio d'uso con lookup OpenCUP locale/cacheato:

```python
from cup_check import OpenCupChecker

with OpenCupChecker.from_latest(cache_dir=".cup-check-cache") as checker:
    result = checker.check("G17H03000130001")

print(result.outcome)
```

Oppure apri il repo in Dev Containers / Codespaces. Il container include Node.js 22,
npm, uv, make, ripgrep, GitHub CLI, Chromium e Lighthouse; al primo avvio esegue
`make setup`.

Comandi principali:

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

`make dataset-release-local` scarica il dump OpenCUP e genera `dist/dataset/` con manifest
e chunk SQLite per prove locali. Il download e grande: usalo solo quando serve rigenerare
il dataset.

`make web-preview-dataset` usa il dataset locale in `dist/dataset/`, lo copia nella build web
con URL relativi e avvia la preview statica. Serve per provare in Codespaces lo stesso
percorso same-origin usato da GitHub Pages.

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
