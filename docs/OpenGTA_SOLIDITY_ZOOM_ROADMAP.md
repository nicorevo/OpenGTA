# OpenGTA — Piano di solidificazione, navigazione urbana continua e camera zoom stile GTA classico

**Stato documento:** proposta tecnica operativa basata sull'analisi del repository OpenGTA fornito il 2026-09-11.  
**Obiettivo:** portare OpenGTA dall'attuale baseline funzionante a un motore realmente solido per attraversare città reali in modo continuo, senza errori bloccanti, con caricamento progressivo, camera top-down regolabile e resa visiva ispirata ai primi GTA 2D/top-down.

---

## 0. Scopo di questo documento

Questo documento raccoglie in un unico posto:

1. lo stato reale del progetto;
2. i punti forti da preservare;
3. i problemi tecnici individuati;
4. le correzioni necessarie prima di aggiungere nuove funzionalità pesanti;
5. la strategia per rendere affidabile la navigazione continua nelle città;
6. la strategia di streaming e cache;
7. la strategia prestazionale;
8. la proposta completa per uno zoom `+ / -`;
9. il rapporto fra zoom, area visibile, chunk e velocità di caricamento;
10. il modello LOD 2D necessario per ottenere una giocabilità simile ai primi GTA;
11. una roadmap implementabile per slice piccole, testabili e reversibili;
12. criteri di accettazione e benchmark.

Il principio centrale è:

> Non aggiungere complessità di gameplay finché il core geografico, lo streaming, la camera, il renderer e la gestione degli errori non permettono di guidare a lungo attraverso una città senza freeze, scene mancanti, collisioni incoerenti o crescita incontrollata della memoria.

---

# 1. Visione di prodotto da mantenere

OpenGTA deve restare:

- browser-first;
- basato su dati geografici reali;
- 2D-first;
- top-down;
- con profondità fake-2.5D;
- con rendering leggibile e arcade;
- con un solo runtime condiviso;
- indipendente da uno specifico renderer;
- indipendente da uno specifico motore fisico;
- capace di funzionare anche senza AI;
- capace di degradare la qualità visiva sui dispositivi meno potenti senza cambiare la verità geografica.

Le due modalità finali devono continuare a convergere sullo stesso runtime:

```text
                         RAW GEOGRAPHIC DATA
                                |
                                v
                      NORMALIZATION / COMPILER
                                |
                +---------------+---------------+
                |                               |
                v                               v
        PREPROCESSED WORLD                RUNTIME WORLD
                |                               |
                +---------------+---------------+
                                |
                                v
                         COMPILED CHUNKS
                                |
                                v
                          SHARED RUNTIME
                                |
                +---------------+---------------+
                |                               |
                v                               v
             RENDERER                        PHYSICS
```

Non creare mai due engine separati.

---

# 2. Esperienza finale desiderata

Il riferimento visivo e di giocabilità è il GTA classico top-down:

- camera perfettamente o quasi perfettamente dall'alto;
- auto sempre chiaramente leggibile;
- strade molto riconoscibili;
- incroci leggibili;
- edifici compatti;
- scene dense ma semplici;
- fake depth leggera;
- buon contrasto tra carreggiata, marciapiede, terreno ed edifici;
- possibilità di vedere più o meno mondo tramite zoom;
- navigazione continua nella città;
- nessun caricamento che blocchi improvvisamente l'intera esperienza;
- nessuna transizione visibile tipo "cambio livello";
- mondo che arriva progressivamente.

La resa non deve copiare asset di GTA.

L'obiettivo è riprodurre il **linguaggio visivo e funzionale**:

```text
REAL MAP
   |
   v
STRONG 2D READABILITY
   |
   v
ARCADE TOP-DOWN WORLD
   |
   v
FAKE DEPTH + CARS + TRAFFIC + GAMEPLAY
```

---

# 3. Stato attuale del progetto

La baseline analizzata è già oltre il semplice prototipo offline.

Risultano implementati e documentati:

- fixture reale di Lecce;
- proiezione WGS84 -> piano metrico locale;
- normalizzazione OSM;
- canonical world model;
- compilazione;
- chunk 300 m;
- PixiJS/WebGL;
- Rapier 2D;
- veicolo arcade;
- collisioni;
- fake-2.5D;
- streaming runtime;
- caricamento progressivo;
- warm cache di sessione;
- retry;
- gestione rate limit;
- limite payload;
- stato `ready/degraded/error/empty`;
- stop/retry;
- revoca consenso;
- test unitari;
- test E2E;
- smoke build production;
- debug overlay;
- fisica confinata alle celle disponibili.

La baseline documentata riporta:

```text
175 unit/integration tests
14 E2E
typecheck PASS
build PASS
production smoke PASS
```

Questi risultati sono evidenze presenti nel repository.

Non sono stati rieseguiti durante questa analisi.

---

# 4. Punti architetturali da NON rompere

## 4.1 Canonical World indipendente

Il modello geografico non deve conoscere:

- PixiJS;
- Rapier;
- WebGL;
- WebGPU;
- canvas;
- sprite;
- handle fisici;
- strutture native OSM non normalizzate.

## 4.2 Confini dei moduli

Conservare:

```text
src/geo
    non dipende da render/physics

src/world
    non dipende da render/physics

src/render
    consuma contratti compilati

src/physics
    resta dietro adapter

src/gameplay
    non conosce tag OSM/raw provider
```

## 4.3 Metri canonici

La geometria deve continuare a vivere in metri.

Lo zoom deve essere una trasformazione camera/schermo.

NON modificare coordinate geografiche, collisioni o fisica per implementare lo zoom.

