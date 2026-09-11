# Piano: City Drive Stable (solidità, zoom e LOD)

Data: 2026-09-11. Analisi di riferimento: review della tranche ONLINE
(2026-09-10) e proposta esterna `docs/OpenGTA_SOLIDITY_ZOOM_ROADMAP.md`,
riconciliata con il codice.
Stato: pianificato; implementazione non avviata.
Baseline codice: `77312aa`. Responsabile della pianificazione: tech-lead-planner.

## Obiettivo

Rendere OpenGTA un motore realmente solido per attraversare città reali in
modo continuo: metriche reali, compilazione cancellabile, renderer
incrementale, guida lunga senza perdite, zoom a livelli discreti con LOD 2D,
cache persistente fra sessioni e un gate "City Drive Stable" verificato su
Lecce. Nessun gameplay avanzato prima di questa milestone
(spec `docs/specs/city-drive-stable.md`, ADR-010,
design `docs/architecture/zoom-and-lod.md`).

## Come usare il piano

1. Leggere [istruzioni e contratti comuni](city/README.md).
2. Assegnare un solo task; leggere la sua scheda e verificare le dipendenze.
3. Eseguire TDD, verifica nativa e log di consegna secondo la scheda.
4. Aggiornare la riga qui e in [todo](todo.md) solo con evidenza.

Il piano non autorizza deploy; il canary live e' separato dalla CI e mai
bloccante per i test deterministici.

## Confini

Inclusi: metriche compiler reali, cancellazione cooperativa di
normalize/compile, benchmark patologici, renderer incrementale per chunk,
long-drive regression, zoom discreti +/− con LOD near/medium/far, cache
persistente (contratto, esperimento IndexedDB, versioning, eviction), canary
reale e gate finale su Lecce.

Differiti: Worker (solo dopo misure), wheel/pinch continui, traffico,
pedoni, missioni, multiplayer, AI, hosting/CDN/SLA di produzione. Le
condizioni di apertura restano in [FOLLOW-UPS](online/FOLLOW-UPS.md).

## Task ordinati

| Stato | ID e scheda | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | [SOLID-01 Metriche compiler reali](city/SOLID-01.md) | Nessuna | S | Nessun `total: 0`; overlay con tempi reali |
| [x] | [SOLID-02 Cancellazione compile](city/SOLID-02.md) | SOLID-01 | M | Abort osservabile durante normalize/compile |
| [x] | [SOLID-03 Benchmark patologici](city/SOLID-03.md) | SOLID-02 | M | Fixture 100..20k membri con budget dichiarato |
| [x] | [SOLID-04 Renderer incrementale](city/SOLID-04.md) | Nessuna | L | setChunk/removeChunk con zero rebuild dei chunk invariati |
| [x] | [SOLID-05 Long-drive regression](city/SOLID-05.md) | SOLID-04 | M | 100+ transizioni senza crash, risorse bounded |
| [x] | [SOLID-06 SECURITY e gate docs](city/SOLID-06.md) | Nessuna | S | SECURITY.md allineato; gate consistenza documentato |
| [x] | [ZOOM-01 Stato camera](city/ZOOM-01.md) | Nessuna | S | Modulo puro con clamp/fattori/bounds testati |
| [ ] | [ZOOM-02 API zoom renderer](city/ZOOM-02.md) | ZOOM-01, SOLID-04 | M | setZoom con centro e fisica invariati |
| [ ] | [ZOOM-03 Controlli +/−](city/ZOOM-03.md) | ZOOM-02 | S | Pulsanti accessibili senza intrappolare i tasti di guida |
| [ ] | [ZOOM-04 Streaming reagisce allo zoom](city/ZOOM-04.md) | ZOOM-03 | M | Domanda aggiornata senza tempesta di richieste |
| [ ] | [ZOOM-05 Test zoom](city/ZOOM-05.md) | ZOOM-04 | M | Unit + E2E con benchmark dei fattori |
| [x] | [LOD-01 Politica zoom→LOD](city/LOD-01.md) | ZOOM-01 | S | lodForZoom pura e testata |
| [ ] | [LOD-02 Label per tier](city/LOD-02.md) | LOD-01, SOLID-04 | S | Soglie di importanza per tier |
| [ ] | [LOD-03 Facade per tier](city/LOD-03.md) | LOD-01 | S | Forza facade decrescente con lo zoom out |
| [ ] | [LOD-04 Road detail per tier](city/LOD-04.md) | LOD-01 | S | FAR body / MEDIUM casing / NEAR marking |
| [ ] | [LOD-05 Culling feature](city/LOD-05.md) | LOD-01 | M | Skip visuale sotto soglia px², world model intatto |
| [x] | [CACHE-01 Contratto storage](city/CACHE-01.md) | Nessuna | S | Interfaccia astratta con quota/errori |
| [x] | [CACHE-02 Esperimento IndexedDB](city/CACHE-02.md) | CACHE-01 | M | Misure write/read/quota con decisione documentata |
| [ ] | [CACHE-03 Versioning e integrità](city/CACHE-03.md) | CACHE-02 | S | Entry incompatibile scartata, mai usata |
| [ ] | [CACHE-04 Eviction](city/CACHE-04.md) | CACHE-03 | S | Budget dichiarato e rispettato |
| [ ] | [CITY-01 Canary reale](city/CITY-01.md) | SOLID-01..06, ZOOM-05 | M | Report separato, Lecce + lista estesa |
| [ ] | [CITY-02 Gate City Drive Stable](city/CITY-02.md) | Tutti i precedenti | M | Matrice requisiti→prove, misure e handoff allineati |

