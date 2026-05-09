# Data Sources

MVP `0.1.0`: nessuna fonte dati esterna.

La web app non chiama API e non verifica l'esistenza dei CUP. I link OpenCUP nel report servono solo per verifica manuale da parte dell'utente.

La verifica su dataset OpenCUP self-hosted e prevista da `0.3.0`. La verifica autoritativa via API Sogei resta una milestone successiva e opzionale.

## Fonte OpenCUP

La fonte primaria per la milestone `0.3.0` e la pagina OpenCUP
[Accesso agli open data](https://www.opencup.gov.it/portale/web/opencup/accesso-agli-open-data).

Alla verifica del 2026-05-09, la pagina dichiara l'aggiornamento di maggio 2026 con CUP
relativi a tutte le nature aggiornati al `01.05.2026`. Il dataset progetti e pubblicato come
zip di 7 CSV:

```text
https://www.opencup.gov.it/portale/documents/21195/299152/OpendataProgetti.zip/
```

Il file reale scaricato il 2026-05-09 contiene CSV con campi quotati, separatore punto e
virgola (`;`) e testo UTF-8.

## Dataset OpenCUP Self-Hosted

Il pattern previsto e uno SQLite esatto pubblicato come asset di release `dataset-YYYY-MM`. Il database logico puo essere diviso in chunk binari per evitare file enormi nel repo:

```text
cups.sqlite
├── cups.sqlite.000
├── cups.sqlite.001
└── cups.sqlite.002
```

Schema iniziale previsto per il lookup di esistenza:

```sql
CREATE TABLE cups (
  cup TEXT PRIMARY KEY
) WITHOUT ROWID;
```

`cup` e la chiave primaria del dataset. Se la build trova duplicati nel bulk OpenCUP,
segnala un warning e mantiene il record con data di aggiornamento piu recente.

Per la `0.3.0` la tabella destinazione contiene solo `cup`, sufficiente al lookup esatto di
presenza nel perimetro OpenCUP. Gli altri campi sono gia dichiarati nel mapping come
`destination: false`, cosi possono essere abilitati in modo esplicito nella `0.4.0`.

La trasformazione CSV -> SQLite e dichiarata in
`packages/cup_check/src/cup_check/opencup_dataset_schema.yaml`: ogni colonna destinazione
indica la colonna sorgente OpenCUP e il tipo di normalizzazione (`cup`, `category`,
`money_cents`, `date`, `bool_equals`, ecc.). Il flag `destination` controlla se il campo entra
nella tabella finale `cups`. Gli importi `*_cents` sono interi in centesimi:
evitano arrotondamenti floating point e restano ampiamente dentro il limite `INTEGER` a 64 bit
di SQLite.

Colonne candidate dal bulk OpenCUP:

- `CUP`;
- `PIVA_CODFISCALE_SOG_TITOLARE`;
- `PIVA_CF_BENEFICIARIO`;
- `COSTO_PROGETTO`;
- `FINANZIAMENTO_PROGETTO`;
- `DESCRIZIONE_SINTETICA_CUP`;
- `DESCRIZIONE_INTERVENTO`;
- `STRUTTURA_INFRASTRUTTURA`;
- `INDIRIZZO_INTERVENTO`;
- `ANNO_DECISIONE`;
- `STATO_PROGETTO`;
- `DATA_CHIUSURA_REVOCA`;
- `NATURA_DIPE`;
- `CUP_MASTER`, se utile per distinguere progetti master/figli.

## Decisioni Semantiche Aperte

Queste decisioni non vanno fissate senza misure su un campione reale:

- importo: confrontare `COSTO_PROGETTO`, `FINANZIAMENTO_PROGETTO` o considerare coerente il match su uno dei due;
- soggetto: confrontare P.IVA/CF contro titolare, beneficiario o entrambi;
- descrizione: costruire una descrizione composita normalizzata e scegliere una soglia cautelativa di token overlap;
- valori assenti: normalizzare segnaposto come `DATO NON PRESENTE` e `***************` a `NULL`;
- stato/revoca: non escludere CUP chiusi o revocati, ma riportare il dettaglio nel risultato.

La stima preliminare per uno SQLite con i campi di coerenza e tra 800 MB e 1.5 GB, da confermare con PoC. GitHub Releases resta lo storage preferito anche a questa scala, con chunk pubblici e manifest versionato. Storage esterni come Turso, Cloudflare R2 o HuggingFace Datasets restano opzioni di fallback solo se GitHub Releases diventasse insufficiente.

## Esiti Futuri

| Esito | Significato |
| --- | --- |
| `TROVATO_OPENCUP` | CUP presente nel mirror OpenCUP, autoritativo solo per il perimetro pubblicato. |
| `NON_TROVATO_OPENCUP_DA_VERIFICARE` | CUP non presente nel mirror: potrebbe non esistere o non essere pubblicato su OpenCUP. |
| `POSSIBILE_INCOERENZA_DA_VERIFICARE` | Uno o piu dati associati al CUP non coincidono con il dataset nel perimetro controllato; richiede verifica umana. |

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
  "min_software_version": "0.3.0",
  "natura_categories": ["Acquisto beni", "Lavori pubblici"]
}
```

Il contratto architetturale e fissato in [ADR 0005](adr/0005-dataset-release-sqlite-chunked.md). La libreria Python espone un loader tipizzato del manifest per riusare la stessa struttura nella pipeline e nel futuro `OpenCupChecker`.
