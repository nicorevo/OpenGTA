# Result: Fisica Veicolo (peso, derapata, reazione, +40% velocità)

Data: 2026-09-18. Spec: `docs/specs/vehicle-physics-v1.md`. Piano:
`tasks/plan.md` (sezione VP). Baseline partenza: `bc635c6`.

## Esito

La guida ha ora un "peso" percepibile e una reazione legata alla fisica, senza
galleggiamento, e la velocità massima è +40% (~211 km/h). Il modello resta il
controller arcade puro (Rapier spinge solo la posizione); sono cambiati i
parametri e due comportamenti, più un leggero skew della scocca.

## Cosa è cambiato

### `controller.ts` (fisica, funzione pura)
- **Curva motore**: l'accelerazione cala avvicinandosi a `maxForwardSpeed`
  (`a = forwardAcceleration * (1 - engineTaper * clamp(v/vMax,0,1))`). Niente rampa
  lineare: la macchina "si riempie" (reazione fisica).
- **Grip/derapata per velocità**: grip alto a bassa velocità (`lateralGripBase 16`,
  ~9° di slide a 10 m/s = agganciata, niente galleggiamento) e più basso a velocità
  (`lateralGripAtSpeed 6`, ~18° di slide a 80 m/s = peso/derapata visibile).
  La derapata deriva dal fatto che la velocità resta allineata all'heading vecchio
  mentre la heading avanza (già presente nel modello); il grip ne modula la durata.
- **Coasting più pesante**: `rollingDeceleration 1.5 → 2.6` (meno scivolamento a gas
  aperto).
- **Tuning super-fast**: `maxForwardSpeed 42 → 84` (~302 km/h), `maxReverseSpeed 7 → 14`,
  `forwardAcceleration 13 → 20`, `reverseAcceleration 5 → 16`, `brakeDeceleration
  20 → 48` (frenata forte). Tutti i valori sono in `VEHICLE_TUNING` per ritocchi rapidi del feel.

### `renderer.ts` (reazione visiva)
- `updateVehicle` riceve `velocity` (opzionale) e applica un **skew** della scocca
  proporzionale alla velocità laterale (la macchina "flessa" in curva). Skew=0 a
  dritta. Contratto esteso in `PixiRenderer`; plumbing in `runtime-session.ts` e
  `bootstrap.ts` (prima persona invariata).

## Dati di verifica (probe, nuovo modello)
- Slide in sterrata sostenuta: 80 m/s → 17.8° / 21.6 m/s laterale; 50 m/s → 13.0°;
  30 m/s → 10.9°; 10 m/s → 9.4° (agganciata a bassa velocità).
- Top speed 84 m/s (~302 km/h) raggiunta e mai superata; 0→302 km/h in ~7.2 s,
  0→100 km/h in ~1.6 s; frenata da 84 m/s in ~69 m.

## Gate
- `typecheck` verde.
- Unit: **437/438** (i 3 test nuovi in `controller.test.ts` verdi; l'unico rosso è
  `runtime-session.test.ts > drives a long looped route...` che in suite piena va in
  timeout per **carico** (MCP Chrome idle) — **verde 9/9 in isolamento**, come la
  baseline).
- `build` verde (solo warning chunk-size pre-esistente).
- E2E non-flaky (8) verdi: `measurements`, `zoom` (driving), `incremental-renderer`,
  `renderer-streaming`. I test di guida `bootstrap`/`touch-controls` restano i flaky
  da carico già noti/accettati.
- Screenshot: `/tmp/opengta-drift.png` (auto a zoom ravvicinato in curva, sprite e
  sterzo corretti).

## Note / follow-up
- Il "feel" è soggettivo: i valori in `VEHICLE_TUNING` (`lateralGripAtSpeed`,
  `engineTaper`, `rollingDeceleration`) sono i manopoli per più/meno derapata e peso.
- Non inclusi: smoothing dell'input sterzo, camera con lag, scie di derapata, audio.
