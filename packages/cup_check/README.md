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

Da `0.3.0`, il package include anche il contratto tipizzato per leggere il
`dataset-manifest.json` delle release OpenCUP self-hosted:

```python
from cup_check import load_dataset_manifest

manifest = load_dataset_manifest("dataset-manifest.json")
print(manifest.dataset_tag)
print(manifest.chunks.files)
```
