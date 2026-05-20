# Security Policy

## Supported Versions

Questo progetto è distribuito come pacchetto Python e web app statica. Le versioni supportate sono quelle pubblicate nell’ultimo rilascio stabile.

## Reporting a Vulnerability

Per segnalare una vulnerabilità, **non aprire una issue pubblica**.

Canali preferiti (in ordine):

1. [GitHub Security Advisories](https://github.com/ale-saglia/cup-check/security/advisories/new) — report riservato, direttamente nel repository.
2. Email: `hello@ale-saglia.com`

Includi:

- descrizione del problema;
- passi per riprodurlo;
- impatto atteso;
- versione o commit interessato.

### Tempi di risposta

Questo è un progetto open source mantenuto a titolo personale. La risposta è **best effort**:

- prima risposta entro **7 giorni lavorativi**;
- stima di impatto e piano di fix entro **30 giorni** dalla conferma della vulnerabilità;
- release con il fix comunicata non appena disponibile.

### Safe harbor

I ricercatori che segnalano vulnerabilità in buona fede, seguendo le istruzioni di questa policy e senza causare danni a terzi o ai dati degli utenti, non saranno oggetto di azioni legali da parte del maintainer. La collaborazione responsabile è benvenuta e apprezzata.

## Scope

Sono in scope:

- problemi nel validatore formale;
- esposizione accidentale di dati;
- supply chain o dependency issues;
- problemi nel packaging o nella web app statica.

Non sono vulnerabilità:

- CUP formalmente valido ma inesistente;
- dati mancanti o incompleti nei dataset pubblici;
- limiti noti del lookup OpenCUP.

## Data Handling

La web app è statica e non invia CUP a servizi server-side del progetto.
