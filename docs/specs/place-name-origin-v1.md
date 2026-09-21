# Origine di gioco per nome del luogo (geocoding) — v1

Data: 2026-09-21. Persona: software-architect.
Input: richiesta utente (2026-09-21, form "OpenGTA / Area di gioco"):
"tra modalità e latitudine/longitudine vorrei introdurre un controllo che
accetta in ingresso il nome di un luogo, consente di scegliere tra i
candidati e quando ne viene selezionato uno valorizza latitudine e
longitudine. ad esempio scrivo taranto, ho le coordinate di taranto e gioco
a taranto."

## Obiettivo

L'utente sceglie l'origine di gioco per **nome del luogo** invece di digitare
coordinate: nel form di avvio, tra "Modalita'" e "Latitudine/Longitudine",
un campo "Cerca un luogo" che, digitato il nome (es. "taranto"), mostra i
candidati geocodificati; la selezione valorizza i campi lat/lon esistenti,
che restano editabili; "Avvia" procede come oggi con l'origine risolta.

Successo = esempio utente: scrivo "taranto", scelgo "Taranto, Puglia,
Italia", i campi lat/lon prendono 40,4644 / 17,2477 e la sessione live
parte con quell'origine.

## Assunzioni (da confermare, altrimenti correggere ora)

1. **Provider di geocoding: Nominatim (OpenStreetMap)**, endpoint pinnato
   `https://nominatim.openstreetmap.org/search`, `format=jsonv2`, `limit=5`,
   `accept-language=it`. Scelta: coerenza con il dato OSM già usato
   (attribuzione OSM già in pagina), CORS abilitato, nessuna API key,
   endpoint pubblico e stabile. Alternativa valutata e scartata per v1:
   Photon (komoot).
2. **Candidati: massimo 5**, ordinati come restituiti dal provider.
3. **La selezione valorizza i campi lat/lon ma non li blocca**: l'utente può
   rifinire le coordinate a mano; il campo luogo mostra il nome scelto e non
   ri-scrive i campi se questi vengono modificati dopo la selezione.
4. **Il geocoding è un'azione esplicita dell'utente** (digitazione con
   debounce + selezione): non è un invio automatico al provider diverso dal
   modello di consenso esistente (casella fissa, consenso implicito; l'opt-out
   dalla rete resta la modalità Offline). Il campo luogo viene **disabilitato
   in modalità offline**, come i campi coordinate.
5. **Nessun cambio al contratto di avvio**: il form continua a produrre
   `{ mode, lat, lon, provider, consent }`; il geocoding è solo un
   "pre-fill assistito" dei campi lat/lon. `readRuntimeConfig` invariato.
6. Portata: solo il form di avvio (bootstrap). Nessun geocoding in-game,
   nessuna reverse geocoding, nessun "luoghi recenti".

## Stato attuale (dove cambia)

- `src/app/live-controls.ts`: form a griglia `field(title, control, full)`;
  oggi: Modalita' (full) → Latitudine/Longitudine → consenso → errore →
  Avvia. I campi lat/lon leggono i param URL `lat`/`lon` (default
  `DEFAULT_ORIGIN`) e `syncCoordinates()` li disabilita in offline.
- `src/world/runtime/live-config.ts`: `readRuntimeConfig(params, policy)`
  valida lat/lon (regex + bound ±90/±180); i provider MVT pinnati usano
  costanti di compilazione e non toccano l'allowlist (pattern "pinned,
  trusted, never user input" — da riusare per l'endpoint del geocoder).
- Presidi SECURITY.md da rispettare: endpoint fissi (mai URL a input
  utente), timeout bounded, budget byte, errori tipizzati, tutto il testo
  applicativo via `textContent` (mai `innerHTML`), dati di risposta del
  provider non attendibili ai confini.

## Modello (design)

### 1. Cliente geocoding puro — `src/app/geocode.ts` (nuovo)

```ts
export interface GeocodeCandidate {
  readonly name: string;          // display_name, validato e bounded
  readonly latitude: number;      // finito, ±90
  readonly longitude: number;     // finito, ±180
  readonly placeId: string;       // identificativo opaco del provider
}

export type GeocodeErrorCode = "network" | "http" | "rate-limited"
  | "timeout" | "invalid-response" | "aborted";
export class GeocodeError extends Error {
  readonly code: GeocodeErrorCode; readonly status?: number;
}

export interface GeocodeClientOptions {
  readonly endpoint: string;              // default: costante pinnata
  readonly fetcher?: (url: string, init: RequestInit) => Promise<Response>;
  readonly timeoutMs?: number;            // default 5000
  readonly maxCandidates?: number;        // default 5
  readonly maxResponseBytes?: number;     // default 256 KiB
}
export function createGeocodeClient(options?: GeocodeClientOptions): {
  search(query: string, signal?: AbortSignal): Promise<GeocodeCandidate[]>;
};
```

