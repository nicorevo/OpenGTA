# ONLINE-09: Scegliere uno spawn percorribile

**Stato:** completato. Log: `tasks/executions/2026-09-10-ONLINE-09.md`.
**Dipendenze:** ONLINE-05.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** medium.
**Taglia:** M, fino a 5 file di codice/test.
**Finding:** miglioramento spawn e requisito di prima area giocabile.

## Obiettivo

Dato un insieme di chunk disponibili, individuare vicino alle coordinate
richieste una pose stradale libera per la sagoma fisica del veicolo. Il punto
(0,0) cade sul bordo di quattro chunk e non e' automaticamente uno spawn sicuro.
Nessun candidato valido produce un esito esplicito, non una pose inventata.

## READ

- Letture comuni, C-RESOURCES/C-SESSION e log ONLINE-05.
- `src/gameplay/vehicle/shape.ts` introdotto in ONLINE-05.
- `src/world/compiler/compiled.ts`, `src/world/model/types.ts`.
- `src/physics/rapier/adapter.ts`, `src/app/bootstrap.ts`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: `src/gameplay/vehicle/spawn.ts` e `src/gameplay/vehicle/spawn.test.ts`,
`src/world/chunk/availability.ts` e `src/world/chunk/availability.test.ts`
(nuovi), eventualmente un test in `src/physics/rapier/adapter.test.ts`.
Non collegare ancora il bootstrap, non cambiare tuning, raw OSM o query.
Il gameplay usa geometria compilata e un callback di spazio libero, non Rapier.

## Esecuzione TDD

1. Fixture compilata con strada libera, edificio solido, cortile, acqua e
   strada a cavallo del bordo. Dimostrare che (0,0) o il semplice midpoint
   non garantiscono una pose valida. Verificare sagoma ruotata, non solo centro.
2. Generare candidati sulle centerline, ordinati per distanza dal punto
   richiesto con tie-break stabile su featureId/coordinate; heading coerente
   col segmento. Escludere segmenti degeneri e campionare con budget finito
   (massimo 128 candidati, deterministico), senza pathfinding o ricerca remota.
3. Accettare solo candidati con sagoma interamente nelle aree disponibili e
   liberi secondo query fisica. La funzione pura di copertura della sagoma
   vive in availability.ts e verifica tutte le celle intersecate, anche se
   la sagoma ne attraversa piu' di una. ONLINE-11 la riusera' per il movimento,
   senza una seconda interpretazione di "disponibile". Poiche' i collider degli edifici sono muri,
   escludere anche pose interne a footprint solidi: l'assenza di intersezione
   con un muro non rende libero l'interno dell'edificio. Preservare i cortili
   dove la geometria e la strada consentono davvero il passaggio.
4. Restituire un risultato discriminato pose/no-spawn; distinguere mancanza
   di strade da candidati tutti bloccati. Nessuna mutazione del mondo, nessuna
   eccezione per una mappa validamente vuota. Integrare le prove con la query
   reale dell'adapter per evitare un mock sempre true.

## Accettazione

- [x] AC1: a parita' di chunk e input la scelta e' deterministica, su strada,
  con sagoma disponibile e senza edificio/collider attraversato.
- [x] AC2: vuoto, strada troppo stretta/bloccata, bordo e segmenti degeneri
  danno esito controllato; nessun auto-spawn arbitrario o loop non limitato.
- [x] AC3: l'helper non importa raw OSM, PixiJS o Rapier; usa la sagoma di
  ONLINE-05 e almeno un test con query fisica reale dimostra lo spazio libero.

## Verifica

`npm run test:run -- src/gameplay/vehicle/spawn.test.ts src/world/chunk/availability.test.ts src/physics/rapier/adapter.test.ts`

Gate comune. Non pretendere che una strada esista in qualsiasi coordinata.
La UI e la decisione di aspettare altri chunk saranno implementate in ONLINE-10.

## Handoff

Riportare tipo del risultato, ordinamento/budget candidati, criteri di
occupazione e query necessaria. La sessione potra' riprovare lo spawn quando
arriva un nuovo chunk e terminare come empty solo quando la finestra e' esaurita.
