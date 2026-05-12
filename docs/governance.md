# Governance

- Repo pubblico come single source of truth.
- Conventional Commits.
- SemVer per le release.
- Fixture YAML come specifica funzionale.
- ADR per decisioni architetturali non banali.

Ogni modifica alle regole di validazione deve partire da un aggiornamento dei fixture.

## Postura Epistemica

Il prodotto preferisce segnalare un CUP come "da verificare" piuttosto che dichiarare valido un CUP fasullo. Nessun esito di esistenza viene prodotto senza una fonte autoritativa o un dataset esatto che ne delimiti chiaramente il perimetro. Strutture probabilistiche, come Bloom filter, non possono essere fonte primaria di esiti utente.

## Principi

- **Proporzionalità**: nessuna tecnologia senza un problema specifico.
- **Onestà sui limiti**: UI e API devono dichiarare cosa è e cosa non viene verificato.
- **Asimmetria di rischio**: i falsi positivi sono peggio dei falsi negativi cautelativi.
- **Cautela sui controlli sostanziali**: le discrepanze tra atto e dataset sono sempre "da verificare", mai giudizi automatici di incoerenza definitiva.
- **Stack appropriato**: JavaScript minimale nel browser, Python dove serve integrazione o pipeline.
- **Degradazione graceful**: se una fonte esterna fallisce, il check locale resta disponibile.

## Sicurezza e Privacy

- Nell'MVP nessun dato dell'utente lascia il browser.
- I CUP sono codici amministrativi e non dati personali direttamente identificativi.
- Nessun segreto nell'MVP.
- Il publish PyPI usa preferibilmente Trusted Publishing OIDC.
- Eventuali API autoritative future devono documentare in modo esplicito quali CUP vengono inviati fuori dal browser o dal processo locale.

## Release

- Software: tag `v*`, SemVer.
- Dataset futuro: tag `dataset-YYYY-MM`, indipendente dalle release software.
- `release-web.yml` deploya GitHub Pages quando viene pushato un tag `v*`.
- `release-python.yml` pubblica su PyPI al push di un tag software `vX.Y.Z`, usando Trusted Publishing OIDC e l'environment GitHub `pypi`; `workflow_dispatch` serve solo a recuperare tag software già esistenti.

## Definition Of Done

- Codice mergiato via PR.
- Test automatici verdi.
- Documentazione aggiornata.
- Changelog aggiornato quando cambia superficie utente.
- Lighthouse sopra le soglie MVP per il web.
- ADR per decisioni architetturali non banali.
- Fixture aggiornati prima dell'implementazione quando cambia una regola.
