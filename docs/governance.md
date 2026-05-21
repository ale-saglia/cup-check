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
- Il publish PyPI usa Trusted Publishing OIDC.
- Il manifest del dataset è firmato con cosign (keyless OIDC) a ogni release; vedi [Verifica del manifest](#verifica-del-manifest).
- Eventuali API autoritative future devono documentare in modo esplicito quali CUP vengono inviati fuori dal browser o dal processo locale.

### Verifica del manifest

I chunk SQLite sono verificati dall'app tramite SHA-256 rispetto al manifest
(`dataset-manifest.json`). Il manifest stesso è firmato con
[cosign](https://github.com/sigstore/cosign) in modalità keyless (OIDC) durante il
job `build` di `release-dataset.yml`. La firma è registrata nel
[Rekor transparency log](https://rekor.sigstore.dev), pubblico e append-only.

Il certificato di firma attesta l'identità esatta del workflow che ha prodotto il manifest:

| Campo | Valore |
|---|---|
| Issuer | `https://token.actions.githubusercontent.com` |
| Subject | `https://github.com/ale-saglia/cup-check/.github/workflows/release-dataset.yml@refs/...` |

Per ogni release dataset sono presenti (su GitHub Releases e su GitHub Pages sotto
`datasets/<tag>/`) il manifest e il suo bundle di firma
`dataset-manifest.json.sigstore.json` (firma + certificato + Rekor entry).

**Verifica con cosign CLI:**

```bash
cosign verify-blob \
  --bundle dataset-manifest.json.sigstore.json \
  --certificate-identity-regexp \
    "https://github.com/ale-saglia/cup-check/.github/workflows/release-dataset.yml@refs/.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  dataset-manifest.json
```

**Verifica con Python (`pip install sigstore`):**

```bash
python -m sigstore verify identity \
  --bundle dataset-manifest.json.sigstore.json \
  --cert-identity-regexp \
    "https://github.com/ale-saglia/cup-check/.github/workflows/release-dataset.yml@refs/.*" \
  --cert-oidc-issuer "https://token.actions.githubusercontent.com" \
  dataset-manifest.json
```

**Verifica offline** (il bundle include già la Rekor entry):

```bash
cosign verify-blob \
  --bundle dataset-manifest.json.sigstore.json \
  --certificate-identity-regexp \
    "https://github.com/ale-saglia/cup-check/.github/workflows/release-dataset.yml@refs/.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --insecure-ignore-tlog \
  dataset-manifest.json
```

## Release

La checklist operativa completa è in [Processo di release](release-process.md).

- Software: tag `v*`, SemVer.
- Dataset: tag `dataset-YYYY-MM`, indipendente dalle release software.
- `release-web.yml` deploya GitHub Pages quando viene pushato un tag `v*`.
- `release-python.yml` pubblica su PyPI al push di un tag software `vX.Y.Z`, usando Trusted Publishing OIDC e l'environment GitHub `pypi`; `workflow_dispatch` serve solo a recuperare tag software già esistenti.
- `release-dataset.yml` costruisce, firma e pubblica il dataset mensile su GitHub Releases e GitHub Pages.

## Definition Of Done

- Codice mergiato via PR.
- Test automatici verdi.
- Documentazione aggiornata.
- Changelog aggiornato quando cambia superficie utente.
- Lighthouse sopra le soglie MVP per il web.
- ADR per decisioni architetturali non banali.
- Fixture aggiornati prima dell'implementazione quando cambia una regola.