- Richiesta: `GET {endpoint}?q={query}&format=jsonv2&limit=5&accept-language=it`
  — `q` serializzato con `URLSearchParams` (mai interpolazione a mano);
  header `Accept: application/json`; `AbortSignal.timeout` combinato con il
  signal del chiamante; byte budget durante la lettura (pattern
  `response-reader`).
- Risposta (Nominatim `jsonv2`): array di oggetti; **ogni candidato viene
  validato prima dell'uso**: `lat`/`lon` stringhe → numeri finiti nei bound,
  `display_name` stringa non vuota ≤ 256 caratteri (trimmata), `place_id`
  presente; i candidati non validi sono **scartati** (nessun rendering,
  nessun valore usato); payload non array / status ≠ 200 / budget superato →
  `GeocodeError` tipizzato. 429 → `rate-limited`; timeout → `timeout`;
  rete → `network`.
- **Cache in memoria** per query normalizzata (trim + casefold), LRU ≤ 32
  voci, solo successi: evita re-queries dello stesso nome e ammortizza il
  limite 1 req/s di Nominatim. I fallimenti non vanno in cache.
- Costante pinnata esportata: `NOMINATIM_SEARCH_URL` (mai derivata da input
  utente; l'allowlist `EndpointPolicy` resta invariata, come per il provider
  MVT).

### 2. Campo "Cerca un luogo" — `src/app/live-controls.ts`

- Nuovo campo full-width tra Modalita' e Latitudine:
  - `input[type=search][name=place]`, `autocomplete=off`, `aria-autocomplete=list`,
    `role=combobox`, `aria-expanded`/`aria-activedescendant` gestiti;
    sotto di esso un `ul[role=listbox]` con `li[role=option]` — **solo
    `textContent`** per nome e tipo (mai `innerHTML`).
- Comportamento:
  - **Debounce 400 ms** + **minimo 2 caratteri** prima di ogni richiesta;
    ogni nuova richiesta **aborta quella in volo** (`AbortController`):
    al limite 1 richiesta alla volta.
  - Risultati: lista dei candidati (≤ 5) con `display_name`; lista vuota →
    "Nessun luogo trovato"; errore → messaggio di stato sotto il campo
    (`role=status`, stesso stile dell'errore config) senza bloccare il form.
  - **Selezione** (click su candidato, oppure `Enter` sul primo/attivo,
    frecciette per navigare, `Esc` per nascondere):
    1. `latitude.value` / `longitude.value` = coordinate del candidato
       (stessa formattazione decimale dei campi, `String(n)`);
    2. il campo luogo passa in stato "risolto": mostra il nome scelto
       (read-only, con `aria-live=polite`);
    3. la lista si chiude e l'input ritorna a `aria-expanded=false`.
  - Dopo la selezione l'utente può modificare lat/lon a mano (il campo luogo
    resta "risolto" ma non ri-scrive i campi); ri-digitarare nel campo luogo
    ri-apre la ricerca (stato "risolto" resettato).
  - **Offline**: `syncCoordinates()` estesa — campo luogo disabilitato con i
    coordinate (nessuna richiesta di rete in offline, invariante SECURITY).
- Il submit del form è invariato: continua a leggere `lat`/`lon` dai campi.

### 3. Cosa NON cambia

- `readRuntimeConfig` / `EndpointPolicy` / provider e streaming: invariati.
- Consenso: invariato (geocoding su endpoint pinnato, azione esplicita).
- Attribuzione OSM: già presente in pagina (Nominatim = OSM).
- Chunks, cache, renderer, fisica: intoccabili.

## Contratto dati (esempi, per i test)

Richiesta: `GET https://nominatim.openstreetmap.org/search?q=taranto&format=jsonv2&limit=5&accept-language=it`

Risposta (forma attesa; ogni campo extra è ignorato):

```json
[
  { "place_id": 3149846, "osm_type": "relation", "osm_id": 44203,
    "lat": "40.4644421", "lon": "17.2468758",
    "display_name": "Taranto, Provincia di Taranto, Puglia, Italia",
    "class": "place", "type": "city" },
  { "place_id": 123, "osm_type": "way", "osm_id": 1,
    "lat": "40.5", "lon": "17.0",
    "display_name": "Taranto, Via X", "class": "highway", "type": "residential" }
]
```

