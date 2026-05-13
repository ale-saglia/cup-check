# ADR 0006: Dataset Lookup via Cloudflare Workers + D1

## Status

Superseded by [ADR 0007](0007-dataset-statico-indice-dettagli.md)

## Context

ADR 0005 ha stabilito che la web app leggesse il dataset OpenCUP tramite HTTP Range request e `sql.js-httpvfs` su file SQLite chunked ospitati su GitHub Releases.

Nell'implementare questa soluzione sono emersi tre vincoli non superabili:

1. **GitHub Releases non è una CDN.** Le URL delle release redirigono su S3 (`objects.githubusercontent.com`), rompendo il caching CDN e, in alcuni browser, le Range request stesse.
2. **GitHub Pages ha un limite di 100 MB per file.** Il DB SQLite supera già questa soglia e crescerà quando verranno introdotti i dettagli per la coerenza atto.
3. **Le Range request per batch multi-CUP non si accorciano.** Con `sql.js-httpvfs` ogni CUP richiede la traversata di un B-tree indipendente: un batch di N CUP genera O(N × profondità_albero) richieste HTTP, anche con query `IN (...)`.

Sono stati valutati approcci alternativi: file sorted a lunghezza fissa con binary search, Bloom filter su GitHub Pages, storage R2 con httpvfs. Tutti introducono compromessi (falsi positivi, latenza per batch grandi, complessità di build) che si aggravano quando il dataset acquisisce colonne aggiuntive e i controlli diventano semantici.

## Decision

Adottiamo **Cloudflare Workers + D1** come backend di lookup per la web app.

- **Cloudflare D1** ospita il dataset OpenCUP come database SQLite gestito.
- **Un Cloudflare Worker** espone un endpoint `POST /lookup` che accetta `{ cups: string[] }` e restituisce `{ [cup: string]: boolean }`.
- La web app invia **una sola fetch** con tutti i CUP unici e riceve i risultati in una risposta.
- La pipeline mensile carica il dataset aggiornato su D1 tramite Wrangler, in aggiunta alla pubblicazione dei chunk su GitHub Releases.

La libreria Python mantiene il suo percorso indipendente: continua a scaricare e cachare localmente i chunk SQLite senza dipendere dal Worker.

## Consequences

**Positivi:**

- Una sola richiesta HTTP per batch, indipendente dal numero di CUP.
- Nessun WASM nel browser, nessuna gestione chunking nel frontend.
- Il Worker è distribuito sulla CDN Cloudflare nativamente.
- Free tier D1 (5 GB, 5 M row reads/giorno) e Workers (100 K req/giorno) sufficienti per la scala attuale.

**Negativi/Trade-off:**

- Si introduce un componente backend. Il progetto non è più puramente statico sul lato web.
- La pipeline mensile deve aggiornare D1 oltre alle release GitHub.
- Il lookup offline non è disponibile; i risultati dell'ultima sessione possono essere tenuti in `sessionStorage`.
- Se il Worker non è raggiungibile, gli esiti degradano a `FORMATO_VALIDO_DA_VERIFICARE` come fallback esplicito.
