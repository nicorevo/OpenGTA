# Lavori successivi, fuori dalla tranche ONLINE

Data: 2026-09-09. Stato: backlog differito, non assegnato.

ONLINE-01..16 ripristinano e verificano il prototipo. I lavori sotto richiedono
altre decisioni o misure: non aggiungerli automaticamente al task in corso.
Quando vengono aperti, produrre una spec/ADR e slice S/M nel piano corrente.

## NEXT-01: Acquisizione e hosting di produzione

**Apertura:** richiesta di pubblicazione o utenti reali oltre il collaudo.
Persona: software-architect, poi release-engineer per il deploy assegnato.

**Input da raccogliere:** URL/hosting, root o sottocartella, regioni, utenti e
concorrenza, budget operativo, responsabile e disponibilita' richiesta.
Questi dati non sono stati forniti e non bloccano ONLINE-01..16.

**Lavoro:** confrontare provider autorizzato, istanza gestita e ingestion da
estratti rispetto ai volumi; verificare termini correnti con fonti primarie.
Definire cache lato servizio, quote, attribuzione, osservabilita', CSP/HTTPS,
policy URL/redirect e procedure di indisponibilita'. Verificare base path,
asset, worker e WASM sull'hosting concreto, senza assumere la root.

**Output:** ADR con alternative, costi e ipotesi dichiarate; contratto source
provider-neutral; runbook di verifica/rollback e task di implementazione.
Il solo confronto non comprende account, acquisti o pubblicazione.

**Accettazione:** soluzione motivata per copertura/volumi; responsabilita' e
limiti espliciti; piano verificabile di errore e rollback. Un URL locale o
una risposta positiva Overpass non dimostrano disponibilita' del sito pubblico.

## NEXT-02: Avvio e compilazione guidati dalle misure

**Apertura:** ONLINE-16 misura un problema rispetto al protocollo di benchmark
su hardware dichiarato. Persona: web-performance-auditor; fullstack-developer
per l'esperimento successivamente assegnato.

**Input:** fixture/percorso ripetibili, profilo prestazionale, bundle report,
tempi di download/parsing/compile/applicazione e frame durante la guida.

**Lavoro:** identificare il collo di bottiglia; confrontare prima caricamento
differito della fixture offline e riduzione del lavoro ripetuto. Valutare un
worker solo se la compilazione sul main thread lo giustifica, includendo
serializzazione, cancellazione e risultati obsoleti.

**Output:** esperimento con baseline, obiettivo numerico fissato prima del
cambiamento, tre esecuzioni e decisione keep/revert. Se passa, aprire una slice
di integrazione con messaggi worker validati su entrambi i lati.

**Accettazione:** miglioramento misurato senza regressioni di geometria,
collisioni, memoria o first-play. Non introdurre worker o splitting solo per
silenziare il warning del bundle.

## NEXT-03: Cache persistente fra sessioni

**Apertura:** riuso tra aperture richiesto e dataset/profile identity stabili.
Dipende da ONLINE-07/13/16. Persona: software-architect, poi fullstack-developer.

**Input:** quota, durata/aggiornamento dati, formato/versioni, dataset identity
stabile e comportamento desiderato in assenza di rete.

**Lavoro:** progettare serializzazione, integrita'/versioni, eviction e fallback
con storage assente o pieno. L'identita' opaca per istanza delle source custom
del prototipo non e' una chiave persistente: serve prima un'identita' stabile
non segreta. Trattare anche i dati del browser come non attendibili.

**Output:** contratto storage e slice write/read/invalidation/failure.

**Accettazione:** reload riusa dati compatibili; origine/versione incompatibile
o entry corrotta viene scartata; quota e storage negato non impediscono la
sessione. Niente token nello storage o persistenza implicita del consenso.

## NEXT-04: Aree precompilate

**Apertura:** modalita' Preprocessed assegnata oltre la fixture V0. Dipende
dai contratti di mondo condiviso e da acquisizione/distribuzione autorizzate.
Persona: software-architect.

**Input:** regione, provenienza/licenza, formato/versionamento e target di
peso/tempo di apertura su dispositivi di riferimento.

**Lavoro:** definire pacchetto/manifest con chunk e integrita', costruzione
offline ripetibile e caricamento progressivo nello stesso runtime. Non creare
un secondo compiler o una seconda simulazione per i pacchetti.

**Output:** spec del pacchetto e prima slice su regione deterministica;
hosting/CDN resta un'attivita' esplicitamente assegnata.

**Accettazione:** scena/collisioni equivalenti a parita' di contenuto canonico;
pacchetto corrotto/incompatibile gestito. Niente bulk download da servizi
pubblici non previsti dal progetto.

## Esclusioni confermate

Multiplayer, traffico, pedoni, missioni, AI e nuovi controlli mobile non sono
conseguenze implicite di "online". Richiedono obiettivi e task propri.
