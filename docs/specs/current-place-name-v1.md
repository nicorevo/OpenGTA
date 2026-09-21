# Nome del luogo corrente nello stato di sessione

Data: 2026-09-21. Approvata dall'utente con "procedi" (opzione A: reverse
geocoding al cambio di zona).

## Obiettivo

Nella barra di stato (`#session-status`, `bootstrap.ts`), nello stato `ready`,
mostrare **il luogo che si sta visualizzando** al posto della scritta statica
"Area pronta" (es. "Lecce, Puglia, Italia"), aggiornato al **cambio di zona**
(non real-time, non polling a intervalli fissi).

## Assunzioni dichiarate (confermate da "procedi")

1. Solo lo stato `ready` mostra il luogo; gli altri stati (`loading`,
   `degraded`, `empty`, `error`, `blocked`) mantengono i messaggi attuali
   invariati.
2. Prima che il primo reverse riesca (e su ogni errore) resta la scritta
   attuale: il luogo è un'aggiunta, mai un requisito per lo stato di sessione.
3. Offline: nessuna richiesta al geocoder, nessun luogo (comportamento
   invariato, "Offline").
  4. Zona = cella di griglia 1000 m nelle coordinate di mondo del veicolo;
     intervallo minimo 5 s tra richieste; al massimo 1 richiesta in-flight (le
     zone nuove restano pendenti fino alla risoluzione; abort solo su
     `dispose`). A top speed (67 m/s) una zona nuova ogni ~15 s → molto sotto
     il policy limit di Nominatim (1 req/s).

## Design

### 1. `src/app/geocode.ts` — `reverse()` sul client esistente

- `NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"`
  (costante pinnata; opzione iniettabile `reverseEndpoint` come per
  `endpoint`).
- `GeocodeClient.reverse(latitude, longitude, signal?)` →
  `Promise<GeocodeCandidate | undefined>`:
  - URL con `URLSearchParams`: `lat`, `lon`, `format=jsonv2`,
    `accept-language=it`, `zoom=10` (livello città).
  - Stesso impianto di `search`: fetcher iniettato, timeout (5 s),
    `readBoundedJson` (256 KiB), errori tipizzati `GeocodeError` con gli
    stessi codici (`network`, `http`, `rate-limited` su 429, `timeout`,
    `invalid-response`, `aborted`).
  - Payload: **singolo oggetto** (non array). `{ error: ... }` = "nessun dato
    per questo punto" → risolve `undefined` (esito legittimo, non errore).
  - Validazione: oggetto (non array/null), `display_name` stringa trim 1..256
    caratteri, altrimenti `invalid-response`; `lat`/`lon` del candidato = i
    valori richiesti (finiti, già validati dal chiamante); `place_id` →
    `placeId` (stringa, `""` se assente).
  - Nessuna cache lato client per il reverse: il trigger a zona (punto 2)
    limita già le richieste; lo stato vive nel tracker.

### 2. `src/app/place-status.ts` (nuovo, puro, senza DOM)

- `export const PLACE_ZONE_METERS = 1000;`
- `export function zoneKeyForPose(x: number, y: number,
  cellSizeMeters = PLACE_ZONE_METERS): string` — chiave deterministica della
  cella (`Math.floor(x / cell)` × `Math.floor(y / cell)`).
- `export interface PlaceTrackerOptions {
    reverse: (lat: number, lon: number, signal?: AbortSignal) =>
      Promise<GeocodeCandidate | undefined>;
    toLonLat: (x: number, y: number) => { latitude: number; longitude: number };
    minIntervalMs?: number;   // default 5000
    cellSizeMeters?: number;  // default PLACE_ZONE_METERS
    clock?: () => number;     // default Date.now, iniettabile per i test
  }`
