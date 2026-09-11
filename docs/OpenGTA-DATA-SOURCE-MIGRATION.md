# OpenGTA — Migrazione della sorgente geografica
## Da Overpass runtime a Vector Tiles / PMTiles senza rompere il core

**Data:** 2026-09-11  
**Stato:** piano tecnico operativo / PoC guidato  
**Obiettivo:** rendere il caricamento geografico di OpenGTA molto più affidabile, veloce e compatibile con navigazione urbana continua e zoom stile GTA classico, eliminando la dipendenza strutturale da query Overpass pubbliche durante la guida.

---

# 1. Decisione sintetica

La direzione raccomandata è:

```text
OGGI
OpenGTA
  -> Overpass pubblico
  -> Raw OSM JSON
  -> normalizeOsm
  -> compileRegion
  -> CompiledChunk

TRANSIZIONE
OpenGTA
  -> Overpass per debug/fallback
  -> Vector Tiles per PoC runtime
  -> stesso CompiledChunk
  -> stesso renderer
  -> stessa physics

TARGET
OpenGTA
  -> provider-neutral tile source
  -> MVT / PMTiles / OpenGTA packages
  -> canonical/compiled chunk
  -> shared runtime
```

Non riscrivere il renderer.

Non riscrivere la fisica.

Non creare un secondo engine.

Non trasformare OpenGTA in MapLibre.

MapLibre può essere utile come strumento di debug/visualizzazione, ma il gioco deve continuare a usare il proprio renderer PixiJS e il proprio runtime.

---

# 2. Perché intervenire adesso

Durante lo sviluppo live sono stati osservati errori frequenti sulle chiamate `.../api/interpreter`.

Nel browser le richieste fallite possono arrivare a:

```text
0 B transferred
network failure
```

Questo tipo di problema può dipendere da:

- endpoint pubblico temporaneamente irraggiungibile;
- browser/network policy;
- CORS;
- timeout;
- rate limiting;
- proxy/firewall;
- DNS;
- overload del servizio;
- connessione interrotta;
- abort locale;
- policy dell'istanza.

Prima di attribuire ogni errore a Overpass bisogna registrare il codice browser esatto.

Tuttavia, anche risolvendo il singolo errore, rimane un problema architetturale:

> un servizio pubblico di query geografiche non è il candidato ideale per diventare il server di streaming di un videogioco durante la guida continua.

---

# 3. Stato del repository rilevante

Il progetto possiede già una buona separazione che rende possibile la migrazione senza riscrittura.

Il contratto corrente è sostanzialmente:

```ts
export interface GeoDataSource {
  acquire(
    request: RuntimeRegionRequest,
    options?: AcquireOptions
  ): Promise<RawOsm>

  promote?(
    signal: AbortSignal,
    priority: 0 | 1 | 2
  ): void
}
```

Quindi il `GeoDataSource` corrente è in realtà:

```text
RawOsmGeoDataSource
```

e non un generico provider geografico.

La compilazione live corrente segue:

```text
GeoDataSource.acquire()
        |
        v
RawOsm
        |
        v
normalizeOsm()
        |
        v
WorldRegion
        |
        v
compileRegion()
        |
        v
CompiledChunk
```

Il runtime possiede però già un punto di estensione molto utile:

```ts
options.compile
```

Il percorso corrente è concettualmente:

```ts
const compiled = options.compile
  ? await options.compile(key, request, context)
  : (await compileRuntimeRegion(
      options.source,
      request,
      context
    )).chunks[0]
```

Questo significa che possiamo sperimentare una sorgente MVT **senza distruggere il percorso Overpass attuale**.

È il seam corretto per il PoC.

---

# 4. Regola architetturale fondamentale

NON fare questo:

```text
MVT
  |
  v
inventare un falso RawOsm
  |
  v
normalizeOsm
```

Perché sarebbe semanticamente scorretto.

Un tile MVT:

- non è Raw OSM;
- può essere generalizzato;
- può essere tagliato sui bordi;
- può avere tag già trasformati;
- può non conservare tutti i tag OSM;
- può aggregare feature a zoom bassi;
- può avere identificatori differenti;
- può provenire anche da Natural Earth o altre fonti a zoom bassi.

Quindi evitare adattatori che fingono:

```ts
MvtTile -> RawOsm
```

solo per riutilizzare `normalizeOsm`.

La direzione corretta è:

```text
Raw OSM
   -> OSM normalizer ------+
                           |
                           v
                       WorldRegion
                           |
MVT -> MVT normalizer -----+
                           |
                           v
                       compileRegion
```

oppure, nel PoC iniziale:

```text
MVT
  -> decode
  -> normalize MVT
  -> compile directly
  -> CompiledChunk
```

attraverso `options.compile`.

---

# 5. Obiettivo della migrazione

Vogliamo ottenere:

```text
player drives
     |
     v
chunk demand
     |
     v
tile requests
     |
     v
small cacheable PBF
     |
     v
decode
     |
     v
OpenGTA canonical representation
     |
     v
CompiledChunk
     |
     +--> renderer
     +--> physics
```

con:

- niente query Overpass per ogni chunk;
- niente query language runtime;
- niente grandi JSON se evitabile;
- cache HTTP naturale;
- CDN;
- richieste XYZ deterministiche;
- zoom coerente con LOD;
- failover più semplice;
- package statici futuri;
- PMTiles futuri;
- possibilità di self-hosting.

---

# 6. Cosa NON cambiare durante il PoC

Durante il primo esperimento non modificare:

```text
src/physics/**
src/gameplay/**
canonical collision semantics
vehicle controller
chunk grid size
renderer architecture
zoom architecture
spawn logic
availability guard
```

Il PoC deve dimostrare una sola cosa:

> lo stesso tipo di area giocabile può essere prodotto da tile vettoriali senza dipendere da Overpass.

---

# 7. Provider candidati

## 7.1 OpenFreeMap — candidato principale per il PoC

OpenFreeMap è particolarmente interessante per sviluppo e confronto perché:

