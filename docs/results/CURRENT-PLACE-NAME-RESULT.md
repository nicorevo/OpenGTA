# Luogo corrente nella barra di stato (reverse geocoding al cambio di zona)

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato (working tree, non ancora commitata — insieme alla
tranche WS velocità/acqua). Spec: `docs/specs/current-place-name-v1.md`
(approvata con "procedi"). Log: `tasks/executions/2026-09-21-ZP-01.md`.
Baseline: `04d2b64` + working tree con la tranche WS da commitare.

## Obiettivo

Richiesta utente: al posto della scritta "Area pronta", mostrare il luogo che
si sta visualizzando, con aggiornamento frequente ma non real-time — polling o
cambio di zona. Valutazione condivisa → Opzione A: reverse geocoding Nominatim
al **cambio di zona** (cella 1000 m), nessun polling fisso.

## Cosa è cambiato

- `src/app/geocode.ts`:
  - `NOMINATIM_REVERSE_URL` pinnato (`/reverse`); opzione iniettabile
    `reverseEndpoint`;
  - `GeocodeClient.reverse(latitude, longitude, signal?)` →
    `Promise<GeocodeCandidate | undefined>`: params `lat`/`lon`/
    `format=jsonv2`/`zoom=10`/`accept-language=it`; `{error}` = "nessun dato"
    → `undefined` (esito legittimo); payload deve essere un singolo oggetto
    (`display_name` 1..256 char trimmed, `place_id` → `placeId`); lat/lon del
    candidato = i valori richiesti; stesso impianto fetcher/timeout/budget/
    errori di `search`; nessuna cache;
  - refactor: la plumbing di fetch (AbortController + timer + forwarding dell'
    abort del caller + `readBoundedJson` + mapping errori) è estratta in un
    helper interno condiviso da `search` e `reverse` (comportamento di
    `search` invariato, i 17 test preesistenti passano intatti).
- `src/app/place-status.ts` (nuovo, puro, senza DOM):
  - `PLACE_ZONE_METERS = 1000`;
  - `zoneKeyForPose(x, y, cellSizeMeters?)` — chiave di cella deterministica
    (floor division, confini coerenti sui negativi);
  - `createPlaceTracker({ reverse, toLonLat, minIntervalMs?=5000,
    cellSizeMeters?, clock? })` → `track(x, y) / place() / dispose()`:
    - 1 richiesta per zona, mai 2 in-flight (la zona nuova resta pending e
      parte alla risoluzione della precedente se l'intervallo è decorso);
    - intervallo minimo 5 s tra richieste (clock iniettabile);
    - successo → nome corrente + zona servita; "nessun dato" → zona servita
      senza nome (zero retry a veicolo fermo in zona priva di dati);
    - fallimento → nome precedente mantenuto, zona NON servita (retry entro
      l'intervallo, guidato dai `track` ogni 200 ms);
    - `dispose()` → abort dell'unica richiesta in-flight + no-op successivi.
- `src/app/bootstrap.ts`:
  - tracker creato solo in open-world con sessione (proiettore
    `createTangentProjector(config.origin)` una volta sola, `toLonLat` da
    `unproject` — l'origine è la stessa che usa la sessione);
  - `updateStatus()` (ogni 200 ms) chiama `track(pose)` e, nello stato
    `ready`, mostra `place() ?? "Area pronta"` (tutti gli altri stati
    invariati);
  - `placeTracker.dispose()` nel `stopLoop` (teardown di stop/restart).
- `tests/e2e/place-status.spec.ts` (nuovo, 4 test): tile MVT serviti con i
  byte del fixture `lecce-z14-openfreemap.pbf` (tutti i tile della finestra →
  stato `ready` reale) + reverse mockato: ready → luogo mock nella barra di
  stato (1 chiamata, lat/lon ≈ origine); reverse 500 → "Area pronta";
  `{error}` → "Area pronta" senza retry; offline → zero richieste reverse.
- `tests/fixtures/geocode-mock.ts` (nuovo): `mockReverseGeocoding(page)`
  registra, DOPO la network guard, un mock deterministic
  del reverse (`{error}` → "nessun dato") per gli 8 spec e2e preesistenti che
  asseriscono "nessuna chiamata esterna inattesa" (live-config ×2,
  live-startup ×2, incremental-renderer, measurements ×3, persistent-cache,
  live-streaming, mvt-live, zoom) — il reverse è ora una chiamata attesa e
  mockata, non una violazione del contratto di quegli spec.
- `SECURITY.md`: riga "Richieste geocoding" estesa al reverse (endpoint
  pinnato, trigger a zona, 1 in-flight, a riposo zero richieste, testo solo
  via `textContent`, offline = zero richieste).

## Comportamento

- Avvio online → "Caricamento area…" → `ready` → "Area pronta" finché il primo
  reverse non risolve → nome del luogo (es. "Lecce, Puglia, Italia"); al
  cambio di zona 1000 m (e ogni ≥ 5 s) il nome si aggiorna; a riposo zero
  richieste.
- Reverse in errore / nessun dato → la scritta resta "Area pronta" (o il
  luogo precedente), nessun messaggio d'errore in barra.
- Offline: comportamento invariato ("Offline"), zero richieste al geocoder.

## Verifica

- TDD: RED unit `geocode.test.ts` 7 reverse (7 failed/17 passed) → 24/24;
  RED `place-status.test.ts` (modulo assente) → 10/10; RED e2e
  `place-status.spec.ts` 3/4 (offline guard già verde) → 4/4.
- `npm run test:run`: **491/491** (59 file; +7 reverse, +10 tracker).
  Un flake temporaneo in `runtime-session.test.ts` (timing) è scomparso al
  rerun, suite verde completa.
- `npm run typecheck`, `npm run build`: verdi.
- `npm run test:e2e`: **38 passed + 1 canary skipped, 0 failed** (i 4 nuovi in
  `place-status.spec.ts`; i 12 fallimenti iniziali erano gli spec preesistenti
  il cui guard "no unexpected external calls" intercettava il nuovo reverse →
  risolti con `mockReverseGeocoding`).
- `git diff --check`: pulito.

## Follow-up (non incluso)

- Nomi sulla mappa (MVT layer `place` non mappato dal compiler): follow-up
  separato (Opzione B della valutazione).
- Cache persistente del luogo per zona (oggi: solo la zona servita resta
  servita per la vita della sessione).
