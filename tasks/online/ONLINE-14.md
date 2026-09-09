# ONLINE-14: Richiedere parchi e parcheggi gia' supportati

**Stato:** pianificato.
**Dipendenze:** ONLINE-07, ONLINE-13.
**Persona:** root-cause-debugger.
**MODEL CLASS:** STANDARD. **REASONING:** medium.
**Taglia:** M, circa 3 file di codice/test.
**Finding:** incoerenza tra acquisizione e normalizzazione.

## Obiettivo

La query live deve recuperare anche aree con solo leisure=park oppure
amenity=parking. Il normalizzatore le supporta, ma i filtri attuali non le
selezionano se non hanno anche un altro tag cercato. Nessun nuovo tipo di
feature o classificazione geografica e' necessario.

## READ

- Letture comuni, C-SOURCE/C-RUNTIME e log ONLINE-07/13.
- `src/world/runtime/source.ts`, `src/world/runtime/source.test.ts`.
- `src/geo/normalize/osm.ts`, `src/world/compiler/compiled.ts`.
- Identita' query profile nel bootstrap introdotta da ONLINE-07.

## MAY MODIFY / DO NOT TOUCH

Modificabili: source e test; bootstrap solo per aggiornare l'identita' del
profilo se non e' gia' esportata dalla source. Non cambiare compiler,
normalizzatore, palette, classificazione delle strade o schema canonico.

## Esecuzione TDD

1. Decodificare la POST con URLSearchParams e verificare i filtri specifici
   leisure=park e amenity=parking nel bbox esistente. Non usare confronti su
   una query intera fragili rispetto alla sola formattazione.
2. Usare due way chiuse con nodi e solo i tag minimi (niente landuse/building).
   Verificare il percorso source -> normalize -> compile fino a ground con
   classi park/parking. Conservare building/highway/natural/landuse/waterway/
   barrier e ricorsione dei riferimenti della query attuale.
3. Aggiungere selettori specifici, non acquisire ogni amenity/leisure senza
   necessita'. Incrementare query profile version per impedire hit di una
   cache creata col vecchio insieme di filtri. Identita' delle feature invariata.

## Accettazione

- [ ] AC1: la query include entrambi i filtri specifici con bbox e ricorsione
  corretti, senza perdere i filtri strutturali gia' presenti.
- [ ] AC2: fixture minime park/parking arrivano come aree compilate corrette;
  il test non si limita a verificare che due parole compaiano nella stringa.
- [ ] AC3: la versione del profilo cambia e invalida il riuso incompatibile,
  senza cambiare featureId, schema o introdurre query non bounded.

## Verifica

`npm run test:run -- src/world/runtime/source.test.ts src/world/runtime/open-world.test.ts src/geo/normalize`

Gate comune. Se il bootstrap cambia, includere E2E live-startup.
Nessun download live necessario per verificare i selettori.

## Handoff

Riportare versione profilo e feature supportate. Non descrivere come
supportati tutti i POI OSM: questa slice copre solo le due classi gia'
comprese dal normalizzatore.
