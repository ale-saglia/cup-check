# Fixture YAML

I fixture sono la specifica funzionale del validatore.

Ogni caso ha questa forma:

```yaml
- id: valid-typical
  description: 'CUP formalmente valido tipico'
  input: 'G17H03000130001'
  expected:
    outcome: FORMATO_VALIDO_DA_VERIFICARE
    failed_rules: []
```

I casi possono dichiarare `options.current_year` per fissare l'anno di riferimento
quando documentano regole dipendenti dal tempo.

Regole ammesse: `R0`, `R1`, `R2`, `R3`, `R4`, `R5`.
Outcome ammessi: `INVALIDO_FORMATO`, `FORMATO_VALIDO_DA_VERIFICARE`.
