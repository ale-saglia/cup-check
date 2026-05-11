# ADR 0008: PoC Indice CUP Statico per 0.3.0

## Status

Accepted

## Context

ADR 0007 ha riportato il lookup OpenCUP verso asset statici pubblicati su GitHub Releases,
senza Cloudflare Workers, D1 o altri servizi server-side. Prima di integrare il lookup nella
web app e nella libreria Python serve scegliere un formato di indice CUP esatto con misure su
dataset reale, per evitare di fissare troppo presto un contratto costoso da cambiare.

La 0.3.0 introduce solo la verifica di presenza nel perimetro OpenCUP. I dettagli sostanziali
per controlli su soggetti, importi, stato e descrizione restano fuori scope e vengono rinviati
alla 0.4.0 tramite `detail_store`.

## Decision

La prima iterazione della 0.3.0 e una PoC misurabile dell'indice CUP statico. La PoC deve
confrontare almeno:

- lista CUP ordinata e compressa;
- shard alfabetici o per prefisso;
- SQLite usato solo come formato build-side, non letto dal browser tramite Range request.

Ogni alternativa deve produrre un indice esatto, pubblicabile come asset GitHub Release e
descritto da `dataset-manifest.json` tramite una sezione `cup_index`. Non sono ammessi Bloom
filter o strutture probabilistiche come fonte primaria di esiti utente.

## Misure Richieste

Per ogni alternativa vanno registrati:

- dimensione non compressa e compressa;
- tempo di download o caricamento iniziale nel browser;
- memoria usata nel browser dopo il caricamento;
- tempo di lookup su batch piccoli e grandi;
- semplicita di consumo dalla libreria Python.

La PoC decide il formato minimo da stabilizzare prima di introdurre gli esiti
`TROVATO_OPENCUP` e `NON_TROVATO_OPENCUP_DA_VERIFICARE` nell'interfaccia utente.

## Consequences

La web app resta formato-only finche l'indice statico non e scelto e integrato. Il repository
non contiene codice operativo Cloudflare; ADR 0006 resta solo come decisione storica
superseded.
