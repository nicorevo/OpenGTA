# ONLINE-02: Accodare acquisizioni e cancellare l'attesa

**Stato:** completato; prove nel log ONLINE-02.
**Dipendenze:** ONLINE-01.
**Persona:** root-cause-debugger.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, circa 4 file di codice/test.
**Finding:** F2.

## Obiettivo

Quattro acquisizioni richieste insieme o in sequenza rapida devono essere
servite rispettando l'intervallo del provider, senza fallire solo perche' la
risposta precedente e' stata veloce. La coda deve poter essere cancellata e
deve avere limiti indipendenti dal timeout di una richiesta attiva.

## READ

- Letture comuni e C-SOURCE in [README](README.md); log finale ONLINE-01.
- `src/world/runtime/source.ts`, `src/world/runtime/source.test.ts`, `src/world/runtime/open-world.ts`.
- `src/world/runtime/open-world.test.ts` per il caso dei quattro chunk.
- `SECURITY.md`, sezione servizi esterni.

## MAY MODIFY / DO NOT TOUCH

Modificabili: source e relativi test; `src/world/runtime/request-scheduler.ts`
e `src/world/runtime/request-scheduler.test.ts` (nuovi se l'estrazione semplifica il codice).
Non cambiare bootstrap, geometrie, retry policy, dimensione chunk o valori
dei timeout per mascherare un errore. Il coordinatore usera' la coda in ONLINE-08.

## Esecuzione TDD

1. Con fake timer e loader immediato richiedere quattro acquisizioni: riprodurre
   i tre rifiuti attuali. Fissare max concurrency 1 e inizi distanziati almeno
   2.000 ms in Overpass e 1.000 ms nell'adapter HTTP.
2. Testare ordine P0/P1/P2 e FIFO per parita', job attivo non preempted,
   errore di un job che non blocca i successivi, limite 32 pending e timeout
   di coda 120 s. Esporre opzioni facoltative a `acquire`, senza rompere gli
   attuali caller a un argomento. Prevedere un handle interno per promuovere
   un job ancora in coda: ONLINE-08 deve poter assegnare priorita' P0 a un
   precedente P2 senza duplicare il lavoro. La promozione non riavvia un fetch.
3. Testare abort prima dell'accodamento, in coda, durante fetch e allo scadere
   del timeout. Il loader osserva il segnale; anche un loader che ignora abort
   non puo' impedire alla promessa pubblica di terminare. Non applicare poi
   il risultato tardivo. Al termine non restano timer/listener dei job chiusi.
4. Centralizzare ownership di coda, controller e inizio tentativo. Per ora
   ogni job generico invoca il loader una volta; lasciare un punto interno
   per il ciclo di retry di ONLINE-03, non una seconda coda annidata.

## Accettazione

- [ ] AC1: quattro richieste rapide riescono senza `source rate limit interval
  has not elapsed`, con concorrenza 1 e spaziatura corretta anche dopo errori.
- [ ] AC2: priorita'/FIFO, coda piena e scadenza di coda sono testati; attendere
  il proprio turno non consuma il timeout attivo di 30 s.
- [ ] AC3: tutte le forme di cancellazione terminano e liberano lo slot;
  nessuna richiesta tardiva parte dopo abort, nessun timer residuo nei test.

## Verifica

`npm run test:run -- src/world/runtime/source.test.ts src/world/runtime/request-scheduler.test.ts`

Se non viene creato il modulo scheduler, i relativi casi vivono in source.test
e il comando focalizzato usa quel file. Eseguire il gate comune. I test temporali
usano fake timer, clock coerente e flush delle microtask; niente sleep reali.

## Handoff

Registrare firme di acquire/opzioni, proprietario del timeout, punto unico
che ammette un tentativo e prove di pulizia. ONLINE-03 deve poter usare questo
punto per ogni retry senza deadlock o doppie attese.
