# Data Sources

MVP `0.1.0`: nessuna fonte dati esterna.

La web app non chiama API e non verifica l'esistenza dei CUP. I link OpenCUP nel report servono solo per verifica manuale da parte dell'utente.

La verifica su dataset OpenCUP self-hosted è prevista da `0.3.0`. La verifica remota opzionale è pianificata in `0.8.0`–`0.9.0`: la web app la espone come tool tramite un Cloudflare Worker (nessun segreto nel browser); il package Python la supporta con credenziali BYOK configurabili dall'utente (`RemoteMefProvider`).

## Fonte OpenCUP

La fonte primaria per la milestone `0.3.0` è la pagina OpenCUP
[Accesso agli open data](https://www.opencup.gov.it/portale/web/opencup/accesso-agli-open-data).

Alla verifica del 2026-05-09, la pagina dichiara l'aggiornamento di maggio 2026 con CUP
relativi a tutte le nature aggiornati al `01.05.2026`. Il dataset progetti è pubblicato come
zip di 7 CSV:

```text
https://www.opencup.gov.it/portale/documents/21195/299152/OpendataProgetti.zip/
```

Il file reale scaricato il 2026-05-09 contiene CSV con campi quotati, separatore punto e
virgola (`;`) e testo UTF-8.

## Dataset OpenCUP Self-Hosted

Il pattern previsto è un dataset esatto versionato come release `dataset-YYYY-MM` e servito
alla web app tramite asset statici GitHub Pages. Per mantenere la web app statica e preparare
i controlli sostanziali, il dataset è separato in due livelli:

```text
dataset-YYYY-MM
├── dataset-manifest.json
├── dataset-latest.json
├── cup-index.sqlite.*
└── details-*.sqlite
```

Nella `0.3.0` è obbligatorio solo l'indice CUP. Il dataset dettagli viene introdotto nella milestone di coerenza atto, spostata dopo il tool PDF `0.4.0`.

Schema logico dell'indice CUP:

```sql
CREATE TABLE cup_index (
  cup TEXT PRIMARY KEY,
  detail_chunk INTEGER
) WITHOUT ROWID;
```

`cup` è la chiave primaria dell'indice. `detail_chunk` indica il chunk del dataset dettagli che contiene i dati completi del CUP; nella `0.3.0` può essere assente o valorizzato a `NULL` finché non esiste il dataset dettagli. Se la build trova duplicati nel bulk OpenCUP, segnala un warning e mantiene il record con data di aggiornamento più recente.

Per la `0.3.0` l'indice contiene solo le informazioni necessarie al lookup esatto di presenza nel perimetro OpenCUP. Gli altri campi sono già dichiarati nel mapping come `destination: false`, così possono essere abilitati in modo esplicito nel dataset dettagli quando partirà la milestone di coerenza atto.

La trasformazione CSV -> SQLite è dichiarata in
`packages/cup_check/src/cup_check/opencup_dataset_schema.yaml`: ogni colonna destinazione
indica la colonna sorgente OpenCUP e il tipo di normalizzazione (`cup`, `category`,
`money_cents`, `date`, `bool_equals`, ecc.). Il flag `destination` controlla se il campo entra
nella tabella finale `cups`. Gli importi `*_cents` sono interi in centesimi:
evitano arrotondamenti floating point e restano ampiamente dentro il limite `INTEGER` a 64 bit
di SQLite. La documentazione completa del DSL è in [docs/dataset-schema.md](dataset-schema.md).

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

La stima preliminare per uno SQLite con i campi di coerenza è tra 800 MB e 1.5 GB resta da confermare con misure sul dataset reale. Per evitare di scaricare sempre tutto, la milestone di coerenza atto pubblicherà un dataset dettagli shardato: il browser usa l'indice CUP per capire quali chunk dettagli servono ai CUP caricati e scarica solo quelli necessari. GitHub Pages resta il canale operativo per il consumo browser degli asset statici; GitHub Releases resta archivio versionato della release dataset. Storage statici esterni restano opzioni di fallback solo se Pages o Releases diventassero insufficienti.

## Esiti Futuri

| Esito | Significato |
| --- | --- |
| `TROVATO_OPENCUP` | CUP presente nel mirror OpenCUP, autoritativo solo per il perimetro pubblicato. |
| `NON_TROVATO_OPENCUP_DA_VERIFICARE` | CUP non presente nel mirror: potrebbe non esistere o non essere pubblicato su OpenCUP. |
| `POSSIBILE_INCOERENZA_DA_VERIFICARE` | Uno o più dati associati al CUP non coincidono con il dataset nel perimetro controllato; richiede verifica umana. |

## Manifest Dataset

`dataset-manifest.json` sarà il collante tra software e dataset:

```json
{
  "schema_version": 1,
  "dataset_tag": "dataset-2026-05",
  "released_at": "2026-05-05T03:14:00Z",
  "sources_snapshot_date": "2026-05-01",
  "schema": {
    "table": "cup_index",
    "version": 1
  },
  "cup_index": {
    "base_url": "https://<owner>.github.io/cup-check/datasets/dataset-2026-05",
    "files": ["cup-index.sqlite.000", "cup-index.sqlite.001"],
    "files_sha256": ["1111...aaaa", "2222...bbbb"],
    "chunk_size_bytes": 52428800,
    "total_size_bytes": 104857600,
    "sha256": "abcd...ef01"
  },
  "detail_store": {
    "base_url": "https://<owner>.github.io/cup-check/datasets/dataset-2026-05",
    "shards": [
      { "id": 0, "file": "details-000.sqlite", "sha256": "1234...abcd", "size_bytes": 73400320 },
      { "id": 1, "file": "details-001.sqlite", "sha256": "5678...ef01", "size_bytes": 73400320 }
    ]
  },
  "n_records": 9842317,
  "min_software_version": "0.3.0",
  "natura_categories": ["Acquisto beni", "Lavori pubblici"]
}
```

`detail_store` è opzionale nella `0.3.0` e diventa obbligatorio quando la milestone di coerenza atto abilita i controlli sostanziali.

`cup_index.sha256` identifica l'indice SQLite ricomposto. `cup_index.files_sha256` identifica i singoli chunk: il browser verifica ogni file scaricato prima del reassembly e ritenta il download dei chunk corrotti o incompleti.

Il contratto architetturale è fissato in [ADR 0007](adr/0007-dataset-statico-indice-dettagli.md). La libreria Python espone loader tipizzati per manifest/latest e `OpenCupChecker`, che riusa gli stessi asset statici scaricando e ricomponendo l'indice SQLite in cache locale.