Corretto:

```text
1 canonical meter
       |
       v
camera zoom
       |
       v
N pixels
```

Errato:

```text
zoom
  |
  v
alterare dimensione geometria/collisione
```

---

# 5. Problemi individuati che impediscono di considerare OpenGTA "solido"

---

## HARDENING-01 — La metrica di compilazione non misura realmente la compilazione

### Problema

Il compiler genera attualmente diagnostica equivalente a:

```ts
stageDurationsMs: { total: 0 }
```

Il runtime legge questo valore come `lastCompileMs`.

L'overlay lo mostra come tempo di compilazione.

Quindi una metrica fondamentale risulta formalmente presente ma non affidabile.

### Perché è importante

Senza misurazione reale non è possibile decidere correttamente:

- quando introdurre Worker;
- quando effettuare yielding cooperativo;
- quanto costa una città densa;
- se il compiler sta peggiorando;
- se una modifica al normalizzatore è realmente più veloce;
- se uno zoom/LOD riduce il costo reale.

### Intervento

Misurare almeno:

```text
acquisitionMs
decodeMs
normalizeMs
compileMs
applyRenderMs
applyPhysicsMs
totalFirstPlayableMs
```

Non mischiare tempi di rete con tempi CPU.

### Accettazione

- nessuna durata fittizia;
- nessuna metrica sempre zero;
- unit test sulle strutture diagnostiche;
- benchmark che riporta valori reali;
- overlay coerente con i dati misurati.

---

# 6. HARDENING-02 — La cancellazione non attraversa tutta la pipeline

## Problema

Il percorso corrente è concettualmente:

```text
await acquire()
abort check
normalize()
compile()
```

La cancellazione è affidabile durante acquisizione/lettura, ma non necessariamente durante:

- normalizzazione lunga;
- costruzione relation/multipolygon;
- compilazione;
- generazione geometrie;
- costruzione collisioni.

Se il giocatore cambia zona mentre una compilazione pesante è in corso, lavoro ormai inutile può continuare sul main thread.

## Intervento iniziale

Non introdurre subito un Worker solo perché sembra elegante.

Prima implementare cancellazione cooperativa:

```ts
normalizeOsm(raw, projector, origin, regionId, {
  signal,
  yieldController
})

compileRegion(region, {
  signal,
  yieldController
})
```

A intervalli deterministici:

```ts
signal.throwIfAborted()
```

Per cicli lunghi:

```ts
if (shouldYield()) {
  await scheduler.yield()
}
```

con fallback compatibile quando necessario.

## Successivamente

Solo se misure dimostrano jank significativo:

```text
main thread
    |
    +--> acquire
    |
    +--> worker: normalize
    |
    +--> worker: compile
    |
    v
compiled chunk
```

## Accettazione

Scenario:

```text
richiesta chunk A
player si sposta
A diventa inutile
richiesta A viene abortita
CPU non continua a compilare A per centinaia di ms
nessun risultato A viene applicato
```

---

# 7. HARDENING-03 — Multipolygon OSM potenzialmente costosi

## Problema

L'assemblaggio delle relation utilizza una ricerca lineare ripetuta fra catene pendenti.

Concettualmente:

```text
while pending:
    chain = pending.shift()

    while chain not closed:
        pending.findIndex(candidate that joins)
```

Con relation grandi il costo può avvicinarsi a O(n²).

I limiti correnti consentono relation molto grandi.

## Rischio

Una risposta formalmente valida potrebbe:

- non superare il limite byte;
- non superare il limite elementi;
- ma bloccare comunque il main thread tramite una relation patologica.

## Intervento

Creare benchmark specifici:

```text
100 members
500 members
1 000 members
5 000 members
20 000 members
```

Misurare:

```text
normalize time
peak memory
long frames
abort responsiveness
```

Se il costo cresce male, utilizzare indicizzazione per endpoint:

```text
nodeId -> candidate chains
```

evitando scansioni complete ripetute.

## Accettazione

Definire PRIMA il budget.

Esempio iniziale, non definitivo:

```text
normalizzazione pathological fixture:
nessun task > 50 ms senza yield
abort osservabile rapidamente
nessun freeze di secondi
```

---

# 8. HARDENING-04 — Rebuild completo della scena per ogni variazione chunk

## Problema

Il renderer attuale distrugge e ricrea la parte statica della scena quando cambia l'insieme dei chunk.

Concettualmente:

```text
chunk arriva
   |
   v
remove all static children
   |
   v
rebuild ground
rebuild roads
rebuild buildings
rebuild labels
```

Questo è accettabile per una finestra piccola.

Non scala bene ad attraversamenti urbani lunghi.

## Obiettivo

Passare da:

```text
render(allChunks)
```

a:

```text
addChunk(chunk)
updateChunk(chunk)
removeChunk(chunkId)
```

## Struttura consigliata

```ts
interface ChunkPresentation {
  root: Container
  ground: Container | Graphics
  roads: Container | Graphics
  buildings: Container | Graphics
  labels: Container
}

const renderedChunks = new Map<string, ChunkPresentation>()
```

### Nuovo chunk

```text
compile presentation SOLO per chunk nuovo
attach container
```

### Chunk rimosso

```text
detach container
destroy solo risorse del chunk
```

### Chunk invariato

```text
ZERO rebuild
ZERO nuova allocazione
```

## Effetto atteso

Il costo di streaming deve dipendere principalmente dal delta:

```text
O(chunks_changed)
```

e non dalla dimensione totale della scena attiva.

---

# 9. HARDENING-05 — Rendere il caricamento realmente robusto su città reali

