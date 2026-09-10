# ONLINE-12: Collegare lo streaming alla guida

**Stato:** completato. Log: `tasks/executions/2026-09-10-ONLINE-12.md`.
**Dipendenze:** ONLINE-10, ONLINE-11.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, circa 4-5 file di codice/test.
**Finding:** F3 e percorso completo di F6/F7.

## Obiettivo

Guidando oltre la finestra iniziale arrivano nuovi chunk, quelli lontani
vengono rilasciati e un disservizio non permette di attraversare il vuoto.
La sessione deve usare gli adapter e il coordinatore gia' implementati,
senza ricreare mondo, auto o loop a ogni cambio cella.

## READ

- Letture comuni e tutti i contratti; log ONLINE-08/10/11.
- `src/app/runtime-session.ts`, `src/app/runtime-session.test.ts`.
- API camera del renderer, snapshot/loadWindow del runtime e guardia fisica.
- `src/world/chunk/window.ts`, `tests/e2e/live-startup.spec.ts`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: sessione e test; `tests/e2e/live-streaming.spec.ts` e
`tests/fixtures/live-world.ts` (nuovi), eventualmente helper sessione locale.
Non cambiare scheduler, cell size 300 m, tuning veicolo o riaprire gli adapter
per evitare di usare le loro API. Niente timer per fetch dentro ogni frame.

## Esecuzione TDD

1. Costruire fixture deterministica con strada percorribile per almeno 1 km,
   ostacoli identificabili e featureId stabili fra bbox adiacenti. Il mock
   restituisce geometria globale coerente col bbox, non nuove copie traslate
   della stessa strada a ogni richiesta. Intercettare tutta la rete live.
2. Nel loop usare posizione/velocita' reali e cameraBounds del renderer.
   Coalescere rivalutazioni a massimo 5 Hz, deduplicare domande equivalenti,
   mantenere la source/runtime per tutta la sessione e passare pinned keys
   dalla sagoma. Resize e cambio direzione producono domanda aggiornata.
3. Applicare commit/rimozioni di ONLINE-10 e guardia ONLINE-11 prima/durante
   gli step. Se un chunk davanti manca, mostrare il motivo operativo e
   confinare l'auto; ripristino del dato riabilita la guida senza reset.
   Non riaccodare la stessa failure ad ogni tick da 200 ms.
4. Prove: almeno tre confini attraversati, ritorno in una cella warm senza
   fetch, inversione rapida con risposta vecchia tardiva, rete interrotta
   davanti al veicolo e recupero. Monitorare active/pending/warm/collider
   count per dimostrare che l'uscita dalla finestra rilascia risorse.

## Accettazione

- [x] AC1: un percorso di almeno tre confini mostra nuovi dati e collisioni,
  mantenendo body/pose continui; ritorno in warm cache non fa rete inutile.
- [x] AC2: direzione/resize aggiornano la domanda entro 200 ms con limiti di
  coda e priorita' rispettati; nessuna risposta obsoleta riapplica chunk rimossi.
- [x] AC3: disconnessione e neighbor lento non consentono ingresso nel vuoto;
  recupero e stop della sessione non lasciano risorse, job o loop duplicati.

## Verifica

`npm run test:run -- src/app/runtime-session.test.ts src/world/runtime/open-world.test.ts`

`npm run test:e2e -- tests/e2e/live-startup.spec.ts tests/e2e/live-streaming.spec.ts`

Gate comune e checkpoint C4. A 22 m/s attraversare tre celle di 300 m richiede
decine di secondi: prevedere timeout E2E fino a 90 s e polling sulla posizione,
non sleep fisso o aumento artificiale della velocita' di produzione.
Le prove lunghe di retention restano unit/integration a clock simulato.
Nel browser usare tastiera, snapshot diagnostico in sola lettura, screenshot
e osservazione del nuovo ostacolo: il contatore richieste da solo non basta.

## Handoff

Documentare cadenza/retrigger, pinning, limite active/warm osservato, rete
interrotta e recupero. Questo task chiude lo streaming giocabile del prototipo;
payload, ingresso utente e gate complessivo restano ONLINE-13..16.
