# Guida Utente

Questa guida descrive l'uso operativo della web app `cup-check` per persone che devono controllare elenchi di CUP prima di una rendicontazione, una trasmissione o una revisione interna.

## Scenario Tipico

Hai un file con 500 CUP da verificare prima di inviare un prospetto al MEF, a una struttura di monitoraggio o a un ufficio di controllo. Prima della verifica ufficiale vuoi individuare:

- CUP vuoti, incompleti o scritti con caratteri non ammessi;
- codici formalmente validi ma non presenti nel mirror OpenCUP disponibile;
- duplicati da leggere una sola volta in vista aggregata;
- righe da ricontrollare manualmente su fonte autoritativa.

`cup-check` serve a fare questo controllo preliminare in modo locale e ripetibile. Non sostituisce il Sistema CUP, OpenCUP o altri canali ufficiali.

## Controllo Da File

1. Apri la [web app](https://ale-saglia.github.io/cup-check/).
2. Carica un file CSV o XLSX.
3. Se il file Excel contiene più fogli, scegli il foglio da controllare.
4. Verifica che la colonna proposta sia quella dei CUP. Se necessario, seleziona un'altra colonna.
5. Indica se la prima riga contiene intestazioni.
6. Decidi se ignorare le righe senza CUP.
7. Avvia il controllo.

La tabella risultati mostra gli esiti per CUP, con possibilità di raggruppare i codici uguali o vedere il dettaglio riga per riga nell'export CSV.

## Controllo Da Testo

Usa l'area di testo quando hai una lista breve o un elenco copiato da un documento:

1. Incolla un CUP per riga.
2. Avvia il controllo.
3. Esporta il CSV se devi condividere o archiviare l'esito.

Le righe vuote vengono ignorate.

## Estrazione CUP Da PDF

Disponibile nel menu **Strumenti** della web app, il tool estrae automaticamente i codici CUP da fatture e documenti PDF prima di passarli al verificatore principale.

### Flusso base

1. Apri il menu **Strumenti** e scegli **Estrai CUP da fatture PDF**.
2. Trascina uno o più PDF nella zona di rilascio, oppure usa il pulsante per selezionarli.
3. La web app legge il testo nativo del PDF con pdf.js. Se il documento è scansionato (testo assente o scarso), attiva automaticamente l'OCR locale in italiano — nessun dato viene inviato a server esterni.
4. La tabella si popola con una riga per ogni coppia *file ↔ CUP*. Per ogni CUP viene mostrata la validazione formale (struttura e checksum), ma non ancora la verifica OpenCUP.

### Correzione manuale

Se l'OCR ha letto male un CUP (ad esempio ha confuso `I` con `1`), clicca **modifica** sulla riga, correggi il valore e premi Invio o clicca **salva**. Il CUP corretto viene marcato come **manuale** nell'export. Puoi anche aggiungere CUP mancanti su righe con errore o senza CUP rilevato con il pulsante **+ aggiungi CUP**.

### Azioni finali

- **Apri nel verificatore** (azione principale): genera un CSV `cup,file_origine` e lo passa al verificatore, che lo apre come file caricato con la colonna `cup` già selezionata. La verifica OpenCUP avviene in questa fase.
- **Esporta CSV (file ↔ CUP)**: scarica un file semicolonne `cup;file_origine;formato_valido;fonte;manuale` per archiviazione o elaborazione esterna.
- **Pulisci**: azzera tutti i risultati della sessione corrente.

### Affidabilità dei CUP estratti via OCR

I CUP con fonte **ocr** nella colonna *Fonte* richiedono attenzione particolare: il riconoscimento ottico può confondere caratteri simili (es. `I` ↔ `1`) o frammentare sequenze alfanumeriche in modo inaspettato. Prima di usare questi codici verifica sempre la correttezza con la funzione **modifica**, oppure confronta visivamente il valore con il PDF originale.

### Limiti del tool PDF

- L'OCR usa solo la lingua italiana (con inglese come supporto). Documenti in altre lingue o con grafica complessa possono produrre letture imperfette.
- La qualità dell'OCR dipende dalla risoluzione e dalla nitidezza del PDF scansionato: usa sempre la correzione manuale per i CUP dubbi.
- La validazione mostrata nella tabella è solo **formale** (regole `R0`–`R5`). La verifica di esistenza nel dataset OpenCUP si esegue nel verificatore dopo il passaggio.
- Il tool non deduplicano i CUP: se lo stesso codice appare in più file, viene riportato una volta per file. La deduplicazione è disponibile nel verificatore tramite il toggle "Raggruppa CUP uguali".
- Con batch di **50–100 file o più** (caso tipico: invio massivo di fatture) l'elaborazione è completamente sequenziale e la UI rimane reattiva. I file vengono letti uno alla volta e liberati dalla memoria subito dopo l'estrazione; il browser non accumula il contenuto di tutti i PDF contemporaneamente.

Il tool PDF non sostituisce il verificatore: prepara l'elenco dei CUP da controllare e mantiene l'origine del file come colonna tracciabile fino all'export finale.

## Lettura Degli Esiti

Gli esiti sono cautelativi:

- `INVALIDO_FORMATO`: il CUP non rispetta le regole formali applicate dal validatore.
- `FORMATO_VALIDO_DA_VERIFICARE`: il CUP ha formato valido, ma il dataset OpenCUP non è disponibile o il controllo è solo formale.
- `TROVATO_OPENCUP`: il CUP è presente nel mirror OpenCUP statico disponibile alla data dello snapshot.
- `NON_TROVATO_OPENCUP_DA_VERIFICARE`: il CUP non è presente nel mirror OpenCUP disponibile; va verificato su fonte autoritativa.

Un `NON_TROVATO_OPENCUP_DA_VERIFICARE` non dimostra che il CUP non esista. Può indicare un CUP recente, non pubblicato, non incluso nello snapshot mensile o da verificare con strumenti ufficiali.

## Privacy e Offline

I file caricati, i CUP incollati, i PDF e i report vengono elaborati nel browser. La web app non invia i dati a un backend applicativo.

La web app può scaricare asset pubblici e cacheabili, incluso il dataset OpenCUP statico e, per il tool PDF, gli asset OCR locali serviti dalla stessa applicazione. Dopo la prima visita l'interfaccia può funzionare offline; il lookup OpenCUP dipende dalla disponibilità del dataset già scaricato o raggiungibile.

## Buone Pratiche

- Conserva il CSV esportato come evidenza del controllo preliminare.
- Verifica su fonte autoritativa i CUP marcati come non trovati o usati in atti rilevanti.
- Ripeti il controllo dopo una nuova release dataset se stai lavorando su CUP molto recenti.
- Non trattare gli esiti come certificazione di esistenza o correttezza sostanziale del progetto.
