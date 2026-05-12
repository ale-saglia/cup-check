# Security Policy

## Supported Versions

Questo progetto è distribuito come pacchetto Python e web app statica. Le versioni supportate sono quelle pubblicate nell’ultimo rilascio stabile.

## Reporting a Vulnerability

Per segnalare una vulnerabilità, non aprire una issue pubblica. Contatta il maintainer tramite GitHub Security Advisories.

Includi:
- descrizione del problema;
- passi per riprodurlo;
- impatto atteso;
- versione o commit interessato.

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
