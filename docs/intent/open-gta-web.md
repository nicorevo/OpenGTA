# Intento di OpenGTA Web

## Stato

Baseline di prodotto aggiornata il 2026-08-19.

Questo documento è la fonte corrente per l'intento di prodotto. Non è una
specifica tecnica e non costituisce accettazione automatica delle tecnologie
proposte nella bozza originaria o nei documenti di valutazione.

La baseline precedente è conservata in:

`docs/archive/open-gta-web.baseline-before-dual-mode-2d.md`

La bozza tecnica originaria resta disponibile in:

`docs/idea/OpenGTA Web City Scale Idea.md`

## Obiettivo

OpenGTA Web è un motore e una sandbox geospaziale **browser-first** che
trasformano zone urbane reali, descritte principalmente da dati OpenStreetMap,
in un ambiente di gioco **2D top-down riconoscibile, esplorabile e guidabile**.

Il riferimento percettivo è la leggibilità dei primi GTA top-down.

Il mondo deve apparire ricco e riconoscibile dall'alto senza richiedere una
simulazione tridimensionale completa.

La profondità visiva può essere suggerita mediante effetti **fake-2.5D**
economici, purché non obblighino il motore, la fisica o il modello geografico a
diventare realmente 3D.

Il valore distintivo è permettere al giocatore di guidare in una
rappresentazione stilizzata di una città reale senza costruirne manualmente la
mappa.

Il primo risultato non deve essere un gioco completo in stile GTA. Missioni,
combattimento, progressione, economia e altri sistemi di gameplay non sono
ancora definiti.

## Due modalità finali del prodotto

Il prodotto finale deve supportare due modalità che condividono lo stesso core.

### 1. Preprocessed World Mode

L'utente sceglie una zona già elaborata e ottimizzata.

Il processo offline può preparare, dove utile:

- geometrie;
- collisioni;
- indici spaziali;
- texture;
- texture atlas;
- asset visivi;
- livelli di dettaglio;
- static baking;
- metadati;
- eventuale arricchimento AI.

Il client deve principalmente scaricare, decodificare e visualizzare i
pacchetti necessari.

Questa modalità esiste anche per supportare browser e dispositivi meno
performanti.

### 2. Open World Runtime Mode

L'utente può scegliere coordinate geografiche arbitrarie.

Il browser deve poter:

1. acquisire i dati geografici necessari;
2. normalizzarli;
3. convertirli nel modello canonico del mondo;
4. compilare progressivamente l'area necessaria;
5. renderizzarla;
6. preparare collisioni e dati runtime.

L'eventuale elaborazione AI per l'aspetto visivo deve essere preferibilmente
eseguita lato client quando ciò è sostenibile, in modo da evitare costi server
permanenti elevati.

La modalità Open World deve comunque essere utilizzabile **senza AI**.

## Un solo motore

Le due modalità non devono diventare due engine separati.

Il principio architetturale è:

```text
sorgente geografica
    -> normalizzazione
    -> Canonical World Model
    -> World Compiler
    -> CompiledChunk / World Package
    -> runtime condiviso
```

Una volta ottenuto il mondo compilato, rendering, fisica e gameplay non devono
dipendere dal fatto che il contenuto sia stato:

- pre-elaborato offline;
- compilato nel browser;
- recuperato da cache locale.

## Principio 2D-first

Il modello canonico del mondo è 2D-first.

```text
WORLD MODEL  = 2D-first
GAMEPLAY     = 2D-first
PHYSICS      = prevalentemente 2D
COLLISIONS   = prevalentemente planari
RENDERING    = 2D + fake-2.5D opzionale
HEIGHT / Z   = principalmente metadato visivo
```

Gli edifici sono innanzitutto footprint/poligoni 2D.

L'altezza può essere suggerita tramite:

- tetto traslato;
- falsa facciata;
- ombra semplice o pre-baked;
- sprite stratificati;
- piccoli offset;
- parallasse leggero;
- altre tecniche economiche misurate.

Una vera mesh 3D non è il default.

## AI e verità del mondo

L'AI non definisce la struttura geografica autorevole.

Devono essere deterministici, quando i dati lo consentono:

- coordinate;
- footprint degli edifici;
- topologia stradale;
- aree d'acqua e terreno;
- collisioni;
- identificatori e struttura spaziale.

L'AI può essere un livello opzionale di arricchimento visivo, ad esempio per:

- texture;
- palette;
- facciate;
- tetti;
- variazioni regionali;
- dettagli decorativi.

## Problema da risolvere