- usa dati OpenStreetMap;
- usa lo schema OpenMapTiles;
- offre vector tile pubblici;
- non richiede API key;
- dichiara nessun limite sul numero di richieste/map views della public instance;
- permette self-hosting;
- distribuisce aggiornamenti planetari periodici;
- espone TileJSON e PBF XYZ;
- il public endpoint non ha SLA garantito.

Endpoint documentato per TileJSON:

```text
https://tiles.openfreemap.org/planet/latest
```

Tile PBF:

```text
https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf
```

Per il PoC OpenGTA questo è ideale perché permette di testare MVT senza account o backend aggiuntivo.

### Ma NON trattarlo ancora come backend definitivo

La public instance:

- non offre SLA;
- ha aggiornamenti non realtime;
- è un servizio esterno;
- non è sotto il controllo di OpenGTA;
- usa dati cartografici preprocessati;
- può avere differenze temporanee rispetto a OSM live.

Uso raccomandato:

```text
PoC
sviluppo
benchmark
fallback visuale
```

Non ancora:

```text
authoritative production gameplay source
```

---

# 8. OpenMapTiles come schema di input

OpenFreeMap usa schema OpenMapTiles.

Layer rilevanti già disponibili:

```text
building
transportation
landcover
landuse
park
water
waterway
place
transportation_name
```

Per OpenGTA V0 sono particolarmente interessanti:

```text
building
transportation
park/landuse/landcover
water/waterway
```

Lo schema `building` contiene edifici OSM e include campi come:

```text
render_height
render_min_height
colour
```

Il layer `transportation` contiene:

```text
motorway
trunk
primary
secondary
tertiary
minor
path
service
track
...
```

ed è derivato dalla gerarchia stradale OSM.

Quindi il mapping minimo è realistico.

---

# 9. MapTiler — provider di confronto / candidato managed

MapTiler offre una API XYZ:

```text
/tiles/{tilesId}/{z}/{x}/{y}
```

e TileJSON.

Richiede API key.

Può essere utile come:

- provider managed;
- confronto di affidabilità;
- confronto di latenza;
- confronto di copertura;
- eventuale produzione se costi/limiti risultano adatti.

Non legare però il core a MapTiler.

L'API OpenGTA deve restare provider-neutral.

---

# 10. PMTiles — candidato forte per OpenGTA Preprocessed World

PMTiles è un formato single-file per una piramide di tile.

Il browser può leggere solo le parti necessarie tramite:

```text
HTTP Range Requests
```

Quindi:

```text
puglia.pmtiles
```

non significa:

```text
scarica tutta la Puglia
```

ma:

```text
leggi header/index
leggi byte range del tile richiesto
```

Vantaggi:

- static hosting;
- object storage/CDN;
- nessun server di query;
- cache;
- costo operativo basso;
- versionamento semplice;
- molto coerente con Preprocessed World Mode.

Limite:

- archivio read-only;
- aggiornamento = generazione nuova versione;
- provider/storage deve gestire bene Range Requests;
- archivi enormi globali possono avere trade-off specifici.

Per OpenGTA è probabilmente più interessante usare:

```text
city.pmtiles
region.pmtiles
country.pmtiles
```

invece di un singolo planet archive enorme.

---

# 11. Strategia finale raccomandata: 3 classi di sorgente

```text
                  Runtime World Input
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
     OVERPASS          MVT XYZ          PMTILES
   debug/fallback      live world       curated world
        |                |                |
        +----------------+----------------+
                         |
                         v
                OpenGTA normalization
                         |
                         v
                   WorldRegion
                         |
                         v
                   CompiledChunk
```

---

# 12. Non eliminare subito Overpass

Overpass rimane molto utile come:

```text
reference source
debug source
data inspection source
parity oracle
rare fallback
developer tool
```

Durante la migrazione è fondamentale poter confrontare:

```text
Overpass Lecce
vs
OpenFreeMap Lecce
```

e capire esattamente cosa perdiamo.

Quindi:

```text
KEEP OVERPASS
REMOVE OVERPASS AS MANDATORY HOT PATH
```

---

# 13. Prima attività: diagnosticare gli errori attuali

## DATA-00 — Browser failure diagnostics

### Goal

Rendere distinguibili:

```text
HTTP error
CORS
network
timeout
abort
rate-limit
invalid response
payload too large
```

### Modifiche

Aggiungere al debug overlay / logging developer:

```text
source provider
endpoint host
request id
chunk id
attempt
duration
failure category
HTTP status se disponibile
browser error category se disponibile
```

NON loggare:

```text
payload completo
coordinate private non necessarie
token/API keys
```

### Acceptance

Da DevTools o overlay developer deve essere possibile distinguere:

```text
ERR_FAILED
429
504
AbortError
Timeout
CORS-like fetch rejection
```

senza indovinare.

---

# 14. Seconda attività: fallback Overpass temporaneo

## DATA-01 — Multi-endpoint Overpass fallback

Questa è una misura di continuità per lo sviluppo, NON la soluzione finale.

### Scopo

Se il default Overpass fallisce per cause recuperabili:

```text
primary
   |
 fail
   v
secondary
```

### Vincoli

Non fare round-robin aggressivo.

Non usare fallback per aggirare rate limit intenzionalmente.

Non sparare la stessa query in parallelo a più provider.

### Esempio policy

```text
primary
  1 retry

se network/5xx persistente:
  secondary

se 429:
  rispettare Retry-After
  non saltare immediatamente su 5 server
```

### Source identity

Il cache namespace deve distinguere provider/dataset.

Il repository già include `sourceIdentity` e `queryProfile` nel namespace.

Preservare questa proprietà.

---

# 15. PoC principale: OpenFreeMap MVT su Lecce

## DATA-02 — MVT foundation

### Goal

Introdurre soltanto utilities MVT:

```text
lat/lon -> z/x/y
fetch PBF
decode PBF
tile coordinate -> world coordinate
```

### Dipendenza decoder

Valutare una libreria MVT piccola e browser-safe.

Criteri:

- ESM;
- TypeScript types;
- no renderer dependency;
- decode geometry;
- accesso source layer;
- bundle size misurato;
- manutenzione attiva;
- nessun `eval`;
- licenza compatibile.

Non introdurre MapLibre come dipendenza solo per decodificare tile.

