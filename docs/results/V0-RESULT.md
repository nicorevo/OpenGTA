# OpenGTA Web V0 — Rapporto di esecuzione

Data: 2026-08-19
Commit di riferimento: `312a835` (prima del commit del presente report)
Fixture: Lecce centro, Piazza Sant'Oronzo, fixture OSM locale committato

## Risultato

Il percorso verticale è eseguibile in locale: fixture OSM → proiezione locale
WGS84 → modello canonico → compilazione → scena PixiJS con effetto fake-2.5D,
Rapier 2D inizializzato e veicolo arcade controllato da tastiera.

La collisione dinamica Rapier e la ricostruzione dei multipolygon edilizi sono
state completate e coperte da test. Il benchmark steady-state di 30 secondi
resta non automatizzato perché il server MCP DevTools non mantiene un target
aperto; la scena è stata comunque verificata in Chrome headless.

## Implementato

- scaffold TypeScript strict, Vite e Vitest;
- proiettore WGS84 tangent-linear con round-trip e vettori Lecce;
- contratti canonici 2D e validazione di base;
- normalizzazione di nodi/way OSM con limiti, parsing misure e diagnostica;
- fixture Overpass locale da 824 KiB con provenienza, hash query e nota ODbL;
- compiler di terreno, strade, edifici, fake-depth e collisioni neutrali;
- PixiJS v8/WebGL adapter e scena top-down deterministica;
- Rapier 2D adapter per colliders statici e veicolo dinamico;
- controller veicolo arcade a passo fisso e input WASD/frecce;
- overlay F3 con dati regione, compilazione, colliders, warning e metriche;
- metriche runtime per frame time, p95/p99, long frames e costo fisica;
- favicon statico e smoke browser senza richieste 404;
- test unitari e integrazione sul fixture reale senza rete.

## Verifiche eseguite

```text
npm install                         PASS
npm run typecheck                   PASS
npm run test:run                    PASS (8 file, 10 test)
npm run build                       PASS (1.33 s, warning chunk > 500 KiB)
npm audit --audit-level=high        PASS (0 vulnerabilità)
curl http://127.0.0.1:5173/        PASS
Chrome headless + screenshot        PASS (1280×720, scena visibile)
Chrome DevTools MCP                 NON DISPONIBILE: target chiuso dal server
Chrome DevTools MCP headless         PASS (canvas, F3, network e trace)
```

Il build principale risultante è circa 2.34 MB minificato (763.8 KiB gzip),
prima di una successiva ottimizzazione/codesplitting.

## Ambiente benchmark rilevato

```text
OS: Fedora/Linux kernel 7.1.8-200.fc44.x86_64
CPU: Intel Core Ultra 7 258V
core logici: 8
RAM: 30.9 GiB
GPU: Intel Arc Graphics 130V/140V
Node: v26.4.0
Browser: Google Chrome installato; versione non rilevata
devicePixelRatio/canvas: non rilevati in MCP
```

La sessione MCP headless ha prodotto 812 frame osservati: 31,74 FPS, frame
medio 31,51 ms, p95 33,40 ms, p99 50 ms, massimo 100 ms, 426 long frame e
fisica media 0,196 ms. La trace DevTools è durata circa 5 secondi. Il profilo
headless/software non raggiunge quindi la cadenza target di 60 Hz; il costo
fisico resta basso e il collo di bottiglia osservato è il rendering/software
WebGL. Non è ancora un campione steady-state di 30 secondi.

## Deviazioni e problemi noti

- Le relazioni multipolygon non edilizie restano fuori dal profilo V0; quelle
  edilizie con anelli outer/inner sono ricostruite.
- La normalizzazione usa un limite di 100.000 elementi e bounds V0 fissi; sono
  intenzionali per il prototipo bounded, non per Open World.
- PixiJS e il fixture importato producono un bundle iniziale grande; il
  codesplitting è rinviato a una misura browser reale.
- Nessuno screenshot è stato conservato nel repository.

## Decisione di stop

Stop alla coda V0 in base all’evidenza disponibile. Non sono state introdotte
streaming, cache persistente, AI runtime, multiplayer, traffico, pedoni o
mobile.
