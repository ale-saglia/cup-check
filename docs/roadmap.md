# Roadmap

| Versione | Tema | Contenuto | Dipendenze |
| --- | --- | --- | --- |
| `0.1.0` | MVP web | Format check, report CSV, web app statica, fixture YAML, regole `R0`-`R5` | nessuna |
| `0.1.x` | Hardening | Bug fix, polish UX, auto-detect colonne, fixture aggiuntivi | nessuna |
| `0.2.0` | Libreria Python | `pip install cup-check`, API `validate_format`, parity sui fixture, nessun parser file nel core | account PyPI |
| `0.3.0` | Dataset OpenCUP self-hosted | Pipeline mensile, SQLite chunked, release `dataset-YYYY-MM`, range request via `sql.js-httpvfs` per verifica esistenza CUP, `OpenCupChecker`, nuovi esiti OpenCUP | nessuna |
| `0.4.0` | Coerenza atto | Espansione schema dataset (stato, natura, P.IVA/CF, importi, descrizione); estensione range request per campi aggiuntivi; cross-check CUP con dati atto; esiti cautelativi per possibili inversioni | nessuna |
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
3. SQLite ottimizzato `WITHOUT ROWID`, schema iniziale con sola colonna `cup`.
4. Chunking in asset da pubblicare su GitHub Releases.
5. `dataset-manifest.json`.
6. Integrazione web tramite HTTP Range request e `sql.js-httpvfs`: query limitata all'esistenza del CUP (`SELECT 1 FROM cups WHERE cup = ?`), nessun campo aggiuntivo.
7. `OpenCupChecker` Python con download/cache locale.
8. Nuovi esiti `TROVATO_OPENCUP` e `NON_TROVATO_OPENCUP_DA_VERIFICARE`.
9. ADR per release dataset separata e SQLite chunked.

## Milestone `0.4.0`

1. Espansione schema dataset: colonne `attivo`, `natura_index`, `cup_master`, `updated_on_sort`, `piva_cf_titolare`, `piva_cf_beneficiario`, `costo_progetto_cents`, `finanziamento_progetto_cents`, `descrizione_full`.
2. Strategia dedup aggiornata a `ON CONFLICT(cup) DO UPDATE SET ... WHERE excluded.updated_on_sort > cups.updated_on_sort`.
3. Normalizzazione ingest per valori assenti come `DATO NON PRESENTE` e `***************`.
4. Estensione integrazione web: le range request via `sql.js-httpvfs` leggono i campi aggiuntivi per alimentare i controlli di coerenza.
5. API Python `OpenCupChecker.check(...)` con parametri opzionali per P.IVA/CF, importo e descrizione.
6. Mapping colonne web per CUP obbligatorio e campi di coerenza opzionali.
7. Esito cautelativo `POSSIBILE_INCOERENZA_DA_VERIFICARE`, mai esito forte di incoerenza automatica.
8. Dettaglio per campo: match P.IVA/CF titolare o beneficiario, match costo o finanziamento, score descrizione, stato/revoca.
9. Fixture o mini-dataset di test per parity web/Python sui controlli sostanziali.
10. ADR per schema dataset e strategia di matching.
