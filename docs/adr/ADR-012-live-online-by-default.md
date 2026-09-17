# ADR-012: Live online by default, sorgente MVT pinnata, consenso implicito

Data: 2026-09-17.
Stato: accettato.
Supersede: [ADR-009](ADR-009-live-runtime-consent.md).
Contesto: il prodotto deve essere giocabile online "out of the box". Il modello
di ADR-009 (default offline + consenso esplicito e revocabile per sessione)
aggiungeva attrito a ogni avvio, mentre il rischio che il gate di consenso
copriva — endpoint arbitrario e trasferimento di dati senza azione esplicita —
è ormai mitigato per costruzione: la sorgente live predefinita è il provider
MVT pinnato a un endpoint costante di compile-time (mai input utente o URL).

## Decisione

- La modalità predefinita al load è online (`open-world-live`); l'app avvia
  automaticamente una sessione online con l'origine configurata o di default.
- La sorgente live predefinita (e unica configurabile dall'UI) è il provider
  `openfreemap-mvt`, pinnato al dataset versionato costante: `provider` e
  `endpoint` non sono più campi dell'interfaccia (rimossi dal form).
- Il consenso è implicito e sempre attivo: la casella è mostrata come
  presa d'atto fissa, non revocabile. Il modo per non usare la rete è
  selezionare esplicitamente la modalità offline.
- La modalità offline resta disponibile dall'UI; selezionandola gli input
  latitudine/longitudine (irrilevanti, perché si usa il fixture) vengono
  disabilitati.
- I provider `osm` e `http` restano disponibili solo via opt-in esplicito
  nell'URL (dev/test), ancora subordinati all'allowlist di endpoint e al
  pinning dell'origine di sviluppo.

## Motivazione di sicurezza

- L'endpoint live del percorso predefinito è una costante del codice, non
  derivabile da input utente o da parametri URL: non esiste un vettore di
  endpoint arbitrario (né SSRF-like) sul percorso default.
- L'unico dato inviato al provider è l'origine della mappa (posizione pubblica
  a grana grossa), non la posizione personale precisa dell'utente.
- L'allowlist di endpoint HTTPS e il pinning dell'origine di sviluppo restano
  invariati e vincolanti per i percorsi opt-in `osm`/`http`.
- L'opt-out dalla rete è la scelta esplicita della modalità offline.

## Conseguenze

- Il client effettua richieste di rete al load per default; in un ambiente
  offline la sessione entra in stato di errore con affordance di `Riprova` e
  l'utente può passare alla modalità offline.
- La suite E2E resta deterministica pinnando le tile MVT a un fixture
  (`tests/e2e` intercetta `tiles.openfreemap.org`).
- Le invarianti di consenso in `SECURITY.md` e le righe di stato vengono
  aggiornate di conseguenza; ADR-009 è marcato come superseded.
