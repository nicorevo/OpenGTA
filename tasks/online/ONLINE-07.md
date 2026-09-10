# ONLINE-07: Isolare la cache per mondo e provider

**Stato:** completato. Log: `tasks/executions/2026-09-10-ONLINE-07.md`.
**Dipendenze:** ONLINE-01, ONLINE-06.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** medium.
**Taglia:** M, fino a 5 file di codice/test.
**Finding:** componente identita' cache di F6.

## Obiettivo

Due runtime che condividono una cache non devono leggere la stessa
`chunk:0:0` quando origine, griglia, dataset o profilo sono differenti.
Questo task prepara il riuso corretto dei chunk e non introduce persistenza.

## READ

- Letture comuni, C-RUNTIME, log ONLINE-01/06.
- `src/world/chunk/cache.ts`, `src/world/chunk/cache.test.ts`.
- `src/world/runtime/open-world.ts`, `src/world/runtime/open-world.test.ts`.
- `src/app/bootstrap.ts`, `docs/architecture/chunk-streaming-cache.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: cache e test, open-world e test, bootstrap limitatamente alla
costruzione dell'identita' source/runtime. Non modificare source fetch/retry,
coordinate del mondo o featureId. Non aggiungere IndexedDB, hashing library,
TTL di produzione o cache di oggetti renderer/fisica.

## Esecuzione TDD

1. Condividere la cache tra due runtime: stessa key e compilerVersion, ma
   origine diversa. Dimostrare che oggi viene restituito il primo chunk.
   Estendere i casi a cell size, provider/dataset, query profile, schema e
   coordinate-model diversi; tutte le varianti devono produrre miss.
2. Definire un namespace strutturato e deterministico e usarlo in get/set/evict.
   Identificatore non segreto della source e versione profilo sono input
   espliciti del runtime; bootstrap li fornisce. Non costruire identita' da
   key locale soltanto, non salvare URL con credenziali nel debug o nei log.
   Per source custom senza identita' stabile, usare un'identita' opaca per
   istanza: meglio un miss che un hit ambiguo.
3. Conservare i caller generici della cache, oppure migrare tutti i caller
   interessati in questo task. Non modificare id spaziali pubblici o featureId
   per codificare il namespace. Stesso namespace e versione riusano i dati
   senza chiamare il loader; evict non coinvolge un altro namespace.
4. Verificare ancora LRU/capacita' e copia della chiave; la capacita' resta
   globale alla cache condivisa, non un limite separato moltiplicato per ogni
   namespace. Il rilascio automatico del lifecycle sara' collegato in ONLINE-08.

## Accettazione

- [x] AC1: origini, griglie, dataset/profili e versioni incompatibili non
  producono hit incrociati, anche quando chunkId e compilerVersion coincidono.
- [x] AC2: configurazioni compatibili producono hit; get/set/evict usano la
  stessa identita', senza alterare gli id del mondo o esporre credenziali.
- [x] AC3: LRU e limite di capacita' restano verificati; bootstrap offline e
  live forniscono identita' esplicite e i test precedenti passano.

## Verifica

`npm run test:run -- src/world/chunk/cache.test.ts src/world/runtime/open-world.test.ts`

Gate comune ed E2E bootstrap, poiche' cambia la costruzione del runtime.
Usare source con contatori e chunk differenti, non solo confronto delle stringhe
della chiave. Non servono rete o browser storage.

## Handoff

Documentare il formato della chiave e chi fornisce dataset/profile version.
ONLINE-14 dovra' incrementare il profilo query; ONLINE-08 usera' la cache
come unico proprietario warm dei chunk che escono dalla finestra.
