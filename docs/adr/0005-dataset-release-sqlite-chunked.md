# ADR 0005: Dataset OpenCUP Come Release SQLite Chunked

## Status

Superseded by [ADR 0007](0007-dataset-statico-indice-dettagli.md)

## Context

La milestone `0.3.0` introduce una verifica su dataset OpenCUP self-hosted. La web app deve restare statica e deployabile su GitHub Pages; la libreria Python deve poter funzionare senza servizi server-side del progetto.

Il dataset completo puo diventare troppo grande per essere tenuto nel repository o scaricato sempre come singolo file. Serve anche un contratto stabile tra pipeline, web app e libreria Python.

## Decision

Pubblichiamo il dataset OpenCUP come release separata con tag `dataset-YYYY-MM`.

Ogni release dataset contiene:

- uno SQLite logico con tabella primaria `cups` e `WITHOUT ROWID`;
- chunk binari `cups.sqlite.000`, `cups.sqlite.001`, ecc.;
- un `dataset-manifest.json` con schema, tag dataset, snapshot fonte, lista chunk, dimensioni, hash SHA-256 complessivo, numero record e versione software minima.

La web app leggera il dataset via HTTP Range request e `sql.js-httpvfs`. La libreria Python scarichera e cachera i chunk localmente, ricomponendo il file SQLite per interrogazioni con `sqlite3` stdlib.

Il software non includera asset dataset nel repository. La release software e la release dataset restano versionate separatamente: il manifest dichiara la compatibilita minima, mentre il software decide se accettare o rifiutare manifest non compatibili.

## Build strategy

La tabella `cups` viene creata direttamente come `WITHOUT ROWID` con `PRIMARY KEY`. I record vengono inseriti con `INSERT OR IGNORE`: i duplicati vengono scartati silenziosamente e il loro conteggio e ricavato come `total_records - n_records`.

I duplicati nel bulk OpenCUP sono un caso limite; per ora non e necessaria una logica di selezione piu fine.

Nella milestone `0.4.0`, quando la tabella `cups` accogliera colonne aggiuntive (es. stato, data aggiornamento), la strategia di deduplicazione diventera `ON CONFLICT(cup) DO UPDATE SET ... WHERE excluded.updated_on > cups.updated_on`, mantenendo il record piu recente senza richiedere una tabella temporanea.

## Consequences

La web app resta statica e non introduce servizi server-side.

GitHub Releases diventa il canale primario di distribuzione dataset. Se dimensioni, bandwidth o limiti operativi diventassero insufficienti, storage esterni potranno essere valutati senza cambiare il contratto del manifest.

Gli esiti di esistenza OpenCUP saranno introdotti solo nel checker dataset, non nel validatore formale. Un CUP non trovato nel mirror OpenCUP dovra restare un esito cautelativo perche il perimetro pubblicato puo essere incompleto.
