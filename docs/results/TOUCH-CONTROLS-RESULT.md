# Risultato: Controlli touch mobile (pulsanti, zoom e nomi vie)

Data: 2026-09-17. Stato: consegnato.
Baseline di partenza: `9e72120` (sopra la tranche online di default). Commit
finale della tranche: `4ba08f2`. Indurimento E2E separato: `f828a14`.
Piano: `tasks/plan.md`. Checklist: `tasks/todo.md`.

## Esito

Sui dispositivi touch compaiono pulsanti on-screen (accelerazione, retromarcia,
sterza sinistra/destra) che guidano il veicolo alla pari della tastiera: i
gesti sono iniettati come tasti sintetici nello stesso set di input, quindi la
guida è identica. La barra zoom in alto a destra è ingrandita su touch e
aggiunge il tasto `street` per mostrare i nomi delle vie (stesso effetto del
tasto `L`). Il pannello delle configurazioni si restringe sugli schermi touch
stretti per non sovrapporre la barra zoom.

## Matrice requisiti → prove

| Requisito | Prova |
| --- | --- |
| Pulsanti touch guidano il veicolo | `touch-controls.ts` (mapping `gas/reverse/left/right` → `w/s/a/d`); E2E `touch-controls` (gas avanza, sterza cambia heading, retromarcia con `v·forward < 0`) |
| Retromarcia = throttle inverso (non freno a mano) | `TOUCH_ACTION_KEY.reverse = "s"` (tasto `S`); unit `touch-controls.test.ts` |
| Zoom + tasto `street` su touch | `bootstrap.ts`: barra verticale ingrandita + `vieButton`; E2E (visibilità, altezza > 40 px) |
| `street` toggle nomi vie | `bootstrap.ts`: `labels.toggle` condiviso col tasto `L`; E2E (hint `Nomi attivi` on/off) |
| Pannello non sovrappone la barra zoom | `live-controls.ts`: `box-sizing:border-box` + larghezza via `isTouchDevice()`; E2E (no intersezione `#live-controls` vs `#zoom-bar`) |
| Desktop invariato | `isTouchDevice()` false → nessun pulsante, barra compatta, pannello largo |

## Limiti dichiarati

- `isTouchDevice()` è `true` se `ontouchstart`, `maxTouchPoints > 0` oppure
  `pointer: coarse`. Su un touchscreen con puntatore primario "fine" i
  controlli compaiono e il pannello si restringe: usano la stessa condizione,
  quindi restano coerenti.
- Nessun multi-touch simultaneo tra i quattro pulsanti (un'azione per dito,
  come la tastiera); il pinch continuo resta fuori scope.
- Gli E2E misurano dimensioni e assenze geometriche (non overlap), non la
  calligrafia o l'estetica dei controlli.

## Verifiche finali

- `npm run typecheck`: PASS.
- `npx vitest run`: PASS — 56 file, 415 test.
- `npm run build`: PASS (warning dimensione bundle preesistente).
- `npm run test:e2e`: 25 PASS, 1 skipped (canary).
- `test:e2e` touch sotto carico: budget temporali generosi (`test.setTimeout(90000)`,
  init poll 30 s) per ridurre i falsi negativi da load; assert invariati.
