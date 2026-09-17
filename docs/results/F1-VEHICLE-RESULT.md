# Risultato: Veicolo F1 (velocità, sprite e stabilità di guida)

Data: 2026-09-17. Stato: consegnato.
Baseline di partenza: `f828a14` (sopra la tranche touch). Commit della tranche:
`33bf6bf` (velocità + sprite F1), `568dcc0` (fix zig-zag). Piano:
`tasks/plan.md`. Checklist: `tasks/todo.md`.

## Esito

Due richieste insieme: (1) l'auto è più veloce e (2) in vista dall'alto ha la
forma di una Formula 1. La velocità è ora ~150 km/h (42 m/s) e lo sprite è un
modello top-down F1 (naso, side pod, quattro ruote, ali anteriore/posteriore).
Raddoppiando la velocità è emerso un difetto di guida (l'auto curvava/zig-zagava
senza sterzo), riparato nello stesso lotto: il controller arcade è tornato
autorevole per velocità e rotazione, il solver Rapier sposta solo la posizione.

## Dettaglio

### Velocità (F1-01)
- `VEHICLE_TUNING` (oggetto nominato in `controller.ts`): top speed 22 → 42
  m/s, accelerazione 9 → 13, frenata 14 → 20; gli altri valori invariati. Il
  controller legge tutto dall'oggetto e `stepVehicle(..., tuning)` lo accetta in
  input, quindi i valori potranno essere esposti dall'UI senza toccare la
  matematica.
- Spec `docs/specs/vehicle-controller-v0.md` aggiornata.

### Sprite F1 (F1-02)
- `drawF1Vehicle` in `renderer.ts` sostituisce il vecchio rettangolo arrotondato
  + naso: body rosso, naso conico, quattro ruote agli angoli (posteriori più
  larghe), ali ant./post., cockpit + casco. +x locale = avanti (invariato).
- `renderer-labels.test.ts`: il mock `FakeGraphics` ora espone `circle` (API Pixi
  reale già usata dal nuovo disegno).

### Stabilità di guida (F1-03, fix)
- Causa: `adapter.ts` rilesse da Rapier la velocità e la rotazione del corpo e
  le reiniettava nello stato del controller al passo successivo. Un urto non
  centrato ad alta velocità iniettava velocità laterale e rotazione → curva /
  zig-zag con solo acceleratore.
- Fix: il controller è autorevole per velocità e rotazione; Rapier corregge solo
  la posizione (anti-penetrazione). Attrito a 0, `angvel` resettato a ogni passo.
- Riproduzione: muro a 45°, solo acceleratore: pre-fix 31° di heading + 4,3 m/s
  laterali; post-fix 0° / 0.

## Matrice requisiti → prove

| Requisito | Prova |
| --- | --- |
| Top speed ~150 km/h (42 m/s) | `controller.test.ts` (raggiunge 42, non lo supera) |
| Tuning esposto per futura UI | `VEHICLE_TUNING` esportato; `stepVehicle(..., tuning)` overridable |
| Sprite top-down F1 | `renderer.test.ts` (geometria: cockpit, ali, 4 ruote; dentro footprint) |
| Nessun drift/zig-zag senza sterzo | `adapter.test.ts` "throttle-only che graffia un muro angolato non devia" |
| Niente tunneling a 42 m/s | `adapter.test.ts` "keeps a dynamic vehicle outside a static wall" (verde) |

## Limiti dichiarati

- Contro un muro l'auto **scivola lungo la faccia** (la posizione viene spinta)
  invece di rimbalzare, e lo sprite resta orientato nella direzione mirata:
  comportamento atteso del modello "arcade autorevole + solver solo posizione".
- La velocità mostrata è quella di throttle (il modello arcade), non quella
  effettiva quando l'auto viene spinta lungo un muro.
- Gli screenshot di riferimento citati a voce non sono stati allegati: livrea F1
  rossa classica. Da ricalibrare (colori/livrea) se servono riferimenti esatti.

## Verifiche finali

- `npm run typecheck`: PASS.
- `npx vitest run`: PASS — 56 file, 419 test.
- `npm run build`: PASS (warning dimensione bundle preesistente).
- `npm run test:e2e`: 25 PASS, 1 skipped (canary).
- Guida dritta in scena reale (offline): 0° di drift di heading, dritta su strada
  libera, reindirizza solo al contatto con un edificio.