### Acceptance

Dato:

```text
Lecce
lat 40.353168...
lon 18.17259
zoom scelto
```

ottenere:

```text
tile z/x/y
PBF bytes
decoded layer names
```

e testare:

```text
building exists
transportation exists
```

---

# 16. Quale zoom MVT usare

Per gameplay vicino al veicolo NON utilizzare zoom bassi.

Motivo:

a zoom bassi le sorgenti cartografiche possono:

- generalizzare;
- aggregare;
- eliminare feature;
- usare fonti non-OSM per alcune categorie.

### Primo esperimento

Provare:

```text
z15
z16
z17
```

e confrontare.

### Ipotesi iniziale

```text
FAR visual:     z14 / z15
MEDIUM visual:  z15 / z16
NEAR gameplay:  z16 / z17
```

Non congelare questi valori prima del benchmark.

---

# 17. Importante: MVT zoom != OpenGTA camera zoom

Sono concetti differenti.

```text
OpenGTA Camera Zoom
= quanti metri vedo a schermo

MVT Tile Zoom
= risoluzione/livello della sorgente dati
```

Serve una policy esplicita.

Per il PoC iniziale mantenere il gameplay source a uno zoom MVT fisso.

---

# 18. PoC v1: usare un solo MVT zoom per gameplay

Per ridurre il rischio:

```text
NEAR/GAMEPLAY SOURCE = z16 fisso
```

Lo zoom della camera può cambiare liberamente.

Il world truth della zona vicina resta derivato sempre dalla stessa risoluzione.

Solo dopo parity test introdurre multi-resolution.

Questo evita:

```text
collisioni che cambiano quando premo +
edificio che sposta bordo
strada che cambia forma
```

---

# 19. Coordinate MVT -> OpenGTA

Una feature MVT è espressa nel sistema locale del tile.

Pipeline:

```text
MVT local coordinates
        |
        v
tile coordinate in Web Mercator
        |
        v
lon/lat oppure projected meters
        |
        v
OpenGTA local tangent plane
```

Preferire un solo percorso matematico testabile.

### Invariante

La stessa posizione geografica decodificata da due tile adiacenti deve risultare nella stessa coordinata OpenGTA entro la tolleranza prevista.

---

# 20. Tile seam problem

Le geometrie MVT possono essere:

- tagliate al confine del tile;
- duplicate nel buffer;
- presenti parzialmente in tile adiacenti.

Questo è normale per vector tile rendering.

OpenGTA però deve convertirle in un world coerente.

### Problemi possibili

```text
road segment duplicate
building double-rendered
collision overlap
label duplicate
feature IDs unstable
tiny gap on seam
```

### Strategia

Il normalizzatore MVT deve:

1. proiettare;
2. clipparle ai bounds autorevoli OpenGTA;
3. deduplicare feature dove possibile;
4. mantenere segmenti coerenti;
5. produrre ID deterministici;
6. non assumere che il tile MVT coincida con il chunk OpenGTA.

---

# 21. MVT tile e OpenGTA chunk sono due griglie differenti

NON cambiare immediatamente:

```text
OpenGTA chunk = 300 m
```

solo perché MVT usa XYZ.

Un chunk OpenGTA può richiedere:

```text
1
2
4
o più MVT tile
```

a seconda di zoom e posizione.

Quindi:

```text
OpenGTA Chunk Request
        |
        v
intersecting MVT tiles
        |
        v
fetch/decode
        |
        v
merge canonical features
        |
        v
clip to OpenGTA chunk
        |
        v
CompiledChunk
```

Questo mantiene stabile:

```text
physics
cache
availability
streaming
chunk lifecycle
```

---

# 22. DATA-03 — Tile coverage resolver

### API proposta

```ts
interface SlippyTileKey {
  z: number
  x: number
  y: number
}

function tilesForRuntimeRegion(
  request: RuntimeRegionRequest,
  zoom: number
): readonly SlippyTileKey[]
```

### Acceptance

Per un bounds di 300 m:

- lista deterministica;
- no duplicati;
- copertura completa;
- test su confine tile;
- latitudine clamp Web Mercator;
- nessun valore NaN/Infinity.

---

# 23. DATA-04 — OpenFreeMap tile client

### API proposta

```ts
interface VectorTileProvider {
  readonly id: string
  readonly datasetVersion: string

  getTile(
    key: SlippyTileKey,
    signal: AbortSignal
  ): Promise<ArrayBuffer>
}
```

Implementazione PoC:

```ts
createOpenFreeMapProvider({
  template:
    "https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf"
})
```

### Importante

Non hardcodare `latest` come identità persistente definitiva.

Per cache persistente serve una dataset version reale oppure una policy di invalidazione.

---

# 24. DATA-05 — MVT decode model

Creare un modello intermedio.

NON passare direttamente oggetti della libreria decoder nel canonical world.

Esempio:

```ts
interface DecodedVectorFeature {
  readonly layer: string
  readonly id?: string | number
  readonly properties: Readonly<Record<string, unknown>>
  readonly geometry:
    | DecodedPointGeometry
    | DecodedLineGeometry
    | DecodedPolygonGeometry
}
```

Questo protegge OpenGTA da lock-in verso il decoder.

---

# 25. DATA-06 — Mapping `transportation`

Mapping iniziale:

```text
OpenMapTiles class     OpenGTA RoadClass

motorway               motorway
trunk                  trunk
primary                primary
secondary              secondary
tertiary               tertiary
minor                  residential/fallback
service                service/fallback
path                    path/non-drivable
track                   track/non-drivable o fallback
```

Non assumere che:

```text
minor == residential
```

sia una verità definitiva.

È un mapping PoC.

Registrare warning per classi non supportate.

---

# 26. Road width

Il compiler corrente ha fallback di larghezza per classi stradali.

Vector tile cartografici potrebbero non conservare tutti i tag OSM necessari per ricostruire:

```text
width
lanes
parking lanes
shoulders
```

Quindi per PoC:

```text
class -> existing OpenGTA fallback width
```

Per produzione OpenGTA:

preferire tile custom che contengano i campi necessari.

---

# 27. Strade non guidabili

