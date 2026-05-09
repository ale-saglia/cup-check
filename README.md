# cup-check

Nella rendicontazione di progetti pubblici, fondi PNRR e programmi finanziati, un CUP scritto male puo bloccare controlli, rallentare pratiche e generare correzioni costose. `cup-check` aiuta enti, consulenti e team tecnici a intercettare subito gli errori formali prima di caricare o condividere elenchi di Codici Unici di Progetto.

Verifica massiva e locale del formato dei Codici Unici di Progetto (CUP).

`cup-check` include una web app statica per controllare liste di CUP direttamente nel browser e una libreria Python importabile per usare lo stesso validatore in script, pipeline e applicazioni.

La verifica ha due livelli: controllo formale del formato (regole `R0`–`R5`) e verifica di esistenza nel dataset OpenCUP pubblicato. Un CUP formalmente valido e presente nel dataset riceve esito `TROVATO`; se assente, `NON_TROVATO`. Il dataset viene scaricato in background da GitHub Pages alla prima visita e cachato offline dal service worker.

## Stato

Il progetto e rilasciato come web app statica e package Python.

## Cosa Fa

- Valida CUP da file CSV e XLSX.
- Valida CUP incollati come testo, uno per riga.
- Verifica l'esistenza di ogni CUP nel dataset OpenCUP (`TROVATO` / `NON_TROVATO`).
- Scarica il dataset (~246 MB) in background e lo cacha per le visite successive.
- Mostra risultati filtrabili per esito e testo.
- Esporta report CSV con esito riga per riga.
- Funziona offline dopo la prima visita.
- Espone una libreria Python installabile come `cup-check`.

## Privacy

File CSV/XLSX e testi incollati vengono elaborati localmente nel browser. L'app non carica i CUP, i file o i report su un backend applicativo.

Alla prima visita il browser scarica anche il dataset OpenCUP (~246 MB) da GitHub Pages per consentire la verifica di esistenza. Il dataset e pubblico e non contiene dati personali degli utenti. Dopo il download iniziale il service worker lo serve dalla cache locale, senza ulteriori richieste di rete.

## Limiti Del Controllo

Gli esiti possibili sono:

- `INVALIDO_FORMATO` — il CUP non rispetta le regole strutturali.
- `TROVATO` — formato valido e presente nel dataset OpenCUP incluso in questa versione.
- `NON_TROVATO` — formato valido ma assente dal dataset. Il CUP potrebbe esistere in progetti non ancora pubblicati o aggiornati nel dataset.
- `FORMATO_VALIDO_DA_VERIFICARE` — formato valido, dataset non ancora scaricato.

Il dataset e un'istantanea pubblica di OpenCUP, non una fonte autoritativa in tempo reale. Per attestare l'esistenza di un progetto resta necessario il Sistema CUP o il portale OpenCUP.

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
npm, uv, make, ripgrep, GitHub CLI, Chromium e Lighthouse; al primo avvio esegue
`make setup`.

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
