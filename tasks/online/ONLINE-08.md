# ONLINE-08: Pubblicare chunk progressivamente e riconciliare la finestra

**Stato:** pianificato.
**Dipendenze:** ONLINE-03, ONLINE-06, ONLINE-07.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, circa 4-5 file di codice/test; scomporre se richiede piu' di una sessione.
**Finding:** F2, F4 e integrazione della retention F6.

## Obiettivo

Il runtime deve notificare ciascun chunk pronto subito, accettare nuove
finestre senza applicare risultati obsoleti e rilasciare cio' che non serve.
La callback di applicazione consente alla sessione di avviare P0 prima dei
neighbor; il risultato finale conserva loaded e failed per chi ne ha bisogno.

## READ

- Letture comuni, C-SOURCE/C-RUNTIME e log ONLINE-03/06/07.
- `src/world/runtime/open-world.ts`, `src/world/runtime/open-world.test.ts`.
- Lifecycle, cache e scheduler implementati dai prerequisiti.
- `src/world/chunk/window.ts`, `src/world/chunk/window.test.ts`, `src/world/chunk/grid.ts`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: open-world e test; eventuale helper locale della finestra con
test; `src/world/chunk/window.ts` se serve un limite preventivo delle domande.
Non modificare renderer/fisica/bootstrap. Usare i contratti di cancellazione
dei prerequisiti; non crearne un secondo sistema incompatibile.

## Esecuzione TDD

1. Deferred loader: P0 completo, neighbor pendente. Verificare che la callback
   riceva P0 mentre la promessa finale e' ancora pendente. Se la callback di
   commit e' asincrona, il chunk non e' ACTIVE prima del suo successo. Se
   fallisce, registrare l'errore e non distruggere gli altri chunk validi.
2. Passare priorita' e segnale del lifecycle alla source. Con source rapida
   reale ma fetcher finto ottenere quattro chunk senza errori locali. Ammettere
   la priorita' della nuova domanda: un P0 non ancora partito precede P2 in coda;
   promuovere il lavoro accodato senza duplicare un fetch utile gia' iniziato.
3. Riconciliare generazioni e set wanted/pinned. Riutilizzare i lavori ancora
   utili, cancellare quelli obsoleti, notificare rimozioni e rilasciare record
   con le API di ONLINE-06. Prima di attivare verificare che la domanda sia
   ancora attuale; applicazioni concorrenti devono essere serializzate.
4. Fallimento di P0/neighbor, cambio direzione rapido, return-to-cache e
   release+reload della stessa key sono casi espliciti. Non riprogrammare
   automaticamente la stessa failure a ogni loadWindow identica: riprova
   esplicita o nuova domanda effettiva, mantenendo i limiti della source.
5. Aggiungere snapshot in sola lettura secondo C-RUNTIME. Attraversare 100
   finestre sintetiche: active solo wanted/pinned, record compilati vecchi
   rilasciati, warm <= capacita'. Limitare a 32 domande non pinned per finestra,
   con ordinamento prioritario e bounds validati prima di enumerazioni enormi.

## Accettazione

- [ ] AC1: P0 notificato/attivabile senza aspettare neighbor; callback fallita,
  P0 fallito e neighbor fallito producono risultati separati e non corrompono
  gli altri chunk. L'intervallo di acquisizione reale e' rispettato.
- [ ] AC2: deduplicazione, priorita', generazioni e pinned keys verificati;
  un completamento vecchio non riattiva dati usciti dalla finestra.
- [ ] AC3: percorso di 100 finestre mantiene risorse logiche limitate a
  wanted/pinned/pending piu' warm cache; dispose termina tutte le attivita'.

## Verifica

`npm run test:run -- src/world/runtime/open-world.test.ts src/world/chunk`

Gate comune. Le 100 finestre sono una prova unitaria con fixture/deferred
promise, non 100 richieste a Overpass. Distinguere conteggio degli oggetti
ancora referenziati da una misura del garbage collector.

## Handoff

Registrare firme loadWindow/callback/snapshot/pin/dispose, gestione dei commit
asincroni e della promozione delle priorita'. Se una scelta richiede cambiare
una firma precedente, aggiornare quel contratto e i suoi caller in una
sotto-slice esplicita, non aggirarla con uno stato globale. Sblocca ONLINE-10.