Gli E2E deterministici sono corretti e devono rimanere tali.

Ma serve anche una verifica periodica non bloccante contro geografia reale.

## Canary suite

Aggiungere una suite separata dalla CI deterministica:

```text
tests/canary/
```

Esempio aree:

```text
Lecce centro
Taranto centro
Milano centro
Roma centro
Parigi centro
città con geometria semplice
città con multipolygon complessi
```

Non serve eseguirla su ogni commit.

Può essere:

```text
manuale
nightly
settimanale
pre-release
```

## Deve verificare

```text
provider reachable
payload valido
normalizzazione completa
P0 giocabile
almeno N chunk disponibili
collisioni applicate
zero uncaught exception
zero NaN
zero chunk bloccato eternamente
```

---

# 10. HARDENING-06 — Documentazione di sicurezza fuori sync

`SECURITY.md` contiene ancora descrizioni appartenenti a una fase pre-runtime.

Aggiornare il threat model con le superfici reali:

```text
coordinate utente
URL/provider config
payload OSM
ReadableStream
normalizzazione
compiler
chunk cache
IndexedDB futura
canvas/render
WASM Rapier
Web Worker futuro
asset
telemetria
hosting
CSP
```

Aggiungere un piccolo documentation consistency gate prima delle milestone.

---

# 11. HARDENING-07 — Cache persistente fra sessioni

La warm cache corrente è utile, ma vive essenzialmente nella sessione.

Per una città reale è importante evitare di ricompilare continuamente aree già visitate.

## Obiettivo

```text
visit chunk
     |
     v
compile
     |
     v
memory cache
     |
     v
persistent cache
```

Al successivo avvio:

```text
persistent cache
     |
     v
validate
     |
     +--> valid -> immediate load
     |
     +--> stale/corrupt -> discard + refetch
```

## Chiave cache

La chiave deve includere almeno:

```text
provider/data source identity
query profile version
chunk coordinate
compiler version
canonical schema version
compiled schema version
projection/world version
```

NON utilizzare token o segreti.

## Storage

IndexedDB è un candidato naturale per browser, ma va confermato tramite ADR/esperimento.

## Gestire

- quota piena;
- storage disabilitato;
- entry corrotta;
- schema incompatibile;
- eviction;
- aggiornamenti dati;
- consenso.

La sessione deve funzionare anche senza persistent cache.

---

# 12. HARDENING-08 — Provider di produzione

L'endpoint pubblico Overpass non deve essere trattato come infrastruttura di produzione garantita.

Per utenti reali valutare:

```text
A. Overpass autorizzato/gestito
B. propria istanza
C. ingestion da estratti
D. servizio intermedio/cache
E. world packages precompilati
```

La decisione deve considerare:

```text
concorrenza utenti
regioni
latenza
costo
quote
rate limit
disponibilità
licenza/attribution
cache
fallback
```

---

# 13. HARDENING-09 — Gestione errori non bloccante

Il giocatore non deve essere punito per un errore locale di rete.

Classificare errori almeno in:

```text
recoverable
degraded
fatal
```

## Recoverable

Esempi:

```text
neighbor timeout
429
provider momentaneamente occupato
chunk vuoto
cache miss
```

Comportamento:

```text
continua a giocare nell'area sicura
riprova in background
mostra stato leggero
```

## Degraded

Esempi:

```text
alcuni neighbor mancanti
LOD completo non disponibile
decorazioni assenti
```

Comportamento:

```text
mondo giocabile
qualità ridotta
```

## Fatal

Esempi:

```text
renderer non inizializzabile
physics adapter rotto
schema incompatibile impossibile da recuperare
errore interno consistente
```

Comportamento:

```text
ferma sessione in modo controllato
libera risorse
mostra errore
permetti restart completo
```

---

# 14. HARDENING-10 — Streaming predittivo

Il sistema già assegna priorità:

```text
P0 = chunk corrente
P1 = direzione del movimento
P2 = camera
```

Questa è una buona base.

Evoluzione proposta:

```text
P0 current/player safety
P1 predicted trajectory
P2 visible camera bounds
P3 preload ring
P4 speculative low-priority cache
```

La traiettoria può considerare:

```text
speed
heading
current road
camera zoom
```

Mai bloccare P0 per P3/P4.

---

# 15. HARDENING-11 — Budget di memoria

Per una città continua serve un budget esplicito.

Misurare almeno:

```text
raw payload bytes
normalized world bytes estimate
compiled chunk estimate
render objects per chunk
physics colliders per chunk
texture memory
persistent cache size
number active chunks
number warm chunks
```

Definire:

```text
ACTIVE
WARM
COLD/PERSISTED
EVICTED
```

Esempio concettuale:

```text
player
  |
  | ACTIVE: fisica + render
  |
  | WARM: compiled, pronto a riattivarsi
  |
  | PERSISTED: IndexedDB
  |
  v
far away
```

---

# 16. HARDENING-12 — Test di guida lunga

Aggiungere una prova automatizzata di attraversamento.

Esempio:

```text
10 km virtuali
100+ cambi chunk
continue acceleration/steering
```

Verificare:

```text
no crash
no unhandled rejection
memory bounded
cache bounded
active chunks bounded
physics colliders bounded
no stale chunk reapplied
no vehicle enters unavailable world
renderer resources released
```

Aggiungere una variante:

```text
avanti
indietro
loop
diagonale
rapido cambio direzione
```

---

# 17. HARDENING-13 — Invarianti geometrici

Prima di aumentare il numero di città bisogna proteggere:

