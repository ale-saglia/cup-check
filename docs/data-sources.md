# Data Sources

MVP `0.1.0`: nessuna fonte dati esterna.

La web app non chiama API e non verifica l'esistenza dei CUP. I link OpenCUP nel report servono solo per verifica manuale da parte dell'utente.

La verifica su dataset OpenCUP self-hosted e prevista da `0.3.0`. La verifica autoritativa via API Sogei resta una milestone successiva e opzionale.

## Dataset OpenCUP Self-Hosted

Il pattern previsto e uno SQLite esatto pubblicato come asset di release `dataset-YYYY-MM`. Il database logico puo essere diviso in chunk binari per evitare file enormi nel repo:

```text
cups.sqlite
├── cups.sqlite.000
├── cups.sqlite.001
└── cups.sqlite.002
```

Schema minimale previsto:

```sql
CREATE TABLE cups (
  cup TEXT PRIMARY KEY,
  natura TEXT,
  anno INTEGER,
  area TEXT,
  revocato INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
```

## Esiti Futuri

| Esito | Significato |
| --- | --- |
| `TROVATO_OPENCUP` | CUP presente nel mirror OpenCUP, autoritativo solo per il perimetro pubblicato. |
| `NON_TROVATO_OPENCUP_DA_VERIFICARE` | CUP non presente nel mirror: potrebbe non esistere o non essere pubblicato su OpenCUP. |

## Manifest Dataset

`dataset-manifest.json` sara il collante tra software e dataset:

```json
{
  "schema_version": 1,
  "dataset_tag": "dataset-2026-05",
  "released_at": "2026-05-05T03:14:00Z",
  "sources_snapshot_date": "2026-05-01",
  "schema": {
    "table": "cups",
    "version": 1
  },
  "chunks": {
    "base_url": "https://github.com/<owner>/cup-check/releases/download/dataset-2026-05",
    "files": ["cups.sqlite.000", "cups.sqlite.001"],
    "chunk_size_bytes": 52428800,
    "total_size_bytes": 104857600
  },
  "sha256": "abcd...ef01",
  "n_records": 9842317,
  "min_software_version": "0.3.0"
}
```
