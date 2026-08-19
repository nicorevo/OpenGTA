# 🚗 OpenGTA Web (City-Scale WebGL Top-Down Engine)

> [!IMPORTANT]
> Stato: bozza tecnica in revisione. Le tecnologie, i valori numerici e le
> soluzioni descritte qui sono ipotesi, non decisioni accettate. La baseline di
> prodotto confermata è in
> [`../intent/open-gta-web.md`](../intent/open-gta-web.md).

Un gioco multiplayer top-down in stile GTA 1 che gira nativamente nel browser. Trasforma qualsiasi città reale in un mondo di gioco 3D esplorabile, sfruttando dati vettoriali **OpenStreetMap**, il motore grafico **Three.js**, la fisica in WebAssembly **Rapier.js** e uno stile visivo curato tramite **AI pre-generata**.

---

## 📐 Architettura di Sistema

Il progetto si basa sul **Caso 1 (AI Offline + Pre-rendering)**: l'AI viene utilizzata prima del deployment per generare *Texture Atlas* in pixel art basate sul tipo di architettura o territorio, eliminando ogni carico di calcolo sui dispositivi degli utenti.

```text
                  +-----------------------------------+
                  | Utente: Inserisce Città / Coords |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------+-----------------+
                  | Geocoding (Nominatim / OSM) |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------+-----------------+
                  | Download Vettori OSM (Overpass) |
                  +-----------------+-----------------+
                                    |
                                    v
               +--------------------+--------------------+
               | WEB WORKER THREAD |
               | - Triangolazione Poligoni (Earcut) |
               | - Parsing altezze e tag terreni |
               +--------------------+--------------------+
                                    |
                   +----------------+----------------+
                   | |
                   v v
        +----------+----------+ +----------+----------+
        | MAIN THREAD (3D) | | PHYSICS WORKER |
        | - Three.js | | - Rapier.js (Wasm) |
        | - Floating Origin | | - Collisioni Muri |
        | - Atlas Texture AI | | - Fisica Veicolo |
        +----------+----------+ +----------+----------+
                   ^ ^
                   | |
                   +----------------+----------------+
                                    |
                                    v
                  +-----------------+-----------------+
                  | Server Multiplayer (Node.js) |
                  | - Spatial Grid Hashing (150m) |
                  | - Sincronizzazione Client 30 Hz |
                  +-----------------------------------+
```

---

## 🛠️ Stack Tecnologico

| Componente | Tecnologia | Licenza / Costo | Ruolo |
| :--- | :--- | :--- | :--- |
| **Engine Grafico** | **Three.js** | MIT / Gratis | Rendering WebGL/WebGPU, illuminazione ortografica e shader pixel-art. |
| **Motore Fisico** | **Rapier.js** | Apache / Gratis | Simulazione fisica in Wasm per veicoli, pedoni e collisioni 3D. |
| **Dati Mappa** | **OpenStreetMap** | Open Data / Gratis | Estrusione vettoriale di palazzi, strade e parchi in tempo reale. |
| **Geocoding** | **Nominatim API** | Open Data / Gratis | Conversione di nomi di città (es. "Lecce") in coordinate GPS. |
| **Pipelining AI** | **Stable Diffusion / Flux** | Open Source | Generazione offline di Atlas di texture (mattoni, pietra, tetti). |
| **Multiplayer** | **Geckos.io / Socket.io** | MIT / Gratis | Networking ad alta frequenza su protocollo WebRTC/UDP. |
| **Caching Locale**| **IndexedDB** | Standard W3C | Archiviazione locale dei chunk scaricati per caricamento istantaneo. |

---

## 🎮 Funzionalità Chiave

### 1. Generazione Globale e Chunking
* **Streaming Dinamico:** La mappa viene divisa in settori (chunk) da 150m x 150m. Vengono caricati solo il settore corrente e gli 8 adiacenti (griglia 3x3).
* **Floating Origin:** Risolve lo sfarfallio delle coordinate 32-bit riallineando il centro del mondo 3D attorno alla posizione corrente del giocatore.
* **Compatibilità Universale:** Funziona in qualsiasi città o villaggio mappato su OpenStreetMap.

### 2. Estetica AI Pre-Generata
* Nessuna dipendenza da API cloud costose durante il gameplay.
* Gli attributi OpenStreetMap (`building=historic`, `surface=cobblestone`) applicano la texture appropriata attingendo dal Texture Atlas ottimizzato per quella regione geografica.

