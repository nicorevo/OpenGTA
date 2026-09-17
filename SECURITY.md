# Security Policy

## Segnalazione delle vulnerabilità

Non aprire issue pubbliche per vulnerabilità. Usa un canale privato del progetto
quando verrà definito; fino ad allora non pubblicare dettagli sfruttabili o dati
sensibili nel repository.

## Stato attuale

Il repository contiene un'applicazione eseguibile: V0 offline sul fixture Lecce
committato, Open World Runtime con streaming a chunk e warm cache in memoria,
modalità live online di default su sorgente MVT pinnata con consenso implicito
e policy endpoint. Baseline stabile:
commit `77312aa` sul ramo `opcl` (2026-09-10), evidenze in
[`docs/results/ONLINE-RUNTIME-RESULT.md`](docs/results/ONLINE-RUNTIME-RESULT.md).

Non esistono ancora nel codice: Web Worker, multiplayer, telemetria, un server
applicativo di proprietà del progetto, un hosting pubblico e una Content
Security Policy dichiarata. Queste voci sono requisiti futuri con un trigger
esplicito (vedi [Superfici future](#superfici-future)); finché non esistono nel
codice, nessun documento deve descriverle al presente. La persistenza client è
presente: una cache IndexedDB dei chunk compilati, best-effort e bounded
(vedi [Cache persistente](#superfici-reali-e-presidi-presenti)). Questo tipo di
deriva è verificato dal
[gate di consistenza documentale](docs/process/documentation-consistency-gate.md).

## Superfici reali e presidi presenti

| Superficie | Dove | Presidio attuale |
| :--- | :--- | :--- |
| Configurazione da URL (`mode`, `provider`, `lat`, `lon`, `endpoint`) | `src/world/runtime/live-config.ts`, `src/app/live-controls.ts` | la modalità predefinita è online su sorgente MVT pinnata (provider/endpoint fissi, non configurabili dall'UI); allowlist di mode/provider; latitudine/longitudine validate con regex numerica e bound (±90 / ±180); per i provider opt-in `osm`/`http` l'endpoint è ≤ 2048 caratteri, senza `username`/`password`/query/fragment e soggetto ad allowlist; su input non valido l'avvio fallisce con errore mostrato |
| Consenso alla modalità live | `live-config.ts`, `src/app/live-controls.ts` | il consenso è implicito e sempre attivo (casella di presa d'atto fissa, non revocabile); l'opt-out dalla rete è la scelta esplicita della modalità offline, che non effettua alcuna acquisizione remota |
| Policy degli endpoint | `live-config.ts` (`EndpointPolicy`) | corrispondenza esatta con l'allowlist HTTPS; in sviluppo è ammessa solo l'origine locale con path `/__test-geo`; il build di produzione non abilita l'eccezione locale (verificato dallo smoke su `dist`) |
| Richieste al provider | `src/world/runtime/source.ts`, `src/world/runtime/request-scheduler.ts`, `src/world/runtime/vector-tile/provider.ts` | endpoint configurato da allowlist; in sviluppo (solo build dev) è ammesso un secondario dichiarato per il provider Overpass, assente dal build di produzione (nessuna rotazione di mirror); timeout 30 s; intervallo minimo 1 s (HTTP) / 2 s (Overpass); coda ≤ 32 con priorità; retry limitati con backoff bounded e rispetto di `Retry-After`; nessuna credenziale inviata (solo `content-type`) |
| Richieste tile MVT | `src/world/runtime/vector-tile/provider.ts` | URL costruito solo da chiave tile validata (z/x/y interi, z ≤ 24) su endpoint fisso e dataset versionato pinnato (mai `latest`); timeout 30 s; budget di byte 16 MiB con `cancel()` dello stream a overrun; 404/204 = tile vuota deterministica; errori distinti (network/timeout/http/abort); cache LRU in memoria (128 tile decodificati) con dedup dei fetch in-flight, i fallimenti non vanno in cache; max 8 fetch concorrenti (coda FIFO); un solo retry su 429/502/503/504 con `Retry-After` clamped a 30 s, abort-aware |
| Payload OSM e `ReadableStream` | `source.ts`, `src/world/runtime/response-reader.ts`, `vector-tile/provider.ts` | budget di byte applicato durante la lettura dello stream (8 MiB di default per il percorso JSON; 16 MiB per i tile MVT); abort e `cancel()` del reader; `TextDecoder` con `fatal`; `JSON.parse`; verifica di `elements` come array, ≤ 100 000 elementi, tipi ammessi `node`/`way`/`relation`; `remark` non vuoto dal provider = `provider-error` |
| Normalizzazione | `src/geo/normalize/osm.ts` | troncamento a 100 000 elementi con warning; way ≤ 20 000 nodi; relation ≤ 20 000 membri; validazione degli anelli poligonali; nessun nome/tag esterno interpretato come markup |
| Compilazione e geometrie | `src/world/compiler/*`, `src/world/model/clip.ts`, `src/world/runtime/open-world.ts` | valori non finiti rifiutati prima di entrare nella fisica; chunk partizionati per cella; `regionId` bounded (≤ 128 caratteri) e raggio ≤ 100 km; numero di chunk pinned ≤ 32 |
| Warm cache | `src/world/chunk/cache.ts`, `open-world.ts` | LRU solo in memoria (capacity 9); la chiave include namespace (versione proiezione, origine, lato cella, identità della source, profilo query) e versione del compiler: un record di namespace o versione diversi non viene mai riusato in silenzio |
| Cache persistente | `src/world/chunk/persistent.ts`, `persistent-codec.ts`, `persistent-indexeddb.ts`, `src/app/bootstrap.ts` | best-effort: se IndexedDB non è disponibile lo store è assente e il runtime continua con la sola cache in memoria; budget dichiarato 32 MiB con eviction LRU alla write; la chiave include namespace, id del chunk, versione del compiler e revisione del codec; alla lettura il record è deserializzato e validato per forma prima dell'uso: un record incompatibile o corrotto è scartato come miss, mai riusato in silenzio; nessun dato utente, nessuna credenziale |
| Canvas e DOM | `src/render/pixi/*`, `bootstrap.ts`, `live-controls.ts` | tutto il testo applicativo passa da `textContent`; nessun `innerHTML`, `document.write`, `eval` o `new Function` nel codice applicativo; PixiJS non carica texture, font o asset da URL remoti |
| WASM Rapier | `src/physics/rapier/adapter.ts` | binario incorporato nel bundle in base64 dal pacchetto `@dimforge/rapier2d-compat` versionato dal lockfile: nessuna fetch, nemmeno same-origin, nessun CDN e nessun URL configurabile; coordinate dei collider validate finite prima della creazione |
| Diagnostica in pagina | `bootstrap.ts` | `window.__opengtaV0Debug` e `window.__opengtaV0Metrics` espongono stato di gioco, contatori, tempi e i chunk attivi compilati (geometrie pubbliche derivate da OSM, incluso il nome delle feature: dati pubblici, handle locale senza rete): nessun segreto, nessun dato personale |
| Dati del fixture offline | `src/fixtures/geo/lecce-sant-oronzo-v0.raw.json` (importato da `bootstrap.ts`), `src/geo/normalize/osm.ts` | l'intero JSON raw finisce nel bundle client: nulla di privato o riservato può stare nella fixture. Il normalizzatore legge solo una allowlist di tag (`building`, `highway`, `landuse`, `natural`, `waterway`, `barrier`, `leisure`, `amenity`, `lanes`, `service`, `surface`, `tunnel`, `bridge`, `layer`, `oneway`, `area`, `historic`, `water`); i tag di contatto OSM presenti nella fixture (`website`, `email`, `phone`) restano dati inerti: non entrano nel mondo compilato, non vengono resi nel DOM, non diventano link e non vengono richiesti dalla rete |
| Attribution e licenza dati | `bootstrap.ts` (riga di attribuzione), `docs/legal/osm-data-and-attribution.md`, `src/fixtures/geo/lecce-sant-oronzo-v0.PROVENANCE.md` | attribuzione OpenStreetMap sempre visibile; provenienza e licenza del fixture documentate separatamente dalla licenza del codice |
| Supply chain | `package.json`, `package-lock.json` | npm con lockfile unico committato; dipendenze runtime minime (`pixi.js`, `@dimforge/rapier2d-compat`); nessun secret nel repository |

Limiti dichiarati, per non sovra-claimare:

- il budget di byte protegge lettura e parsing iniziale, non il costo di
  compilazione né l'heap totale del browser;
- il bundle contiene i valori testuali dei tag OSM del fixture, compresi URL
  `http` non HTTPS e contatti pubblici di esercizi commerciali: sono dati
  inerti, mai caricati dalla rete e mai mostrati dall'interfaccia;
- i test E2E sono offline e deterministici (intercettazione catch-all di tutta
  la rete): non dimostrano il comportamento di un provider pubblico, che resta
  fuori dal controllo del client per copertura, rate limit e policy;
- le misure di prestazione documentate sono headless con GPU software;
- nessun deploy pubblico, SLA o certificazione è assunto da questo documento.

## Requisiti obbligatori

### Input e dati geospaziali

- Valida coordinate, stringhe di ricerca, tag, dimensioni delle risposte e
  complessità delle geometrie prima dell'elaborazione.
- Imposta limiti a vertici, relazioni, profondità, payload e tempo di calcolo per
  evitare blocchi o esaurimento della memoria con dati patologici.
- Non comporre query verso servizi esterni con stringhe non validate: la query
  Overpass attuale è costruita solo da numeri già validati e da un bbox derivato
  dal raggio, mai da testo libero.
- Non inserire testo esterno nel DOM tramite `innerHTML` e non eseguire dati con
  `eval` o costruttori equivalenti.
- Tratta i valori dei tag OSM (inclusi `website`, `email`, `phone`) come dati,
  non come risorse: non renderli cliccabili, non usarli per build di URL e non
  richiederli, salvo allowlist esplicita di schema e host.
- Non committare fixture, dump o cache che contengano segreti, dati personali
  non pubblici o identificatori di sessione: il fixture offline viene consegnato
  per intero al client.

### Servizi esterni

- Usa HTTPS e una allowlist esplicita degli endpoint contattabili; ogni nuovo
  endpoint richiede una modifica della policy e della sua copertura di test.
- Applica timeout, cancellazione, backoff e limiti di concorrenza alle
  richieste; rispetta `Retry-After` e non aumentare i retry per aggirare un
  rifiuto.
- Non ruotare mirror o endpoint per aggirare intenzionalmente i rate limit;
  rispetta policy d'uso, quote e attribuzione dei provider
  ([ADR-007](docs/adr/ADR-007-public-osm-service-boundaries.md)).
- La modalità live è attiva di default su una sorgente pinnata con consenso
  implicito ([ADR-012](docs/adr/ADR-012-live-online-by-default.md)); l'opt-out
  dalla rete è la modalità offline, che non effettua alcuna acquisizione remota.
  I provider opt-in `osm`/`http` restano subordinati all'allowlist di endpoint
  ([ADR-009](docs/adr/ADR-009-live-runtime-consent.md), superseded).
- Non includere chiavi, token o credenziali nel client browser, nemmeno per
  provider "proprietari".
- Quando nascerà un server di proprietà del progetto che recupera URL
  influenzati dall'utente, limita schema e host e blocca indirizzi privati o
  riservati per prevenire SSRF.

### Browser, cache e storage

- La warm cache è solo in memoria, con capacità e chiave versionata:
  mantieni l'invariante per cui una response esterna non può causare crescita
  illimitata dello stato, e non riusare mai un record con namespace o versione
  di compiler diversi.
- Lo storage persistente attuale (contratto `PersistentChunkStore`,
  implementazione `createIndexedDbChunkStore`) valida versione e integrità dei
  dati letti prima dell'uso, con quota dichiarata (32 MiB), eviction LRU e
  invalidazione tramite versione del compiler e del codec nella chiave: una
  entry corrotta o incompatibile va scartata come miss, mai usata in silenzio.
  La persistenza resta best-effort: la sua indisponibilità degrada alla sola
  cache in memoria, mai a un errore di runtime.
- Non conservare token di autenticazione accessibili a JavaScript in
  `localStorage`, `sessionStorage` o IndexedDB.

### Rendering e WASM

- Il runtime di rendering resta sulla canvas del documento, senza asset o script
  remoti; nuovi font, texture o modelli vanno incorporati nel bundle.
- Il WASM (Rapier) resta incorporato nel bundle e versionato dal lockfile:
  nessuna richiesta di rete per caricarlo, nessun CDN e nessun URL
  configurabile.

### Superfici future

Nessuna di queste esiste oggi; ognuna richiede un aggiornamento di questo
documento prima dell'introduzione.

- **Web Worker**: considera non attendibili i messaggi ricevuti da un worker e
  valida i contratti su entrambi i lati del confine, inclusi dimensione e forma
  dei dati trasferiti.
- **Telemetria**: nessuna telemetria è presente nel codice; se introdotta, deve
  essere dichiarata all'utente, non deve includere coordinate o identificatori
  personali senza consenso esplicito, non deve caricare script di terze parti
  fuori dalla CSP e non deve diventare un canale di esfiltrazione dei dati di
  gioco.
- **Hosting e CSP**: nessuna Content Security Policy è dichiarata oggi (né meta
  tag in `index.html` né header di hosting) e `dist/` è un artefatto statico non
  committato. Prima di esporre il client su un hosting pubblico vanno definiti
  header restrittivi per script, worker, asset e `connect-src` (limitato
  all'origine dell'app e agli endpoint in allowlist), oltre a `Referrer-Policy`
  e `X-Content-Type-Options`; va inoltre evitato ogni script inline non
  necessario.
- **Multiplayer**: considera ogni client ostile e valida frequenza, forma e
  intervalli di tutti gli input; il client non deve essere autorità per stato
  condiviso, collisioni decisive, inventario o altre regole sfruttabili.
  Applica autenticazione, autorizzazione, rate limiting e limiti di interesse
  spaziale sul server, e non fidarti di posizioni o risultati fisici calcolati
  solo dal client senza una strategia esplicita di verifica.

### Asset e AI offline

- Registra provenienza, modello, licenza e termini d'uso degli asset generati.
- Tratta file, metadati e output dei generatori come input non attendibili;
  valida formato e dimensione prima di inserirli nella pipeline.
- Non includere prompt contenenti segreti o dati personali.
- Il runtime non deve dipendere da credenziali AI incorporate nel client.

### Segreti e supply chain

- Non committare `.env`, chiavi, token, certificati privati o credenziali.
- Usa variabili d'ambiente o un secret manager per la configurazione sensibile.
- Il package manager in uso è npm con un unico `package-lock.json` committato:
  mantieni installazioni riproducibili e non introdurre script di dipendenza
  non revisionati (`npm install` esegue i lifecycle script delle dipendenze).
- Revisiona proprietà, manutenzione, licenza, provenienza e grafo transitivo di
  ogni nuova dipendenza prima di aggiungerla.
- Non applicare automaticamente correzioni forzate degli audit di sicurezza
  (`npm audit fix --force` o equivalenti).

## Verifiche di milestone

Prima di chiudere una tranche o una milestone:

- esegui il gate tecnico dichiarato in `tasks/city/README.md` (typecheck, suite
  deterministica, E2E, build, smoke di `dist`);
- esegui il
  [gate di consistenza documentale](docs/process/documentation-consistency-gate.md)
  sulle affermazioni di stato, così che nessun documento descriva superfici
  inesistenti o fasi superate;
- verifica che nessun nuovo endpoint, worker, storage o script di terze parti
  sia stato introdotto senza il corrispondente aggiornamento di questo documento
  e della relativa copertura di test;
- verifica che nessun segreto sia presente nel repository o nel bundle
  (`git diff --check`, `git status --short`, ricerca di pattern di chiave nei
  file committati);
- esegui l'audit nativo del package manager sul lockfile committato
  (`npm audit`) e registra l'esito nel log di consegna, senza applicare fix
  forzati automatici.

Prima di introdurre il multiplayer, aggiornare il threat model con abuso del
protocollo, cheating, denial of service, autenticazione, privacy e logging degli
eventi di sicurezza. Prima di introdurre telemetria, worker o hosting
pubblico, aggiornare le sezioni corrispondenti di questo documento.
