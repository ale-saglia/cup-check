# AGENTS.md

Istruzioni operative per agenti di coding su questo repo.

- Leggere `docs/project.md` prima di modifiche sostanziali.
- I fixture in `tests/fixtures/*.yaml` sono la specifica funzionale: aggiornali prima di cambiare il validatore.
- Nell'MVP non introdurre esiti di verifica esistenza. Gli unici outcome ammessi sono `INVALIDO_FORMATO` e `FORMATO_VALIDO_DA_VERIFICARE`.
- Tenere il web package statico e deployabile su GitHub Pages.
- Preferire modifiche piccole, testate e coerenti con la roadmap.
- Non aggiungere servizi server-side nell'MVP.

## Messaggi di commit

Usare Conventional Commits con descrizioni in italiano. Il `type` resta quello standard in inglese (`feat`, `fix`, `docs`, ecc.):

```text
<type>(<scope>): <descrizione breve>
```

Regole:

- usare descrizioni brevi, in minuscolo, all'imperativo o forma verbale semplice;
- preferire scope utili quando chiariscono l'area (`web`, `docs`, `fixtures`, `ci`, `release`);
- non mettere il punto finale nella prima riga;
- se la modifica cambia comportamento utente, fixture o roadmap, aggiungere un body sintetico con il razionale;
- tenere commit piccoli e tematici: docs separati da codice quando possibile.

Type consigliati:

- `feat`: nuova funzionalita utente;
- `fix`: correzione bug;
- `docs`: documentazione;
- `test`: fixture o test;
- `chore`: manutenzione senza comportamento utente;
- `ci`: workflow GitHub Actions;
- `refactor`: riorganizzazione senza cambio funzionale;
- `build`: dipendenze o build tooling.

Esempi:

```text
docs: dividi la documentazione di progetto
chore: rimuovi placeholder python dal workspace
fix(web): stabilizza soglia di accettazione in ci
test(fixtures): aggiungi caso cup minuscolo
feat(web): aggiungi input cup incollato
```