Il layer transportation include anche:

```text
footway
path
steps
cycleway
rail
...
```

Non trasformare tutto in carreggiata.

Aggiungere una classificazione interna:

```ts
type TransportUse =
  | "drivable-road"
  | "pedestrian"
  | "rail"
  | "service"
  | "ignored"
```

---

# 28. DATA-07 — Mapping `building`

Input:

```text
OpenMapTiles building polygons
render_height
render_min_height
colour
```

Output:

```text
BuildingFeature
```

Se `render_height` non esiste:

riutilizzare la policy deterministica del progetto.

La facade resta responsabilità del renderer/compiler OpenGTA.

---

# 29. DATA-08 — Land/park/water

Mapping PoC:

```text
park
landuse
landcover
water
waterway
```

Verso:

```text
LandAreaFeature
WaterFeature
```

Obiettivo primo passaggio:

```text
strade
edifici
parchi
acqua
```

---

# 30. Barrier gap: problema importante

Il profilo Overpass corrente richiede anche:

```text
barrier
```

Lo schema OpenMapTiles standard potrebbe non fornire tutte le barriere necessarie alla stessa granularità.

Quindi il PoC deve produrre una matrice di parità:

```text
Feature              Overpass    OpenMapTiles
roads                 yes         yes
buildings             yes         yes
parks                 yes         yes
parking               yes/?       verify
water                 yes         yes
barriers              yes         verify/gap
trees                 supported?  verify
```

Qualsiasi gap va dichiarato.

Non inventare dati mancanti.

---

# 31. DATA-09 — Lecce parity fixture

Creare una zona deterministica attorno a:

```text
Piazza Sant'Oronzo / Lecce
```

Comparare:

```text
Overpass baseline
OpenFreeMap z15
OpenFreeMap z16
OpenFreeMap z17
```

Metriche:

```text
road count
building count
park count
water count
compiled feature count
collision count
bytes transferred
request count
decode ms
normalize ms
compile ms
first playable
```

---

# 32. Parity visuale

Generare screenshot con stessa:

```text
origin
camera
zoom
viewport
```

Comparare manualmente:

```text
major roads present?
street network recognizable?
building blocks equivalent?
holes/courtyards reasonable?
parks correct?
obvious missing geometry?
```

Non richiedere pixel-perfect parity.

Richiedere gameplay parity.

---

# 33. Parity fisica

Test automatico:

```text
spawn pose valid
building collision works
road corridor navigable
chunk seam traversable
no invisible wall caused by tile clipping
no open building edge caused by seam
```

---

# 34. Criterio Go / No-Go per MVT

## GO

Se:

```text
first playable migliora o rimane competitivo
affidabilità richiesta migliora
dimensione trasferita diminuisce materialmente
road/building parity sufficiente
seam stabile
collisioni stabili
```

## NO-GO

Se:

```text
mancano dati gameplay essenziali
geometria near troppo generalizzata
seam produce collision bugs
provider non permette uso adatto
mapping richiede hack provider-specifici nel core
```

In caso di NO-GO:

non buttare il lavoro.

Riutilizzare:

```text
tile math
MVT decoder
provider abstraction
benchmark
```

per i custom OpenGTA tiles.

---

# 35. Come integrare il PoC senza cambiare `GeoDataSource`

Il runtime ha già:

```ts
options.compile
```

Usarlo nel primo esperimento.

Esempio concettuale:

```ts
const runtime = createOpenWorldRuntime({
  ...
  source: placeholderSource,
  sourceIdentity: "openfreemap:planet:latest",
  queryProfile: "openmaptiles:z16",

  compile: async (key, request, context) => {
    return compileVectorTileChunk(
      vectorProvider,
      key,
      request,
      context
    )
  }
})
```

### Miglioria raccomandata

Non mantenere a lungo un `placeholderSource`.

Dopo il PoC formalizzare un contratto più corretto.

---

# 36. Contratto target: RuntimeChunkCompiler

Proposta:

```ts
export interface RuntimeChunkCompiler {
  readonly identity: string
  readonly profile: string

  compile(
    key: ChunkKey,
    request: RuntimeRegionRequest,
    context: ChunkLoadContext
  ): Promise<CompiledChunkV0>
}
```

Adapter:

```text
OverpassRuntimeChunkCompiler
VectorTileRuntimeChunkCompiler
PmtilesRuntimeChunkCompiler
```

Il runtime diventa:

```text
chunk demand
   |
   v
RuntimeChunkCompiler
   |
   v
CompiledChunk
```

Questo è più corretto del far credere che ogni fonte produca `RawOsm`.

---

# 37. Alternativa target: CanonicalRegionSource

Se si vuole mantenere il compiler separato:

```ts
export interface CanonicalRegionSource {
  readonly identity: string
  readonly profile: string

  acquireCanonical(
    request: RuntimeRegionRequest,
    context: AcquireContext
  ): Promise<WorldRegion>
}
```

Poi:

```text
Overpass
 -> RawOsm
 -> OSM normalizer
 -> WorldRegion

MVT
 -> decode
 -> MVT normalizer
 -> WorldRegion

WorldRegion
 -> compileRegion
```

Questa è architetturalmente molto pulita.

### Raccomandazione

Per il PoC:

```text
RuntimeChunkCompiler
```

Per il refactor definitivo:

valutare:

```text
CanonicalRegionSource
```

perché mantiene il world compiler unico.

---

# 38. Non duplicare il compiler

Regola non negoziabile:

NON arrivare a:

```text
OSM compiler
MVT compiler
PMTiles compiler
```

con tre semantiche differenti.

L'obiettivo finale deve restare:

```text
OSM normalizer ---+
                  |
MVT normalizer ---+--> Canonical World --> ONE compiler
                  |
Package loader ---+
```

---

# 39. Cache a tre livelli

Target:

```text
L0 decoded/current
L1 compiled memory cache
L2 HTTP browser cache / persistent cache
L3 provider/CDN
```

In seguito:

```text
IndexedDB compiled cache
```

può diventare un ulteriore livello.

---

# 40. Cache MVT raw

Il browser/CDN può già cacheare:

