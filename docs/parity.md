# Parity

I fixture in `tests/fixtures/*.yaml` sono la specifica funzionale del validatore.

Nel bootstrap iniziale la parity e verificata solo sul validatore JavaScript.

```bash
cd packages/web
npm test
```

Da `0.2.0`, gli stessi fixture in `tests/fixtures/*.yaml` saranno letti anche dalla libreria Python.

Regole:

- non duplicare i fixture per linguaggio;
- aggiornare i fixture prima dell'implementazione quando cambia una regola;
- se un input e vuoto, l'unica regola fallita e `R0`;
- web e Python devono produrre stessi outcome e stesse failed rules.
