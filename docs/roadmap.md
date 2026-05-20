# Roadmap

| Versione | Tema | Contenuto | Dipendenze |
| --- | --- | --- | --- |
| `0.1.0` | MVP web | Format check, report CSV, web app statica, fixture YAML, regole `R0`-`R5` | nessuna |
| `0.1.x` | Hardening | Bug fix, polish UX, auto-detect colonne, fixture aggiuntivi | nessuna |
| `0.2.0` | Libreria Python | `pip install cup-check`, API `validate_format`, parity sui fixture, nessun parser file nel core | account PyPI |
| `0.3.0` | Dataset OpenCUP statico + lookup browser/Python | Pipeline mensile, indice SQLite CUP esatto versionato su GitHub Releases e servito da Pages, latest dataset dinamico, verifica esistenza CUP da web e Python, cache browser/Python, nuovi esiti OpenCUP | nessuna |
| `0.4.0` | Estrazione CUP da PDF | Tool web per fatture PDF: router strumenti, estrazione testo con pdf.js, OCR locale italiano con Tesseract.js, correzione manuale, export file/CUP e passaggio al verificatore | nessuna |
| `0.4.1` | Consolidamento sicurezza e robustezza | Fix XSS (DOM programmatico in pdf-extract-view), race condition OCR worker, blocco coda drainQueue, timeout per-chunk dataset, registry hash per trasferimento CSV, debounce render OCR, fix accessibilità e mobile | nessuna |
| `0.5.0` | UX & a11y | WCAG AA piena, drag-drop multi-file, batch >100k con Web Worker, i18n base | nessuna |
| `0.6.0` | Coerenza atto | Tool web: cross-check CUP con dati atto; dataset dettagli chunked (stato, natura, P.IVA/CF, importi, descrizione); download dei soli chunk necessari; esiti cautelativi per possibili inversioni | nessuna |
| `0.7.0` | CLI Python | `cup-check` come comando invocabile; input da file, stdin e argomento singolo; output tabellare, CSV e JSON; exit code semantico; supera ADR 0004 | nessuna |
| `0.8.0` | Astrazione verifica remota | interfaccia `RemoteVerificationProvider`, `MockRemoteProvider`, esiti cautelativi verifica remota, ADR boundary BYOK | nessuna |
| `0.9.0` | Worker Cloudflare + BYOK Python | Tool web: verifica remota opzionale tramite Cloudflare Worker; rate limiting (IP + numero CUP nel payload), KV store, CORS, nessun dato persistente; `RemoteMefProvider` BYOK nel package Python; nessun segreto nel frontend | accesso API MEF |
| `1.0.0` | Produzione stabile | documentazione utente consolidata, hardening, dichiarazione accessibilità | da valutare |

## Modello di rilascio degli strumenti

A partire dalla `0.4.0` la web app adotta un registro interno degli strumenti (`tools-registry`) che alimenta il menu "Strumenti": nuovi tool possono essere aggiunti come viste indirizzabili (`#/nome-tool`) senza modificare il verificatore principale.

La coerenza atto (`0.6.0`) e la verifica remota (`0.9.0`) seguono questo modello: vengono rilasciati come tool separati nel registro, non come modifica al flusso principale. Questo preserva la coerenza con l'identità del progetto (local-first, statico, senza dipendenze obbligatorie) e permette di attivare funzioni avanzate solo a chi ne ha bisogno.

Ulteriori strumenti potranno essere aggiunti in milestone successive in base al feedback degli utenti, senza richiedere modifiche architetturali.

## Milestone `0.2.0`

1. Scaffold `packages/cup_check` pubblicato come `cup-check`.
2. Tipi pubblici per outcome, regole e risultato.
3. API `validate_format(str)` con regole `R0`-`R5`.
4. Supporto per iterabili di stringhe.
5. Parity test sui fixture YAML.
6. Coverage del validatore almeno 90%.
7. Job CI Python con ruff e pytest.
8. Workflow PyPI con Trusted Publishing OIDC.
9. README del package con esempi importabili.

## Milestone `0.3.0`

