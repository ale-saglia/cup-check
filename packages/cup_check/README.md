# cup-check

Libreria Python per validare localmente il formato dei Codici Unici di Progetto (CUP).

La verifica è solo formale: un CUP con formato valido viene restituito come
`FORMATO_VALIDO_DA_VERIFICARE`, non come CUP esistente.

```python
from cup_check import validate_format

result = validate_format("G17H03000130001")

print(result.outcome)
print(result.failed_rules)
```

Per validare più valori:

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

Per verificare la presenza nel perimetro OpenCUP con un indice SQLite locale:

```python
from cup_check import OpenCupChecker

with OpenCupChecker.from_manifest(
    "dataset-manifest.json",
    sqlite_path="cup-index.sqlite",
) as checker:
    result = checker.check("G17H03000130001")

print(result.outcome)
```

Per usare l'ultimo dataset pubblicato con cache locale:

```python
from cup_check import OpenCupChecker

checker = OpenCupChecker.from_latest(cache_dir=".cup-check-cache")
result = checker.check("G17H03000130001")
```

Se il dataset non è disponibile, il checker resta cautelativo e restituisce
`FORMATO_VALIDO_DA_VERIFICARE` per i CUP formalmente validi.

## Logging

La libreria usa logger nel namespace `cup_check` e non configura handler o
livelli globali. Le applicazioni chiamanti possono governare la verbosità con
il logging standard di Python:

```python
import logging

logging.getLogger("cup_check").setLevel(logging.INFO)
```
