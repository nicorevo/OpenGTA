# SOLID-02: Compilazione cooperativamente cancellabile

**Stato:** pianificato.
**Dipendenze:** SOLID-01.
**Persona:** fullstack-developer.
**Taglia:** M, 5 file di codice/test.

## Obiettivo

Propagare l'`AbortSignal` dentro normalize e compile: `throwIfAborted()` a
intervalli deterministici nei loop lunghi (assemblaggio ring, feature,
clip/collisioni) e yield cooperativo opzionale se il budget per task viene
superato. Un chunk diventato inutile non deve occupare il main thread per
centinaia di ms dopo l'abort. Nessun Worker in questa slice.

## READ

- `src/geo/normalize/osm.ts`, `src/world/compiler/compiled.ts`,
  `src/world/runtime/source.ts` (compileRuntimeRegion), `src/world/chunk/lifecycle.ts`.
- C-SOURCE in `tasks/online/README.md` (contratti abort esistenti).

## MAY MODIFY / DO NOT TOUCH

Modificabili: normalize, compiler, source e test. Non cambiare output
geometrico, limiti MAX_ELEMENTS/MAX_WAY_NODES o semantica del lifecycle.
I punti di controllo devono essere deterministici e a costo trascurabile.

## Esecuzione TDD

1. Test RED: fixture grande con signal abortito a meta' normalizzazione:
   l'operazione rigetta con `AbortError` e il numero di feature processate
   resta sotto la soglia attesa.
2. Iniettare `signal`/`yieldController` nei punti caldi; `throwIfAborted()`
   ogni N elementi; yield solo con budget superato (misurato con SOLID-01).
3. Test GREEN + test di regressione: risultato identico senza abort.

## Accettazione

- [ ] AC1: richiesta abortita interrompe normalize/compile; nessun risultato
  obsoleto applicato (guardie lifecycle esistenti).
- [ ] AC2: nessun task sul main thread oltre il budget dichiarato senza yield
  su fixture patologica.
- [ ] AC3: suite completa, typecheck, build ed E2E verdi; output invariato
  senza abort.

## Verifica

`npm run test:run -- src/geo/normalize src/world/compiler
src/world/runtime/source.test.ts` + gate comune.

## Handoff

SOLID-03 usa la cancellabilita' per i benchmark patologici e verifica
l'abort responsiveness dichiarata.