1. Pipeline download bulk OpenCUP.
2. Estrazione e dedup CUP, gestione revocati.
3. Indice SQLite ottimizzato `WITHOUT ROWID`, tabella `cup_index`, chiave `cup` e `detail_chunk` per ora `NULL`.
4. Indice CUP esatto pubblicato nella release dataset, servito da GitHub Pages e descritto da `dataset-manifest.json` con sezione `cup_index`.
5. Chunk dell'indice scaricabili e cacheabili dal browser senza servizi server-side.
6. Integrazione web: lookup locale nel browser sui CUP unici con `sql.js`, latest dataset dinamico e fallback a `FORMATO_VALIDO_DA_VERIFICARE` se il dataset non è disponibile.
7. `OpenCupChecker` Python con download/cache locale dell'indice.
8. Manifest con hash, dimensioni, snapshot fonte e compatibilità minima software.
9. Nuovi esiti `TROVATO_OPENCUP` e `NON_TROVATO_OPENCUP_DA_VERIFICARE`.
10. ADR per strategia statica browser lookup (ADR 0007) e SQLite chunked distribuito via Pages/Releases (ADR 0008).

## Milestone `0.4.0`

1. Hash router minimale con vista verificatore `#/` e vista PDF `#/pdf-extract`.
2. Navbar con menu "Strumenti" popolato da registro interno.
3. Refactor della UI esistente in layout e vista verificatore senza cambio funzionale.
4. Estrazione testo nativa dai PDF con pdf.js caricato dinamicamente.
5. Heuristica per distinguere PDF nativi e scansionati.
6. OCR fallback locale con Tesseract.js, asset `ita` serviti da `public/tesseract/` e nessuna CDN obbligatoria.
7. Pattern CUP condiviso tra validatore e tool PDF, con supporto a CUP spezzati da newline o spazi.
8. Tabella risultati file/CUP con fonte `testo`/`ocr`, stato, modifica manuale e rimozione.
9. Export CSV file/CUP e azione "Apri nel verificatore" tramite file sintetico `cup,file_origine`.
10. Test unitari per estrazione testo, normalizzazione CUP ed export CSV; acceptance end-to-end dal menu strumenti al verificatore.
11. Documentazione utente e tecnica del flusso PDF, inclusi limiti OCR e privacy locale.

## Milestone `0.5.0`

1. **Web Worker per batch >100k**: spostare `validateBatch` e il lookup OpenCUP in un Worker dedicato; streaming progressivo dei risultati con progress bar percentuale; cancellazione del job in corso; elaborazione a chunk per contenere il footprint di memoria; parity test su fixture con worker attivo e disattivo.
2. **Drag-and-drop multi-file nel verificatore principale**: il verificatore accetta più file CSV/XLSX contemporaneamente via input e drag-and-drop; le righe vengono concatenate in un unico batch con colonna `file_origine` aggiunta automaticamente; gestione coerente delle intestazioni tra file multipli.
3. **WCAG 2.1 AA piena**: audit completo con Lighthouse e axe-core; focus management al cambio vista nel router; live region ARIA per avanzamento asincrono (lookup dataset, OCR, progress Worker); contrasto colore AA su tutti i componenti; etichette ARIA su tabelle risultati, input file e pulsanti icona; navigazione tastiera completa inclusi drag-and-drop; link "Salta al contenuto"; quality gate Lighthouse a11y integrato in CI.
4. **i18n base**: architettura di traduzione minimale (file JSON `it`/`en` caricato dinamicamente); estrazione di tutte le stringhe UI, etichette esiti e messaggi errore nel bundle traduzioni; selettore lingua con persistenza in `localStorage`; inglese come prima lingua aggiuntiva; fixture e contratti interni restano in italiano.
5. **Note di accessibilità**: documento statico `accessibility.md` con stato informativo di accessibilità, limitazioni note e contatto per segnalazioni.

## Milestone `0.6.0`

