# Changelog

## Unreleased

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