```text
no NaN
no Infinity
valid bounds
polygon rings valid
holes preserved
roads finite
building footprints finite
collision geometry finite
chunk clipping deterministic
shared seams consistent
```

Su input non supportabile:

```text
diagnostic
skip safely
continue
```

Mai:

```text
silent corruption
```

---

# 18. HARDENING-14 — Benchmark reali su hardware reale

Le misure headless software-GPU servono per regressioni.

Non sono sufficienti per stabilire esperienza utente.

Creare profili:

```text
DESKTOP_LOW
DESKTOP_MID
DESKTOP_HIGH
MOBILE_FUTURE
```

Registrare:

```text
firstPlayable
p50 frame
p95 frame
p99 frame
long frames
normalize
compile
render apply
physics
memory
draw calls
visible features
active chunks
zoom level
```

---

# 19. Camera zoom: fattibilità

## Risposta

Sì.

È perfettamente implementabile.

In realtà la documentazione architetturale del progetto lo prevede già:

```text
top-down renderer must eventually support multiple zoom levels
```

e prevede anche un LOD 2D:

```text
near
medium
far
```

Il codice corrente possiede già una camera implicita.

Attualmente il renderer calcola una scala simile a:

```ts
viewScale =
  Math.max(1, Math.min(screen.width, screen.height)) / 360
```

e applica:

```ts
world.scale.set(scale)
```

La camera è quindi già una trasformazione di scala del mondo.

Serve trasformare quella scala fissa in:

```text
baseScale * zoom
```

---

# 20. Semantica dei pulsanti

Interfaccia:

```text
[-]   [100%]   [+]
```

Convenzione consigliata:

```text
+ = zoom IN
    auto più grande
    meno territorio visibile
    più dettaglio

- = zoom OUT
    auto più piccola
    più territorio visibile
    meno dettaglio
```

Tasti opzionali:

```text
+ / =
- / _
mouse wheel
```

Touch futuro:

```text
pinch
```

Il primo task deve limitarsi ai pulsanti + e - e a scorciatoie tastiera semplici.

---

# 21. Zoom continuo o a step?

Per OpenGTA consiglio inizialmente **zoom a step discreti**.

Motivi:

- facile da testare;
- facile collegare al LOD;
- facile definire limiti;
- comportamento deterministico;
- meno churn nello streaming;
- meno rebuild;
- più facile mantenere estetica GTA classico.

Esempio sperimentale:

```text
ZOOM 0 = FAR
ZOOM 1 = MEDIUM_FAR
ZOOM 2 = DEFAULT
ZOOM 3 = MEDIUM_NEAR
ZOOM 4 = NEAR
```

Fattori iniziali SOLO per esperimento:

```ts
const ZOOM_STEPS = [0.70, 0.85, 1.0, 1.20, 1.45] as const
```

I valori finali devono essere scelti tramite benchmark e prova visiva.

---

# 22. Modifica API renderer

Evolvere:

```ts
interface PixiRenderer {
  render(...)
  updateVehicle(...)
  toggleLabels()
  cameraBounds()
  dispose()
}
```

in qualcosa di simile:

```ts
type ZoomLevel = 0 | 1 | 2 | 3 | 4

interface CameraState {
  readonly zoomLevel: ZoomLevel
  readonly zoomFactor: number
  readonly bounds: Bounds2D
}

interface SessionRenderer {
  render(...)
  updateVehicle(...)
  setZoom(level: ZoomLevel): void
  zoomIn(): ZoomLevel
  zoomOut(): ZoomLevel
  cameraState(): CameraState
  cameraBounds(): Bounds2D
  toggleLabels(): boolean
  dispose(): void
}
```

Non esporre PixiJS fuori dal modulo render.

---

# 23. Implementazione camera

Concettualmente:

```ts
let zoomLevel: ZoomLevel = DEFAULT_ZOOM

function viewScale(): number {
  const base =
    Math.max(1, Math.min(app.screen.width, app.screen.height)) / 360

  return base * ZOOM_STEPS[zoomLevel]
}
```

`cameraBounds()` continuerà automaticamente a rappresentare l'area visibile:

```ts
halfX = screen.width / scale / 2
halfY = screen.height / scale / 2
```

Quindi:

```text
zoom IN
scale cresce
camera bounds diminuiscono

zoom OUT
scale diminuisce
camera bounds aumentano
```

Questo è esattamente il comportamento desiderato.

---

# 24. Punto fondamentale: zoom e caricamento

## Idea intuitiva

Si potrebbe pensare:

> zoom più lontano = posso caricare più lentamente

Questa frase è vera solo se implementiamo LOD e priorità.

### Senza LOD

Zoom OUT:

```text
vedo più metri
    |
    v
cameraBounds più grandi
    |
    v
più chunk visibili
    |
    v
più dati richiesti
```

Quindi può addirittura peggiorare il carico.

### Con LOD

Zoom OUT:

```text
vedo più metri
    |
    v
più area
    |
    v
ma ogni area costa meno
    |
    +--> edifici semplificati
    +--> niente dettagli piccoli
    +--> meno labels
    +--> niente props
    +--> road markings ridotte
    +--> facade ridotta
    +--> eventuale background baked
```

Qui nasce il vantaggio.

---

# 25. Strategia corretta zoom + streaming

Separare due concetti:

```text
VISIBILITY
QUALITY
```

Un chunk può essere:

```text
visibile in FAR
ma non ancora disponibile in NEAR detail
```

Esempio:

```text
             player
               |
      +--------+--------+
      |                 |
      v                 v
 HIGH DETAIL        MEDIUM DETAIL
 active area        near horizon
      |
      v
 LOW DETAIL
 far visible area
```