Casi di validazione: `lat`/`lon` non numerici o fuori bound → candidato
scartato; array vuoto → "Nessun luogo trovato"; `{"error": ...}` o JSON
non-array → `invalid-response`; 429 → `rate-limited` ("Ricerca troppo
frequente, riprova tra un momento").

## Strategia di test (TDD)

- **Unit (vitest)** — `src/app/geocode.test.ts`, client con `fetcher` iniettato:
  - happy path: 2 candidati validi → lat/lon/nome corretti, ordine preservato;
  - validazione: lat fuori bound, lon NaN, display_name assente → scartati;
    tutti non validi → lista vuota (non errore);
  - errori: 429 → `rate-limited`; 500 → `http` (con status); timeout (fetch
    lento vs `timeoutMs`) → `timeout`; fetch reject → `network`; JSON
    non-array → `invalid-response`; payload > budget → `invalid-response`;
  - cache: stessa query (case/whitespace normalizzati) → 1 solo fetch;
    i fallimenti non si cacheano; LRU bounded;
  - `q` sempre serializzato (query con `&`, spazi, `?` non corrompono l'URL).
- **E2E (Playwright)** — `tests/e2e/place-search.spec.ts`, app reale con
  `page.route` che intercetta l'URL Nominatim e risponde con JSON mock
  (nessuna dipendenza dalla rete pubblica):
  1. "tar" → dopo il debounce appare la lista con i candidati mock;
  2. selezione di "Taranto, …" → input lat/lon = coordinate del mock;
     "Avvia" → l'intercettazione degli URL tile MVT mostra che il tile
     centrale richiesto è `latLonToTile(lat, lon, 14)` delle coordinate
     selezionate (gioco a Taranto; il snapshot di sessione non espone
     l'origine, l'URL del tile è l'evidenza deterministica e non dipende
     dall'esito della rete: i tile restanti si possono abortare);
  3. 1 carattere → zero richieste geocoding (intercettate: 0);
  4. provider 429 → messaggio di stato, form utilizzabile, lat/lon invariati;
  5. provider lento/timeout → messaggio di errore, nessun crash;
  6. modalità Offline → campo luogo disabilitato, zero richieste.
- Gate di rito: `npm run test:run`, `npm run typecheck`, `npm run build`,
  `npm run test:e2e`, `git diff --check`.

## Criteri di accettazione

1. Il form mostra, tra Modalita' e Latitudine, il campo "Cerca un luogo";
   digitando ≥ 2 caratteri (debounce) compaiono ≤ 5 candidati.
2. Selezionando un candidato, i campi Latitudine/Longitudine prendono le sue
   coordinate e "Avvia" avvia la sessione live con quell'origine (esempio
   utente: "taranto" → 40,4644 / 17,2477 → gioco a Taranto).
3. I candidati restituiscono solo dati validati; payload difettosi producono
   stati di errore testuali e non valori corrotti né crash.
4. In offline il campo luogo è disabilitato e non parte alcuna richiesta
   geocoding; il consenso e il flusso di avvio non cambiano.
5. Accessibilità: combobox/listbox con `role`/`aria-*` corretti,
   navigazione da tastiera (frecce/Enter/Esc), annunci via `role=status`.
6. 1 richiesta alla volta (abort dell'in volo), debounce 400 ms, cache
   in-memory per query; nessun URL costruito da input utente (endpoint
   pinnato).
7. Suite completa, typecheck, build, E2E verdi; SECURITY.md aggiornato con la
   nuova superficie (riga "Richieste geocoding").

## Fuori scope (v1)

- Geocoding in-game / ricerca dal HUD; reverse geocoding (coord → nome).
- "Luoghi recenti"/preferiti persistenti (cache in-memory solo).
- Provider alternativi o fallback (Photon), API key, risultati mappati.
- Cambio del modello di consenso o dell'allowlist endpoint.

## Decisioni esplicite e rischi

| Decisione | Rischio | Mitigazione |
| --- | --- | --- |
| Nominatim pinnato, solo browser | Uso improprio del servizio (policy: 1 req/s, UA) | debounce + 1 in-flight + cache + limit=5; volume per utente irrisorio; UA = quello del browser (non impostabile in browser, accettabile per uso occasionale) |
| `accept-language=it` | Nomi localizzati diversi dal display OSM | Comportamento documentato; i campi lat/lon non dipendono dalla localizzazione |
| Pre-fill dei campi esistenti (niente nuovo contratto) | L'utente rifinisce le coordinate dopo la selezione | Scelta esplicita (assunzione 3): la selezione non ri-scrive i campi già modificati |
| DOM del campo nel form esistente | Complessità a11y del combobox | pattern combobox/listbox minimo + test e2e da tastiera |

## Open questions (per l'utente)

1. Nominatim come provider va bene? (alternativa: Photon)
2. Max 5 candidati e `accept-language=it` ok?
3. Il campo luogo deve restare editabile dopo la selezione (ri-cerca) —
   confermato dall'assunzione 3/6, ok?
