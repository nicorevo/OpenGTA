# Risultato: ripristino online e streaming Open World

Data: 2026-09-10. Stato: consegnato, con correzioni post-review.
Baseline: `4ad9836`. Commit finale della tranche: `a5b076b`; commit di
correzione post-review: `77312aa` (baseline stabile per i test utente).
Piano: `tasks/plan.md`. Checklist: `tasks/todo.md`.

## Esito

ONLINE-01..16 completati; checkpoint C1..C6 superati. Il prototipo avvia
un'area giocabile dal provider OSM con consenso esplicito, continua a
caricare i neighbor durante la guida, rilascia i chunk lontani, confina il
veicolo alle celle applicate e recupera da errori e disconnessioni senza
reload. Il V0 offline resta il default e non contatta mai la rete.

## Matrice F1-F7 -> evidenza

| Finding | Stato | Evidenza principale |
| --- | --- | --- |
| F1 default live non fornisce i dati di Lecce | Chiuso | ONLINE-01: endpoint Overpass coerente con la copertura osservata, nessuna rotazione, remark non vuoto = provider-error. E2E `live-startup` "OSM live compiles real geometry using only the selected provider" |
| F2 risposte rapide impediscono i neighbor | Chiuso | ONLINE-02/03: coda 32 con priorita', timer di ammissione P0; test scheduler "admits new P0 ahead of P2 still waiting..." e matrice Retry-After |
| F3 nessuno streaming durante la guida | Chiuso | ONLINE-10..12: E2E `live-streaming` (tre confini con `chunk:3:0` attivo, collisioni osservate), test di sessione con warm cache e risorse bounded |
| F4 avvio attende i neighbor e perde le cause | Chiuso | ONLINE-10: stati loading/ready/degraded/empty/error; E2E "starts driving while a neighbor is delayed..."; misure: first playable ~114 ms vs ultimo chunk ~14 s |
| F5 retry e risposte di errore inaffidabili | Chiuso | ONLINE-01/03: backoff, Retry-After secondi/data, cooldown preservato, errori tipizzati; E2E errore -> Riprova -> successo |
| F6 cache limitata non limita il lifecycle | Chiuso | ONLINE-06..08: release/dispose idempotenti, test di 100 finestre (<= 2 record, cache <= 9), misure con records/cache 8 |
| F7 test verdi senza risultato utile | Chiuso | Questa matrice; E2E con fixture che verificano geometria (landmark `2000`, fence `3000` che ferma l'auto) e contatori diagnostici, non solo HTTP |

Requisiti ONLINE-13..15: payload bounded (test reader + source senza retry),
profilo parchi/parcheggi (test source -> normalize -> compile), consenso e
policy endpoint (unit + E2E `live-config` + smoke di produzione che rifiuta
l'endpoint HTTP locale nella build).

## Misure

Ambiente dichiarato: 2026-09-10; OS Fedora 44 (Linux 7.1.13-200.fc44.x86_64);
Chromium headless via Playwright 1.62.1 (device Desktop Chrome, GPU software);
Node v26.4.0; risoluzione 1280x720, dpr 1; renderer PixiJS WebGL; CPU/RAM non
rilevati. Fixture: `tests/fixtures/live-world.ts` (strada continua 4 km,
edificio, fence), rete provider intercettata. Metodo: pagina fredda ->
`#session-status` ready -> pending a zero -> Interrompi -> Riprova (stessa
pagina) -> ready, per tre trial identici.

| Misura | Trial 1 | Trial 2 | Trial 3 |
| --- | --- | --- | --- |
| navigazione -> ready (ms) | 1284 | 1035 | 1136 |
| primo frame giocabile, cold (ms) | 114 | 113 | 123 |
| ultimo chunk applicato, cold (ms) | 14109 | 14171 | 14083 |
| primo frame giocabile, warm (ms) | 1,5 | 1 | 1,3 |
| richieste provider, cold | 8 | 8 | 8 |
| richieste provider, warm | 0 | 0 | 0 |
| p95 frame (ms) | 33,3 | 33,3 | 16,8 |
| p95 step fisica (ms) | 0,2 | 0,2 | 0,2 |
| record/cache attivi | 8 | 8 | 8 |
| collider | 2 | 2 | 2 |

Lettura dei dati: il primo frame giocabile arriva ~100 ms dopo il bootstrap,
molto prima dell'ultimo chunk (~14 s, dominato dalla spaziatura minima
Overpass di 2 s su 8 celle), quindi l'avvio progressivo non dipende dai
neighbor. Warm = riuso della warm cache di sessione con source condivisa
(zero richieste); la cache HTTP di un reload completo non e' stata misurata
in questa tranche. Headless con GPU software: i valori frame non promettono
prestazioni dell'hardware dell'utente. I file JSON per trial restano in
`/tmp`, fuori dal repository.

## Limiti dichiarati

- Ripristino del prototipo locale: non e' una scelta di provider di
  produzione, un deploy o un SLA. Copertura geografica e rate limit del
  provider restano fuori dal controllo del client.
- Parchi/parcheggi sono le uniche feature aggiunte al profilo OSM.
- Il limite payload protegge lettura e parsing iniziale, non il costo di
  compilazione o l'heap totale.
- Le prove lunghe di retention sono integration a tempo simulato; le E2E
  usano fixture committate, nessun servizio pubblico contattato.

## Verifiche del gate

- `npm run typecheck`: PASS.
- `npm run test:run`: PASS — 29 file, 175 test.
- `npm run build`: PASS (warning dimensione bundle preesistente).
- `OPENGTA_E2E_PORT=5175 npm run test:e2e`: PASS — 14 test dev server.
- Smoke dist: `OPENGTA_E2E_PREVIEW=1 OPENGTA_E2E_PORT=5176` con
  `tests/preview/production.spec.ts`: PASS — asset offline, policy HTTPS di
  produzione attiva (endpoint HTTP locale rifiutato, zero richieste) e
  select provider con fallback verificato nella build.
- `git diff --check` pulito; lint N/A (script assente); nessun artefatto
  runtime committato.

## Correzioni post-review (`77312aa`)

Dopo la review end-to-end della tranche (2026-09-10) sono stati corretti i
difetti confermati, quattro dei quali live-riprodotti in Chrome:

- pannello live nel build di produzione: il select provider ricade sull'unica
  opzione disponibile invece di inviare un valore vuoto (verificato nello
  smoke dist);
- `start()`/`stop()` sbloccano sempre `busy` e i retry su ogni percorso
  (inclusi fallimenti di inizializzazione e teardown); uno start soppiantato
  non tocca piu' canvas o UI del successivo;
- la revoca del consenso ferma solo le sessioni live e azzera la
  configurazione autorizzata, cosi' Riprova non riavvia il live senza
  consenso; Riprova con errore fatale esegue un riavvio completo invece di
  chiamare la funzione disabilitata dal latch;
- i tasti di guida funzionano di nuovo dopo il focus su pulsanti/checkbox; A
  e D ora concordano con le frecce (sterzo positivo = sinistra, coperto da
  test di direzione);
- i render delle rimozioni sono coalescizzati per microtask; le guardie di
  ri-applicazione rifiutano record senza valore su entrambi i percorsi;
- il test di rollback dell'adapter esegue ora il ramo post-step
  (`blockedByAvailability` reale, deflessione su muro inclinato);
- gli E2E intercettano tutta la rete (catch-all che abbatte ogni host non
  atteso): il claim "nessun servizio pubblico contattato" e' ora una
  proprieta' della suite, non una convenzione;
- l'overlay F3 ripristina long frames, media frame/fisica, debito di
  simulazione, warning e tempo di compilazione, posizione/velocita'/heading
  dell'auto, origine e risoluzione canvas; la legenda dei controlli e'
  tornata a schermo.

Limiti residui dichiarati: il costo di rebuild della scena per applicazioni
successive resta quadratico nel numero di chunk (mascherato dal pacing del
provider); la misurazione del percorso HTTP-cache di un reload completo non
e' coperta.
