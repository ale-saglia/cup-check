# MVP 0.1.0

## Stato

Il bootstrap del repo e l'MVP `0.1.0` sono completati; la linea web statica include:

- web app Vite vanilla JS;
- parser CSV/XLSX;
- input testuale per liste di CUP;
- validatore JavaScript;
- export CSV;
- Service Worker offline-first;
- fixture YAML consumati dai test Vitest;
- workflow CI e deploy GitHub Pages.

## In Scope

- Web app statica su GitHub Pages.
- Upload locale CSV e XLSX.
- Incolla testo, un CUP per riga.
- Selezione interattiva della colonna CUP.
- Validazione formale deterministica.
- Due soli esiti: `INVALIDO_FORMATO`, `FORMATO_VALIDO_DA_VERIFICARE`.
- Opzione "Ignora CUP assente".
- Export CSV `<filename>_check.csv`.
- Disclaimer esplicito: nessuna verifica di esistenza nell'MVP.
- Fixture YAML iniziali in `tests/fixtures/`.

## Fuori Scope

- Libreria Python importabile, consegnata nella release `0.2.0`.
- CLI dedicata; se servira, sara un wrapper sottile sopra la libreria.
- Verifica esistenza, rinviata a `0.3.0` per il perimetro OpenCUP.
- Verifica importi, anagrafiche, BDAP, ANAC, OpenCoesione.
- Autenticazione, persistenza server-side, multi-tenancy.
- i18n, tema scuro, accessibilita avanzata oltre il gate MVP.

## Regole Formali

Il valore viene normalizzato con `trim` + uppercase e le regole vengono applicate al valore normalizzato. Se la normalizzazione rimuove spazi bianchi o converte lettere in maiuscolo, il dettaglio mostra un avviso non bloccante.

| Regola | Specifica                                            |
| ------ | ---------------------------------------------------- |
| `R0`   | valore vuoto dopo trim                               |
| `R1`   | lunghezza diversa da 15 caratteri dopo trim          |
| `R2`   | charset diverso da lettere maiuscole A-Z e cifre 0-9 |
| `R3`   | prima posizione non alfabetica                       |
| `R4`   | posizioni 5-6 non sono un anno plausibile non futuro |
| `R5`   | quarta posizione non alfabetica                      |

Se il valore e vuoto, l'unica regola fallita e `R0`. Se almeno una regola fallisce, l'esito e `INVALIDO_FORMATO`. Se tutte passano, l'esito e `FORMATO_VALIDO_DA_VERIFICARE`.

Avvisi non bloccanti:

| Avviso | Specifica                       |
| ------ | ------------------------------- |
| `N1`   | spazi bianchi rimossi dal CUP   |
| `N2`   | lettere convertite in maiuscolo |

## Output

- Tabella con riga originale, CUP normalizzato, esito, dettaglio e link OpenCUP per verifica manuale.
- Filtri per esito e ricerca testuale.
- Export CSV con separatore `;` e BOM UTF-8.
- Riepilogo con totale righe, conteggi per esito e durata elaborazione.

## Criteri Di Accettazione

1. File XLSX da 10.000 righe: target prodotto sotto 3 secondi su laptop medio; gate automatico sotto 5 secondi per assorbire cold-start Chromium in CI.
2. Fixture YAML coperti al 100% dai test web.
3. Nessun esito riferito a esistenza.
4. PWA funzionante offline dopo primo caricamento.
5. Deploy Pages automatico su release pubblicata con tag `v*`.
6. Lighthouse: Performance, Accessibility, Best Practices e SEO almeno 90.
7. Repo con README, LICENSE EUPL-1.2, AGENTS.md e CODEOWNERS.
