# Product

## Sintesi

`cup-check` verifica liste di CUP in modo locale, auditabile e a costo operativo zero.

Il progetto offre una web app statica e una libreria Python importabile, pubblicata su PyPI come `cup-check`, pensata per integrazione in sistemi gestionali e pipeline applicative.

## Contesto

Nella PA italiana il CUP è un identificatore obbligatorio per gli atti di finanziamento o autorizzazione di investimenti pubblici. La verifica manuale di liste di CUP è frequente in rendicontazione, controllo e monitoraggio, ma il lookup puntuale tramite portale OpenCUP è oneroso.

`cup-check` nasce per offrire uno strumento leggero che aiuti funzionari e tecnici a individuare rapidamente errori formali prima di successive verifiche manuali o autoritative.

L'evoluzione è incrementale: nelle prime milestone il prodotto risponde alla domanda "questo CUP ha un formato corretto ed è presente nel perimetro dati disponibile?". Da `0.4.0` riduce anche l'attrito a monte, estraendo CUP da fatture PDF e documenti simili prima di passarli al verificatore. Da `0.5.0` amplia il perimetro documentale aggiungendo le fatture elettroniche XML FatturaPA, l'import multi-file con tracciabilità dell'origine e la validazione batch di oltre 100.000 righe tramite Web Worker. Da `0.6.0` diventa anche uno strumento di coerenza dell'atto, cioè aiuta a rispondere alla domanda "questo CUP, questa P.IVA/CF, questo importo e questa descrizione sembrano riferirsi allo stesso progetto?". Questa seconda domanda intercetta errori più costosi, come inversioni di CUP tra righe o progetti durante copia-incolla e rendicontazioni. Le funzioni avanzate sono rilasciate come tool separati nel registro strumenti, attivabili indipendentemente dal verificatore principale.

## Stakeholder

- Funzionari PA che gestiscono atti contenenti CUP.
- Strutture di monitoraggio regionale e centrale.
- Soggetti attuatori, in particolare su flussi PNRR.
- Tecnici che costruiscono controlli qualità su flussi documentali.

## Obiettivi

- Verificare in batch la correttezza formale di almeno 10.000 CUP.
- Offrire una web app interattiva e una libreria Python importabile.
- Produrre report esportabili con esito riga per riga o raggruppato per CUP.
- Restare offline-first dopo la prima visita.
- Da `0.3.0`, verificare l'esistenza nel perimetro pubblicato da OpenCUP tramite dataset esatto self-hosted.
- Da `0.4.0`, estrarre CUP da fatture PDF in modo locale, con testo nativo quando disponibile e OCR italiano come fallback per documenti scansionati.
- Da `0.5.0`, estrarre CUP da fatture elettroniche XML FatturaPA; importare più file CSV/XLSX contemporaneamente con tracciabilità dell'origine (file, scheda, riga, colonna); validare batch di oltre 100.000 righe tramite Web Worker dedicato senza bloccare la UI.
- Da `0.6.0`, segnalare possibili incoerenze tra CUP e dati associati nell'atto, come soggetto titolare/beneficiario, importo e descrizione progetto.
- Da `0.7.0`, offrire una CLI Python (`cup-check`) per uso in script e pipeline CI.
- Da `0.9.0`, supportare verifica remota opzionale tramite Cloudflare Worker (web app) o credenziali BYOK (package Python), senza introdurre segreti nel frontend.

## Vincoli

1. Costo operativo a regime: 0 euro/mese.
2. Nessuna infrastruttura server-side nell'MVP.
3. Frontend web servito esclusivamente da GitHub Pages.
4. Codice, configurazione e fixture nel repo pubblico.
5. Nessun esito di verifica esistenza senza fonte autoritativa o dataset esatto.
6. Nessuna struttura probabilistica come fonte primaria di esiti utente.
7. Fixture YAML come specifica funzionale.
8. Release software e release dataset indipendenti.

## Principi

Vedi [Governance](governance.md#principi).