Lo streaming non deve interpretare "visibile" come "serve tutto immediatamente".

---

# 26. LOD per ottenere il look GTA classico

La documentazione esistente propone:

```text
NEAR
- detailed road markings
- detailed roofs/facades
- props
- vehicles/pedestrians

MEDIUM
- simplified facades
- reduced props
- simplified markings

FAR
- roof/building blocks
- major roads
- minimal decoration
```

Questa direzione è corretta.

## Proposta concreta

### LOD_NEAR

Utilizzato quando l'utente è molto vicino.

Mostrare:

```text
tutte le strade supportate
edifici
fake facade completa
labels principali
road casing
road markings
props futuri
veicoli
pedoni futuri
alberi
barriere
```

### LOD_MEDIUM

Mostrare:

```text
strade
edifici
fake facade ridotta
labels selezionate
niente micro props
marking semplificate
alberi aggregati
```

### LOD_FAR

Mostrare:

```text
major roads
building blocks
parchi
acqua
pochissime labels
no fake facade costosa
no props piccoli
no dettagli strada
```

---

# 27. Non usare lo zoom per cambiare la fisica

La fisica deve rimanere identica:

```text
zoom 70%
zoom 100%
zoom 145%
```

devono condividere:

```text
stessa posizione
stessa velocità
stesse collisioni
stesso mondo
```

Lo zoom cambia solo presentazione e domanda streaming visiva.

---

# 28. Zoom non deve causare refetch inutile

Premendo rapidamente:

```text
- - - + + -
```

non vogliamo creare una tempesta di richieste.

Aggiungere:

```text
debounce/hysteresis camera demand
```

Esempio:

```text
camera changes immediately visually

streaming demand update:
max ogni 100-200 ms
```

Il runtime oggi effettua già stream con pacing circa 200 ms.

Riutilizzare questa disciplina.

---

# 29. Zoom e finestra attiva

Attualmente la selezione dei chunk usa:

```text
P0 current chunk
P1 movement direction
P2 camera keys
```

La camera è limitata a una finestra massima attorno al chunk centrale.

Questo fornisce già una protezione.

Con zoom introdurre però esplicitamente:

```text
camera demand radius
visual LOD radius
physics safety radius
```

Non devono per forza coincidere.

---

# 30. Proposta di anelli di caricamento

```text
+------------------------------------------------------+
|                       FAR LOD                        |
|     +------------------------------------------+     |
|     |                MEDIUM LOD                |     |
|     |      +----------------------------+      |     |
|     |      |          NEAR LOD          |      |     |
|     |      |             CAR            |      |     |
|     |      +----------------------------+      |     |
|     +------------------------------------------+     |
+------------------------------------------------------+
```

Priorità:

```text
P0 safety/physics
P1 next movement
P2 near visual
P3 medium
P4 far
```

Se provider è lento:

```text
P4 può aspettare
P3 può aspettare
P0 non può aspettare
```

---

# 31. Miglioramento percettivo del caricamento

L'obiettivo non è che ogni cosa sia disponibile subito.

L'obiettivo è che il giocatore non percepisca un mondo rotto.

Sequenza ideale:

```text
T0
P0 minimal playable
road + collision + car

T0 + poco
near buildings

successivamente
neighbor roads

successivamente
neighbor buildings

successivamente
facades / labels / decoration
```

Questo consente di mostrare una città viva anche con provider lento.

---

# 32. Placeholder geografico: sì, ma mai inventare strade

In caso di chunk non ancora disponibile:

NON creare strade immaginarie.

Consentito:

```text
neutral loading tile
fog/veil
darkened unknown area
```

Non consentito:

```text
fake road
fake building
fake navigable region
```

La "world truth" deve rimanere OSM/canonical data.

---

# 33. Estetica stile GTA 1/2

Per avvicinarsi alla leggibilità delle immagini di riferimento:

## Strade

Rendere più evidenti:

```text
asfalto scuro
casing/marciapiede chiaro
lane markings
crosswalk futuri
junction readability
```

## Edifici

Preferire:

```text
roof block
facade corta
outline
palette urbana
```

Non usare fake depth troppo alta.

A zoom lontano:

```text
facade -> 0 o quasi
```

A zoom vicino:

```text
facade -> più visibile
```

## Auto

L'auto deve mantenere dimensione leggibile.

Valutare una minima correzione screen-space ai livelli estremi, senza cambiare fisica.

## HUD

Pulsanti:

```text
[-] [+]
```

posizionati sopra il canvas o in overlay.

Devono:

- non catturare permanentemente i tasti di guida;
- essere accessibili;
- avere `aria-label`;
- funzionare a mouse e touch;
- avere stato disabilitato ai limiti.

---

# 34. UI proposta

```text
┌────────────────────────────────────┐
│ OpenGTA                  [-]  [+]  │
│                                    │
│                                    │
│             GAME                   │
│                                    │
│                                    │
└────────────────────────────────────┘
```

Opzionale:

```text
[-]  100%  [+]
```

Meglio non mostrare una percentuale finché i fattori non hanno un significato prodotto stabile.

Una label:

```text
FAR / MEDIUM / NEAR
```

può essere più utile durante sviluppo.

---

# 35. Zoom e etichette

Non mostrare le stesse label a tutti gli zoom.

## Near

```text
strade principali
piazze
POI futuri
```

## Medium

```text
solo strade importanti
piazze
quartieri
```

## Far

```text
quartieri
major places
```

Aggiungere deduplicazione e collision avoidance in seguito.

---

# 36. Zoom e fake-2.5D

La facade attuale deriva da altezza edificio.

Il risultato deve diventare zoom-aware.

