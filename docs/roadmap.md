# Roadmap

| Versione | Tema | Contenuto | Dipendenze |
| --- | --- | --- | --- |
| `0.1.0` | MVP web | Format check, report CSV, web app statica, fixture YAML, regole `R0`-`R5` | nessuna |
| `0.1.x` | Hardening | Bug fix, polish UX, auto-detect colonne, fixture aggiuntivi | nessuna |
| `0.2.0` | Libreria Python | `pip install cup-check`, API `validate_format`, parity sui fixture, nessun parser file nel core | account PyPI |
| `0.3.0` | Dataset OpenCUP statico + lookup browser/Python | Pipeline mensile, indice SQLite CUP esatto versionato su GitHub Releases e servito da Pages, latest dataset dinamico, verifica esistenza CUP da web e Python, cache browser/Python, nuovi esiti OpenCUP | nessuna |
| `0.4.0` | Coerenza atto | Dataset dettagli chunked (stato, natura, P.IVA/CF, importi, descrizione); download dei soli chunk necessari; cross-check CUP con dati atto; esiti cautelativi per possibili inversioni | nessuna |
| `0.5.0` | UX & a11y | WCAG AA piena, drag-drop multi-file, batch >100k con Web Worker, i18n base | nessuna |
| `0.6.0` | Arricchimento dato | parsing semantico CUP, tooltip esplicativi, helper Python | nessuna |
| `0.7.0` | API autoritativa | completamento per nature non pubblicate, checker puntuale con credenziali o proxy documentato | API key |
| `1.0.0` | Produzione stabile | documentazione utente consolidata, hardening, dichiarazione accessibilita | da valutare |

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

1. Espansione schema dataset: colonne `attivo`, `natura_index`, `cup_master`, `updated_on_sort`, `piva_cf_titolare`, `piva_cf_beneficiario`, `costo_progetto_cents`, `finanziamento_progetto_cents`, `descrizione_full`.
2. Strategia dedup aggiornata a `ON CONFLICT(cup) DO UPDATE SET ... WHERE excluded.updated_on_sort > cups.updated_on_sort`.
3. Normalizzazione ingest per valori assenti come `DATO NON PRESENTE` e `***************`.
4. Estensione integrazione web: l'indice CUP indica i chunk del dataset dettagli necessari e il browser scarica solo quelli richiesti.
5. API Python `OpenCupChecker.check(...)` con parametri opzionali per P.IVA/CF, importo e descrizione.
6. Mapping colonne web per CUP obbligatorio e campi di coerenza opzionali.
7. Esito cautelativo `POSSIBILE_INCOERENZA_DA_VERIFICARE`, mai esito forte di incoerenza automatica.
8. Dettaglio per campo: match P.IVA/CF titolare o beneficiario, match costo o finanziamento, score descrizione, stato/revoca.
9. Fixture o mini-dataset di test per parity web/Python sui controlli sostanziali.
10. ADR per schema dataset e strategia di matching.
11. Schema YAML custom in input: `build_sqlite_from_projects_zip`, `build_dataset_release` e `iter_project_records` accettano `schema_path` opzionale per personalizzare il mapping CSV→SQLite; se omesso, viene usato lo schema bundled.