### 3. Multiplayer e Fisica
* **Spatial Hashing:** Il server trasmette solo la posizione dei giocatori presenti nel raggio di visibilità del client.
* **Client Prediction:** Guida senza ritardi percepiti grazie alla simulazione locale e alla riconciliazione server.

### 4. Supporto Multi-Piattaforma (Desktop e Mobile)
* **Desktop:** Controlli via tastiera (WASD / Frecce) e mouse.
* **Mobile:** Controlli touch adattivi tramite joystick virtuale (`nipplejs`) e throttling della densità dei pixel per evitare il surriscaldamento.

---

## ⚠️ Sfide Tecniche e Soluzioni

| Problema Tecnico | Causa / Impatto | Soluzione Adottata |
| :--- | :--- | :--- |
| **Rate Limit di Overpass (HTTP 429)** | L'API pubblica si blocca se l'utente guida velocemente richiedendo troppi chunk. | Rotazione su server mirror pubblici, throttling degli spostamenti e cache su **IndexedDB**. |
| **Sfarfallio Grafico (Z-precision)** | WebGL perde precisione a 32-bit se si lavora con coordinate GPS distanti dall'origine. | **Floating Origin**: la coordinata `(0,0,0)` del mondo 3D viene riposizionata ad ogni nuovo chunk. |
| **Geometrie OSM Corrotte** | Poligoni aperti, cortili complessi o edifici sovrapposti (Z-fighting). | Pulizia vettoriale e triangolazione affidata alla libreria **Earcut** in un thread separato. |
| **Micro-Stuttering da Fisica** | La creazione dei collisori 3D sul thread principale blocca il rendering (cali di FPS). | Decompressione dati e generazione fisica delegate interamente a **Web Workers**. |
| **Dislivelli e Terreno (2D vs 3D)** | Dati OSM bidimensionali che ignorano colline e pendenze stradali. | Assegnazione di un piano zero uniforme per l'MVP ed estrusione estesa delle fondamenta. |

---

## 📂 Struttura del Progetto

```text
open-gta-web/
├── public/
├── assets/
│ ├── atlases/ # Texture Atlas pre-generati via AI
│ ├── models/ # Sprite e mesh low-poly per auto/pedoni
│ └── styles/ # Fogli di stile CSS per la UI
├── src/
│ ├── core/
│ │ ├── Engine.js # Inizializzazione Three.js e ciclo di loop
│ │ ├── Camera.js # Telecamera ortografica top-down
│ │ └── OriginShift.js# Gestione del Floating Origin
│ ├── map/
│ │ ├── Overpass.js # Client API per il download dei vettori OSM
│ │ ├── ChunkManager.js # Gestione griglia 3x3 e cache IndexedDB
│ │ └── BuildingBuilder.js # Estrusione geometrica dei palazzi
│ ├── physics/
│ │ ├── PhysicsWorld.js # Worker wrapper per Rapier.js
│ │ └── VehicleController.js # Modello di guida top-down (derapate, accelerazione)
│ ├── network/
│ │ └── NetworkManager.js # Connessione WebRTC e sincronizzazione giocatori
│ ├── workers/
│ │ └── GeometryWorker.js # Triangolazione vettoriale in background
│ └── main.js # Entry point dell'applicazione
├── server/
│ ├── SpatialGrid.js # Gestione delle stanze e settori
│ └── server.js # Server Node.js per il multiplayer
├── package.json
└── README.md
```

---

## 🚀 Roadmap di Sviluppo

* [ ] **Fase 1: Prima validazione tecnica**
  * Caricamento vettoriale da Overpass per coordinate manuali.
  * Estrusione base degli edifici in Three.js con telecamera ortografica.
  * Modello di guida base con collisioni.

* [ ] **Fase 2: Ottimizzazione & Mobile**
  * Integrazione di Web Workers per la triangolazione delle geometrie.
  * Sistema di Chunking 3x3 con salvataggio su IndexedDB.
  * Integrazione controlli Touch per smartphone.

* [ ] **Fase 3: Texture AI & Visuals**
  * Generazione offline dei Texture Atlas stilizzati in Pixel Art.
  * Mapping dinamico tra i tag OSM e le coordinate UV dell'Atlas.
  * Effetti di illuminazione notturna e fari delle vetture.

* [ ] **Fase 4: Multiplayer & Features**
  * Integrazione di Geckos.io per la sincronizzazione multiplayer.
  * Sistema di spawn dinamico di pedoni ed auto gestiti dal client (Traffic AI).
  * UI per la selezione delle città tramite Nominatim.
