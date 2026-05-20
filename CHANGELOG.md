# Changelog

## Unreleased

- Completa la migrazione del frontend a TypeScript + Svelte 5 (milestone 0.5.0): riorganizzazione di `src/` in `lib/core`, `lib/data`, `lib/pdf`, conversione dei moduli da JS a TS, vite.config e ESLint migrati, `Validator.svelte` come nuovo entry point Svelte 5 montato via `mount()`. La migrazione copre fasi A1–C6 con coverage completa.
- Aggiunge il tool **Estrai CUP da fatture elettroniche XML** (route `#/xml-extract`): legge file FatturaPA con DOMParser nativo, cerca prima i campi strutturati (`CodiceCUP`, `AltriDatiGestionali[TipoDato=CUP]`) e ricade sul testo libero (`Causale`, `Descrizione`) come fallback. Condivide con il tool PDF il flusso di correzione manuale, il passaggio al verificatore e l'export CSV.
- Introduce l'import multi-file nel verificatore: un wizard guida alla selezione di uno o più file CSV/XLSX, con toggle per includere o escludere singole sorgenti e scelta della colonna per ciascun file. I metadati di origine (file, scheda, riga, colonna) vengono propagati fino all'export CSV come colonne `file_origine`, `scheda_origine`, `riga_origine`, `colonna_origine`. File sopra 25 MB ricevono un avviso advisory nella DropZone.

- Sposta la validazione batch in un Web Worker dedicato per batch >100 k righe: il thread principale resta reattivo durante l'elaborazione. Per batch minori la validazione avviene in-thread senza overhead. Il lookup OpenCUP avviene sempre sul main thread tramite protocollo `lookup-request`/`lookup-result`, evitando di trasferire il dataset al worker.
- Aggiunge `ProgressBar.svelte` e un pannello di progresso in `Validator.svelte` con pulsante Annulla; i trigger di validazione ed export sono disabilitati durante una corsa in corso.
- Espone `AbortController` per annullare validazioni in corso; `onDestroy` interrompe automaticamente eventuali batch all'uscita dalla vista.
- Aggiunge `AbortSignal` a `loadLatestDataset` e all'intera catena di fetch del dataset; `Validator.svelte` annulla il download automaticamente su `onDestroy`, eliminando il download fantasma quando l'utente naviga via prima del completamento.
- Introduce la cache `CacheStorage` per il dataset SQLite: il file viene riscaricato solo se l'hash SHA-256 dichiarato nel manifest differisce da quello del file in cache, coprendo sia rigenerazioni del dataset sia bitrot. Se la rete non è disponibile e la cache contiene dati validi, il dataset viene servito offline senza errore.

- Completa l'accessibilità WCAG D3: aggiunge skip link, focus management tra viste e live region per i processi asincroni. Il gate Lighthouse è integrato in CI per mantenere il punteggio nel tempo.
- Aggiunge accessibilità preparatoria al pannello di importazione multi-file (D2.6): attributi ARIA su DropZone, toggle sorgenti e wizard.
- Aggiunge i18n base con selettore lingua persistito: le stringhe principali della UI sono disponibili in italiano e inglese; le chiavi i18n coprono anche i tool PDF e XML, gli errori parser/worker e le etichette dinamiche dell'importazione.

- Aggiunge `markdownlint` a pre-commit e `svelte-check` a Makefile, CI e pre-commit.
- Aggiunge gate coverage al pre-push hook e verifica coverage a `check` e `release-check`.
- Integra Codecov Bundle Analysis e Test Analytics per Python e web.
- Pubblica le note di accessibilità (`docs/accessibility.md`) e aggiunge la sezione compatibilità browser in `docs/technical-spec.md`.

- Arricchisce l'export CSV del tool XML con sette colonne aggiuntive estratte dai metadati FatturaPA: `data_fattura`, `numero_fattura`, `importo_totale` (decimale con virgola), `causale`, `piva_fornitore`, `nome_fornitore`, `cig`. Le stesse colonne sono visibili in anteprima nella tabella prima del download. File XML elaborati correttamente ma privi di CUP generano comunque una riga nel CSV (con campo CUP vuoto), e il pulsante **Esporta CSV** è abilitato non appena almeno un file è stato elaborato, indipendentemente dalla presenza di CUP.
- Aggiunge test acceptance e anteprima con Chromium legacy (v109) tramite VNC per verificare la compatibilità con browser meno recenti.
- Elimina il falso errore Tesseract `failed to load ita.special-words` che compariva alla prima esecuzione OCR.
- Tronca le celle CUP troppo lunghe nella tabella risultati per evitare overflow visivo.
- Migra `read-excel-file` alla v9.
- Aggiorna le dipendenze npm e le GitHub Actions tramite Dependabot.

