# ADR 0004: Libreria Python Senza CLI Dedicata

## Status

Accepted

## Context

La roadmap iniziale prevedeva una CLI come secondo canale d'uso dopo la web app. Il caso d'uso emerso e diverso: chi integra `cup-check` in processi PA o gestionali ha piu valore da una libreria Python importabile che da un comando da invocare via subprocess.

La CLI aggiungerebbe dipendenze, interfacce e manutenzione senza essere necessaria per il valore principale. Se servira, potra essere costruita in futuro come wrapper sottile sopra la libreria.

## Decision

Non introduciamo una CLI dedicata nelle milestone iniziali.

La milestone Python pubblica il package `cup-check` su PyPI con API importabili:

- `validate_format(...)` e `validate_many(...)` per la validazione formale;
- `OpenCupChecker` in una milestone successiva per interrogare il dataset OpenCUP self-hosted;
- un eventuale checker autoritativo futuro, con credenziali fornite dall'utente.

Il package non include parser CSV/XLSX nel core. Accetta stringhe o iterabili di stringhe; eventuali parser potranno vivere in extra opzionali.

## Consequences

La superficie pubblica resta piu piccola e adatta all'integrazione applicativa.

I fixture YAML restano la specifica funzionale condivisa tra web e Python. La CLI non e esclusa per sempre, ma non guida l'architettura del progetto.
