# Roadmap

| Versione | Tema | Contenuto | Dipendenze |
| --- | --- | --- | --- |
| `0.1.0` | MVP web | Format check, report CSV, web app statica, fixture YAML, regole `R0`-`R5` | nessuna |
| `0.1.x` | Hardening | Bug fix, polish UX, auto-detect colonne, fixture aggiuntivi | nessuna |
| `0.2.0` | Libreria Python | `pip install cup-check`, API `validate_format`, parity sui fixture, nessun parser file nel core | account PyPI |
| `0.3.0` | Dataset OpenCUP self-hosted | Pipeline mensile, SQLite chunked, release `dataset-YYYY-MM`, `OpenCupChecker`, nuovi esiti OpenCUP | nessuna |
| `0.4.0` | UX & a11y | tema scuro, WCAG AA piena, drag-drop multi-file, batch >100k con Web Worker, i18n base | nessuna |
| `0.5.0` | Arricchimento dato | parsing semantico CUP, tooltip esplicativi, helper Python | nessuna |
| `0.6.0` | API autoritativa | completamento per nature non pubblicate, checker puntuale con credenziali o proxy documentato | API key |
| `1.0.0` | Produzione stabile | documentazione utente, hardening, dichiarazione accessibilita, eventuale Developers Italia | da valutare |

## Prossima Milestone: `0.2.0`

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