## 0.4.1 - 2026-05-14

- Migra `pdf-extract-view` da `innerHTML` a creazione DOM programmatica, eliminando il rischio XSS nei template della tabella risultati.
- Corregge la race condition nel singleton OCR worker e nel loader pdf.js: la Promise di inizializzazione viene assegnata immediatamente, impedendo la creazione di worker duplicati in caso di caricamento concorrente.
- Previene il blocco permanente della coda di elaborazione PDF se `processEntry` lancia un'eccezione imprevista.
- Valida il `Content-Type` della risposta prima di parsare il JSON del dataset, restituendo un messaggio d'errore leggibile invece di un errore di parsing criptico.
- Aggiunge `inactivity timeout` per-chunk nel download progressivo del dataset: connessioni appese vengono interrotte e segnalate come errore ritentabile.
- Sostituisce il passaggio `state.pendingFile` tra viste con un registry temporaneo identificato da hash, eliminando la possibile perdita del file in caso di navigazione rapida.
- Estrae `isStructurallyPlausible` in `validator.js` per unificare le due semantiche di validazione CUP presenti in `extract-cups.js`.
- Applica debounce al render OCR, libera la memoria PDF dopo l'estrazione e mostra un avviso quando vengono caricati molti file contemporaneamente.
- Specifica il cache name nel fallback offline del Service Worker per evitare collisioni tra cache app-shell e cache dataset.
- Aggiunge `fallback runtime` a `PRODUCT_VERSION` per evitare `undefined` fuori dall'ambiente Vite.
- Aggiunge `aria-label` alla tabella risultati del tool PDF e corregge il menu strumenti su mobile.
- Aggiunge `rel="noopener"` esplicito su tutti i link `target="_blank"`.
- Aggiunge fallback esplicito per hash sconosciuti nel router.
- Inietta `opener` come parametro nelle funzioni HTTP Python invece di usare monkeypatch, rendendo i test più robusti.
- Aggiunge avvertenza OCR nella UI e nella guida utente sui CUP estratti da PDF scansionati.

## 0.4.0 - 2026-05-13

