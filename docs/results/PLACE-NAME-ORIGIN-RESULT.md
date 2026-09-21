# Origine di gioco per nome del luogo (geocoding nel form di avvio)

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato (commit `9ea0062`).
Baseline di partenza: `59c17c5`. Spec: `docs/specs/place-name-origin-v1.md`.
Log: `tasks/executions/2026-09-21-PN-01.md`.

## Obiettivo

Richiesta utente: nel form "OpenGTA / Area di gioco", tra Modalità e
coordinate, un controllo che accetta il nome di un luogo, elenca i candidati e
alla selezione valorizza lat/lon: "scrivo taranto, ho le coordinate di
taranto e gioco a taranto".

## Cosa è cambiato

- `src/app/geocode.ts` (nuovo, puro, senza DOM):
  - `NOMINATIM_SEARCH_URL` pinnato a livello di compilazione;
  - `createGeocodeClient({ endpoint?, fetcher?, timeoutMs?, maxCandidates?,
    maxResponseBytes?, maxCacheEntries? })` → `search(query, signal?)`;
  - URL costruito con `URLSearchParams` (`q`, `format=jsonv2`, `limit`,
    `accept-language=it`); lettura con `readBoundedJson` (256 KiB);
  - `GeocodeError` con code `network | http | rate-limited | timeout |
    invalid-response | aborted`;
  - validazione per-candidato (lat ±90 / lon ±180 finiti, `display_name`
    ≤ 256 char trimmed, `place_id`): i non validi sono scartati, non
    falliscono la ricerca;
  - cache LRU in memoria ≤ 32 query normalizzate (trim+casefold), solo
    successi; query vuota → `[]` senza fetch.
- `src/app/geocode.test.ts` (nuovo, 17 test) — fetcher iniettato, zero rete.
- `src/app/live-controls.ts`:
  - campo "Cerca un luogo" (full-width) tra Modalità e Latitudine:
    `input[role=combobox]` + `ul[role=listbox]` + `span[role=status]`;
  - debounce 400 ms + min 2 caratteri; 1 richiesta in-flight con
    `AbortController` (nuova ricerca aborta la precedente; abort del caller →
    silenzioso, timeout → messaggio);
  - selezione via click, Enter, frecce (con `aria-activedescendant`) ed Esc →
    `latitude`/`longitude` valorizzati, campo con il nome del luogo e
    readOnly; click sul campo ri-edita;
  - stati inline: "Ricerca in corso…", "Nessun luogo trovato", messaggi per
    codice errore (429 → "troppo frequente", timeout → "tempo scaduto", …);
  - offline: `syncCoordinates` disabilita anche il campo (zero richieste);
  - submit: aborta la ricerca in-flight.
- `tests/e2e/place-search.spec.ts` (nuovo, 7 test): `page.route` mocka
  Nominatim (deterministico, nessun servizio reale) e intercetta gli URL tile
  MVT; la verifica "gioco a Taranto" = il tile centrale richiesto all'avvio
  è `latLonToTile(lat, lon, 14)` del luogo scelto (lo snapshot di sessione
  non espone l'origine; l'URL del tile è l'evidenza deterministica, e i tile
  restanti si abortono → il test non dipende dall'esito della rete).
- `SECURITY.md`: riga "Richieste geocoding" nella tabella delle superfici.

## Comportamento

- "tar" → lista (≤ 5) di candidati Nominatim in italiano; selezione →
  coordinate valorizzate e restano editabili; "Avvia" invariato
  (`readRuntimeConfig`/consenso/contratto di avvio intatti).
- 1 carattere → nessuna richiesta; query vuota → nessuna richiesta.
- Offline → campo disabilitato, zero richieste.

## Verifica

- TDD: RED unit 16/17→17/17 (PN-01); RED e2e 6/6 (PN-02) → 7/7 (PN-03).
- `npm run test:run`: **472/472** (58 file).
- `npm run typecheck`, `npm run build`: verdi.
- `npm run test:e2e`: **34 passed + 1 canary skipped**.
- `git diff --check`: pulito.

## Follow-up (non incluso)

- Ricerca in-game e reverse geocoding (fuori scope dichiarato).
- "Luoghi recenti" (persistenza): oggi cache in-memory solo per sessione.
- Se Nominatim diventasse instabile: il client è già isolato dietro
  `createGeocodeClient` (endpoint/fetcher iniettabili) → swap di provider
  senza toccare il form.
