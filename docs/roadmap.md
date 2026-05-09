# Roadmap

| Versione | Tema | Contenuto | Dipendenze |
| --- | --- | --- | --- |
| `0.1.0` | MVP web | Format check, report CSV, web app statica, fixture YAML, regole `R0`-`R5` | nessuna |
| `0.1.x` | Hardening | Bug fix, polish UX, auto-detect colonne, fixture aggiuntivi | nessuna |
| `0.2.0` | Libreria Python | `pip install cup-check`, API `validate_format`, parity sui fixture, nessun parser file nel core | account PyPI |
| `0.3.0` | Dataset OpenCUP self-hosted | Pipeline mensile, SQLite chunked, release `dataset-YYYY-MM`, `OpenCupChecker`, nuovi esiti OpenCUP | nessuna |
| `0.4.0` | Coerenza atto | Cross-check CUP con P.IVA/CF, importo e descrizione progetto contro dataset OpenCUP; esiti cautelativi per possibili inversioni | PoC bulk OpenCUP |
| `0.5.0` | UX & a11y | tema scuro, WCAG AA piena, drag-drop multi-file, batch >100k con Web Worker, i18n base | nessuna |
| `0.6.0` | Arricchimento dato | parsing semantico CUP, tooltip esplicativi, helper Python | nessuna |
| `0.7.0` | API autoritativa | completamento per nature non pubblicate, checker puntuale con credenziali o proxy documentato | API key |
| `1.0.0` | Produzione stabile | documentazione utente, hardening, dichiarazione accessibilita, eventuale Developers Italia | da valutare |

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
3. SQLite ottimizzato `WITHOUT ROWID`.
4. Chunking in asset da pubblicare su GitHub Releases.
5. `dataset-manifest.json`.
6. Integrazione web con `sql.js-httpvfs`.
7. `OpenCupChecker` Python con download/cache locale.
8. Nuovi esiti `TROVATO_OPENCUP` e `NON_TROVATO_OPENCUP_DA_VERIFICARE`.
9. ADR per release dataset separata e SQLite chunked.

## Milestone `0.4.0`

Prerequisito: PoC su un CSV reale del bulk OpenCUP per misurare dimensione SQLite, copertura dei campi P.IVA/CF, qualita delle descrizioni, presenza di importi nulli o rimodulati e frequenza dei segnaposto.

1. Estensione dello schema dataset con P.IVA/CF titolare, P.IVA/CF beneficiario, costo progetto, finanziamento progetto, descrizione composita, anno decisione, stato progetto, revoca e natura DIPE.
2. Normalizzazione ingest per valori assenti come `DATO NON PRESENTE` e `***************`.
3. API Python `OpenCupChecker.check(...)` con parametri opzionali per P.IVA/CF, importo e descrizione.
4. Mapping colonne web per CUP obbligatorio e campi di coerenza opzionali.
5. Esito cautelativo `POSSIBILE_INCOERENZA_DA_VERIFICARE`, mai esito forte di incoerenza automatica.
6. Dettaglio per campo: match P.IVA/CF titolare o beneficiario, match costo o finanziamento, score descrizione, stato/revoca.
7. Fixture o mini-dataset di test per parity web/Python sui controlli sostanziali.
8. ADR per schema dataset e strategia di matching.
