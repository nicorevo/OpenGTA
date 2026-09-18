# Result: Look Veicolo "General Lee" (berlina rossa, ombra a terra, decal nitide)

Data: 2026-09-18. Baseline codice: `28fe0ee`. Piano: `tasks/plan.md`
(sezione "Look Veicolo General Lee", GL-01..04).

## Obiettivo

Rifare lo sprite dell'auto (prima F1 rossa da corsa) perché richiami il
"General Lee", la Dodge Charger 1969 di *The Dukes of Hazzard* (la macchina dei
due cugini Duke), e ridurre l'effetto galleggiamento con un'ombra a terra che
appoggi la scocca sulla strada. Tutto confinato in `src/render/pixi/renderer.ts`;
la fisica (`controller.ts`), i collider (`shape.ts`) e lo spawn non cambiano.

## Cosa è stato fatto

- **`drawF1Vehicle` → `drawGeneralLee`**: la scocca non è più una F1 (ali, side
  pod, casco) ma una berlina rossa (Dodge Charger): scocca rossa tonda
  (`0x8a1420`), 4 ruote agli angoli, parabrezza largo davanti + finestrino
  posteriore, fari bianchi davanti e stop rossi dietro. Il tetto resta rosso (tra
  i due cristalli) ed è dove sta la scritta.
- **Ombra a terra (anti-galleggiamento)**: `vehicle` è ora un `Container` con due
  figli — un'ombra morbida (roundRect, alpha 0.16) sotto e il gruppo scocca.
  L'ombra scivola leggermente **contro** la piega in curva
  (`updateVehicle`), così l'auto pare appoggiata e inclinata, non flottante.
  `VEHICLE_VISUAL_SCALE` portato da 2.6 a 3.0 (scocca più leggibile; solo
  visiva, il collider non cambia).
- **Decal nitide "GENERAL LEE" + "01"**: scritta bianca sul tetto e "01" sulle
  due porte, come `Text` (figli del gruppo scocca, così flexano con la piega).
  Introdotto **`makeWorldText`**: il `Text` è rasterizzato a un corpo fisso di
  128px e poi ridotto alla dimensione di mondo richiesta. Un `Text` classico è
  generato a 1× e, con la trasformazione del mondo che ingrandisce l'auto ~26×,
  le lettere si trasformavano in una banda sfocata; rasterizzando grosso e
  scalando in basso la scritta resta nitida a ogni zoom.

## File toccati

- `src/render/pixi/renderer.ts`: `drawGeneralLee` (ex `drawF1Vehicle`),
  `makeWorldText`, Container ombra + gruppo scocca, decal, `VEHICLE_VISUAL_SCALE`
  3.0, `updateVehicle` (skew sul gruppo + ombra che scivola).
- `src/render/pixi/renderer.test.ts`: `drawF1Vehicle` → `drawGeneralLee` (desc +
  geometria: centro scocca, 4 ruote, footprint dentro la sagoma).
- `src/render/pixi/renderer-labels.test.ts`: i test del ciclo di vita delle
  label usano una **baseline** = numero di `Text` create all'iniz (le decal
  dell'auto), così asseriscono sui delta delle label e non contano le decal.

## Verifica

- `npm run typecheck` verde.
- `npm run test:run`: **438/438** test unitari (56 file) verdi.
- `npm run build` verde.
- `npm run test:e2e` (sottoinsieme non-flaky: measurements, zoom,
  incremental-renderer, renderer-streaming): **8/8** verdi.
- Screenshot a zoom ravvicinato (Playwright, clip sull'auto): berlina rossa
  riconoscibile, "GENERAL LEE" sul tetto + "01" sulle porte nitide, ombra a
  terra sulla carreggiata.

## Limiti / note

- Le decal sono `Text` vettoriali-rasterizzate: nitide, ma a zoom molto chiuso
  occupano gran parte del tetto (come sul vero General Lee, la scritta è
  prominente). Il colore rosso e i dettagli sono in `drawGeneralLee` (ritocco
  rapido).
- L'ombra è un'ellisse morbida, non un'ombra proiettata dal sole: sufficiente
  per l'effetto "appoggiato", più economico di un'ombra reale.