- Aggiunge il tool "Estrai CUP da fatture PDF" accessibile dal menu "Strumenti" nella web app.
- Introduce hash router (`#/`, `#/pdf-extract`) e registro strumenti per supportare tool futuri senza duplicare HTML o Service Worker.
- Estrae testo da PDF nativi con pdf.js (caricamento lazy all'apertura del tool).
- Aggiunge OCR locale italiano con Tesseract.js + lingua `ita` e `eng` come fallback per PDF scansionati (caricamento lazy solo se necessario, nessuna CDN esterna).
- Corregge la confusione OCR `I`/`1` nelle posizioni alfabetiche del CUP.
- Supporta CUP spezzati su più righe o token OCR frammentati via normalizzazione alfanumerica.
- Mostra validazione formale (regex + checksum) per ogni CUP estratto; la verifica OpenCUP avviene nel verificatore dopo il passaggio CSV.
- Permette modifica manuale di qualsiasi CUP con tracciabilità del flag `manuale` nell'export.
- Esporta CSV `cup,file_origine` verso il verificatore o CSV `cup;file_origine;formato_valido;fonte;manuale` per archivio.
- Aggiunge cache Service Worker dedicata (`cup-check-lazy-v1`) con strategia cache-first per gli asset pdf.js e Tesseract.
- Porta la coverage linee web al 100% con suite Vitest per la nuova vista PDF, le operazioni di edit, i CSV builder e il flusso `state.pendingFile` nel verificatore.
- Aggiunge il flusso PDF-extract al test acceptance Playwright end-to-end.
- Aggiunge fixture PDF in `samples/pdf/`: testo nativo mono/multi-pagina, CUP spezzato, testo scarso (OCR), senza CUP.
- Riallinea la roadmap: la `0.4.0` diventa il tool di estrazione CUP da PDF e la validazione multicampo viene spostata a una milestone successiva.
- Migliora il README con un'introduzione orientata al problema pubblico e un abstract in inglese.
- Aggiunge una guida utente non tecnica e un processo contributivo minimo.
- Aggiunge i badge dinamici al README e integra l'upload della coverage Python su Codecov.
- Stabilizza il controllo di release web quando l'ambiente non espone il contesto Git completo.
- Aggiunge coverage Vitest a Codecov, porta la coverage linee web al 100% e copre dark mode, dialog, rendering, stato e Service Worker.
- Aggiunge un audit accessibilità con axe al test acceptance web.
- Genera la matrice Python CI da `requires-python` e aggiunge il controllo `npm audit` al workflow web.
- Aggiunge hook `pre-commit`, policy di sicurezza, sezione maintainer e riconoscimento contributori.
- Corregge il progresso del caricamento dataset che appariva bloccato intorno all'80%: il callback `onBytes` veniva ignorato durante lo streaming dei chunk, aggiornando la barra solo al termine di ciascun chunk intero (~17% per salto). Ora il progresso è continuo e riflette i byte effettivamente ricevuti; in caso di retry il contatore retrocede correttamente.

## 0.3.2 - 2026-05-12

- Aggiunge nei risultati il toggle per raggruppare o mostrare riga per riga i CUP uguali, con export CSV coerente.
- Aggiunge nella preview XLSX un selettore scheda quando il file contiene più fogli.
- Migliora la UI mobile di header, footer, anteprima, risultati e stato dataset.
- Corregge il workflow PyPI: il publish Python ora parte solo da tag software `vX.Y.Z` o da dispatch manuale sullo stesso formato, evitando release dataset e versioni VCS spurie.
- Rafforza il download dei dataset con timeout espliciti e log di avanzamento per il bulk OpenCUP.
- Verifica nel browser lo SHA-256 di ogni chunk SQLite con retry prima di ricomporre l'indice.
- Isola gli asset dataset in una cache Service Worker dedicata, mantenendo solo l'ultima release `dataset-YYYY-MM`.
- Porta la coverage Python al 100% e rende la soglia obbligatoria nei test.
- Aggiorna le istruzioni agent per usare la documentazione tematica al posto di `docs/project.md`.

## 0.3.1 - 2026-05-11

- Corregge il deploy del dataset quando il GitHub Release software non è ancora pubblicato (fallback ai git tag).
- Corregge il TypeError nel service worker quando una risorsa non è presente in cache.
- Corregge il fallback discovery dataset che usava `browser_download_url` bloccato da CORS; ora usa sempre URL GitHub Pages.
- Introduce `deploy-pages.yml`: deploy automatico di Pages dopo ogni release software, combinando web e dataset più recenti senza ricostruire il dataset.

## 0.3.0 - 2026-05-11

- Aggiunge la generazione dell'indice OpenCUP SQLite chunked con manifest e puntatore latest.
- Integra nella web app il lookup locale del dataset OpenCUP con `sql.js`, cache browser e fallback cautelativo.
- Pubblica il workflow mensile/manuale per creare la release dataset e aggiornare GitHub Pages dal web pinnato.
- Aggiunge `OpenCupChecker` Python con lookup OpenCUP su indice SQLite locale o scaricato in cache.
- Aggiunge i contratti Python per manifest e latest dataset, più test locali e di integrazione sul dataset pubblicato.
- Chiarisce nella web app i limiti dello strumento in sviluppo e del dataset OpenCUP mensile.
- Documenta la strategia statica via GitHub Releases e Pages con ADR, roadmap e specifiche aggiornate.

## 0.2.2 - 2026-05-09

- Aggiorna il workflow Pages per includere il dataset OpenCUP più recente nel deploy.

## 0.2.1 - 2026-05-09

- Aggiunge favicon, manifest collegato e `robots.txt` per stabilizzare Lighthouse su web.
- Aggiunge fallback statico `404.html` con redirect alla homepage per GitHub Pages.
- Rafforza il test Lighthouse con un controllo esplicito della superficie PWA.

## 0.2.0 - 2026-05-09

- Avvia lo scaffold `0.2.0` della libreria Python `cup-check`.
- Aggiunge API `validate_format` e `validate_many` con tipi pubblici per outcome, regole, warning e risultato.
- Aggiunge parity test Python sugli stessi fixture YAML del web.
- Aggiunge il workflow di publish PyPI con Trusted Publishing OIDC.

## 0.1.1 - 2026-05-08

- Accetta i CUP minuscoli dopo normalizzazione e segnala gli avvisi non bloccanti.
- Corregge il filtro dell'input testuale per ignorare solo l'intestazione `CUP`.
- Migliora la gestione delle intestazioni CSV/XLSX con toggle di correzione.
- Mostra il conteggio dei CUP unici nel riepilogo risultati.
- Limita i link OpenCUP ai valori cercabili manualmente.
- Protegge l'export CSV da celle formula-like.
- Chiarisce privacy e limiti della verifica solo formale.
- Rafforza i test parser, report e acceptance.

## 0.1.0 - 2026-05-08

- MVP web statico per validazione formale CUP.
- Supporto input CSV, XLSX e testo incollato.
- Report CSV esportabile.
- Service Worker offline-first.
- Fixture YAML come specifica funzionale.
