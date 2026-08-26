# OpenGTA Web — Fase 0 completata

Data: 2026-08-19

## Gate

> Un agente può spiegare l'architettura senza inferire regole centrali mancanti.

La Fase 0 è **documentazione e contratti**, non codice di gioco. Lo slice
eseguibile V0 è evidenza successiva e non sostituisce questi contratti.

## Deliverable e sede

| Deliverable | Documento autorevole |
|---|---|
| Intento di prodotto | `docs/intent/open-gta-web.md` |
| Principi architetturali | `docs/architecture/product-architecture-principles.md` |
| Pipeline dual-mode | `docs/architecture/dual-world-pipeline.md` |
| Modello di rendering 2D | `docs/architecture/2d-rendering-model.md` |
| Canonical World Model | `docs/architecture/world-model.md` |
| Sistema di coordinate | `docs/architecture/coordinate-system.md` |
| World compiler | `docs/architecture/world-compiler.md` |
| Chunk / streaming / cache | `docs/architecture/chunk-streaming-cache.md` |
| Confine AI | `docs/architecture/client-ai-visual-pipeline.md` |
| ADR iniziali | `docs/adr/` |
| Regole Codex / agenti | `AGENTS.md`, `.opencode/agents/AGENTS.md`, `docs/codex/` |
| Indice architettura | `docs/architecture/README.md` |
| Stato deciso vs aperto | `docs/DECISIONS.md` |
| Punto di ingresso corrente | `docs/handoff/CURRENT.md` |

Contratti V0 più stretti (normalizzazione OSM, chunk compilato, veicolo, overlay)
sono in `docs/specs/`. Non sono decisioni di prodotto nuove: specializzano la
Fase 0 per il prototipo bounded.

## Cosa un agente non deve inferire

- La presenza di un file di roadmap, ADR o layout proposto **non** implica che
  il codice esista, né che una fase successiva sia aperta.
- I documenti di handoff pre-code (`PRE-CODE-COMPLETE.md`,
  `CODEX-START-HERE.md`, `CODEX-EXECUTION-QUEUE.md`) sono **storici**. Lo stato
  corrente è in `docs/handoff/CURRENT.md`.
- I numeri della bozza city-scale (dimensione chunk, griglia, Hz di rete) restano
  ipotesi finché un ADR o una misura non li accetta.
- Renderer, fisica e toolchain V0 sono **Accepted for prototype**, non stack di
  produzione definitivo.

## Stato del repository al closing della Fase 0

Il repository contiene anche lo slice V0 (fixture Lecce, PixiJS, Rapier, guida).
Quella evidenza è in `docs/results/V0-RESULT.md` e appartiene alla Fase 1 della
roadmap, non a questa chiusura.

La Fase 0B (esperimenti pre-codice su proiezione, renderer e fisica) non è
riaperta: le prove richieste sono già nel V0 e negli ADR-001/002/003.

## Verifica del gate

- Esiste un indice esplicito dei documenti architetturali.
- `docs/DECISIONS.md` separa accettato, prototipo e aperto.
- `AGENTS.md` e `README.md` riportano comandi e stato reali.
- I vincoli 2D-first, dual-mode, un solo core e AI come arricchimento visivo
  opzionale sono scritti nell'intento e nei principi, non solo nella bozza.
