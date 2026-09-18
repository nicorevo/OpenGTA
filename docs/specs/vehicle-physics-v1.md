# Vehicle physics — peso, derapata e reazione (v1)

Data: 2026-09-18. Persona: fullstack-developer.
Input: richiesta utente (2026-09-18): "un po' di fisica nel movimento dell'auto —
qualcosa che dia l'idea del movimento e non galleggiamento, qualche reazione legata
alla fisica, movimenti un po' più realistici. Aumenta anche la velocità del 40%."

## Problema (stato attuale, `controller.ts`)
Il controller arcade è autorevole per velocità+heading; Rapier spinge solo la posizione
fuori dai collider. La guida "galleggia" perché:
- accelerazione **lineare** costante (nessuna curva motore);
- coasting molto blando (`rollingDeceleration=1.5` → scivola a lungo a gas aperto);
- grip laterale **costante** (niente derapata a velocità → sembra su binari);
- il ruota all'istante senza reazione visiva al cambio di direzione.

## Modello (design) — niente cambio di schema, niente nuova fisica di contatto
Resto nel controller arcade puro. Modifico solo parametri + 2 comportamenti:

1. **Curva motore**: l'accelerazione cala avvicinandosi a `maxForwardSpeed`
   (`a = forwardAcceleration * (1 - engineTaper * clamp(v/vMax,0,1))`). Sensazione di
   motore che "si riempie", non rampa lineare.
2. **Grip/derapata per velocità**: grip laterale alto a bassa velocità (aderenza,
   niente galleggiamento) e che **cala a velocità** (derapata percepibile, peso)
   (`grip = gripBase + (gripAtSpeed - gripBase) * clamp(|v|/vMax,0,1)`).
   In top-down la derapata (scocca a un angolo rispetto alla traiettoria) È la "idea
   del movimento".
3. **Coasting più pesante**: `rollingDeceleration` su → meno scivolamento.
4. **Reazione visiva** (`renderer.ts`): leggero *skew* della scocca in base alla
   velocità laterale (la macchina "flessa" in curva) + micro-stretch longitudinale
   con la velocità. Contratto `updateVehicle` esteso con `velocity` opzionale.

Non tocco: modello di sterzo (il fattore di velocità è già corretto e stabile),
collider Rapier, spawn, fixed-step, reverse top-speed scaling.

## Tuning (+40% velocità massima)
`VEHICLE_TUNING`:
- `maxForwardSpeed`: 42 → **84** m/s (~302 km/h, super-fast). `maxReverseSpeed`: 7 → 14.
- `forwardAcceleration`: 13 → 20 (con curva motore). `brakeDeceleration`: 20 → 48
  (frenata forte: ~69 m da 302 km/h). `reverseAcceleration`: 5 → 16 (recupero rapido).
- `rollingDeceleration`: 1.5 → 2.6.
- nuovi: `engineTaper` 0.7, `lateralGripBase` 16, `lateralGripAtSpeed` 6 (sostituiscono
  `lateralGrip`).

I valori sono "feel" — tutti in `VEHICLE_TUNING` per ritocchi rapidi (più/meno
derapata = `lateralGripAtSpeed`; più peso = `rollingDeceleration` + `engineTaper`).

## Verifica (TDD)
- `controller.test.ts`: vmax = 84 (raggiunta e mai superata); curva motore (accel
  minore vicino a vmax rispetto a 0); derapata per velocità (a parità di sterzata
  brusca, a alta velocità resta più velocità laterale che a bassa); coasting più
  pesante (a gas aperto rallenta di più che prima).
- `adapter.test.ts` invariato (la collisione non cambia; la frenata laterale resta 0
  con throttle-only).
- `renderer.test.ts`: skew diverso tra dritto e curva (da velocità laterale).
- Screenshot: curva a velocità (derapata + flessione visibili).
- Gate completa: typecheck, test, build, e2e (modulo flaky da carico Chrome).

## Follow-up (non inclusi)
- Smoothing dell'input sterzo (rate-limit), camera con lag/accelerazione, scie
  di derapata, rumore motore (audio), cambio marce.
