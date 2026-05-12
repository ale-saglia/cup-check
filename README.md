# cup-check

> Local-first support tool for checking Italian public project codes (CUP) before administrative reporting, with static OpenCUP lookup and a Python library.

**[Web app](https://ale-saglia.github.io/cup-check/)** · [Python package](https://pypi.org/project/cup-check/) · [Documentazione](docs/product.md)

![cup-check — web app](screenshot.png)

Nella rendicontazione di progetti pubblici, fondi PNRR e programmi finanziati, un CUP scritto male puo bloccare controlli, rallentare pratiche e generare correzioni costose. Verificare manualmente centinaia o migliaia di codici prima di una trasmissione ufficiale e un'attivita ripetitiva, lenta e soggetta a errore.

`cup-check` nasce per ridurre questo attrito operativo: aiuta funzionari, consulenti e team tecnici a controllare in batch liste di CUP prima di rendicontazioni, caricamenti o verifiche amministrative, intercettando rapidamente errori formali e assenze dal perimetro OpenCUP disponibile.

Il progetto mantiene una postura cautelativa: distingue il formato valido dalla verifica di esistenza, usa un dataset OpenCUP statico e versionato quando disponibile, e non presenta mai il risultato come certificazione autoritativa.

`cup-check` include una web app statica per controllare liste di CUP direttamente nel browser e una libreria Python importabile per usare lo stesso validatore in script, pipeline e applicazioni. La verifica controlla il formato (regole `R0`-`R5`) e, quando il dataset OpenCUP statico e disponibile, la presenza del CUP nel mirror pubblicato. Se il dataset non e disponibile, un CUP formalmente valido resta `FORMATO_VALIDO_DA_VERIFICARE`.

## English Abstract

`cup-check` is an open source, local-first tool for checking Italian CUP codes used in public investment projects before administrative reporting, uploads or downstream validation. It helps public administrations and technical teams review large CUP lists, find format errors and compare codes with a static OpenCUP mirror.

The project is designed for zero operational cost, browser-side processing, auditable rules and cautious outcomes. It is not an authoritative certification service: final existence checks still belong to the official CUP/OpenCUP channels.

## Stato

Il progetto e rilasciato come web app statica e package Python.

## Cosa Fa

- Valida CUP da file CSV e XLSX.
- Valida CUP incollati come testo, uno per riga.
- Verifica la presenza nel dataset OpenCUP statico quando il dataset e disponibile.
- Mostra risultati filtrabili per esito e testo.
- Mostra ed esporta i risultati raggruppati per CUP o riga per riga.
- Funziona offline dopo la prima visita.
- Espone una libreria Python installabile come `cup-check`.

## Privacy

File CSV/XLSX e testi incollati vengono elaborati localmente nel browser. L'app non carica i CUP, i file o i report su un backend applicativo.

La web app recupera il dataset OpenCUP statico come asset pubblico e cacheabile, senza servizi server-side applicativi. I file caricati dagli utenti e i report restano elaborati localmente.

## Contesto PA E Open Source

Il progetto e rilasciato con licenza EUPL-1.2 ed e strutturato per essere valutabile in contesti di adozione, integrazione o condivisione nella Pubblica Amministrazione, in coerenza con i principi delle Linee guida AGID su acquisizione e riuso del software.

`cup-check` non e un servizio ufficiale ne una fonte autoritativa: fornisce controlli locali, auditabili e cautelativi a supporto dei processi amministrativi.

## Limiti Del Controllo

`cup-check` e in fase di sviluppo: puo contenere errori, bug o interpretazioni
incomplete delle regole. I risultati sono un supporto operativo, non una
certificazione.

La verifica OpenCUP usa una banca dati generata mensilmente: potrebbe non
includere gli ultimi CUP emessi, CUP non ancora pubblicati o record aggiornati
dopo l'ultimo snapshot.

Gli esiti possibili sono:

- `INVALIDO_FORMATO` — il CUP non rispetta le regole strutturali.
- `FORMATO_VALIDO_DA_VERIFICARE` — il CUP rispetta le regole strutturali, ma il dataset non e disponibile.
- `TROVATO_OPENCUP` — CUP presente nel mirror OpenCUP disponibile.
- `NON_TROVATO_OPENCUP_DA_VERIFICARE` — CUP non presente nel mirror OpenCUP disponibile; richiede verifica cautelativa e potrebbe comunque esistere.

Per attestare l'esistenza di un progetto resta necessario il Sistema CUP o il portale OpenCUP.

## Documentazione

- [Guida utente](docs/user-guide.md)
- [Sviluppo](docs/development.md)
- [Product](docs/product.md)
- [Architettura](docs/architecture.md)
- [Specifiche tecniche](docs/technical-spec.md)
- [Roadmap](docs/roadmap.md)
- [Fonti dati](docs/data-sources.md)
- [Governance](docs/governance.md)
- [Glossario](docs/glossary.md)
- [ADR](docs/adr/)

## Contribuire

Il progetto accetta contributi coerenti con la roadmap e con i vincoli di governance. Vedi [CONTRIBUTING.md](CONTRIBUTING.md) per processo, convenzioni e regola fixture-first.

## Licenza

EUPL-1.2. Vedi `LICENSE`.
