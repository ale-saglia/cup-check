# AGENTS.md

Istruzioni operative per agenti di coding su questo repo.

- Leggere `docs/project.md` prima di modifiche sostanziali.
- I fixture in `tests/fixtures/*.yaml` sono la specifica funzionale: aggiornali prima di cambiare il validatore.
- Nell'MVP non introdurre esiti di verifica esistenza. Gli unici outcome ammessi sono `INVALIDO_FORMATO` e `FORMATO_VALIDO_DA_VERIFICARE`.
- Tenere il web package statico e deployabile su GitHub Pages.
- Preferire modifiche piccole, testate e coerenti con la roadmap.
- Non aggiungere servizi server-side nell'MVP.

## Commit message

Usare Conventional Commits:

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
docs: split project documentation into docs
chore: remove python workspace placeholders
fix(web): keep acceptance threshold stable in ci
test(fixtures): add lowercase cup edge case
feat(web): add pasted cup input
```
