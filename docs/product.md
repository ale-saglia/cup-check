# Product

## Sintesi

`cup-check` verifica liste di CUP in modo locale, auditabile e a costo operativo zero.

Il progetto offre una web app statica e una libreria Python importabile, pubblicata su PyPI come `cup-check`, pensata per integrazione in sistemi gestionali e pipeline applicative.

## Contesto

Nella PA italiana il CUP e un identificatore obbligatorio per gli atti di finanziamento o autorizzazione di investimenti pubblici. La verifica manuale di liste di CUP e frequente in rendicontazione, controllo e monitoraggio, ma il lookup puntuale tramite portale OpenCUP e oneroso.

`cup-check` nasce per offrire uno strumento leggero che aiuti funzionari e tecnici a individuare rapidamente errori formali prima di successive verifiche manuali o autoritative.

L'evoluzione prevista e incrementale: nelle prime milestone il prodotto risponde alla domanda "questo CUP ha un formato corretto ed e presente nel perimetro dati disponibile?". In una milestone successiva diventa anche uno strumento di coerenza dell'atto, cioe aiuta a rispondere alla domanda "questo CUP, questa P.IVA/CF, questo importo e questa descrizione sembrano riferirsi allo stesso progetto?". Questa seconda domanda intercetta errori piu costosi, come inversioni di CUP tra righe o progetti durante copia-incolla e rendicontazioni.

## Stakeholder

- Funzionari PA che gestiscono atti contenenti CUP.
- Strutture di monitoraggio regionale e centrale.
- Soggetti attuatori, in particolare su flussi PNRR.
- Tecnici che costruiscono controlli qualita su flussi documentali.

## Obiettivi

- Verificare in batch la correttezza formale di almeno 10.000 CUP.
- Offrire una web app interattiva e una libreria Python importabile.
- Produrre report esportabili con esito riga per riga.
- Restare offline-first dopo la prima visita.
- Da `0.3.0`, verificare l'esistenza nel perimetro pubblicato da OpenCUP tramite dataset esatto self-hosted.
- Da `0.4.0`, segnalare possibili incoerenze tra CUP e dati associati nell'atto, come soggetto titolare/beneficiario, importo e descrizione progetto.
- In una milestone successiva, valutare verifica puntuale tramite fonte autoritativa/API.

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

- Proporzionalita: nessuna tecnologia senza un problema specifico.
- Onesta sui limiti: UI e API devono dichiarare cosa e cosa non viene verificato.
- Asimmetria di rischio: i falsi positivi sono peggio dei falsi negativi cautelativi.
- Cautela sui controlli sostanziali: le discrepanze tra atto e dataset sono sempre "da verificare", mai giudizi automatici di incoerenza definitiva.
- Stack appropriato: JavaScript minimale nel browser, Python dove serve integrazione o pipeline.
- Degradazione graceful: se una fonte esterna fallisce, il check locale resta disponibile.
