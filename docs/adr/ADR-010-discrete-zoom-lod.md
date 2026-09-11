# ADR-010: Zoom a livelli discreti con LOD 2D

Data: 2026-09-11.
Stato: accettato.
Contesto: milestone "OpenGTA City Drive Stable" (spec
`docs/specs/city-drive-stable.md`).

## Decisione

La camera top-down espone uno zoom a **livelli discreti** (5 step, default
al centro) tramite pulsanti `+`/`-` e scorciatoie tastiera. Ogni livello
mappa a un tier LOD 2D (`near`/`medium`/`far`) che riduce solo la
presentazione (facade, road detail, labels, culling visuale), mai il mondo
canonico, la fisica o la verità geografica.

- `viewScale = baseScale * ZOOM_STEPS[level]`, con `baseScale` invariata
  (`max(1, min(w,h)) / 360`); `cameraBounds()` continua a derivare dalla
  scala, quindi la domanda di streaming reagisce allo zoom senza API nuove
  di rete.
- Lo zoom NON altera: posizione, velocità, heading, collisioni, fixed-step
  fisico. Cambia solo trasformazione schermo e costo di presentazione.
- Il wheel/pinch continuo e' differito: i livelli discreti danno test
  deterministici e un LOD agganciabile per esperimento.

## Motivazione

La documentazione architetturale prevede gia' piu' livelli di zoom e un LOD
2D (`docs/architecture/2d-rendering-model.md` §26-27). La scala fissa attuale
e' gia' una camera implicita: il costo marginale e' un fattore moltiplicativo
e una UI minima. Livelli discreti = churn di streaming limitato, accettazione
verificabile, estetica coerente con i GTA classici. LOD legato allo zoom
corregge l'intuizione "zoom out = meno caricamento": zoom out mostra piu'
territorio e costa di piu' senza LOD; con LOD il costo per metro quadro cala
e il caricamento resta progressivo e tollerabile.

## Conseguenze

- Nuovo modulo puro camera/zoom testabile senza Pixi (ZOOM-01).
- Il renderer diventa incrementale per chunk (SOLID-04) prima di applicare
  LOD per chunk: altrimenti ogni cambio di tier riattiverebbe i rebuild.
- La firma di stream della sessione include il livello di zoom (via
  cameraBounds): debounce gia' esistente a 200 ms come anti-tempesta.
- La guardia di disponibilita' fisica resta basata sui chunk APPLICATI, non
  sui chunk visibili a zoom lontano (ZOOM-04).
- Benchmark per livello prima di fissare i fattori finali di `ZOOM_STEPS`.
