# ONLINE-01: Provider corretto e risposte distinguibili

**Stato:** completato il 2026-09-09.
**Dipendenze:** nessuna.
**Persona:** root-cause-debugger.
**MODEL CLASS:** STANDARD. **REASONING:** medium.
**Taglia:** M, circa 4 file di codice/test piu' documentazione.
**Finding:** F1 e componente semantica di F5.

## Obiettivo

Il percorso `provider=osm` deve richiedere dati al provider globale esplicitamente
scelto e distinguere risposta geografica vuota da errore del provider. La prova
di riferimento a Lecce ha dato zero elementi col default svizzero e 8.059 con
`overpass-api.de`; quei numeri live non vanno fissati nelle asserzioni.

## READ

- Letture comuni in [README](README.md), contratto C-SOURCE.
- `src/world/runtime/source.ts`, `src/world/runtime/source.test.ts`, `src/world/runtime/live-config.ts`, `src/world/runtime/live-config.test.ts`.
- `tests/e2e/bootstrap.spec.ts`.
- `README.md`, `docs/adr/ADR-007-public-osm-service-boundaries.md`, `docs/adr/ADR-009-live-runtime-consent.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: i due file source, `src/world/runtime/live-config.test.ts` e
`tests/e2e/live-startup.spec.ts` (nuovo), piu' README e ADR-009 per la policy
effettivamente implementata. Non modificare renderer, fisica, compiler o la
semantica della griglia. Non introdurre backend o nuovo provider SDK.

## Esecuzione TDD

1. Aggiungere test del default globale e dell'override esplicito; verificare
   metodo POST, bbox e query. Usare la fixture Lecce gia' committata per una
   regressione E2E `provider=osm` con edifici/strade non vuoti, intercettando
   la rete. Bloccare richieste remote inattese nel contesto di test.
2. Riprodurre `200 + remark + elements: []`, `200 + remark + dati parziali`,
   JSON invalido e risposta vuota valida. Il caso remark deve fallire col
   codice attuale. Introdurre codici di errore stabili secondo C-SOURCE,
   mantenendo causa/status utili e senza esporre payload arbitrari nella UI.
3. Impostare `https://overpass-api.de/api/interpreter` come default del
   prototipo e mantenere l'override esplicito. Eliminare la rotazione automatica
   degli endpoint: gli attuali test "fallback" diventano test di retry sullo
   stesso endpoint. Il timing dei retry resta affidato a ONLINE-03.
4. Non rifiutare `elements: []` in `GeoDataSource`: ONLINE-09/10 stabiliranno
   se un risultato valido contiene un'area giocabile. Aggiornare la descrizione
   del default e del fallback in README/ADR senza dichiarare ripristinato tutto
   il live o garantita la disponibilita' del servizio pubblico.

## Accettazione

- [ ] AC1: il default e l'override usano solo l'endpoint scelto; E2E OSM con
  fixture non vuota mostra geometria e contatori > 0 senza rete reale.
- [ ] AC2: errore HTTP, parsing, forma invalida e remark sono distinguibili;
  `elements: []` senza remark resta valido e non attiva mirror o dati sintetici.
- [ ] AC3: `/` resta offline e il live senza consenso non invia richieste;
  README, ADR e test non descrivono piu' la rotazione dei mirror.

## Verifica

`npm run test:run -- src/world/runtime/source.test.ts src/world/runtime/live-config.test.ts`

`npm run test:e2e -- tests/e2e/live-startup.spec.ts`

Applicare anche il gate comune del README. Per il browser vedere la nota sulle
porte: non riusare alla cieca 5173. Verificare canvas, contatori e console;
non basta l'assenza di pageerror. Nessuna richiesta pubblica necessaria.

## Handoff

Log da [template](EXECUTION-TEMPLATE.md): codici/firme degli errori, query
verificata, endpoint scelto e limiti residui. Sblocca ONLINE-02 e ONLINE-07.
Il rate limiter e lo startup restano difettosi fino ai task successivi.