Esempio concettuale:

```ts
function facadeStrength(level: ZoomLevel) {
  switch (level) {
    case FAR:
      return 0
    case MEDIUM_FAR:
      return 0.25
    case DEFAULT:
      return 0.6
    case MEDIUM_NEAR:
      return 0.85
    case NEAR:
      return 1
  }
}
```

La geometria autorevole non cambia.

Cambia solo il rendering.

---

# 37. Zoom e road markings

Anche il dettaglio delle strade deve scalare.

```text
FAR
major road body only

MEDIUM
road casing + basic lanes

NEAR
markings + intersections + eventuale arrows/crosswalk
```

In questo modo lo zoom lontano può essere molto più economico.

---

# 38. Culling

Con una scena a chunk incrementali, aggiungere culling.

Non processare elementi completamente fuori vista.

Livelli:

```text
chunk culling
feature culling
eventuale label culling
```

Pixi container invisibili o staccati non devono comunque accumulare risorse senza limite.

---

# 39. Static baking futuro

Per Preprocessed World Mode si può avere:

```text
FAR LOD
    |
    v
prebaked background tile
```

mentre:

```text
NEAR
    |
    v
vector geometry + gameplay data
```

Questo è particolarmente adatto allo stile GTA classico.

Potrebbe permettere:

```text
far zoom = immagini/tile molto economici
near zoom = vettoriale
```

Ma deve essere una fase successiva.

Prima dimostrare il LOD vettoriale.

---

# 40. Roadmap raccomandata

Non implementare tutto insieme.

---

## FASE A — SOLIDITY BASELINE

### SOLID-01 — Metriche compiler reali

**Goal:** misurare normalize/compile/apply.

**Acceptance:**

```text
nessun total=0 artificiale
overlay corretto
test verdi
benchmark aggiornato
```

---

## SOLID-02 — Compile cancellation

**Goal:** propagare `AbortSignal`.

**Acceptance:**

```text
stale compile cancellato
nessuna applicazione risultato obsoleto
test regressione
```

---

## SOLID-03 — Pathological OSM benchmark

**Goal:** misurare multipolygon/large payload.

**Acceptance:**

```text
fixture ripetibile
misure
nessun crash
decisione documentata
```

---

## SOLID-04 — Incremental renderer

**Goal:** eliminare full scene rebuild.

API target:

```text
setChunk
removeChunk
```

**Acceptance:**

```text
chunk invariato conserva le stesse risorse
1 chunk nuovo non ricrea tutti gli altri
1 chunk rimosso distrugge solo quello
```

---

## SOLID-05 — Long drive test

**Goal:** 100+ window transitions.

**Acceptance:**

```text
memory bounded
active chunks bounded
cache bounded
no crash
no stale apply
```

---

## SOLID-06 — Live canary

**Goal:** test manuale/nightly città reali.

**Acceptance:**

```text
report separato dalla CI
fallimento provider non rende rosso il normale unit build
```

---

# 41. FASE B — ZOOM BASE

## ZOOM-01 — CameraState

Creare contratto:

```ts
type ZoomLevel = 0 | 1 | 2 | 3 | 4

interface CameraState {
  zoomLevel: ZoomLevel
  zoomFactor: number
  bounds: Bounds2D
}
```

---

## ZOOM-02 — Renderer setZoom

Aggiungere:

```ts
setZoom()
zoomIn()
zoomOut()
```

**Acceptance:**

```text
camera center invariato
vehicle world position invariata
physics invariata
bounds cambiano correttamente
```

---

## ZOOM-03 — Pulsanti + e -

Aggiungere UI.

**Acceptance:**

```text
+ zoom in
- zoom out
limiti rispettati
nessun page error
guida continua dopo click
responsive
```

---

## ZOOM-04 — Streaming reacts to zoom

Al cambio zoom:

```text
cameraBounds cambia
stream signature cambia
runtime aggiorna domanda
```

Non introdurre fetch duplicati.

---

## ZOOM-05 — Zoom tests

Unit:

```text
clamp min
clamp max
center preservation
bounds shrink on zoom in
bounds expand on zoom out
```

E2E:

```text
click +
world visually grows
click -
world visually shrinks
car remains centered
no page error
session stays ready/degraded
```

---

# 42. FASE C — LOD

## LOD-01 — Presentation profile

Creare:

```ts
type LodTier =
  | "near"
  | "medium"
  | "far"
```

Funzione:

```ts
lodForZoom(zoomLevel)
```

Non inserire logica LOD nel canonical world.

---

## LOD-02 — Labels

Ridurre label per livello.

---

## LOD-03 — Facades

Ridurre/disabilitare fake depth a zoom lontano.

---

## LOD-04 — Road detail

Ridurre marking/casing non essenziali.

---

## LOD-05 — Small feature culling

Non disegnare micro feature sotto una soglia in pixel.

Esempio:

```text
se footprint < N px²
skip visual only
```

Non cancellare dal world model.

---

# 43. FASE D — PERSISTENT CACHE

## CACHE-01 — Storage contract

Definire interfaccia astratta.

---

## CACHE-02 — IndexedDB experiment

Misurare:

```text
write
read
deserialize
quota
failure
```

---

## CACHE-03 — Version validation

Entry incompatibile:

```text
discard
```

Mai tentare di usarla silenziosamente.

---

## CACHE-04 — LRU/eviction

Definire budget.

---

# 44. FASE E — PREPROCESSED MODE

Dopo cache/runtime stabile:

```text
OSM extract
   |
   v
offline normalize/compile
   |
   v
world package
   |
   v
CDN/static file
   |
   v
same runtime
```

