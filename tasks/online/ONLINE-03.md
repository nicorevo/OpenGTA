# ONLINE-03: Retry con cooldown e budget verificabili

**Stato:** completato; prove nel log ONLINE-03.
**Dipendenze:** ONLINE-02.
**Persona:** root-cause-debugger.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, fino a 4 file di codice/test piu' ADR.
**Finding:** F5, parte temporale.

## Obiettivo

Il client deve rispettare cooldown e deadline dopo un errore transitorio.
La riproduzione originale usa Headers.get che restituisce null: `Number(null)`
diventa zero e salta il backoff. Il mock con headers totalmente assente non
riproduce correttamente Fetch.

## READ

- Letture comuni, C-SOURCE e log ONLINE-01/02.
- Source, scheduler e relativi test implementati dai prerequisiti.
- `docs/adr/ADR-009-live-runtime-consent.md`, `SECURITY.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: source, scheduler e relativi test; ADR-009 per descrivere la
policy finale. Non cambiare provider, bootstrap, coda priorita' o alzare i
budget predefiniti. Non reintrodurre rotazione automatica dei mirror.

## Esecuzione TDD

1. Matrice Headers realistica: Retry-After assente, stringa vuota, zero,
   secondi positivi, data HTTP futura/passata, non numerico e negativo.
   Assente/invalido usa il backoff; valido non anticipa mai il cooldown.
   Il tempo effettivo e' il massimo fra cooldown, backoff applicabile e
   intervallo minimo. Zero non annulla il rate limit locale.
2. Testare 429, 500, 503, errore di trasporto, 400/403, abort, JSON invalido
   e remark. Solo trasporto e 429/5xx sono ritentati; massimo tre tentativi
   complessivi tutti sullo stesso endpoint. Validazione e abort non si ritentano.
3. Integrare retry nel proprietario del job seriale di ONLINE-02: tutti gli
   inizi, incluso il primo della richiesta successiva, rispettano la spaziatura.
   Non chiamare acquire ricorsivamente mentre si possiede lo slot.
4. Con clock finto consumare quasi tutto il budget attivo nel primo tentativo;
   non far partire un secondo dopo la deadline. Un Retry-After oltre il budget
   conclude con un errore che conserva status/cooldown, non con un'attesa
   abbreviata. Verificare abort durante il backoff e nessun fetch successivo.

## Accettazione

- [ ] AC1: matrice degli header e intervalli verificata su clock controllato;
  l'assenza di header non produce piu' il retry immediato della regressione.
- [ ] AC2: casi ritentabili/non ritentabili e limite tentativi conformi a
  C-SOURCE; nessun accesso a un endpoint diverso per superare un rifiuto.
- [ ] AC3: budget include tutti i tentativi, parsing e backoff; abort e deadline
  liberano la coda senza timer residui o fetch dopo la conclusione.

## Verifica

`npm run test:run -- src/world/runtime/source.test.ts src/world/runtime/request-scheduler.test.ts`

Adattare solo il path del modulo effettivamente introdotto da ONLINE-02.
Gate comune e checkpoint C1. Non testare i retry contro il servizio pubblico.

## Handoff

Riportare la tabella finale errori/retry, semantica Retry-After, clock e deadline
usati. Aggiornare ADR-009 descrivendo solo il comportamento ormai verificato.
La coda e' pronta per ONLINE-08; l'avvio progressivo non e' ancora integrato.
