# Intento di OpenGTA Web

## Stato

Baseline di prodotto confermata il 2026-08-19. Questo documento serve a
ricostruire il contesto nelle sessioni future; non è una specifica tecnica e
non costituisce accettazione delle tecnologie proposte nella bozza originale.

Documento di origine:
[`../idea/OpenGTA Web City Scale Idea.md`](../idea/OpenGTA%20Web%20City%20Scale%20Idea.md).

## Obiettivo

OpenGTA Web è un motore e una sandbox geospaziale browser-first che trasformano
una zona urbana reale, descritta da dati OpenStreetMap, in un ambiente 3D
top-down riconoscibile, esplorabile e guidabile.

Il valore distintivo è permettere al giocatore di guidare in una
rappresentazione stilizzata di una città reale senza costruire manualmente la
mappa. Il primo risultato non deve essere un gioco completo in stile GTA:
missioni, combattimento, progressione, economia e altri sistemi di gameplay non
sono ancora definiti.

## Problema da risolvere

Come possiamo trasformare una zona urbana reale in un mondo di gioco top-down
immediatamente esplorabile, mantenendo caricamento e simulazione compatibili
con un browser desktop?

## Vincoli di esecuzione

- Il progetto deve essere affrontabile da una persona o da un team molto
  piccolo.
- Lo sviluppo procede per incrementi verificabili.
- Il primo target è un browser desktop su un PC di fascia media.
- Le prestazioni dovranno essere espresse con metriche e hardware di riferimento
  prima dell'implementazione; "fluido" non e ancora un requisito misurabile.

## Prima validazione tecnica

Il primo prototipo deve dimostrare un solo percorso verticale:

1. caricare una zona urbana prefissata da dati OpenStreetMap;
2. convertirla in una scena top-down riconoscibile;
3. consentire la guida di un veicolo;
4. gestire collisioni stabili con l'ambiente;
5. mantenere prestazioni fluide su un PC medio, secondo metriche ancora da
   definire.

Questa validazione viene prima dell'estensione geografica e delle funzionalità
di gioco avanzate.

## Fuori dal primo prototipo

Le seguenti capacità sono evoluzioni previste, ma non appartengono alla prima
validazione:

- selezione arbitraria di città o coordinate;
- streaming alla scala di un'intera città;
- cache persistente dei settori;
- grafica regionale tramite texture generate offline con AI;
- supporto mobile e controlli touch;
- multiplayer, prediction e reconciliation;
- pedoni, traffico e sistemi di gameplay completi.

Questi elementi restano nell'analisi tecnica: essere fuori dal prototipo non
significa ignorarne l'impatto evolutivo sull'architettura.

## Comprensione del sistema futuro

Il prodotto completo è composto da due livelli:

1. un motore geospaziale che acquisisce dati urbani, genera geometrie, gestisce
   coordinate, caricamento spaziale, rendering, fisica e cache;
2. una sandbox o un gioco che usa quel motore per veicoli, pedoni, traffico,
   multiplayer e futuri sistemi di gameplay.

Il flusso desiderato a regime è:

```text
Scelta della città o delle coordinate
    -> acquisizione dei dati urbani
    -> conversione in ambiente giocabile
    -> caricamento dell'area vicina al giocatore
    -> guida ed esplorazione top-down
    -> funzionalità di gioco e multiplayer
```

La promessa di compatibilità globale deve essere intesa come obiettivo da
verificare: qualità e completezza della scena dipenderanno dai dati disponibili
per ciascuna area.

## Decisioni tecniche non ancora accettate

La bozza propone soluzioni plausibili, ma tutte le seguenti scelte devono essere
analizzate prima di diventare decisioni o ADR:

- adozione di Three.js e scelta del backend grafico effettivo;
- Rapier e il modello fisico del veicolo;
- Nominatim, Overpass e la strategia di acquisizione dei dati;
- schema delle coordinate e strategia di precisione numerica;
- dimensione dei chunk e finestra di caricamento;
- triangolazione, estrusione e trattamento delle geometrie OSM;
- confini tra main thread, geometry worker e physics worker;
- formato, invalidazione e limiti della cache IndexedDB;
- pipeline e licenze degli asset generati con AI;
- modello di autorità, trasporto e frequenza del multiplayer;
- strategia specifica per prestazioni e memoria su mobile.

I valori presenti nella bozza, inclusi chunk da 150 metri, griglia 3x3 e
sincronizzazione a 30 Hz, sono ipotesi da misurare e non requisiti confermati.

## Criterio per la revisione tecnica

Ogni decisione della bozza deve ricevere uno dei seguenti giudizi:

- valida;
- valida con condizioni o misurazioni;
- da rinviare;
- da sostituire.

Per ciascuna scelta vanno esplicitati motivazione, rischi, alternative,
dipendenze e prova minima necessaria per validarla.

## Stato della bozza originale

La roadmap della bozza non prova lo stato dell'implementazione. In particolare,
la "Fase 1" marcata come completata non e verificabile nel repository corrente,
che al momento contiene documentazione e infrastruttura di processo, ma non il
codice applicativo descritto.

## Regola di aggiornamento

Aggiornare questa baseline soltanto quando cambia l'intento di prodotto. Le
decisioni architetturali confermate dovranno essere registrate separatamente in
ADR, con alternative e conseguenze, senza trasformare retroattivamente le
ipotesi di questa nota in decisioni già accettate.