```text
/{z}/{x}/{y}.pbf
```

Non duplicare necessariamente tutti i PBF in IndexedDB.

Prima misurare.

### Compiled cache

È più interessante persistere:

```text
CompiledChunk
```

per evitare:

```text
decode
normalize
compile
```

al secondo avvio.

---

# 41. Cache namespace

Il progetto già protegge da collisioni usando:

```text
base origin
cell size
source identity
query profile
compiler version
```

Con MVT includere almeno:

```text
provider ID
dataset/version
schema ID
MVT zoom
normalizer version
compiler version
```

---

# 42. Zoom + sorgente dati

Lo zoom OpenGTA deve cambiare la presentazione immediatamente.

Non deve necessariamente cambiare la source gameplay immediatamente.

## Fase 1

```text
camera zoom changes
gameplay source remains z16
```

## Fase 2

```text
FAR visual source = lower z
NEAR physics source = stable high z
```

Questa separazione è importante.

---

# 43. Due domini: Visual World e Gameplay World

A lungo termine può essere utile distinguere:

```text
GAMEPLAY WORLD
- player vicinity
- high fidelity
- collision
- spawn
- navigation
- exact-enough canonical geometry

VISUAL WORLD
- wider camera horizon
- lower LOD
- no collision requirement
- may arrive later
```

Ma NON creare due engine.

Sono due quality domains dello stesso world/runtime.

---

# 44. Caricamento con zoom lontano

Con FAR zoom:

```text
camera sees 1+ km
```

Non è necessario che tutti i km siano caricati a precisione fisica.

Possiamo fare:

```text
P0 current gameplay chunks
P1 movement prediction
P2 near visual
P3 far visual low LOD
```

Se P3 manca:

```text
gioco continua
```

Se P0 manca:

```text
fisica impedisce ingresso
```

---

# 45. Provider priorities

Per richieste MVT:

```text
P0 = current high detail
P1 = predicted high detail
P2 = nearby
P3 = far low detail
```

Il fetch scheduler deve:

- cancellare P3 obsoleto;
- non far aspettare P0 dietro decine di P3;
- deduplicare stessa tile;
- condividere una fetch tra più OpenGTA chunk;
- limitare concorrenza;
- rispettare abort.

---

# 46. Request deduplication

Più chunk OpenGTA possono richiedere la stessa MVT tile.

Serve:

```ts
Map<TileKey, Promise<DecodedTile>>
```

per evitare:

```text
chunk A -> fetch tile X
chunk B -> fetch tile X
chunk C -> fetch tile X
```

in parallelo.

Target:

```text
one tile
one in-flight request
many consumers
```

---

# 47. Abort semantics con richieste condivise

Non abortire una fetch condivisa se:

```text
consumer A cancella
consumer B la usa ancora
```

Serve reference tracking oppure cache promessa con ownership.

PoC semplice:

- tile fetch è breve;
- non abortire fetch condivisa quando esiste almeno un consumer.

Versione robusta:

```text
consumer count
AbortController per tile
abort quando count == 0
```

---

# 48. Memory budget MVT

Non conservare ogni tile visitata.

Cache decoded:

```text
bounded LRU
```

Cache compiled:

```text
bounded LRU già esistente
```

Misurare:

```text
raw bytes
decoded feature count
decoded geometry memory estimate
compiled chunk memory estimate
```

---

# 49. Sicurezza

Le tile sono input esterno non attendibile.

Validare:

```text
PBF decode errors
layer name
feature count
geometry point count
coordinate ranges
property types
NaN/Infinity
polygon complexity
```

Non assumere che provider affidabile significhi payload sempre corretto.

---

# 50. Limiti di decode

Definire budget:

```text
max tile bytes
max features per tile
max points per feature
max total geometry points
max properties
```

Superamento:

```text
TileSourceError
category = response-too-large / invalid-tile
```

e sessione degradata, non crash.

---

# 51. Nuova tassonomia errori

Proposta:

```ts
type WorldSourceErrorCode =
  | "network"
  | "timeout"
  | "rate-limit"
  | "http"
  | "aborted"
  | "response-too-large"
  | "invalid-response"
  | "invalid-tile"
  | "unsupported-schema"
  | "missing-layer"
  | "decode-failed"
```

---

# 52. Retry MVT

I tile statici/CDN hanno una semantica diversa da Overpass.

Retry suggerito:

```text
network -> exponential backoff breve
5xx -> retry
429 -> Retry-After
404/204 -> empty deterministic, non retry loop
invalid tile -> no automatic repeated retry immediato
abort -> no retry
```

---

# 53. Empty tile != errore

Un tile senza feature utilizzabili può essere valido.

Distinguere:

```text
empty
```

da:

```text
failed
```

come già fa il runtime OpenGTA.

---

# 54. Attribution

Non rimuovere attribution OSM.

Con OpenFreeMap seguire anche le loro richieste di attribution.

Per custom OpenGTA data derivata da OSM, verificare ODbL e requisiti del dataset/distribuzione prima del rilascio.

---

# 55. DATA-10 — Benchmark Overpass vs MVT

Eseguire stessa sessione:

```text
same origin
same route
same viewport
same OpenGTA zoom
same chunk grid
```

## Metriche

```text
time to first playable
total network bytes
number requests
p50 request latency
p95 request latency
decode ms
normalize ms
compile ms
last visible chunk time
long frames
peak active records
cache hits
failed requests
retry count
```

---

# 56. Test con throttling

Provare:

```text
No throttling
Fast 4G
Slow 4G
high latency profile
offline after first area
intermittent failures
```

L'obiettivo non è soltanto velocità media.

È:

```text
graceful degradation
```

---

# 57. Test di provider failure

Scenario:

```text
start
P0 loads
then network drops
drive toward boundary
```

Expected:

```text
current world remains stable
no crash
no geometry disappears incorrectly
vehicle stops before unavailable world
UI says partial/offline
network returns
missing chunk retries
vehicle can continue
```

---

# 58. DATA-11 — OpenFreeMap runtime PoC

### Feature flag

Aggiungere provider sperimentale:

```text
provider=openfreemap-mvt
```

Non sostituire default finché non passa i gate.

