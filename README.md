# OpenGTA Web

OpenGTA Web è un motore e una sandbox geospaziale browser-first che trasforma
zone urbane reali, descritte principalmente da dati OpenStreetMap, in un mondo
di gioco **2D top-down** riconoscibile, esplorabile e guidabile, con effetti
fake-2.5D leggeri.

## Visione finale

Due modalità, un solo core:

1. **Preprocessed World Mode** — zone già elaborate/ottimizzate e distribuite
   come pacchetti statici, adatte anche a client meno potenti.
2. **Open World Runtime Mode** — coordinate arbitrarie, acquisizione e
   compilazione progressiva nel browser, con AI visiva opzionale
   preferibilmente client-side.

## Stato del repository

Fase 0 (documentazione e contratti) chiusa:

`docs/results/PHASE-0-COMPLETE.md`

Slice V0 eseguibile (Lecce centro, guida top-down, collisioni 2D):

`docs/results/V0-RESULT.md`

Ripristino online e streaming Open World (ONLINE-01..16, checkpoint C1..C6):

`docs/results/ONLINE-RUNTIME-RESULT.md`

**Baseline stabile per test utente:** commit `4142db4` sul ramo `opcl3D`
(2026-09-17, Review Remediation). Verificata con 406 test unitari
(55 file), 11 test bench, 23 E2E (1 skipped) su dev server (più canary live
separata), 1 smoke del build di produzione, typecheck e build. Vedi
[Prova della baseline](#prova-della-baseline).

Tranche First-Person Renderer (vista prospettiva OutRun-style, MVP; toggle
`V`; strade in prospettiva vera + edifici box 3D; guard e2e
`first-person-view`):

`docs/specs/first-person-renderer-v0.md` · `tasks/first-person/`

Tranche Review Remediation (RV-01..12, checkpoint R-A/R-B/R-C; robustezza e
performance del runtime, dettagli in `tasks/plan.md`):

`tasks/review/` · `tasks/executions/2026-09-17-RV-*.md`

Tranche City Drive Stable (solidità, zoom a livelli discreti con LOD 2D,
cache persistente, gate su Lecce):

`docs/results/CITY-DRIVE-STABLE-RESULT.md` · `docs/specs/city-drive-stable.md` ·
`docs/adr/ADR-010-discrete-zoom-lod.md` · `docs/architecture/zoom-and-lod.md`

Tranche Provider-Neutral World Streaming (migrazione Overpass → Vector
Tiles con Overpass come reference/fallback, ADR-011; decisione parity
GO VISUAL ONLY, flag `provider=openfreemap-mvt` sperimentale):

`docs/results/PROVIDER-NEUTRAL-WORLD-STREAMING-RESULT.md` ·
`docs/specs/provider-neutral-world-streaming.md` ·
`docs/analysis/MVT-LECCE-PARITY.md` · `docs/OpenGTA-DATA-SOURCE-MIGRATION.md` ·
`tasks/plan.md` · `tasks/data/README.md`

Avvio di sessione per agenti:

`docs/handoff/CURRENT.md`

Specifica corrente indicizzata:

`docs/SPEC.md`

I file `docs/handoff/CODEX-START-HERE.md`, `docs/handoff/CODEX-EXECUTION-QUEUE.md`
e `docs/execution/` sono archivio della coda V0: non rieseguirli come backlog
attivo.

## Decisioni

Vista sintetica:

`docs/DECISIONS.md`

## Fonte di verità

Ordine:

```text
AGENTS.md
→ relevant .opencode instructions
→ docs/SPEC.md
→ docs/intent/open-gta-web.md
→ docs/architecture/
→ docs/adr/
→ docs/specs/
→ docs/handoff/CURRENT.md
→ tasks/
→ implementation
```

La vecchia bozza tecnica è conservata come ipotesi storica:

`docs/idea/OpenGTA Web City Scale Idea.md`

## V0 già definito

V0 usa:

- fixture reale fissa: Lecce centro, ~600 × 600 m;
- WGS84 + piano metrico locale validato;
- TypeScript strict;
- Vite 8-class tooling;
- Vitest 4-class tests;
- PixiJS v8 / WebGL;
- Rapier 2D;
- un veicolo arcade;
- collisioni 2D;
- fake-2.5D;
- nessuna AI, streaming o multiplayer.

Le tecnologie sono accettate **per il prototipo** e rimangono sostituibili dopo
evidenza misurata.

## Documentazione chiave

### Architecture

- `docs/architecture/README.md`
- `docs/architecture/product-architecture-principles.md`
- `docs/architecture/dual-world-pipeline.md`
- `docs/architecture/2d-rendering-model.md`
- `docs/architecture/world-model.md`
- `docs/architecture/coordinate-system.md`
- `docs/architecture/world-compiler.md`
- `docs/architecture/data-acquisition-strategy.md`

### Specs

- `docs/specs/canonical-world-v0-contract.md`
- `docs/specs/osm-normalization-v0.md`
- `docs/specs/road-generation-v0.md`
- `docs/specs/building-fake-2_5d-v0.md`
- `docs/specs/compiled-chunk-v0-contract.md`
- `docs/specs/vehicle-controller-v0.md`
- `docs/specs/debug-overlay-v0.md`

### Testing

- `docs/testing/v0-test-strategy.md`
- `docs/testing/benchmark-protocol-v0.md`

### Handoff

- `docs/handoff/CURRENT.md`
- `docs/results/PHASE-0-COMPLETE.md`
- `docs/handoff/PRE-CODE-COMPLETE.md` (storico)
- `docs/handoff/CODEX-START-HERE.md` (storico)
- `docs/handoff/CODEX-EXECUTION-QUEUE.md` (storico)

### Tasks

- `tasks/plan.md`
- `tasks/todo.md`
- `tasks/executions/`

## Comandi di sviluppo

Installazione e verifiche:

```bash
npm install
npm run dev
npm run typecheck
npm run test:run
npm run test:e2e
npm run build
```

### Modalità live (online di default)

La modalità live è attiva di default al load e usa la sorgente vettoriale
OpenFreeMap (MVT) pinnata a un dataset versionato: l'endpoint è una costante
di compile-time (mai input utente), il consenso è implicito e l'unico dato
inviato al provider è l'origine della mappa. L'opt-out dalla rete è la
modalità offline.

Provider Overpass (OpenStreetMap, opt-in via URL) e endpoint autorizzato in
produzione:

```text
http://127.0.0.1:5173/?mode=open-world-live&provider=osm&lat=40.35&lon=18.17
```

L'endpoint Overpass predefinito è `https://overpass-api.de/api/interpreter`.
Per un ambiente di produzione usare un endpoint autorizzato o un'istanza
Overpass gestita; non incorporare chiavi o credenziali nel client.

### Prova della baseline

Avvio: `npm install && npm run dev`, poi aprire `http://127.0.0.1:5173/`.
Il default è la **modalità online** (sorgente MVT OpenFreeMap pinnata): l'app
avvia subito una sessione live con l'origine predefinita; guida con W,
retromarcia con S, F3 per la diagnostica, L per le etichette.

Per giocare offline (fixture Lecce, nessuna rete) selezionare "Offline" dal
pannello **"OpenGTA / Area di gioco"** (in alto a sinistra), oppure usare
`http://127.0.0.1:5173/?mode=offline`. Il pannello consente di impostare
l'origine (lat/lon), di scegliere la modalità e di riavviare la sessione con
**Avvia**; provider e endpoint sono fissi alla sorgente MVT (non
configurabili dall'interfaccia).

Provider Overpass (OpenStreetMap) via URL esplicito:

```text
http://127.0.0.1:5173/?mode=open-world-live&provider=osm&lat=40.35&lon=18.17
```

Cosa verificare durante la prova:

- stato sotto la scena: `Area pronta`, `Area parziale` (neighbor falliti),
  `Nessuna strada percorribile`, `Caricamento non riuscito` — con `Riprova`
  senza ricaricare la pagina;
- l'auto parte appena la prima area è applicata, senza attendere i neighbor;
- guidando si attraversano i confini dei chunk: i dati arrivano e i settori
  lontani vengono rilasciati;
- se il settore davanti non è ancora disponibile l'auto si ferma con
  "Settore davanti non disponibile" e riparte quando i dati arrivano;
- `Interrompi` ferma la sessione;
- l'attribuzione OpenStreetMap resta sempre visibile.

Limiti noti della baseline (dettagli in `docs/results/ONLINE-RUNTIME-RESULT.md`):

- con il provider reale la finestra completa arriva in ~14 s (spaziatura
  minima Overpass di 2 s per cella); il primo chunk giocabile è pronto in
  ~100 ms;
- la copertura dipende dal provider pubblico: un'area senza strade o un
  servizio occupato producono `empty`/`error` espliciti, non un mondo finto;
- le misure di prestazione sono headless con GPU software: non promettono
  FPS dell'hardware dell'utente;
- lo zoom `+/−` (pulsanti in alto a destra o tasti `+`/`-`) ha 5 livelli con
  LOD near/medium/far; il dettaglio si riduce allontanandosi e la domanda
  di streaming segue la camera;
- un reload della pagina riusa i chunk compilati dalla cache persistente
  (IndexedDB) senza nuove richieste al provider;
- la porta E2E è configurabile con `OPENGTA_E2E_PORT` (default 5180);
  lo smoke degli asset costruiti con `OPENGTA_E2E_PREVIEW=1`; la canary live
  reale si esegue con `npm run test:canary` (mai nella CI).
