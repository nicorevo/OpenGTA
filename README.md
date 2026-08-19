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

## Stato del repository al handoff

Il repository applicativo deriva da uno scaffold AI-SDLC e contiene già:

- `AGENTS.md`;
- `.opencode/agents`;
- `.opencode/skills`;
- standard e policy di progetto.

Al momento del handoff non è stato ancora scritto codice applicativo OpenGTA.

Il planning pack porta il progetto fino al punto in cui la prossima attività
richiede il repository eseguibile reale.

## Da dove partire

### Umano: applicazione ZIP

Leggere:

`docs/execution/overlay-existing-repository.md`

### Codex: dopo l'overlay

Iniziare da:

`docs/handoff/CODEX-START-HERE.md`

e seguire:

`docs/handoff/CODEX-EXECUTION-QUEUE.md`

## Decisioni

Vista sintetica:

`docs/DECISIONS.md`

## Fonte di verità

Ordine:

```text
AGENTS.md
→ relevant .opencode instructions
→ docs/intent/open-gta-web.md
→ docs/architecture/
→ docs/adr/
→ docs/specs/
→ docs/execution/ and docs/handoff/
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

- `docs/handoff/PRE-CODE-COMPLETE.md`
- `docs/handoff/CODEX-START-HERE.md`
- `docs/handoff/CODEX-EXECUTION-QUEUE.md`

## Comandi di sviluppo

Non esistono ancora al momento del planning handoff.

Codex li introdurrà nel primo scaffold e aggiornerà questa sezione rispettando
il `AGENTS.md` e le policy già presenti.