1. Espansione schema dataset: colonne `attivo`, `natura_index`, `cup_master`, `updated_on_sort`, `piva_cf_titolare`, `piva_cf_beneficiario`, `costo_progetto_cents`, `finanziamento_progetto_cents`, `descrizione_full`.
2. Strategia dedup aggiornata a `ON CONFLICT(cup) DO UPDATE SET ... WHERE excluded.updated_on_sort > cups.updated_on_sort`.
3. Normalizzazione ingest per valori assenti come `DATO NON PRESENTE` e `***************`.
4. Estensione integrazione web: l'indice CUP indica i chunk del dataset dettagli necessari e il browser scarica solo quelli richiesti.
5. API Python `OpenCupChecker.check(...)` con parametri opzionali per P.IVA/CF, importo e descrizione.
6. Mapping colonne web per CUP obbligatorio e campi di coerenza opzionali.
7. Esito cautelativo `POSSIBILE_INCOERENZA_DA_VERIFICARE`, mai esito forte di incoerenza automatica.
8. Dettaglio per campo: match P.IVA/CF titolare o beneficiario, match costo o finanziamento, score descrizione, stato/revoca.
9. Fixture o mini-dataset di test per parity web/Python sui controlli sostanziali.
10. ADR 0009 per schema dataset e strategia di matching.
11. Schema YAML custom in input: `build_sqlite_from_projects_zip`, `build_dataset_release` e `iter_project_records` accettano `schema_path` opzionale per personalizzare il mapping CSV→SQLite; se omesso, viene usato lo schema bundled.

## Milestone `0.7.0`

1. **ADR 0010 — supera ADR 0004**: la libreria è ora matura e la CLI può essere implementata come wrapper sottile senza guidare l'architettura; documenta motivazione, scelte di packaging e compatibilità con le API esistenti.
2. **Entrypoint `cup-check`**: comando installabile con `pip install cup-check`; subcomandi `verify` e `lookup`; nessuna logica aggiuntiva oltre le API Python già esistenti.
3. **Input flessibile**: `cup-check verify file.csv`, `cup-check verify -` (stdin), `cup-check verify G17H03000130001` (CUP singolo come argomento); rilevamento automatico del tipo di input.
4. **Output configurabile**: `--format table` (default, human-readable), `--format csv`, `--format json`; `--no-header` per pipeline; colori opzionali con `--no-color` o variabile `NO_COLOR`.
5. **Exit code semantico**: `0` tutti validi, `1` almeno un CUP invalido o non trovato, `2` errore di input o sistema; consente uso diretto in script e pipeline CI.
6. **`cup-check lookup`**: interroga il dataset OpenCUP locale o lo scarica se assente; opzione `--dataset-dir` per cache custom; `--update` per forzare il refresh.
7. **Test CLI**: test di integrazione per i percorsi principali (file, stdin, argomento singolo, exit code, formati output); nessuna duplicazione dei test di libreria già esistenti.

## Milestone `0.8.0`

1. Definizione interfaccia `RemoteVerificationProvider` condivisa tra web e Python: metodo `verify(cup)` con esito cautelativo, timeout e stato disponibilità.
2. Implementazione `MockRemoteProvider` per sviluppo e test offline.
3. Integrazione web: la verifica remota è un provider opzionale; se non disponibile o non configurato, il risultato è `VERIFICA_REMOTA_NON_DISPONIBILE` senza bloccare il flusso locale.
4. Nuovi esiti cautelativi: `TROVATO_REMOTO`, `NON_TROVATO_REMOTO_DA_VERIFICARE`, `VERIFICA_REMOTA_NON_DISPONIBILE`.
5. Dichiarazione esplicita nel frontend: il browser non gestisce né conserva credenziali MEF.
6. ADR 0011 "Remote authoritative verification and BYOK boundary": la web app usa solo il Worker controllato dal progetto; il BYOK MEF è supportato esclusivamente nel package Python; gli enti possono self-hostare un proxy compatibile.
7. Parity test mock tra web e Python sugli esiti remoti.

## Milestone `0.9.0`

1. Cloudflare Worker: endpoint minimale `/verify`, nessun dato persistente, segreti MEF solo in Cloudflare Secrets.
2. Rate limiting sul Worker: doppio limite — per IP (es. 20 richieste/minuto) e per numero di CUP nel payload (es. max 50 CUP/richiesta); implementazione con KV store.
3. Privacy notice chiara sulla verifica remota: l'IP del client può raggiungere il Worker; nessun profilo persistente costruito.
4. `RemoteMefProvider` nel package Python: accetta credenziali MEF via costruttore o variabile d'ambiente; non entra mai nel frontend.
5. CORS configurati sul Worker per le sole origini autorizzate (GitHub Pages + localhost dev).
6. Documentazione modalità self-hosted proxy per enti con credenziali proprie.
7. Integrazione CI: smoke test contro Worker di staging.