### Esempio URL

```text
?mode=open-world-live
&provider=openfreemap-mvt
&lat=40.35316888888889
&lon=18.17259
```

Il consenso deve essere provider-neutral.

---

# 59. Live controls provider-neutral

Evolvere verso:

```text
Offline fixture
Online OSM — Overpass (legacy/debug)
Online Vector Tiles — OpenFreeMap (experimental)
```

In futuro:

```text
OpenGTA Region Package
```

---

# 60. Non esporre URL arbitrari in produzione

Durante sviluppo un endpoint custom è utile.

In produzione:

- allowlist provider;
- HTTPS;
- no arbitrary cross-origin fetch;
- no token in logs;
- CSP coerente.

---

# 61. DATA-12 — Seam tests

Costruire fixture MVT sintetica con:

```text
road crosses tile edge
building crosses tile edge
polygon hole crosses edge
same feature buffered in neighbor
```

Verificare:

```text
no gap
no duplicate collision
no double facade
deterministic output
```

Questa slice è obbligatoria prima di dichiarare MVT gameplay-ready.

---

# 62. Feature IDs

Non basare la correttezza su OSM IDs se il provider non li garantisce.

Generare ID canonici deterministici per tile-derived segment.

La strategia definitiva va progettata dopo aver verificato gli ID OpenMapTiles reali.

---

# 63. Duplicati ai tile buffer

MVT spesso include geometria oltre il bordo del tile per evitare artefatti di rendering.

Quindi prima del canonical model:

```text
clip to requested OpenGTA region
```

Non compilare indiscriminatamente tutto il buffer di ogni tile.

---

# 64. DATA-13 — Canonical MVT normalizer

Quando il PoC è riuscito, creare:

```text
src/geo/normalize/mvt.ts
```

Responsabilità:

```text
DecodedVectorTile
-> WorldRegion
```

NON:

```text
fetch
cache
renderer
physics
```

---

# 65. Rifattorizzazione definitiva della source pipeline

Target:

```text
src/world/runtime/source/
  osm-overpass.ts
  vector-tile.ts
  pmtiles.ts

src/geo/normalize/
  osm.ts
  mvt.ts

src/world/compiler/
  compiled.ts
```

Il compiler continua a consumare:

```text
WorldRegion
```

---

# 66. DATA-14 — CanonicalRegionSource

Dopo PoC:

```ts
interface CanonicalRegionSource {
  readonly identity: string
  readonly profile: string

  acquire(
    request: RuntimeRegionRequest,
    options?: AcquireOptions
  ): Promise<WorldRegion>
}
```

Implementazioni:

```text
OverpassCanonicalRegionSource
VectorTileCanonicalRegionSource
```

Poi:

```text
runtime
  -> source.acquire()
  -> WorldRegion
  -> compileRegion()
```

---

# 67. PMTiles fase successiva

Una volta che MVT -> canonical funziona:

il passaggio a PMTiles diventa soprattutto:

```text
cambia tile transport
```

Non:

```text
riscrivi normalizer
```

Perché PMTiles può contenere MVT.

Architettura:

```text
HttpMvtProvider ----+
                    |
PmtilesProvider ----+--> DecodedVectorTile --> MVT normalizer
```

---

# 68. DATA-15 — PMTiles PoC locale

Creare un piccolo archivio Lecce.

Servirlo localmente con Range Requests.

Verificare:

```text
header fetch
range fetch
tile decode
same canonical output del provider XYZ
```

Questo è il ponte verso Preprocessed World Mode.

---

# 69. OpenGTA custom tile schema

OpenMapTiles è ottimo per il PoC.

Non è detto che sia sufficiente come schema definitivo del gioco.

OpenGTA potrebbe aver bisogno di:

```text
road width
lanes
surface
access
oneway
bridge/tunnel
barriers
traffic signals
crossings
parking
building levels
building height
entrances
trees
POI gameplay
spawn hints
```

Quindi a lungo termine creare:

```text
OpenGTA Tile Schema v1
```

---

# 70. Possibile schema OpenGTA v1

```text
layer roads
  id
  class
  subclass
  width
  lanes
  surface
  oneway
  bridge
  tunnel
  access

layer buildings
  id
  height
  min_height
  levels
  kind

layer land
  id
  class

layer water
  id
  class

layer barriers
  id
  type

layer points
  id
  type
```

Non congelare finché non emerge dai requisiti reali.

---

# 71. Tooling custom tiles

Pipeline futura:

```text
Geofabrik/OSM PBF extract
        |
        v
OpenGTA tile builder
        |
        v
MVT
        |
        v
PMTiles
```

Valutare Planetiler o pipeline equivalente dopo ADR.

---

# 72. Aggiornamenti del mondo

Con Overpass:

```text
quasi live
```

Con OpenFreeMap:

```text
dataset periodico
```

Con OpenGTA PMTiles:

```text
versioni deliberate
```

Per un videogioco, la consistenza fra sessioni può essere più importante della freschezza immediata.

---

# 73. Versioned world

Per gameplay futuro, è utile poter dire:

```text
OpenGTA Italy 2026-09-11 v3
```

Così:

- test riproducibili;
- bug riproducibili;
- cache deterministica;
- multiplayer futuro più semplice;
- niente edificio che cambia durante la stessa sessione.

---

# 74. Provider freshness policy

Definire:

```text
LIVE EXPLORATION
  latest available tiles

CURATED WORLD
  pinned dataset version

TEST
  immutable fixture/version
```

---

# 75. Failover MVT

Per produzione non assumere che un singolo provider pubblico sia infallibile.

Opzioni:

```text
managed provider
self-host
OpenGTA CDN
regional PMTiles
```

Il miglior fallback può essere:

```text
compiled cache
```

non un provider switch continuo.

---

# 76. Offline/degraded recovery

Se il giocatore ha già visitato l'area:

```text
network down
   |
   v
compiled cache hit
   |
   v
continue
```

Questa è molto più potente di un retry aggressivo.

---

# 77. Priorità: persistent compiled cache

La migrazione MVT non sostituisce il lavoro già previsto sulla cache persistente.

Anzi lo rende ancora più utile.