Questa modalità sarà probabilmente la migliore per grandi città curate.

---

# 45. FASE F — Produzione

Solo dopo:

```text
solid runtime
zoom
LOD
persistent cache
long drive
canary
```

affrontare:

```text
hosting
provider
CDN
CSP
observability
quota
SLA
rollback
release
```

---

# 46. Definition of Done per "navigare una città"

Non considerare completato Open World solo perché un chunk si carica.

La milestone "City Navigation Stable" deve richiedere:

## Funzionale

- [ ] posso partire da coordinate valide;
- [ ] P0 diventa giocabile;
- [ ] posso guidare continuamente;
- [ ] attraversamento chunk trasparente;
- [ ] collisioni coerenti;
- [ ] nessuna strada falsa;
- [ ] area non disponibile blocca fisicamente in modo sicuro;
- [ ] il gioco riprende quando arriva il chunk;
- [ ] retry senza reload;
- [ ] stop/restart affidabile;
- [ ] zoom durante la guida;
- [ ] nessuna variazione fisica causata dallo zoom.

## Robustezza

- [ ] 100+ transizioni;
- [ ] no uncaught exception;
- [ ] no unhandled rejection;
- [ ] no NaN/Infinity;
- [ ] no stale application;
- [ ] no resource leak evidente;
- [ ] memory bounded;
- [ ] cache bounded;
- [ ] collider bounded.

## Performance

- [ ] first playable misurato;
- [ ] normalize misurato;
- [ ] compile misurato;
- [ ] p95 frame misurato;
- [ ] long frames misurati;
- [ ] test almeno su desktop reale low/mid.

## Zoom

- [ ] minimo;
- [ ] massimo;
- [ ] step intermedi;
- [ ] camera center stabile;
- [ ] bounds corretti;
- [ ] LOD coerente;
- [ ] no request storm.

---

# 47. Debug overlay futuro

Aggiungere:

```text
zoom level
zoom factor
LOD tier
camera width meters
camera height meters
active chunk count
visible chunk count
warm cache count
persistent hit/miss
pending requests
P0/P1/P2/P3 count
normalize ms
compile ms
renderer apply ms
collider count
graphics/container count
```

Questo renderà il tuning molto più semplice.

---

# 48. Metriche zoom importanti

Per ogni livello:

```text
visible world meters
visible chunks
draw calls
Graphics count
feature count
label count
frame p95
memory
stream requests
first visual completion
```

Esempio report:

```text
Zoom FAR
camera: 900 x 500 m
chunks visible: 12
render features: 1 300
p95: ...

Zoom DEFAULT
camera: 500 x 280 m
chunks visible: 6
render features: 2 100
p95: ...

Zoom NEAR
camera: 280 x 160 m
chunks visible: 2
render features: 1 000
p95: ...
```

Non assumere a priori quale sia più veloce.

Misurare.

---

# 49. Un'importante distinzione

## Zoom OUT non deve significare "carica tutto"

Questa sarebbe una trappola.

La regola deve essere:

```text
camera wants visibility
streamer decides priority
LOD decides cost
```

Quindi un'area lontana può apparire:

```text
prima come FAR
poi come MEDIUM
poi eventualmente NEAR
```

senza bloccare il giocatore.

---

# 50. Strategia ideale a lungo termine

```text
                             +----------------------+
                             |  PERSISTENT CACHE    |
                             +----------+-----------+
                                        |
                                        v
PROVIDER -> ACQUIRE -> NORMALIZE -> COMPILE -> COMPILED CHUNK
                                        |
                                        v
                              +---------+---------+
                              |                   |
                              v                   v
                        PHYSICS CORE       PRESENTATION CACHE
                                                  |
                           +----------------------+--------------------+
                           |                      |                    |
                           v                      v                    v
                        FAR LOD               MEDIUM LOD            NEAR LOD
                           |                      |                    |
                           +----------------------+--------------------+
                                                  |
                                                  v
                                             PIXI RENDERER
                                                  |
                                                  v
                                            ZOOMED CAMERA
```

---

# 51. Funzionalità da NON implementare prima di questa roadmap

Rimandare:

- multiplayer;
- missioni complesse;
- combattimento;
- inventario;
- economia;
- IA generativa runtime;
- pedoni massivi;
- traffico massivo;
- migrazione WebGPU;
- renderer 3D;
- shader complessi;
- texture AI dinamiche.

Prima:

```text
world reliability
streaming
renderer delta
camera
zoom
LOD
cache
```

---

# 52. Criterio per introdurre Web Worker

Non farlo perché:

```text
"il compiler potrebbe essere pesante"
```

Farlo quando i dati mostrano:

```text
normalize/compile crea long frame
main thread responsiveness peggiora
yielding non basta
```

Esperimento:

```text
A = main thread cooperative
B = worker
```

Misurare:

```text
first playable
compile wall time
main thread long frames
serialization cost
memory
cancellation latency
```

Keep solo se B migliora realmente l'esperienza.

---

# 53. Criterio per cambiare PixiJS

Non cambiare renderer ora.

PixiJS è coerente con il prodotto 2D-first.

Considerare cambio solo con evidenza:

```text
renderer overhead misurato
batching insufficiente
feature necessaria impossibile
memory strutturalmente problematica
```

Lo stesso vale per Rapier.

---

# 54. Primo risultato visivo da puntare

Prima milestone grafica GTA-like:

```text
camera top-down
+
zoom 5 step
+
strade fortemente leggibili
+
building blocks
+
fake facade leggera
+
car sprite/shape leggibile
+
streaming continuo
```

Non servono ancora:

