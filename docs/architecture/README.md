# Architettura — indice

Ordine di autorità:

```text
docs/intent/open-gta-web.md
    → docs/SPEC.md
    → questo indice e i principi
    → ADR in docs/adr/
    → spec V0 in docs/specs/
    → risultati in docs/results/
    → piani e log in tasks/
    → codice
```

Un ADR non può contraddire l'intento senza aggiornare l'intento.

## Contratti di Fase 0

| Documento | Ruolo |
|---|---|
| `product-architecture-principles.md` | Vincoli non negoziabili (browser-first, dual-mode, 2D-first, un core) |
| `dual-world-pipeline.md` | Preprocessed World e Open World sullo stesso compiler/runtime |
| `world-model.md` | Canonical World Model indipendente da renderer e fisica |
| `coordinate-system.md` | Identità WGS84 e piano metrico locale |
| `world-compiler.md` | Da mondo canonico a dati runtime |
| `2d-rendering-model.md` | Top-down + fake-2.5D; niente 3D di default |
| `chunk-streaming-cache.md` | Architettura futura di chunk/cache; non implementata come Fase 2 |
| `client-ai-visual-pipeline.md` | AI solo a valle della verità geografica |
| `performance-capability-tiers.md` | Degrado visivo, non cambio di verità |
| `data-acquisition-strategy.md` | Sorgenti geografiche e confini di servizio |
| `technology-evaluation.md` | Valutazione; non accetta stack da sola |
| `v0-repository-layout.md` | Direzione delle dipendenze; il tree `src/` reale può differire |

## Layout del codice

La direzione delle dipendenze in `v0-repository-layout.md` resta in vigore.

Il tree proposto in quel file è storico. Lo stato osservato è sotto `src/`:

```text
src/geo        dati e proiezione, niente renderer/fisica
src/world      modello e compiler canonici
src/render     adapter PixiJS su dati compilati
src/physics    adapter Rapier su collisioni compilate
src/gameplay   veicolo arcade
src/app        bootstrap, overlay, metriche
src/fixtures   fixture geografici deterministici
```

## Cosa resta aperto

Vedi `docs/DECISIONS.md` sezione OPEN / DEFERRED. In particolare non sono
ancora decisioni: dimensione chunk, cache persistente, formato World Package,
WebGPU, AI runtime, multiplayer.