Target:

```text
first visit
tile network -> compile -> persist

second visit
persistent compiled chunk -> immediate
```

---

# 78. Roadmap esatta

```text
DATA-00 browser/source failure diagnostics
DATA-01 temporary Overpass fallback
DATA-02 MVT decoder + tile math
DATA-03 tile coverage resolver
DATA-04 OpenFreeMap provider
DATA-05 decoded tile internal model
DATA-06 transportation mapping
DATA-07 building mapping
DATA-08 land/water mapping
DATA-09 Lecce parity benchmark
DATA-10 Overpass vs MVT benchmark
DATA-11 OpenFreeMap feature-flag runtime
DATA-12 seam/duplicate tests
DATA-13 canonical MVT normalizer
DATA-14 source architecture refactor
DATA-15 PMTiles Lecce PoC
DATA-16 custom OpenGTA tile schema ADR
DATA-17 persistent compiled cache
DATA-18 curated region package
```

---

# 79. Ordine rispetto alla roadmap di solidificazione

```text
SOLID-01 real timing
DATA-00 diagnostics
DATA-01 Overpass dev fallback

SOLID-02 cancellation
SOLID-03 pathological input benchmark

DATA-02 MVT foundations
DATA-03 tile coverage
DATA-04 OpenFreeMap
DATA-05 decoded model
DATA-06/07/08 mappings
DATA-09 parity

SOLID-04 incremental renderer
SOLID-05 long-drive

ZOOM-01..05

DATA-10 benchmark
DATA-11 feature flag runtime
DATA-12 seam hardening

LOD-01..05

DATA-13/14 source refactor

CACHE persistent

DATA-15 PMTiles
DATA-16 custom schema
```

---

# 80. Task template da dare a Codex

Ogni task deve seguire:

```text
TASK ID:
TITLE:

MODEL CLASS:
REASONING:

GOAL:

READ:
- exact files

MAY MODIFY:
- exact paths

DO NOT TOUCH:
- unrelated modules

CONSTRAINTS:
- architecture invariants

RED:
- failing test first

GREEN:
- minimum implementation

REFACTOR:
- cleanup

ACCEPTANCE:
- explicit assertions

BENCHMARK:
- if applicable

VERIFY:
npm run typecheck
npm run test:run
npm run test:e2e
npm run build

RESULT:
- files changed
- tests
- measurements
- unresolved risks
```

---

# 81. Prima scheda pronta — DATA-00

```text
TASK ID: DATA-00
TITLE: Classificare con precisione i fallimenti della source live

GOAL:
Rendere diagnosticabile un fetch live fallito senza cambiare la semantica del runtime.

READ:
- src/world/runtime/source.ts
- src/world/runtime/source-error.ts
- src/app/runtime-session.ts
- src/app/bootstrap.ts
- src/app/live-controls.ts
- test relativi

MAY MODIFY:
- source/source-error
- diagnostica sessione
- overlay developer
- test pertinenti

DO NOT TOUCH:
- compiler
- normalizer
- renderer geometry
- physics
- chunk grid

ACCEPTANCE:
- network, timeout, abort, HTTP, rate-limit, invalid-response e response-too-large restano distinguibili;
- la UI user-facing rimane semplice;
- debug diagnostics espone categoria, tentativo e durata;
- nessun payload completo nei log;
- nessun token nei log;
- suite verde.
```

---

# 82. Seconda scheda pronta — DATA-02

```text
TASK ID: DATA-02
TITLE: Introdurre tile math e decode MVT isolato

GOAL:
Dato z/x/y, scaricare/decodificare un MVT senza integrare ancora il runtime.

READ:
- AGENTS.md
- CODING-STANDARDS.md
- SECURITY.md
- docs/SPEC.md
- docs/DECISIONS.md
- src/geo/**
- src/world/runtime/source.ts

MAY MODIFY:
- nuovo src/geo/mvt/**
- package.json/lock solo per decoder scelto
- test relativi

DO NOT TOUCH:
- renderer
- physics
- gameplay
- runtime session
- Overpass source

CONSTRAINTS:
- decoder behind project-owned adapter;
- bounded input;
- AbortSignal;
- no MapLibre dependency solo per decode;
- no provider-specific objects fuori adapter.

RED:
test tile math;
test invalid z/x/y;
test decode fixture;
test malformed tile.

GREEN:
utility minima.

ACCEPTANCE:
- lat/lon -> tile deterministic;
- fixture MVT decodificata;
- layer names leggibili;
- malformed tile non crasha;
- dependency size/licenza documentata;
- suite verde.
```

---

# 83. Terza scheda pronta — DATA-04

```text
TASK ID: DATA-04
TITLE: OpenFreeMap vector tile provider

GOAL:
Implementare un provider HTTP MVT cancellabile e bounded.

ENDPOINT:
https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf

MAY MODIFY:
- src/world/runtime/vector-tile/**
- test provider

DO NOT TOUCH:
- canonical model
- compiler
- renderer
- physics

ACCEPTANCE:
- URL deterministic;
- AbortSignal propagato;
- response byte limit;
- 404/204 trattabili;
- HTTP/network/timeout distinti;
- no API key;
- provider identity esplicita;
- nessuna logica OpenFreeMap nel canonical world.
```

---

# 84. Quarta scheda pronta — DATA-09

```text
TASK ID: DATA-09
TITLE: Lecce Overpass vs OpenFreeMap parity

GOAL:
Stabilire con dati misurati se OpenMapTiles è sufficiente per il world gameplay di OpenGTA.

AREA:
Lecce fixture / Piazza Sant'Oronzo.

COMPARE:
- Overpass existing
- OpenFreeMap z15
- OpenFreeMap z16
- OpenFreeMap z17

MEASURE:
- network bytes
- request count
- roads
- buildings
- land
- water
- barriers gap
- normalize
- compile
- first playable
- seam anomalies

OUTPUT:
docs/analysis/MVT-LECCE-PARITY.md

DECISION:
GO / GO VISUAL ONLY / NO-GO GAMEPLAY
```

---

# 85. Quinta scheda pronta — DATA-11