```text
persone
traffico
missioni
texture elaborate
```

Se questo risulta piacevole da guidare, il prodotto ha una base forte.

---

# 55. Ordine esatto raccomandato dei prossimi task

```text
01 SOLID-01 real compiler timing
02 SOLID-02 cancellation through normalize/compile
03 SOLID-03 pathological OSM benchmark
04 SOLID-04 incremental chunk renderer
05 SOLID-05 long-drive regression
06 ZOOM-01 camera state
07 ZOOM-02 renderer zoom API
08 ZOOM-03 +/- controls
09 ZOOM-04 streaming reacts to camera zoom
10 ZOOM-05 unit + E2E zoom tests
11 LOD-01 zoom -> LOD policy
12 LOD-02 labels
13 LOD-03 facade detail
14 LOD-04 road detail
15 LOD-05 feature culling
16 SOLID-06 real-world canary
17 CACHE-01 persistence contract
18 CACHE-02 IndexedDB experiment
19 CACHE-03 version/integrity
20 CACHE-04 eviction
21 PREPROCESSED-01 package spec
22 production provider/hosting ADR
```

---

# 56. Regola di implementazione per ogni task

Ogni task deve contenere:

```text
TASK ID
GOAL
READ
MAY MODIFY
DO NOT TOUCH
CONSTRAINTS
TEST FIRST
IMPLEMENTATION
ACCEPTANCE
BENCHMARK
ROLLBACK
RESULT
```

Usare TDD quando possibile.

Ogni bug:

```text
reproduce
test failing
fix
test green
regression retained
```

---

# 57. Regola di commit

Ogni slice deve essere piccola e atomica.

Esempio:

```text
feat(camera): add bounded zoom state
test(camera): cover zoom bounds and center invariants
```

Non fare un unico commit:

```text
"add zoom lod cache renderer rewrite"
```

---

# 58. Regola di compatibilità

Dopo ogni task:

```bash
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
```

Se disponibile, smoke production.

Il task non è chiuso solo perché "sembra funzionare".

---

# 59. Risposta finale alla domanda sullo zoom

Lo zoom è non soltanto possibile, ma molto coerente con OpenGTA.

La base corrente ha già:

```text
top-down camera
world.scale
cameraBounds
camera-driven chunk demand
2D-first architecture
planned zoom
planned 2D LOD
```

Quindi non serve rifare l'engine.

La strada corretta è:

```text
current fixed camera scale
        |
        v
bounded zoom factor
        |
        v
cameraBounds react
        |
        v
stream demand reacts
        |
        v
LOD reduces visual cost
```

---

# 60. Correzione chiave sull'idea "zoom = caricamento più lento"

La formulazione corretta per il progetto è:

> Lo zoom può permettere al motore di **nascondere la latenza di caricamento** e di distribuire il lavoro nel tempo, ma solamente se lo zoom è collegato a LOD, priorità e progressive refinement.

Non:

> Più lontano zoommo, meno roba devo caricare.

Perché tecnicamente spesso è il contrario:

```text
zoom out -> più mondo visibile
```

Il vero vantaggio sarà:

```text
zoom out
-> più mondo
-> molto meno dettaglio per metro²
-> caricamento progressivo tollerabile
-> esperienza visivamente continua
```

Questo è un meccanismo ideale per un gioco top-down in stile GTA classico.

---

# 61. Target architetturale finale

Il prodotto dovrebbe arrivare a questo comportamento:

```text
PLAYER DRIVES
      |
      v
CAMERA FOLLOWS + ZOOM
      |
      v
VISIBLE BOUNDS
      |
      v
STREAM PRIORITY PLANNER
      |
      +--> P0 physics safety
      +--> P1 driving direction
      +--> P2 near visual
      +--> P3 medium visual
      +--> P4 far visual
      |
      v
CACHE -> PROVIDER IF NEEDED
      |
      v
NORMALIZE / COMPILE
      |
      v
CHUNK READY
      |
      +--> physics setChunk
      |
      +--> renderer addChunk
      |
      +--> selected LOD presentation
```

Quando il giocatore prosegue:

```text
old chunk
   |
   +--> renderer removeChunk
   +--> physics removeChunk
   +--> keep warm/cache
```

Nessun full rebuild.

Nessun mondo infinito tenuto in RAM.

Nessun caricamento monolitico.

---

# 62. Obiettivo finale della milestone

La milestone da raggiungere prima di gameplay avanzato è:

> **OpenGTA City Drive Stable:** l'utente può scegliere una zona urbana supportata, iniziare a guidare rapidamente, attraversare continuamente numerosi chunk, utilizzare zoom `+` e `-`, ricevere progressivamente il mondo circostante, continuare a giocare durante errori recuperabili, tornare su aree già visitate senza ricompilazioni inutili e completare una sessione lunga senza crash, freeze importante o crescita non limitata delle risorse.

Solo dopo questa milestone iniziare seriamente:

```text
traffic
pedestrians
missions
combat
multiplayer
AI visual enrichment
```

---

# 63. Principio finale

OpenGTA non ha bisogno di essere riscritto.

La struttura fondamentale è buona.

Il prossimo salto qualitativo non viene dall'aggiungere più feature, ma dal rendere estremamente affidabili:

```text
STREAMING
CANCELLATION
INCREMENTAL RENDERING
CACHE
CAMERA
ZOOM
LOD
ERROR RECOVERY
MEASUREMENT
```

Quando questi otto elementi saranno solidi, il progetto avrà la base tecnica necessaria per trasformare città reali in scenari top-down continui con una giocabilità realmente vicina allo spirito dei primi GTA.
