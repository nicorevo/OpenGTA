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

**Baseline stabile per test utente:** commit `a5b076b` sul ramo `opcl`
(2026-09-10). Verificata con 172 test unitari, 14 E2E su dev server, 1 smoke
del build di produzione, typecheck e build. Vedi [Prova della baseline](#prova-della-baseline).

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

### OpenStreetMap live mode

La modalità live usa Overpass per ottenere dati OpenStreetMap. Richiede
consenso esplicito e limita le richieste per rispettare il servizio:

```text
http://127.0.0.1:5173/?mode=open-world-live&provider=osm&lat=40.35&lon=18.17&consent=1
```

L’endpoint predefinito è `https://overpass-api.de/api/interpreter`. Per un
ambiente di produzione usare un endpoint autorizzato o un’istanza Overpass
gestita; non incorporare chiavi o credenziali nel client.

### Prova della baseline

Avvio: `npm install && npm run dev`, poi aprire `http://127.0.0.1:5173/`.
Il default è la **modalità offline** (fixture Lecce, nessuna rete): guida con
W, retromarcia con S, F3 per la diagnostica, L per le etichette.

Modalità live dal pannello **"OpenGTA / Area di gioco"** (in alto a sinistra):
selezionare "Online OSM", spuntare il consenso e premere Avvia. In
alternativa, URL esplicito:

```text
http://127.0.0.1:5173/?mode=open-world-live&provider=osm&lat=40.35&lon=18.17&consent=1
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
- `Interrompi` ferma la sessione; togliere il consenso la termina subito;
- l'attribuzione OpenStreetMap resta sempre visibile.

Limiti noti della baseline (dettagli in `docs/results/ONLINE-RUNTIME-RESULT.md`):

- con il provider reale la finestra completa arriva in ~14 s (spaziatura
  minima Overpass di 2 s per cella); il primo chunk giocabile è pronto in
  ~100 ms;
- la copertura dipende dal provider pubblico: un'area senza strade o un
  servizio occupato producono `empty`/`error` espliciti, non un mondo finto;
- le misure di prestazione sono headless con GPU software: non promettono
  FPS dell'hardware dell'utente;
- la porta E2E è configurabile con `OPENGTA_E2E_PORT` (default 5180);
  lo smoke degli asset costruiti con `OPENGTA_E2E_PREVIEW=1`.
