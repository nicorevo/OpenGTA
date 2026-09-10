# ONLINE-10: Avviare e recuperare una sessione live

**Stato:** completato. Log: `tasks/executions/2026-09-10-ONLINE-10.md`.
**Dipendenze:** ONLINE-04, ONLINE-05, ONLINE-08, ONLINE-09.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, 5 file di codice/test.
**Finding:** F1/F4 lato utente, parte E2E di F7.

## Obiettivo

Avviare gioco e input appena una prima area applicata contiene uno spawn
valido, mentre il resto della finestra continua a caricarsi. Errori e mondo
vuoto devono essere comprensibili e recuperabili con Riprova senza reload.
Questa slice carica progressivamente la finestra iniziale; non segue ancora
lo spostamento della camera, che e' responsabilita' di ONLINE-12.

## READ

- Letture comuni, tutti i contratti e log dei quattro prerequisiti.
- `src/app/bootstrap.ts`, `src/main.ts`, `src/app/fixed-step.ts`, `src/app/input.ts`, `src/app/metrics.ts`.
- API renderer/fisica, runtime progressivo e selettore spawn implementati.
- `tests/e2e/bootstrap.spec.ts`, `tests/e2e/live-startup.spec.ts`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: bootstrap, `src/app/runtime-session.ts` e `src/app/runtime-session.test.ts`
(nuovi), i due E2E bootstrap/live-startup. Non cambiare query, scheduler,
compiler o controller di guida. Le API adapter devono provenire dai prerequisiti.
La sessione estratta serve il loop condiviso, non costituisce un secondo motore.

## Esecuzione TDD

1. Test con P0 non vuoto immediato e neighbor trattenuto da una deferred response:
   geometria, input e passi fisici diventano disponibili prima di risolvere
   il neighbor. La risoluzione finale di loadWindow non deve essere attesa
   per creare renderer/loop o valutare lo spawn.
2. Collegare notifiche ready/remove alla sessione. Applicare grafica e collider
   insieme prima del prossimo step; se un'applicazione fallisce, ripristinare
   il precedente set e non segnare il chunk ACTIVE. Un neighbor fallito rende
   la sessione degraded ma non distrugge la parte giocabile.
3. Introdurre gli stati loading/ready/degraded/empty/error. P0 fallito espone
   la categoria utile (es. servizio occupato/timeout), non soltanto "could not
   load playable chunk". P0 valido senza spawn puo' aspettare i neighbor gia'
   richiesti; se tutta la finestra valida e' esaurita senza spawn, esito empty.
   Il vuoto non e' equivalente a un errore di rete o a un'auto pronta sul prato.
4. Pulsante Riprova: terminare vecchio runtime, richieste, adapter, RAF e
   listener; ripartire mantenendo la configurazione autorizzata. Non azzerare
   il cooldown della stessa source ancora valido: retry UI non deve aggirare
   ONLINE-03. Impedire doppie riprove concorrenti e stale callback nel nuovo DOM.
5. Usare elementi di stato accessibili e testo breve; i dettagli diagnostici
   vanno nel debug in sola lettura. Conservare V0, controlli esistenti e
   attribuzione. Aggiornare l'E2E attuale con `elements: []`: ora deve verificare
   empty, mentre lo smoke giocabile deve usare una fixture non vuota.

## Accettazione

- [x] AC1: P0 applicato con spawn valido consente input e rendering prima del
  neighbor; commit falliti non producono disallineamento scena/collider.
- [x] AC2: P0 fallito, neighbor fallito e mondo validamente vuoto hanno stati
  diversi; Riprova recupera con risposta valida, senza reload o cooldown saltato.
- [x] AC3: ripetere avvio/riprova/stop non duplica listener, RAF, richieste o
  body; V0 offline e attribuzione rimangono funzionanti.

## Verifica

`npm run test:run -- src/app/runtime-session.test.ts`

`npm run test:e2e -- tests/e2e/bootstrap.spec.ts tests/e2e/live-startup.spec.ts`

Gate comune, screenshot desktop/resize e console/rete. Intercettare Overpass
e HTTP generico; usare deferred response e stato osservabile, non sleep di
500 ms. Testare errore -> Riprova -> successo e una seconda riprova rapida.

## Handoff

Documentare API sessione, transizioni, rollback, ownership della source e
pulizia. Il risultato consegnabile e' avvio progressivo recuperabile;
non dichiarare ancora streaming durante la guida.
