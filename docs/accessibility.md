# Dichiarazione di accessibilità

Questa dichiarazione descrive lo stato di accessibilità della web app `cup-check`, disponibile all'indirizzo <https://ale-saglia.github.io/cup-check/>.

`cup-check` è una web app statica e local-first per la verifica preliminare di codici CUP e per l'estrazione di CUP da documenti PDF. L'obiettivo del progetto è rendere le funzioni principali utilizzabili anche con tecnologie assistive, navigazione da tastiera e impostazioni browser comuni.

## Stato di conformità

La web app è progettata per essere conforme alle WCAG 2.1 livello AA per le funzioni principali della milestone `0.5.0`:

- caricamento e verifica di file CSV/XLSX nel verificatore CUP;
- importazione guidata multi-file;
- verifica di batch estesi con avanzamento annunciato;
- consultazione, filtro ed export dei risultati;
- estrazione CUP da PDF con testo nativo o OCR locale;
- cambio lingua italiano/inglese tramite selettore dedicato.

Il quality gate automatico include un controllo Lighthouse accessibility con soglia minima `90`. La baseline locale registrata per la milestone D3 è `100`, ma il controllo automatico non sostituisce una verifica manuale con tastiera e screen reader.

## Misure Adottate

La web app include:

- link "Salta al contenuto" verso l'area principale;
- gestione del focus al cambio vista;
- controlli file utilizzabili anche senza drag-and-drop;
- etichette esplicite per input, select, toggle e pulsanti azione;
- regioni live `aria-live="polite"` per avanzamenti e stati asincroni;
- contrasto colore verificato rispetto ai requisiti AA;
- pannelli di importazione con titolo associato e navigazione da tastiera;
- testi UI localizzati tramite i18n senza tradurre gli outcome tecnici del contratto dati.

## Limitazioni Note

Alcune parti possono richiedere attenzione o verifica manuale:

- i file caricati dall'utente possono contenere intestazioni, fogli Excel, nomi file o valori testuali non accessibili in origine;
- i PDF scansionati dipendono dalla qualità dell'immagine e dall'OCR locale: i CUP estratti con fonte OCR vanno sempre verificati visivamente;
- tabelle molto grandi possono risultare onerose da esplorare con tecnologie assistive, anche se l'elaborazione avviene a chunk e con progress feedback;
- l'export CSV è pensato come formato dati: l'accessibilità del file dipende anche dallo strumento usato per aprirlo;
- browser datati o configurazioni che disabilitano JavaScript, Service Worker o Web Worker possono ridurre l'esperienza disponibile.

`cup-check` non è un servizio ufficiale e non sostituisce il Sistema CUP, OpenCUP o altri canali autoritativi. Gli esiti restano cautelativi e orientati al controllo preliminare.

## Privacy e trattamento locale

File CSV/XLSX, PDF, testi incollati e report sono elaborati nel browser. La web app non invia i dati caricati a un backend applicativo.

La web app può scaricare asset pubblici e cacheabili, come il dataset OpenCUP statico, pdf.js, Tesseract.js e i file OCR serviti dalla stessa applicazione. Il lookup OpenCUP usa asset statici e dataset pubblici.

## Segnalazioni

Per segnalare barriere di accessibilità, problemi di navigazione o contenuti non fruibili, aprire una issue nel repository GitHub:

<https://github.com/ale-saglia/cup-check/issues>

Nella segnalazione, quando possibile, indicare:

- pagina o vista interessata;
- browser e sistema operativo;
- tecnologia assistiva usata, se rilevante;
- passaggi per riprodurre il problema;
- comportamento atteso.

## Preparazione della dichiarazione

Questa dichiarazione è stata preparata per la milestone `0.5.0` sulla base della documentazione tecnica del progetto, dei gate automatici e delle verifiche manuali previste dal piano di migrazione.

Ultimo aggiornamento: 2026-05-19.
