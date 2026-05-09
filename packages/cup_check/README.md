# cup-check

Libreria Python per validare localmente il formato dei Codici Unici di Progetto (CUP).

La verifica e solo formale: un CUP con formato valido viene restituito come
`FORMATO_VALIDO_DA_VERIFICARE`, non come CUP esistente.

```python
from cup_check import validate_format

result = validate_format("G17H03000130001")

print(result.outcome)
print(result.failed_rules)
```

Per validare piu valori:

```python
from cup_check import validate_many

results = validate_many(["G17H03000130001", "117H03000130001"])
```
