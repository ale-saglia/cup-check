# Product

## Sintesi

`cup-check` verifica liste di CUP in modo locale, auditabile e a costo operativo zero.

Nel `0.1.0` il canale principale e una web app statica. Dalla `0.2.0` il progetto aggiunge una libreria Python importabile, pubblicata su PyPI come `cup-check`, pensata per integrazione in sistemi gestionali e pipeline applicative.

## Contesto

Nella PA italiana il CUP e un identificatore obbligatorio per gli atti di finanziamento o autorizzazione di investimenti pubblici. La verifica manuale di liste di CUP e frequente in rendicontazione, controllo e monitoraggio, ma il lookup puntuale tramite portale OpenCUP e oneroso.

`cup-check` nasce per offrire uno strumento leggero che aiuti funzionari e tecnici a individuare rapidamente errori formali prima di successive verifiche manuali o autoritative.

## Stakeholder

- Funzionari PA che gestiscono atti contenenti CUP.
- Strutture di monitoraggio regionale e centrale.
- Soggetti attuatori, in particolare su flussi PNRR.
- Tecnici che costruiscono controlli qualita su flussi documentali.

## Obiettivi

- Verificare in batch la correttezza formale di almeno 10.000 CUP.
- Offrire una web app interattiva e, da `0.2.0`, una libreria Python importabile.
- Produrre report esportabili con esito riga per riga.
- Restare offline-first dopo la prima visita.
- Da `0.3.0`, verificare l'esistenza nel perimetro pubblicato da OpenCUP tramite dataset esatto self-hosted.
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
- Stack appropriato: JavaScript minimale nel browser, Python dove serve integrazione o pipeline.
- Degradazione graceful: se una fonte esterna fallisce, il check locale resta disponibile.

