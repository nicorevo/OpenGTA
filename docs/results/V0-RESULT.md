# OpenGTA Web V0 — Rapporto di esecuzione

Data: 2026-08-19
Commit di riferimento: `6dc8dbe` (`feat: add clean driving presentation mode`)
Fixture: Lecce centro, Piazza Sant'Oronzo, fixture OSM locale committato

## Risultato

Il percorso verticale è eseguibile in locale: fixture OSM → proiezione locale
WGS84 → modello canonico → compilazione → scena PixiJS con effetto fake-2.5D,
Rapier 2D inizializzato e veicolo arcade controllato da tastiera.

La collisione dinamica Rapier e la ricostruzione dei multipolygon edilizi sono
state completate e coperte da test. Il benchmark steady-state di 30 secondi è
stato eseguito tramite Chrome DevTools MCP headless.

## Implementato

- scaffold TypeScript strict, Vite e Vitest;
- proiettore WGS84 tangent-linear con round-trip e vettori Lecce;
- contratti canonici 2D e validazione di base;
- normalizzazione di nodi/way OSM con limiti, parsing misure e diagnostica;
- fixture Overpass locale da 824 KiB con provenienza, hash query e nota ODbL;
- compiler di terreno, strade, edifici, fake-depth e collisioni neutrali;
- clipping di poligoni e centerline al box V0 `600 × 600 m`;
- PixiJS v8/WebGL adapter e scena top-down deterministica;
- Rapier 2D adapter per colliders statici e veicolo dinamico;
- controller veicolo arcade a passo fisso e input WASD/frecce;
- camera top-down vehicle-follow con zoom locale;
- sprite veicolo scalato sulle dimensioni metriche `4,2×1,8 m` e orientato
  lungo l'asse fisico di marcia;
- label compilate per vie e luoghi, con priorità e limite di densità nel
  renderer;
- overlay F3 con dati regione, compilazione, colliders, warning e metriche;
- metriche runtime per frame time, p95/p99, long frames e costo fisica;
- favicon statico e smoke browser senza richieste 404;
- test unitari e integrazione sul fixture reale senza rete;
- label di luoghi e vie prioritarie per orientamento/debug;
- modalità guida pulita con label nascoste di default e toggle `L`.

## Verifiche eseguite

```text
npm install                         PASS
npm run typecheck                   PASS
npm run test:run                    PASS (10 file, 15 test)
npm run build                       PASS (1.33 s, warning chunk > 500 KiB)
npm audit --audit-level=high        PASS (0 vulnerabilità)
curl http://127.0.0.1:5173/        PASS
Chrome headless + screenshot        PASS (1280×720, scena visibile)
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
Browser: Google Chrome 151.0.7922.137
devicePixelRatio: 1
canvas: 1280 × 720 px
renderer: PixiJS WebGL con Chrome headless e GPU disabilitata
```

Il campione MCP headless è durato circa 37,94 secondi, con 4.084 frame
osservati: 32,73 FPS, frame medio 30,76 ms, mediana 33,30 ms, p95 33,40 ms,
p99 50 ms, massimo 66,70 ms, 2.454 long frame e fisica media 0,171 ms.
Il profilo headless/software non raggiunge quindi la cadenza target di 60 Hz;
il costo fisico resta basso e il collo di bottiglia osservato è il
rendering/software WebGL.

## Verifica leggibilità geografica

Il primo rendering mostrava geometrie OSM oltre il box nominale e una scena
visivamente troppo estesa. Il clipping al bounding box è stato applicato nel
normalizzatore e verificato in Chrome MCP sulla stessa area: la mappa ora resta
contenuta nel quadrato V0, mentre la rete stradale rimane presente e leggibile.
La zona non è stata ridotta: il problema principale era il mancato clipping,
non l'assenza di dati stradali.

La prima vista panoramica rendeva il veicolo sproporzionato e quasi immobile.
La camera vehicle-follow mostra ora una finestra locale più utile alla guida;
la grafica del veicolo usa la stessa proporzione del collider fisico, con un
leggero fattore visivo per mantenerla riconoscibile.

Il fixture contiene 187 vie nominate e 36 luoghi/aree nominate. Il renderer
mostra le label di luoghi prioritari e un sottoinsieme delle vie, orientandole
lungo la geometria della strada per evitare di coprire l'intera scena.
La revisione del riferimento GTA PS1 conferma però che queste informazioni
appartengono alla modalità orientamento/debug, non alla schermata di guida
principale. La modalità guida parte ora senza label; `L` attiva e disattiva la
vista orientamento senza modificare il contratto dei dati compilati. Le strade
usano inoltre un bordo scuro deterministico per aumentare la separazione dagli
edifici.

## Deviazioni e problemi noti

- Le relazioni multipolygon non edilizie restano fuori dal profilo V0; quelle
  edilizie con anelli outer/inner sono ricostruite.
- La normalizzazione usa un limite di 100.000 elementi e bounds V0 fissi; sono
  intenzionali per il prototipo bounded, non per Open World.
- PixiJS e il fixture importato producono un bundle iniziale grande; il
  codesplitting è rinviato a una misura browser reale.
- Nessuno screenshot è stato conservato nel repository.

## Decisione di stop della coda V0

La coda V0 è completata in base all’evidenza disponibile. Non sono state
introdotte streaming, cache persistente, AI runtime, multiplayer, traffico,
pedoni o mobile. Le successive rifiniture di presentazione gameplay sono una
fase separata e non riaprono la coda tecnica V0.
