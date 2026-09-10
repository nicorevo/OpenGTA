# ONLINE-13: Limitare i byte delle risposte prima del parsing

**Stato:** completato. Log: `tasks/executions/2026-09-10-ONLINE-13.md`.
**Dipendenze:** ONLINE-03.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, circa 4 file di codice/test.
**Finding:** hardening del payload emerso nell'analisi.

## Obiettivo

Interrompere lettura e parsing di una risposta troppo grande prima che il
limite di 100.000 elementi entri in gioco. Oggi response.json legge tutto;
una risposta con pochi elementi ma stringhe enormi puo' aggirare quel limite.

## READ

- Letture comuni e C-SOURCE; log ONLINE-01/03.
- `src/world/runtime/source.ts`, `src/world/runtime/source.test.ts`.
- `src/geo/normalize/osm.ts`, `SECURITY.md`.
- Tipi Fetch/ReadableStream disponibili nello stack installato.

## MAY MODIFY / DO NOT TOUCH

Modificabili: source e test, `src/world/runtime/response-reader.ts` e
`src/world/runtime/response-reader.test.ts` (nuovi). Non cambiare il modello canonico o aumentare
MAX_ELEMENTS/MAX_WAY_NODES. Nessuna libreria di parsing streaming esterna.

## Esecuzione TDD

1. Budget default 8 MiB di byte del body letto dal browser, configurabile
   internamente e validato. Testare Content-Length maggiore, assente e
   falsamente piccolo; il controllo autorevole e' sui byte effettivamente
   letti, non sulla sola intestazione o su text.length.
2. Con ReadableStream controllata superare la soglia attraverso piu' chunk,
   compreso UTF-8 multibyte. Il reader viene cancellato e JSON.parse non viene
   eseguito sul payload eccessivo. Il valore esattamente alla soglia passa se
   e' JSON valido; soglia+1 fallisce come response-too-large.
3. Collegare la lettura bounded ai fetcher di produzione HTTP e Overpass,
   conservando l'iniezione dei fetcher fake dei test. Non lasciare una strada
   di produzione che faccia response.json senza limite quando manca il body
   stream o Content-Length. JSON invalido/body vuoto sono invalid-response.
4. Propagare abort/deadline di ONLINE-03 anche durante lettura/decodifica e
   rilasciare il reader in finally. Una risposta troppo grande non viene
   ritentata e non blocca la richiesta successiva in coda.

## Accettazione

- [x] AC1: il limite si applica ai byte letti, anche con header mancante/falso
  e UTF-8 multibyte; nessun parsing dopo superamento della soglia.
- [x] AC2: HTTP e Overpass usano il reader bounded in produzione;
  response-too-large e invalid-response sono distinti e non ritentati.
- [x] AC3: abort, timeout e errore di stream rilasciano reader/slot/timer;
  la richiesta successiva puo' completarsi normalmente.

## Verifica

`npm run test:run -- src/world/runtime/response-reader.test.ts src/world/runtime/source.test.ts`

Gate comune. Il limite non promette un tetto esatto all'heap totale o al costo
di compilazione: documentare che protegge la lettura e il parsing iniziale.
I casi limite usano stream sintetici, senza scaricare file grandi da internet.

## Handoff

Indicare budget default/configurazione, errore e integrazione fetcher.
ONLINE-15 deve mostrare un esito comprensibile per dati oltre il limite;
non aggiungere log del payload o dump live al repository.
