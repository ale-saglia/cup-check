# ADR 0007: Dataset Statico con Indice CUP e Dettagli Chunked

## Status

Accepted

## Context

ADR 0006 aveva introdotto Cloudflare Workers + D1 per evitare il costo di lettura del database SQLite da browser tramite Range request.

La direzione di prodotto resta però quella di una web app statica, deployabile su GitHub Pages e senza servizi server-side nell'MVP esteso. Il Worker potrà essere rivalutato più avanti per eventuali API MEF/Sogei autoritative, ma non deve essere necessario per il lookup OpenCUP self-hosted.

La milestone di coerenza atto richiede inoltre dati più ricchi del solo CUP. Scaricare sempre un database completo con stato, natura, soggetti, importi e descrizioni sarebbe troppo costoso per il browser. Serve quindi distinguere il dato minimo per l'esistenza dal dato completo per i controlli di coerenza. Questa milestone è stata spostata dopo la `0.4.0`, che ora è dedicata all'estrazione CUP da PDF.

Un vincolo di prodotto e governance è non introdurre una dipendenza operativa da provider esterni aggiuntivi per la funzionalità core. GitHub è già parte della catena di rilascio del progetto; aggiungere Cloudflare, Turso, R2, Supabase, HuggingFace Datasets o servizi simili implicherebbe account, quote, policy, credenziali, possibili costi futuri e un nuovo punto di failure fuori dal controllo del repository.

Sono state considerate soluzioni gratuite o con free tier, ma nessuna risolve in modo adeguato il problema senza introdurre un compromesso rilevante:

- **Cloudflare Workers + D1**: ottimo per lookup batch, ma introduce backend, deploy dedicato, credenziali e dipendenza da quote free tier.
- **Cloudflare R2 o object storage analoghi**: utili come storage statico, ma aggiungono comunque un provider e non eliminano la necessità di progettare indice, cache e chunking.
- **Turso/Supabase o database serverless simili**: semplificano le query, ma trasformano il lookup OpenCUP in servizio remoto con limiti, autenticazione e gestione operativa.
- **HuggingFace Datasets o mirror dati esterni**: adatti alla distribuzione di dataset, ma meno coerenti con il flusso release del progetto e con garanzie di compatibilità software/dataset dichiarate nel manifest.
- **Bloom filter o strutture probabilistiche**: riducono molto il peso, ma non possono essere fonte primaria di esiti utente perché ammettono falsi positivi.

## Decision

Adottiamo un dataset statico pubblicato su GitHub Releases e composto da due livelli:

- **indice CUP**: contiene tutti i CUP del mirror OpenCUP e un riferimento al chunk dettagli che contiene il record completo;
- **dataset dettagli**: contiene i campi necessari ai controlli di coerenza e viene diviso in shard scaricabili separatamente.

Nella `0.3.0` la web app scarica e cacha l'indice CUP per produrre esiti di presenza nel perimetro OpenCUP. Nella futura milestone di coerenza atto scarica i chunk dettagli solo per i CUP caricati dall'utente e solo quando servono controlli sostanziali.

Il manifest dataset descrive entrambi i livelli: tag, snapshot fonte, versione schema, file, dimensioni, hash, numero record e compatibilità minima software.

Non introduciamo Cloudflare D1, Workers o altri servizi backend per il lookup OpenCUP self-hosted.

## Consequences

**Positivi:**

- La web app resta statica e deployabile su GitHub Pages.
- Web e Python consumano gli stessi asset dataset e lo stesso manifest.
- L'indice consente lookup esatto senza strutture probabilistiche.
- La milestone di coerenza atto può scaricare solo i dettagli necessari ai CUP richiesti.
- Il Worker resta disponibile come opzione futura per API autoritative, non come dipendenza del dataset OpenCUP.

**Negativi/Trade-off:**

- Il primo lookup può richiedere il download dell'indice CUP completo.
- La web app deve gestire cache, versionamento e fallimenti di download del dataset.
- GitHub Releases diventa parte critica della distribuzione dati; se limiti di bandwidth o affidabilità diventassero un problema, sarà necessario valutare uno storage statico alternativo mantenendo lo stesso contratto di manifest.
- Il formato concreto dell'indice va scelto con una PoC misurando dimensioni, tempo di download, tempo di lookup e consumo memoria su browser comuni.
