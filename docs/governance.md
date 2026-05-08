# Governance

- Repo pubblico come single source of truth.
- Conventional Commits.
- SemVer per le release.
- Fixture YAML come specifica funzionale.
- ADR per decisioni architetturali non banali.

Ogni modifica alle regole di validazione deve partire da un aggiornamento dei fixture.

## Sicurezza E Privacy

- Nell'MVP nessun dato dell'utente lascia il browser.
- I CUP sono codici amministrativi e non dati personali direttamente identificativi.
- Nessun segreto nell'MVP.
- Da `0.2.0`, publish PyPI preferibilmente con Trusted Publishing OIDC.
- Eventuali API autoritative future devono documentare in modo esplicito quali CUP vengono inviati fuori dal browser o dal processo locale.

## Release

- Software: tag `v*`, SemVer.
- Dataset futuro: tag `dataset-YYYY-MM`, indipendente dalle release software.
- `release-web.yml` deploya GitHub Pages quando viene pushato un tag `v*` o pubblicata una release software.

## Definition Of Done

- Codice mergiato via PR.
- Test automatici verdi.
- Documentazione aggiornata.
- Changelog aggiornato quando cambia superficie utente.
- Lighthouse sopra le soglie MVP per il web.
- ADR per decisioni architetturali non banali.
- Fixture aggiornati prima dell'implementazione quando cambia una regola.
