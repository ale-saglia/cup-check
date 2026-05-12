# Glossario

- **CUP**: Codice Unico di Progetto, identificatore di 15 caratteri per progetti di investimento pubblico.
- **DIPE**: Dipartimento per la programmazione e il coordinamento della politica economica.
- **OpenCUP**: portale open data del DIPE che pubblica un sottoinsieme dei progetti del Sistema CUP.
- **Sogei**: societa tecnologica del MEF; possibile fonte/API da valutare nelle milestone future.
- **SSoT**: Single Source of Truth.
- **SSoT funzionale**: fixture YAML che definiscono cosa il validatore deve fare.
- **Parity test**: test che verifica che due implementazioni producano gli stessi output sugli stessi input.
- **ADR**: Architecture Decision Record, documento breve che registra una decisione architetturale.
- **PWA**: Progressive Web App, applicazione web funzionante offline dopo la prima visita.
- **Postura epistemica**: vincoli su quando il prodotto puo dichiarare un fatto come vero.
- **Release software**: tag `v*` SemVer che innesca deploy o publish software.
- **Release dataset**: tag `dataset-YYYY-MM` per snapshot OpenCUP.
- **Manifest dataset**: file `dataset-manifest.json` che descrive tag, snapshot, schema, chunk e compatibilita della release dataset.
- **HTTP Range request**: richiesta HTTP di un intervallo di byte, utile per leggere parti di file grandi.
- **Verifica di coerenza atto**: cross-check tra CUP e dati associati nell'atto, come P.IVA/CF, importo e descrizione progetto, contro il dataset disponibile.
- **POSSIBILE_INCOERENZA_DA_VERIFICARE**: esito cautelativo che segnala una discrepanza tra dato dichiarato e dato registrato, senza dichiarare automaticamente l'atto incoerente.
- **Anno di decisione**: anno in cui il soggetto responsabile decide la realizzazione del progetto. Nel formato CUP è rappresentato con due cifre nelle posizioni 5-6 della stringa. Poiché il Sistema CUP è attivo dal 2003, non esiste ambiguità con anni precedenti al 2000. La corrispondenza posizione-anno è verificata empiricamente sul dataset OpenCUP; l'algoritmo di generazione del CUP non è pubblicato nella normativa.
