# ADR 0008: Indice CUP SQLite Chunked per 0.3.0

## Status

Accepted

## Context

ADR 0007 ha riportato il lookup OpenCUP verso asset statici pubblicati su GitHub Releases,
senza Cloudflare Workers, D1 o altri servizi server-side. Per arrivare rapidamente a una
prima 0.3.0 funzionante scegliamo un formato esplicito e misurabile, rinviando eventuali
ottimizzazioni successive a dati reali di download, memoria e lookup.

La 0.3.0 introduce solo la verifica di presenza nel perimetro OpenCUP. I dettagli sostanziali
per controlli su soggetti, importi, stato e descrizione restano fuori scope e vengono rinviati
alla 0.4.0 tramite `detail_store`.

## Decision

La 0.3.0 pubblica un indice SQLite statico e chunked:

```sql
CREATE TABLE cup_index (
  cup TEXT PRIMARY KEY,
  detail_chunk INTEGER
) WITHOUT ROWID;
```

`detail_chunk` e sempre `NULL` nella 0.3.0 e diventa il riferimento ai dettagli dalla 0.4.0.

La pipeline genera `cup-index.sqlite`, lo divide in `cup-index.sqlite.000`,
`cup-index.sqlite.001`, ecc. e pubblica i chunk su GitHub Releases insieme a
`dataset-manifest.json`. Il manifest usa la sezione `cup_index` per descrivere base URL,
file, dimensioni e SHA-256 dell'indice ricomposto.

La web app resta pinnata alle release software `v*` e recupera dinamicamente l'ultimo dataset
disponibile dalle GitHub Releases. `dataset-latest.json` resta pubblicato come asset dataset
e puo essere usato come fallback statico, ma una nuova release dataset non ridistribuisce
GitHub Pages. Il browser scarica i chunk, ricompone lo SQLite in memoria e interroga
`cup_index` tramite `sql.js`. Se il dataset non e disponibile, la verifica degrada a
`FORMATO_VALIDO_DA_VERIFICARE`.

## Consequences

**Positivi:**

- Il lookup resta statico, senza backend applicativo.
- La pipeline conserva SQLite come formato semplice, ispezionabile e riusabile in Python.
- `detail_chunk` prepara il contratto per i dettagli 0.4.0 senza pubblicarli subito.
- La web app non richiede rebuild per scoprire un dataset piu recente.
- Una release dataset non modifica il sito pubblicato, che resta legato ai tag `v*`.

**Negativi/Trade-off:**

- Il browser scarica e ricompone l'intero indice SQLite in memoria.
- `sql.js` introduce una dipendenza WASM nel frontend.
- Se GitHub Releases non e raggiungibile, il lookup OpenCUP usa `dataset-latest.json` solo se
  disponibile nella build pinnata; altrimenti non viene applicato e gli esiti restano cautelativi.
