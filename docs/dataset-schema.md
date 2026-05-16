# Dataset Schema DSL

Il file `packages/cup_check/src/cup_check/opencup_dataset_schema.yaml` dichiara come
trasformare le colonne CSV del bulk OpenCUP in valori normalizzati. È il contratto tra il
formato sorgente e il dataset prodotto dalla libreria Python.

La funzione `build_sqlite_from_projects_zip` usa questo schema per:

- sapere quali colonne CSV leggere e come normalizzarle;
- determinare quali colonne entrano nella tabella SQLite finale (`destination: true`);
- pubblicare nel manifest le liste di categorie ordinate.

Il parametro `schema_path` di `build_sqlite_from_projects_zip` e `iter_project_records`
permette di sostituire lo schema bundled con uno custom, rendendolo parte dell'API pubblica
dalla milestone `0.6.0`.

## Struttura di primo livello

```yaml
schema_version: 1        # intero — versione del DSL, attualmente sempre 1
table: cups              # stringa — nome della tabella SQLite destinazione
category_sets:           # mappa — insiemi di categorie (vedi sotto)
  ...
columns:                 # lista — definizioni delle colonne (vedi sotto)
  - ...
```

## category_sets

Dichiara gli insiemi di categorie usati dalle colonne di tipo `category`.

```yaml
category_sets:
  natura:
    manifest_key: natura_categories
```

Ogni chiave è il nome dell'insieme (referenziato da `category_set` nelle colonne). Il campo
`manifest_key` indica la chiave nel `dataset-manifest.json` in cui il builder pubblica la lista
ordinata dei valori distinti trovati nel bulk; l'ordine determina l'indice intero usato nel
dataset dettagli.

## Campi comuni di ogni colonna

| Campo | Tipo YAML | Obbligatorio | Descrizione |
|---|---|---|---|
| `target` | stringa | sì | Nome della chiave nel record Python prodotto dal mapping |
| `destination` | booleano | sì | `true` → la colonna entra nella tabella SQLite finale |
| `sqlite_column` | stringa | sì | Nome della colonna nella tabella SQLite |
| `sqlite_type` | stringa | sì | Tipo SQLite dichiarato nel DDL (`TEXT`, `INTEGER`, `TINYINT`, `BOOLEAN`, `DATE`, `YEAR`) |
| `source` | stringa o lista | dipende dal tipo | Colonna/e sorgente nel CSV OpenCUP |
| `type` | stringa | sì | Tipo di normalizzazione (vedi sezione seguente) |
| `primary_key` | booleano | no | Aggiunge `PRIMARY KEY` nel DDL |
| `nullable` | booleano | no | `false` aggiunge `NOT NULL` nel DDL |
| `default` | scalare | no | Valore di default SQLite |
| `check` | stringa | no | Espressione SQL da inserire in `CHECK(...)` |

### Normalizzazione del testo

Tutti i tipi che leggono testo applicano prima questa normalizzazione: strip degli spazi
iniziali/finali; i segnaposto `***************` e `DATO NON PRESENTE` diventano `NULL`; la
stringa vuota dopo lo strip diventa `NULL`.

## Tipi di colonna

### `cup`

CUP normalizzato: uppercase e strip. Un record con CUP vuoto o con anno non numerico
(posizioni 4–5 non cifre) è scartato silenziosamente.

```yaml
- target: cup
  source: CUP
  type: cup
  sqlite_type: TEXT
  primary_key: true
```

### `optional_cup`

Come `cup`, ma restituisce `NULL` invece di scartare il record se il valore è assente o
non valido.

```yaml
- target: cup_master
  source: CUP_MASTER
  type: optional_cup
  sqlite_type: TEXT
```

### `cup_year_suffix`

Estrae le due cifre dell'anno dalla posizione 4–5 del CUP (0-based) come intero 0–99. Se
il CUP ha meno di 6 caratteri o le cifre non sono numeriche, restituisce `NULL`.

```yaml
- target: year_suffix
  source: CUP
  type: cup_year_suffix
  sqlite_type: YEAR
  nullable: false
  check: year_suffix BETWEEN 0 AND 99
```

### `optional_text`

Testo normalizzato (vedi [Normalizzazione del testo](#normalizzazione-del-testo)) o `NULL`.
`source` può essere stringa o lista; se è una lista, restituisce il primo valore non-NULL.

```yaml
- target: piva_cf_titolare
  source: PIVA_CODFISCALE_SOG_TITOLARE
  type: optional_text
  sqlite_type: TEXT
```

### `category`

Come `optional_text`, ma dichiara l'appartenenza a un insieme di categorie tramite il campo
`category_set`. Il builder raccoglie i valori distinti durante l'import, li ordina in modo
stabile e li pubblica nel manifest con la chiave indicata da `manifest_key`. L'indice intero
nella lista ordinata è ciò che viene scritto nella colonna SQLite del dataset dettagli.

```yaml
- target: natura
  source:
    - NATURA_DIPE
    - NATURA
  type: category
  category_set: natura      # riferimento a category_sets.natura
  sqlite_type: TINYINT
```

### `money_cents`

Importo monetario come intero in centesimi. Il builder normalizza il formato italiano (`.`
come separatore migliaia, `,` come decimale), moltiplica per 100 con aritmetica decimale
esatta e arrotonda all'intero. Restituisce `NULL` se il valore è assente o non parsabile.

```yaml
- target: costo_progetto_cents
  source: COSTO_PROGETTO
  type: money_cents
  sqlite_type: INTEGER
```

### `joined_text`

Unisce più colonne sorgente con uno spazio, saltando i valori `NULL`. Restituisce `NULL` se
tutte le sorgenti sono `NULL`. `source` deve essere una lista.

```yaml
- target: descrizione_full
  source:
    - DESCRIZIONE_SINTETICA_CUP
    - DESCRIZIONE_INTERVENTO
    - STRUTTURA_INFRASTRUTTURA
    - INDIRIZZO_INTERVENTO
  type: joined_text
  sqlite_type: TEXT
```

### `bool_equals`

`true` se il valore sorgente normalizzato (uppercase, dopo la [normalizzazione del
testo](#normalizzazione-del-testo)) è presente nella lista `true_values` (confronto
case-insensitive). `false` in tutti gli altri casi, inclusi `NULL` e valori non
riconosciuti.

Il campo `true_values` è obbligatorio per questo tipo.

```yaml
- target: attivo
  source: STATO_PROGETTO
  type: bool_equals
  true_values:
    - ATTIVO
  sqlite_type: BOOLEAN
  nullable: false
  default: 0
  check: attivo IN (0, 1)
```

### `date`

Data parsata da stringa. Formati tentati in ordine: `YYYY-MM-DD`, `DD/MM/YYYY`,
`DD-MM-YYYY`, `YYYYMMDD`. Restituisce `NULL` se il valore è assente o non corrisponde a
nessun formato.

```yaml
- target: data_chiusura_revoca
  source: DATA_CHIUSURA_REVOCA
  type: date
  sqlite_type: DATE
```

### `first_date`

Primo valore non-`NULL` parsato come data dalla lista sorgente. Usa gli stessi formati di
`date`. `source` deve essere una lista.

```yaml
- target: updated_on
  source:
    - DATA_AGGIORNAMENTO
    - DATA_ULTIMO_AGGIORNAMENTO
    - DATA_ULTIMA_MODIFICA_SSC
    - DATA_ULTIMA_MODIFICA_UTENTE
    - DATA_CHIUSURA_REVOCA
  type: first_date
  sqlite_type: TEXT
  nullable: false
```
