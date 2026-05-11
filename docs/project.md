# Progetto

> Stato: `0.3.0` pronta per release - Target MVP: `0.1.0` - Owner: Alessandro - Repo: `ale-saglia/cup-check`

`cup-check` e uno strumento per la verifica massiva e locale dei Codici Unici di Progetto (CUP).

Il progetto include una web app statica servita da GitHub Pages e una libreria Python importabile. La verifica formale resta separata dal lookup dataset: un CUP con formato valido e senza dataset disponibile resta `FORMATO_VALIDO_DA_VERIFICARE`.

La documentazione di progetto e divisa qui:

- [Product](product.md): contesto, obiettivi, vincoli e postura epistemica.
- [MVP](mvp.md): scope `0.1.0`, regole funzionali e criteri di accettazione.
- [Architecture](architecture.md): architettura corrente e direzione tecnica.
- [Technical Spec](technical-spec.md): stack, struttura repo, fixture, validatore e workflow.
- [Roadmap](roadmap.md): milestone da `0.1.0` a `1.0.0`.
- [Data Sources](data-sources.md): fonti dati, dataset OpenCUP e manifest futuro.
- [Governance](governance.md): sicurezza, privacy, release e definition of done.
- [Parity](parity.md): fixture YAML come specifica funzionale condivisa.
- [Glossario](glossary.md): termini principali.
- [ADR](adr/): decisioni architetturali.

## Postura Epistemica

Il prodotto preferisce segnalare un CUP come "da verificare" piuttosto che dichiarare valido un CUP fasullo. Nessun esito di esistenza viene prodotto senza una fonte autoritativa o un dataset esatto che ne delimiti chiaramente il perimetro. Strutture probabilistiche, come Bloom filter, non possono essere fonte primaria di esiti utente.
