# ADR 0010: skipWaiting incondizionato nel service worker

## Status

Accepted

## Context

Il service worker chiama `self.skipWaiting()` durante l'evento `install` e `self.clients.claim()` durante `activate`. Questa combinazione forza l'attivazione immediata del nuovo SW, anche se ci sono tab aperti con la versione precedente.

La scelta è aggressiva per definizione: ogni aggiornamento del SW entra in vigore nella sessione corrente senza attendere la chiusura di tutti i tab. In molte applicazioni con backend stateful questo può causare inconsistenze — ad esempio se il SW modifica la strategia di cache o le intestazioni delle richieste API mentre una sessione è in corso.

**Perché è sicura ora.** L'app è interamente local-first e statica:

- Le risorse dell'app shell sono versionate per URL (`CACHE_NAME` include `__APP_VERSION__` e `__BUILD_ID__`); le risorse pre-cachate di una versione non entrano mai in conflitto con quelle di un'altra.
- Il dataset è statico (GitHub Releases), indirizzato per tag di rilascio (`dataset-2024-01`, ecc.) e invalidato per hash SHA-256 in `dataset-loader.ts`. Una nuova versione del SW non modifica il comportamento delle richieste al dataset.
- Non esiste nessun backend applicativo con sessioni, token, o versioning di API. Non ci sono richieste non-idempotenti che un aggiornamento del SW potrebbe interrompere.

In questo contesto `skipWaiting` garantisce che l'utente riceva sempre la versione aggiornata dell'app al prossimo caricamento, senza attendere la chiusura manuale di tutti i tab.

**Cosa cambia alla milestone 0.9.0.** L'ADR 0006 introduce Cloudflare Workers + D1 come backend per le query sull'indice CUP. Quando questo backend sarà attivo:

- Le richieste al worker avranno una forma definita (path, parametri, formato risposta).
- Se una futura versione del SW modifica queste richieste (es. nuovi header, path rinominati, formato risposta v2) e si attiva in una sessione già aperta, la tab potrebbe trovarsi in uno stato inconsistente tra la logica applicativa caricata e il comportamento del SW aggiornato.

## Decision

`skipWaiting()` rimane **incondizionato** fino alla milestone `0.9.0`.

La precondizione che rende la scelta sicura — tutte le risorse remote sono immutabili o versionate per URL, nessun backend stateful — deve essere verificata prima di aggiungere il supporto Cloudflare Workers. Se quella milestone introduce richieste con stato di sessione o contratti API non versionati per URL, la strategia di aggiornamento del SW va rivista prima del deploy.

Le opzioni da valutare a quel punto sono:

- **`skipWaiting` condizionale**: attiva il nuovo SW solo se non ci sono tab attivi (pattern comune per app con backend).
- **Canale `BroadcastChannel` + UI**: notifica all'utente che è disponibile un aggiornamento e lascia che sia lui ad attivarlo (`postMessage({ type: 'SKIP_WAITING' })`).
- **Mantenere `skipWaiting` incondizionato** se il backend Cloudflare è progettato con versioning per URL (es. `/v1/query`, `/v2/query`) e il SW non introduce state tra richieste.

## Consequences

**Positivi (ora):**

- Gli utenti ricevono sempre la versione aggiornata dell'app senza dover chiudere e riaprire i tab.
- La gestione della cache è semplice: ogni versione del SW porta la propria `CACHE_NAME` e pulisce le versioni precedenti in `activateCaches()`.
- Non serve un'UI di "aggiornamento disponibile" né logica di coordinamento tra tab.

**Negativi/Trade-off:**

- La scelta è invisibile nel codice senza questo documento: un lettore potrebbe rimuovere `skipWaiting()` per "prudenza" senza sapere che è stata una scelta deliberata.
- Alla milestone `0.9.0` la scelta va rivalutata esplicitamente; se dimenticata, il rischio di inconsistenze aumenta in modo silenzioso.

## Alternative scartate

**`skipWaiting` rimosso ora**: l'aggiornamento entrerebbe in vigore solo dopo che tutti i tab sono chiusi. Peggiora l'esperienza utente senza alcun beneficio concreto nell'architettura attuale.

**UI "Aggiorna"**: introduce complessità (canale `BroadcastChannel`, stato UI, test) giustificata solo quando un aggiornamento del SW può davvero rompere una sessione in corso — condizione che non si verifica oggi.
