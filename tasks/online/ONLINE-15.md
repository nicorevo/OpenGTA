# ONLINE-15: Ingresso live con consenso e configurazione validata

**Stato:** pianificato.
**Dipendenze:** ONLINE-10, ONLINE-12, ONLINE-13, ONLINE-14.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, circa 5 file di codice/test piu' README/ADR.
**Finding:** miglioramenti di ingresso utente e policy endpoint.

## Obiettivo

Consentire l'avvio del live dalle coordinate con un controllo operativo
esplicito, senza richiedere la composizione manuale di query string e senza
inviare dati prima del consenso. L'URL resta un ingresso supportato, ma viene
validato con la stessa policy dell'interfaccia.

## READ

- Letture comuni, C-SESSION e log dei prerequisiti.
- `src/world/runtime/live-config.ts`, `src/world/runtime/live-config.test.ts`.
- `src/app/bootstrap.ts`, `src/app/runtime-session.ts`.
- `README.md`, `SECURITY.md`, `docs/adr/ADR-009-live-runtime-consent.md`.
- Skill `frontend-ui-engineering` per la piccola UI e `security-and-hardening`
  per il confine di configurazione, oltre alle skill di sviluppo comuni.

## MAY MODIFY / DO NOT TOUCH

Modificabili: live-config e test, `src/app/live-controls.ts` (nuovo), bootstrap,
`tests/e2e/live-config.spec.ts` (nuovo); README/ADR per configurazione e consenso.
Non introdurre geocoder, geolocalizzazione automatica, framework UI, account,
backend o hosting. Non riscrivere il motore o la macchina di sessione.

## Esecuzione TDD

1. Testare parsing condiviso di modalita', provider, coordinate e endpoint:
   NaN/infinito, limiti lat/lon, stringhe vuote, provider sconosciuto, URL
   invalido o troppo lungo, userinfo e schema non ammesso. Distinguere parametro
   assente (default esplicito) da parametro presente ma vuoto (errore).
2. Policy trusted passata al parser: in build usare endpoint HTTPS autorizzati
   da configurazione del progetto, default globale del prototipo incluso.
   L'URL dell'utente non puo' ampliare la allowlist. HTTP solo in development
   verso endpoint locali esplicitamente consentiti; non accettare host che
   somigliano a localhost per sottostringa. Non incorporare segreti nel client.
3. Controlli compatti nel gioco: modalita', latitudine/longitudine, consenso
   non preselezionato, Avvia e Interrompi. Mantenere canvas/attribuzione e
   default offline; non creare una landing page. Il provider HTTP custom resta
   disponibile solo quando la configurazione trusted lo autorizza.
4. Nessuna rete all'apertura dei controlli, al typing o su input invalido.
   Avvia valido crea una sessione; interrompi/revoca la termina e cancella
   pending senza resuscitare callback. Un URL live con consent=1 mantiene la
   compatibilita' esplicita, senza trasformare il consenso in preferenza eterna.
5. UI accessibile: label associate, focus visibile, stato aria-live, errori
   testuali, campi che non si sovrappongono al resize. Nessun tutorial o dettaglio
   di implementazione nel flusso utente; i dettagli tecnici restano in F3.

## Accettazione

- [ ] AC1: URL e controlli condividono validazione/policy; richieste assenti
  senza consenso o con input invalido, endpoint non autorizzato o userinfo.
- [ ] AC2: avvio valido funziona con fixture, stop/revoca cancellano sessione
  e rete; default offline e URL esplicitamente consentito restano supportati.
- [ ] AC3: flusso tastiera e resize 1280x720/390x844 verificati, errori e stato
  comprensibili, attribuzione visibile e nessuna persistenza implicita del consenso.

## Verifica

`npm run test:run -- src/world/runtime/live-config.test.ts`

`npm run test:e2e -- tests/e2e/live-config.spec.ts tests/e2e/live-startup.spec.ts tests/e2e/live-streaming.spec.ts`

Gate comune e checkpoint C5. Usare un endpoint HTTP locale del contesto E2E
intercettato, non una allowlist attivabile con un parametro URL pubblico.
Un check della build deve confermare che l'eccezione development non abilita
HTTP arbitrario in produzione. Documentare i canali trusted di configurazione.

## Handoff

Riportare parametri compatibili, allowlist, differenze dev/build e lifecycle
del consenso. Questo hardening del client non equivale ad aver scelto un
provider di produzione o distribuito il sito: tali decisioni restano differite.
