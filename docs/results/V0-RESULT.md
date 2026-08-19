# OpenGTA Web V0 — Rapporto di esecuzione

Data: 2026-08-19
Commit di riferimento: `6b2e51addc17e1a86cde3a32694bfb9a98680219`
Fixture: Lecce centro, Piazza Sant'Oronzo, fixture OSM locale committato

## Risultato

Il percorso verticale è eseguibile in locale: fixture OSM → proiezione locale
WGS84 → modello canonico → compilazione → scena PixiJS con effetto fake-2.5D,
Rapier 2D inizializzato e veicolo arcade controllato da tastiera.

La Definition of Done V0 non è ancora dichiarata soddisfatta: il veicolo usa
attualmente il controller cinematico e la sua posizione non è ancora collegata
a un corpo dinamico Rapier per la risoluzione delle collisioni; inoltre le
relazioni multipolygon non sono ancora ricostruite dal normalizzatore.

## Implementato

- scaffold TypeScript strict, Vite e Vitest;
- proiettore WGS84 tangent-linear con round-trip e vettori Lecce;
- contratti canonici 2D e validazione di base;
- normalizzazione di nodi/way OSM con limiti, parsing misure e diagnostica;
- fixture Overpass locale da 824 KiB con provenienza, hash query e nota ODbL;
- compiler di terreno, strade, edifici, fake-depth e collisioni neutrali;
- PixiJS v8/WebGL adapter e scena top-down deterministica;
- Rapier 2D adapter per colliders statici;
- controller veicolo arcade a passo fisso e input WASD/frecce;
- overlay F3 con dati regione, compilazione, colliders e warning;
- test unitari e integrazione sul fixture reale senza rete.

## Verifiche eseguite

```text
npm install                         PASS
npm run typecheck                   PASS
npm run test:run                    PASS (6 file, 7 test)
npm run build                       PASS (1.33 s, warning chunk > 500 KiB)
npm audit --audit-level=high        PASS (0 vulnerabilità)
curl http://127.0.0.1:5173/        PASS
Chrome headless --dump-dom         PASS (canvas e overlay presenti)
Chrome DevTools MCP                 NON DISPONIBILE: target chiuso dal server
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

Non è stato prodotto un campione steady-state di 30 secondi né un p95 frame
time: il browser DevTools MCP necessario al protocollo non era disponibile.
Non vengono quindi dichiarati benchmark FPS o collisioni browser.

## Deviazioni e problemi noti

- Il fixture contiene relazioni OSM, ma il primo normalizzatore le conserva
  solo nel raw input e segnala/ignora la ricostruzione multipolygon.
- Il controller veicolo aggiorna la grafica ma non è ancora un body Rapier
  dinamico; la collisione fisica completa è il prossimo incremento obbligatorio.
- La normalizzazione usa un limite di 100.000 elementi e bounds V0 fissi; sono
  intenzionali per il prototipo bounded, non per Open World.
- PixiJS e il fixture importato producono un bundle iniziale grande; il
  codesplitting è rinviato a una misura browser reale.
- Nessuno screenshot è stato conservato nel repository.

## Decisione di stop

Stop alla coda V0 in base all’evidenza disponibile. Non sono state introdotte
streaming, cache persistente, AI runtime, multiplayer, traffico, pedoni o
mobile.
