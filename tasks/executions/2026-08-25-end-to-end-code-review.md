# Execution Log — V0 End-to-End Code Review

Date: 2026-08-25
Verdict: REQUEST CHANGES

## Scope

Review del working tree V0 rispetto a specifiche, ADR, test strategy,
convenzioni e comportamento browser. Nessun fix di produzione incluso.

## Instructions Applied

- persona `code-reviewer`;
- skill `code-review-and-quality`;
- skill `code-simplification`;
- skill `documentation-and-adrs` per separare report ed esecuzione;
- skill `browser-testing-with-devtools` per la prova runtime.

## Static Review

Analizzati test prima dell'implementazione e poi i moduli:

- app/bootstrap, fixed-step e metriche;
- projector e normalizzazione OSM;
- canonical model, clipping, compiler e road fitting;
- controller e adapter Rapier;
- renderer PixiJS, presentation e scene order;
- fixture Lecce, test strategy, contratti e ADR V0;
- stato Git e storia/blame dei moduli critici.

Il report completo è in:

`docs/analysis/END-TO-END-CODE-REVIEW-2026-08-25.md`.

## Native Verification

```text
npm run test:run             PASS (13 file, 36 test)
npm run typecheck            PASS
npm run build                PASS
npm audit --audit-level=high PASS (0 vulnerabilità)
```

Build osservato:

```text
main chunk: 2,389.71 kB minified / 778.87 kB gzip
warning: chunk > 500 kB
```

Non esiste uno script lint. Non è configurato un provider di coverage.

`git diff --check` ha segnalato trailing whitespace in tre documenti già
modificati nel working tree:

- `docs/architecture/v0-repository-layout.md`;
- `docs/execution/codex-task-backlog.md`;
- `docs/execution/roadmap.md`.

## Deterministic Probes

### Fixture multipolygon

```text
building relations: 76
relations with multiple outer ways: 2
relations with open outer members: 2
relations with multiple inner ways: 43
```

Una relazione sintetica composta da due outer way aperte è stata normalizzata
come il triangolo della prima way, senza warning.

### Hole and collision impact

```text
buildings: 164
solid buildings with holes: 66
hole rings: 249
passable buildings: 3
compiled static polygon shapes: 161
```

Un polygon con un hole crea un solo collider. Una shape `segment` crea zero
collider.

### Compiler diagnostics

Una regione sintetica con un barrier e un tree ha prodotto:

```text
inputFeatureCount: 2
compiledFeatureCount: 0
skippedFeatureCount: 0
warnings: []
```

Il fixture Lecce ha prodotto:

```text
inputFeatureCount: 546
compiledFeatureCount: 535
skippedFeatureCount: 0
```

### Vehicle brake

Con velocità longitudinale iniziale `0.1 m/s`, throttle zero e brake uno, un
singolo step ha prodotto `-0.158333 m/s`.

### Polyline clipping

Una polyline che esce e rientra dal bounds è stata restituita come una sola
sequenza, con un segmento artificiale tra exit e re-entry.

## Browser Verification

Ambiente: Chrome DevTools MCP, contesto isolato, Vite dev server locale,
viewport/canvas `1280 x 720`, URL `/?benchmark=1`.

Osservato:

- bootstrap, fixture e canvas presenti;
- 36 richieste locali, tutte `200`;
- nessun errore JavaScript uncaught;
- warning WebGL relativi al fallback software headless;
- overlay `F3` funzionante;
- toggle label `L` funzionante;
- screenshot ispezionato e non conservato;
- risultato benchmark esposto nel DOM.

Il risultato mostrava `708 frames` e `708 physicsSteps` con p95 frame intorno a
`133 ms` e debito scartato. Questo prova l'errore semantico del contatore, non
costituisce un benchmark valido: interazioni DevTools, screenshot e renderer
software hanno alterato il campione.

## Outcome

Il V0 resta avviabile, ma il gate Phase 2 è chiuso. Il prossimo lavoro ammesso
è la remediation della baseline elencata in `tasks/plan.md` e `tasks/todo.md`,
seguita da nuova review.