## Checkpoint

### C-A: solidità, dopo SOLID-01..06

- [ ] Compile misurato e cancellabile; benchmark patologici con budget.
- [ ] Renderer incrementale senza regressioni di ordine/mask/hole.
- [ ] 100+ transizioni: memoria, cache, collider bounded.
- [ ] SECURITY.md riallineato; suite completa, typecheck, build, E2E verdi.

### C-B: zoom base, dopo ZOOM-01..05

- [ ] 5 livelli con clamp e centro invariato; fisica e fixed-step intatti.
- [ ] Pulsanti +/− accessibili; guida continua dopo i click.
- [ ] Domanda di streaming aggiornata con debounce; nessuna tempesta.
- [ ] Fattori benchmarkati e documentati; E2E zoom verdi.

### C-C: LOD, dopo LOD-01..05

- [ ] Tier coerenti per zoom; costo per metro quadro decrescente con lo
  zoom out misurato.
- [ ] Nessun LOD nel canonical world; culling solo visuale.
- [ ] Suite completa, typecheck, build, E2E verdi.

### C-D: cache persistente, dopo CACHE-01..04

- [ ] Reload riusa i chunk validi; entry corrotta/stale scartata.
- [ ] Quota gestita; sessione funziona anche senza storage.
- [ ] Misure cold/warm con ambiente dichiarato.

### C-E: gate, CITY-01..02

- [ ] Canary Lecce + lista estesa con report separato, mai bloccante per CI.
- [ ] Matrice requisiti→prove completa; misure con ambiente dichiarato.
- [ ] `docs/handoff/CURRENT.md`, piano e checklist concordi col codice.

I checkpoint sono gate tecnici e non richiedono nuova autorizzazione per
proseguire una tranche gia' assegnata.

## Dipendenze e ordine di esecuzione

L'ordine numerico e' valido per un singolo esecutore. SOLID-04 (renderer)
e' prerequisito del LOD applicato ma puo' procedere in parallelo con
SOLID-01..03 se assegnato esplicitamente; ZOOM-01 e CACHE-01 sono indipendenti
dal resto. Nessun task di solo test lascia la suite rossa a fine consegna.

## Rischi e scelte esplicite

| Rischio | Gestione prevista |
| --- | --- |
| Zoom out senza LOD aumenta il carico | LOD prima della pubblicizzazione dei fattori; benchmark per livello |
| Renderer incrementale rompe z-order/mask | Container per tipo di layer; regressioni V0 di hole/ordine |
| Compilazione lunga blocca il main thread | Yield cooperativo + budget per task; Worker solo con misure |
| Relation patologiche | Indicizzazione per endpoint se i benchmark lo richiedono |
| Cache persistente corrotta/incompatibile | Versioning nel namespace; discard mai uso silenzioso |
| Canary contatta servizi pubblici | Suite separata, mai in CI, richieste limitate e riportate |

## Storico preservato

Piano e checklist della tranche ONLINE completata: [archivio
piano](archive/2026-09-10-plan.md) e [archivio checklist](archive/2026-09-10-todo.md).
I log in `tasks/executions/` restano evidenza storica.
