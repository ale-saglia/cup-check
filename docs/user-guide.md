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

La roadmap `0.4.0` introduce un tool dedicato per estrarre CUP da fatture PDF prima del controllo principale.

Il flusso previsto è:

1. Apri il menu "Strumenti" e scegli "Estrai CUP da fatture PDF".
2. Carica uno o più PDF.
3. La web app prova a leggere il testo del PDF; se il documento è scansionato usa OCR locale in italiano.
4. Controlla la tabella file/CUP, correggendo manualmente eventuali letture OCR imperfette.
5. Esporta il CSV file/CUP oppure apri i risultati nel verificatore per applicare gli stessi controlli già disponibili.

Il tool PDF non sostituisce la verifica: prepara l'elenco dei CUP da controllare e mantiene l'origine del file come colonna esportabile.

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