- `createPlaceTracker(options)` → `{ track(x, y): void; place(): string |
  undefined; dispose(): void }`:
  - `track` è chiamato ogni 200 ms dal loop di bootstrap; filtra tutto:
    - stessa zona già servita o in-flight → no-op;
    - richiesta in-flight → zona nuova rimembrata (pending) e richiesta alla
      sua risoluzione, se l'intervallo minimo è già decorso;
    - sotto l'intervallo minimo → zona rimembrata (pending), nessuna richiesta
      (riprovata dal prossimo `track`, ogni 200 ms);
    - altrimenti: nuova richiesta; al successo il nome diventa il luogo
      corrente e la zona è marcata servita; **esito "nessun dato"
      (`undefined`)** = zona servita senza nome (nessun retry); **al
      fallimento si mantiene il nome precedente** e la zona non è marcata
      servita (retry al prossimo `track`, sempre entro l'intervallo minimo);
  - `place()` → nome corrente o `undefined` (mai prima del primo successo);
  - `dispose()` → abort in-flight + no-op successivi.
- Testabile senza rete: `reverse` e `clock` iniettati.

### 3. `src/app/bootstrap.ts` — wiring

- Solo per sessione open-world: `createGeocodeClient()` (default pinnati) +
  `createPlaceTracker({ reverse: client.reverse, toLonLat: (x, y) =>
  createTangentProjector(config.origin).unproject({ x, y }) })` (il
  proiettore è costruito una volta, non a ogni `track`).
- In `updateStatus()` (già ogni 200 ms): `tracker.track(veicolo.x, veicolo.y)`;
  messaggio per stato `ready` senza errori:
  `tracker.place() ?? "Area pronta"`.
- Teardown (`stopLoop`/`disposeCurrent`/Interrompi/retry): `tracker.dispose()`.
- Offline: nessun tracker → nessun comportamento nuovo.

## Strategia di test

- **Unit** (TDD, prima di ogni modifica):
  - `geocode.test.ts`: `reverse()` — URL params (lat/lon serializzati,
    `format=jsonv2`, `zoom=10`, `accept-language=it`), mapping happy path,
    `{error}` → `undefined`, payload non-oggetto/array → `invalid-response`,
    429/timeout/network/abort, lat/lon del candidato = valori richiesti.
  - `place-status.test.ts` (nuovo): `zoneKeyForPose` (stabilità, confini di
    cella, celle adiacenti distinte); tracker — 1 richiesta per zona, mai 2
    in-flight (la zona nuova resta pendente), invariato sotto l'intervallo
    con retry della zona pendente, errore mantiene il nome precedente e
    ritenta, esito "nessun dato" marca la zona servita, `place()` undefined
    prima del primo successo, `dispose` aborta la richiesta in-flight.
- **E2E** `tests/e2e/place-status.spec.ts` (Nominatim reverse e tile MVT
  mockati con `page.route`, nessun servizio reale):
  1. avvio online → stato `ready` → il testo di stato è il luogo mock
     ("Lecce, Puglia, Italia"), non "Area pronta"; la richiesta reverse
     contiene le coordinate dell'origine;
  2. reverse 500 → stato `ready` con "Area pronta" (mai testo corrotto, zero
     pageerror);
  3. reverse `{error}` (nessun dato) → "Area pronta";
  4. offline → zero richieste al host geocoding, stato "Offline".
  - I tile MVT sono soddisfatti con i byte del fixture
    `lecce-z14-openfreemap.pbf` per tutti i chiavi richieste: il tile
    centrale è la geometria corretta dell'origine → la sessione arriva a
    `ready` deterministicamente.
  - Il cambio-di-zona durante la guida è coperto dai unit del tracker (la
    guida e2e per 1000 m non è deterministica: il controller non segue le
    strade).

## Criteri di accettazione

1. Stato `ready` con reverse riuscito: la barra mostra il luogo (italiano)
   al posto di "Area pronta".
2. Richieste reverse solo al cambio di zona 1000 m e max 1 ogni 5 s; a
   veicolo fermo, al più una richiesta.
3. Fallimento reverse (429/http/rete/timeout/payload invalido): testo
   precedente mantenuto, sessione e guida non intaccate, nessun pageerror.
4. Offline: zero richieste al geocoder.
5. Endpoint pinnato a livello di compilazione (mai da input utente); testo
   del luogo nel DOM solo via `textContent`.
6. Suite completa, typecheck, build, E2E verdi; `git diff --check` pulito.

## Fuori scope

- Nomi delle città sulla mappa (layer `place` MVT non mappato oggi): feature
  separata, candidata a follow-up.
- Polling a intervalli fissi, cache persistente del luogo, reverse geocoding
  per il debug overlay (F3), altre lingue (fissato `accept-language=it`).

## Decisioni esplicite e rischi

| Decisione/rischio | Scelta |
| --- | --- |
| Fonte del nome | Nominatim reverse (coerente con la search PN-01; stesso policy budget) |
| Trigger | Cambio zona 1000 m + intervallo 5 s + 1 in-flight: zero richieste a riposo, mai > 1/s |
| Errore reverse | Silenzioso: si mantiene l'ultimo nome buono o "Area pronta"; mai un blocco dell'avvio |
| E2E dipendente dalla rete | Reverse e tile mockati via `page.route`; il cambio di zona è verificato a livello unit |
| Costo di compilazione | Nulla (nessun cambio di schema chunk: niente bump `compilerVersion`) |