```text
TASK ID: DATA-11
TITLE: OpenFreeMap runtime behind feature flag

GOAL:
Guidare Lecce usando MVT senza rendere MVT il default.

MODE:
provider=openfreemap-mvt

REQUIREMENTS:
- same chunk grid;
- same runtime lifecycle;
- same physics;
- same renderer;
- same spawn;
- same availability guard;
- source-specific cache namespace.

ACCEPTANCE:
- first playable;
- attraversamento almeno 10 chunk;
- no stale apply;
- no duplicate collision;
- retry/recovery;
- stop/restart;
- tests + E2E.
```

---

# 86. Gate per rendere MVT default

NON cambiare il default prima che passino:

```text
G1 Lecce parity
G2 seam tests
G3 100+ transitions
G4 bounded memory
G5 no collision regression
G6 lower/equal user-visible failure rate
G7 measurable network/perf benefit
G8 attribution/legal reviewed
```

---

# 87. Strategia dopo il PoC

## Caso A — OpenFreeMap MVT è ottimo anche per gameplay

```text
make MVT primary
Overpass debug fallback
PMTiles curated mode
```

## Caso B — MVT è ottimo visualmente ma perde dati gameplay

```text
MVT visual world
+
high fidelity source near player
```

oppure:

```text
custom OpenGTA MVT
```

## Caso C — Public MVT provider non è affidabile abbastanza

```text
self-host tiles
MapTiler managed
PMTiles
OpenGTA CDN
```

usando lo stesso normalizer.

---

# 88. Raccomandazione finale concreta

Per OpenGTA non investire ulteriormente nel tentativo di trasformare `overpass-api.de` nel backbone definitivo dello streaming.

Usalo per:

```text
debug
reference
fallback
development
```

Il prossimo esperimento ad alto valore è:

```text
OpenFreeMap MVT
        |
        v
OpenMapTiles mapping
        |
        v
same OpenGTA canonical/compiler/runtime
```

e, se il concetto funziona:

```text
OpenGTA custom MVT
        |
        v
PMTiles regional packages
        |
        v
CDN/static hosting
```

Questo si allinea con:

- città continue;
- zoom;
- LOD;
- caricamento progressivo;
- cache;
- preprocessed world;
- browser-first;
- costi operativi contenuti.

---

# 89. Target finale

```text
                          OpenGTA
                             |
                             v
                     WORLD SOURCE ROUTER
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
      OVERPASS             HTTP MVT           PMTILES
    debug/reference      online explore      curated areas
          |                  |                  |
          +------------------+------------------+
                             |
                             v
                    SOURCE NORMALIZER
                             |
                             v
                       WORLD REGION
                             |
                             v
                        COMPILER
                             |
                             v
                     COMPILED CHUNK
                             |
                +------------+------------+
                |                         |
                v                         v
             PHYSICS                   RENDER
                                          |
                                          v
                                    CAMERA + ZOOM
```

Il giocatore deve poter guidare senza sapere se il chunk è arrivato da:

```text
Overpass
OpenFreeMap
MapTiler
PMTiles
cache
```

Questo è il segnale che l'architettura è davvero provider-neutral.

---

# 90. Fonti esterne verificate

## OpenFreeMap

https://openfreemap.org/

https://openfreemap.org/quick_start/

https://github.com/hyperknot/openfreemap

Informazioni rilevanti:

- vector tiles da OpenStreetMap;
- public instance senza API key;
- dichiarazione di nessun limite di requests/map views;
- self-hosting;
- schema OpenMapTiles;
- nessun SLA garantito al momento;
- TileJSON `https://tiles.openfreemap.org/planet/latest`;
- PBF `https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf`.

## OpenMapTiles schema

https://openmaptiles.org/schema/

Layer rilevanti:

```text
building
transportation
landcover
landuse
park
water
waterway
```

## PMTiles

https://docs.protomaps.com/pmtiles/

Concetti rilevanti:

- single-file tiled archive;
- Z/X/Y;
- HTTP Range Requests;
- lettura on-demand;
- static/object storage;
- read-only archive.

## Protomaps basemap schema

https://docs.protomaps.com/basemaps/layers

Nota:

- non contiene tutto OSM;
- è un basemap curato;
- alcune feature possono essere aggregate a zoom bassi.

Questo conferma che low-zoom vector tiles non devono diventare automaticamente la verità fisica di OpenGTA.

## MapTiler Tiles API

https://docs.maptiler.com/cloud/api/tiles/

Conferma:

```text
/{z}/{x}/{y}
TileJSON
vector tile support
API key required
```

## Overpass API instances

https://wiki.openstreetmap.org/wiki/Overpass_API

La pagina mantiene un elenco di istanze e relative policy.

Usare endpoint alternativi soltanto nel rispetto delle policy correnti del servizio.

---

# 91. Definition of Done della migrazione dati

La milestone può chiamarsi:

```text
OpenGTA Provider-Neutral World Streaming
```

È completa soltanto se:

- [ ] Overpass non è più necessario per far funzionare il core runtime;
- [ ] almeno una source MVT può produrre chunk giocabili;
- [ ] stessi renderer e physics funzionano senza branch provider-specifici;
- [ ] source identity isola correttamente la cache;
- [ ] dataset/schema/version fanno parte dell'identità;
- [ ] tile requests sono bounded e cancellabili;
- [ ] duplicate in-flight fetch sono deduplicate;
- [ ] seam MVT testati;
- [ ] geometria invalida non crasha;
- [ ] 100+ transizioni chunk sono stabili;
- [ ] network failure degrada senza distruggere la sessione;
- [ ] zoom non altera la fisica;
- [ ] cache compilata può evitare ricompilazioni inutili;
- [ ] attribution è corretta;
- [ ] Overpass resta disponibile come reference/debug;
- [ ] PMTiles può essere aggiunto senza modificare canonical/compiler.

---

# 92. Principio finale

La migrazione non deve essere:

```text
Overpass -> nuovo provider hardcoded
```

Deve essere:

```text
provider-specific acquisition
        |
        v
provider-neutral OpenGTA world
```

Questa è la differenza tra correggere il problema di oggi e costruire una base che regga davvero città intere domani.