Come trasformare dati urbani reali in un mondo top-down immediatamente
riconoscibile e guidabile, mantenendo:

- costi infrastrutturali bassi;
- caricamento progressivo;
- compatibilità browser;
- degradazione sui client meno potenti;
- possibilità futura di coordinate arbitrarie.

## Vincoli di esecuzione

- Il progetto deve essere affrontabile da una persona o da un team molto
  piccolo.
- Lo sviluppo procede per incrementi verificabili.
- Il primo target è browser desktop su PC di fascia media.
- Il design deve evitare costi server permanenti non necessari.
- Le prestazioni devono essere misurate; "fluido" non è un requisito
  sufficiente.
- Il mondo canonico deve restare indipendente dal renderer e dal motore fisico.
- Le skill e il routing agentico esistenti in `.opencode/` restano parte
  dell'infrastruttura di processo e non vengono sostituiti da questa baseline.

## Prima validazione tecnica

Il primo prototipo deve dimostrare un percorso verticale ridotto:

1. caricare una zona urbana prefissata da un fixture geografico locale;
2. trasformarla in coordinate locali coerenti;
3. creare un Canonical World Model 2D;
4. compilarlo in dati runtime;
5. renderizzare strade ed edifici in top-down;
6. dimostrare almeno un effetto fake-2.5D economico;
7. consentire la guida di un singolo veicolo;
8. gestire collisioni 2D stabili;
9. produrre metriche prestazionali ripetibili.

## Fuori dal primo prototipo

- selezione arbitraria di città o coordinate;
- live acquisition da provider geografici;
- streaming city-scale;
- cache persistente definitiva;
- AI runtime;
- texture regionali definitive;
- mobile;
- multiplayer;
- pedoni;
- traffico;
- missioni;
- economia;
- combattimento.

Questi elementi influenzano l'architettura futura ma non devono gonfiare il V0.

## Decisioni tecniche non ancora automaticamente accettate

Restano da valutare o confermare tramite ADR/esperimento:

- renderer;
- backend WebGL/WebGPU;
- motore fisico;
- provider geografici;
- proiezione definitiva;
- dimensione e forma dei chunk;
- finestra di streaming;
- triangolazione/clipping;
- worker topology;
- formato `CompiledChunk`;
- formato World Package;
- cache persistente;
- texture compression;
- runtime AI;
- multiplayer authority/transport/frequenza.

I valori della bozza originaria, inclusi 150 m, griglia 3x3 e 30 Hz, restano
ipotesi fino a misurazione.

## Documenti architetturali

Per i dettagli usare:

- `docs/architecture/README.md`
- `docs/architecture/product-architecture-principles.md`
- `docs/architecture/dual-world-pipeline.md`
- `docs/architecture/2d-rendering-model.md`
- `docs/architecture/world-model.md`
- `docs/architecture/coordinate-system.md`
- `docs/architecture/world-compiler.md`
- `docs/architecture/chunk-streaming-cache.md`
- `docs/architecture/client-ai-visual-pipeline.md`
- `docs/architecture/performance-capability-tiers.md`
- `docs/architecture/technology-evaluation.md`

Gli ADR descrivono decisioni o proposte più ristrette e non possono
contraddire questa baseline senza esplicito aggiornamento dell'intento.

## Gerarchia documentale

```text
Intento di prodotto
    ↓
Principi architetturali
    ↓
ADR
    ↓
Piani di esecuzione
    ↓
Task Codex
    ↓
Codice
```

## Criterio per la revisione tecnica

Ogni scelta significativa deve essere classificata come:

- valida;
- valida con condizioni/misurazioni;
- da rinviare;
- da sostituire.

Per ciascuna scelta vanno esplicitati:

- motivazione;
- rischi;
- alternative;
- dipendenze;
- prova minima necessaria.

## Stato dell'implementazione

Aggiornato il 2026-08-19.

La Fase 0 (documentazione e contratti) è chiusa:

`docs/results/PHASE-0-COMPLETE.md`

Il repository contiene anche lo slice V0 eseguibile (fixture Lecce, compiler,
PixiJS, Rapier, veicolo). L'evidenza è in `docs/results/V0-RESULT.md`.

Non dedurre lo stato del codice dai documenti di handoff pre-code o dalla sola
roadmap. Usare `docs/handoff/CURRENT.md`.

## Regola di aggiornamento

Aggiornare questa baseline soltanto quando cambia l'intento di prodotto.

Le decisioni tecniche devono essere registrate separatamente senza trasformare
retroattivamente ipotesi storiche in decisioni già accettate.
