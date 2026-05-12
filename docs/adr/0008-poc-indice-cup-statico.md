# ADR 0008: Indice CUP SQLite Chunked per 0.3.0

## Status

Accepted

## Context

ADR 0007 ha riportato il lookup OpenCUP verso asset statici, senza Cloudflare Workers, D1 o
altri servizi server-side. Per arrivare rapidamente a una
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

`detail_chunk` è sempre `NULL` nella 0.3.0 e diventa il riferimento ai dettagli dalla 0.4.0.

La pipeline genera `cup-index.sqlite`, lo divide in `cup-index.sqlite.000`,
`cup-index.sqlite.001`, ecc. e pubblica i chunk sia nella release dataset sia nello spazio
statico GitHub Pages sotto `datasets/dataset-YYYY-MM/`. Il manifest usa la sezione
`cup_index` per descrivere base URL, file, dimensioni, SHA-256 dell'indice ricomposto e
SHA-256 dei singoli chunk.

La web app resta pinnata alle release software `v*` e recupera dinamicamente l'ultimo dataset
disponibile leggendo prima `dataset-latest.json` da GitHub Pages. Le GitHub Releases restano
archivio storico e fallback di discovery, ma il consumo browser operativo avviene da asset
statici Pages per evitare rate limit e vincoli CORS sugli asset release. Una nuova release
dataset può quindi ridistribuire GitHub Pages, ma solo ricostruendo la pagina dall'artefatto
immutabile dell'ultima release software `v*`, mai da `main`. Il browser scarica i chunk,
ricompone lo SQLite in memoria e interroga `cup_index` tramite `sql.js`. Se il dataset non è
disponibile, la verifica degrada a `FORMATO_VALIDO_DA_VERIFICARE`.

## Consequences

**Positivi:**

- Il lookup resta statico, senza backend applicativo.
- La pipeline conserva SQLite come formato semplice, ispezionabile e riusabile in Python.
- `detail_chunk` prepara il contratto per i dettagli 0.4.0 senza pubblicarli subito.
- La web app non richiede rebuild per scoprire un dataset più recente.
- Una release dataset aggiorna gli asset Pages del dataset senza promuovere codice web da HEAD.

**Negativi/Trade-off:**

- Il browser scarica e ricompone l'intero indice SQLite in memoria.
- `sql.js` introduce una dipendenza WASM nel frontend.
- Il workflow dataset dipende dall'artefatto web dell'ultima release `v*` o, in sua assenza,
  deve ricostruire la web app facendo checkout di quella stessa tag.
- Se GitHub Pages non espone `dataset-latest.json`, il lookup OpenCUP degrada al fallback
  GitHub Releases API per scoprire il tag dataset più recente; il `manifest_url` viene però
  costruito su GitHub Pages (non `browser_download_url`) per evitare blocchi CORS. In caso
  di rate limit o se il dataset non è ancora stato pubblicato su Pages, il lookup non viene
  applicato e gli esiti restano cautelativi.
