# Piano: ripristino online e streaming Open World

Data: 2026-09-09. Analisi di riferimento: 2026-09-08.
Stato: implementazione in corso; ONLINE-01..10 completati e verificati,
ONLINE-11..16 da eseguire (evidenze in `tasks/executions/` e [todo](todo.md)).
Baseline codice: `4ad9836`. Responsabile della pianificazione: tech-lead-planner.

## Obiettivo

Rendere il live OSM capace di acquisire dati reali, avviare una prima area
giocabile, recuperare dagli errori e aggiornare mondo e collisioni durante
la guida, con richieste e memoria limitate. Conservare il V0 offline e il
core TypeScript/PixiJS/Rapier esistenti.

Evidenza: [analisi online](../docs/analysis/ONLINE-RUNTIME-ANALYSIS-2026-09-08.md).
Le riproduzioni hanno trovato dati vuoti accettati come successo, neighbor
respinti dal rate limiter, assenza di streaming e retry difettosi. I 89 test
unitari e i 3 E2E passavano comunque: i conteggi sono baseline storica, non
un obiettivo di copertura.

## Come usare il piano

1. Leggere [istruzioni e contratti comuni](online/README.md).
2. Assegnare un solo task; leggere la sua scheda e verificare le dipendenze.
3. Eseguire TDD, verifica nativa e log di consegna secondo la scheda.
4. Aggiornare la riga qui e in [todo](todo.md) solo con evidenza di completamento.

Le schede sono autosufficienti insieme al README comune e ai file indicati.
Non richiedono la conversazione originale, script in `/tmp` o un servizio OSM
funzionante per la CI. Il piano non autorizza implicitamente un deploy.

## Confini

Inclusi: fix F1-F7, avvio progressivo, spawn percorribile, streaming locale
con backpressure, rilascio risorse, payload limitati, completamento dei filtri
OSM gia' supportati, ingresso live esplicito e verifica finale.

Differiti: multiplayer, AI, cambio stack, worker obbligatori, IndexedDB,
pacchettizzazione/CDN implementata, servizio backend e deploy pubblico.
Le decisioni di produzione sono raccolte in
[backlog successivo](online/FOLLOW-UPS.md), con condizioni di apertura.

Le API nuove nel README comune sono contratti pianificati, non API gia'
esistenti. Ogni task aggiorna solo il contratto che implementa e riporta
eventuali scostamenti nel proprio log.

## Task ordinati

Ogni scheda contiene obiettivo, READ, MAY MODIFY, DO NOT TOUCH, passi TDD,
tre criteri di accettazione, comandi, rischi e consegna. S/M indica la
superficie stimata di codice e test; documentazione e log non sono conteggiati.

| Stato | ID e scheda | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | [ONLINE-01 Provider e risposte](online/ONLINE-01.md) | Nessuna | M | OSM non vuoto sul percorso reale; errore provider distinto dal vuoto valido |
| [x] | [ONLINE-02 Coda di acquisizione](online/ONLINE-02.md) | ONLINE-01 | M | Quattro richieste rapide servite in ordine e cancellabili |
| [x] | [ONLINE-03 Retry rispettosi](online/ONLINE-03.md) | ONLINE-02 | M | Backoff, Retry-After e deadline verificati senza cambiare mirror |
| [x] | [ONLINE-04 Scena aggiornabile](online/ONLINE-04.md) | Nessuna | M | Cambio chunk preserva auto, camera e label |
| [x] | [ONLINE-05 Collisioni aggiornabili](online/ONLINE-05.md) | Nessuna | M | Aggiunta/rimozione dei collider senza ricreare il veicolo |
| [x] | [ONLINE-06 Rilascio lifecycle](online/ONLINE-06.md) | Nessuna | S | Cancellazione e rilascio senza risultati obsoleti |
| [x] | [ONLINE-07 Identita' cache](online/ONLINE-07.md) | ONLINE-01, ONLINE-06 | M | Nessun riuso fra origini/provider incompatibili |
| [x] | [ONLINE-08 Runtime progressivo](online/ONLINE-08.md) | ONLINE-03, ONLINE-06, ONLINE-07 | M | Ogni chunk pronto pubblicato subito; generazioni e memoria limitate |
| [x] | [ONLINE-09 Spawn percorribile](online/ONLINE-09.md) | ONLINE-05 | M | Posizione iniziale su strada, libera e interna ai chunk disponibili |
| [x] | [ONLINE-10 Sessione live recuperabile](online/ONLINE-10.md) | ONLINE-04, ONLINE-05, ONLINE-08, ONLINE-09 | M | Gioco avviato prima dei neighbor; errore/vuoto/riprova espliciti |
| [x] | [ONLINE-11 Confine disponibile](online/ONLINE-11.md) | ONLINE-05, ONLINE-09 | M | Movimento fisico confinato ai chunk applicati |
| [ ] | [ONLINE-12 Guida con streaming](online/ONLINE-12.md) | ONLINE-10, ONLINE-11 | M | Tre confini attraversati con aggiornamento e rilascio del mondo |
| [ ] | [ONLINE-13 Risposte limitate](online/ONLINE-13.md) | ONLINE-03 | M | Lettura interrotta al budget byte anche senza Content-Length |
| [ ] | [ONLINE-14 Profilo OSM coerente](online/ONLINE-14.md) | ONLINE-07, ONLINE-13 | M | Parchi e parcheggi richiesti e compilati |
| [ ] | [ONLINE-15 Ingresso live esplicito](online/ONLINE-15.md) | ONLINE-10, ONLINE-12, ONLINE-13, ONLINE-14 | M | Coordinate/consenso/policy endpoint verificati prima della rete |
| [ ] | [ONLINE-16 Gate finale](online/ONLINE-16.md) | ONLINE-01..ONLINE-15 | M | E2E completo, build, misure e handoff allineati |

## Checkpoint

### C1: dati affidabili, dopo ONLINE-01..03

- [x] Risposta non vuota attraversa source/normalize/compile.
- [x] Il caso 1 caricato + 3 falliti diventa 4 caricati.
- [x] 429, Retry-After assente/data/secondi, cancellazione e timeout coperti.
- [x] Test pertinenti, suite completa, typecheck e build passano.

C1 corregge l'acquisizione; non certifica ancora avvio progressivo o streaming.

### C2: risorse aggiornabili, dopo ONLINE-04..06

- [x] Rendering e fisica gestiscono chunk in ingresso/uscita senza reset auto.
- [x] Lifecycle rilascia anche richieste pendenti senza risurrezione dei record.
- [x] Test e spot check V0 passano; nessuna regressione di hole o collisioni.

### C3: coordinamento, dopo ONLINE-07..09

- [x] Cache isolata per mondo; priorita', stale result e retention verificati.
- [x] P0 viene pubblicato anche con neighbor pendente.
- [x] Spawn e impronta fisica sicuri sui bordi e nei casi senza strada.

### C4: live giocabile e streaming, dopo ONLINE-10..12

- [ ] Avvio su P0 applicato; errore e vuoto distinti; riprova senza reload.
- [ ] Tre confini, ritorno su cache e disconnessione coperti con fixture.
- [ ] Auto confinata alla zona pronta; risorse e richieste bounded.
- [ ] Suite completa, typecheck, build ed E2E passano.

C4 e' la prima consegna che puo' essere chiamata ripristino online con streaming.
ONLINE-10 da solo consegna l'avvio progressivo, non l'esplorazione continua.

### C5: robustezza del prototipo, dopo ONLINE-13..15

- [ ] Payload e input rifiutati prima del lavoro eccessivo o della rete.
- [ ] Consenso revocato cancella la sessione; default offline preservato.
- [ ] Parchi/parcheggi e namespace cache aggiornati senza download extra in CI.

### C6: consegna, ONLINE-16

- [ ] Ogni criterio delle schede e' collegato a un test o a evidenza manuale.
- [ ] Misure con ambiente dichiarato; nessuna pretesa di SLA pubblico.
- [ ] `docs/handoff/CURRENT.md`, piano e checklist concordano con il codice.

I checkpoint sono gate tecnici. Non richiedono di interrompere una tranche
gia' assegnata per domandare di nuovo il permesso di proseguire. Il lavoro
oltre la tranche assegnata, merge e deploy conservano il proprio perimetro.

## Dipendenze e ordine di esecuzione

L'ordine numerico e' valido per un singolo modello e riduce i conflitti.
Il ramo 04-06 e' preparatorio al runtime; 09 dipende dalla geometria fisica
definita in 05; 11 deve precedere l'attivazione dello streaming in 12.
Nessun task di solo test lascia deliberatamente la suite rossa a fine consegna.

Non avviare esecuzioni concorrenti sullo stesso checkout. Eventuale lavoro
parallelo esplicitamente assegnato puo' riguardare 04 (renderer), 05 (fisica)
e 06 (lifecycle); 01-03 e 07-08 condividono moduli e vanno serializzati.
I prerequisiti tecnici sono piccoli incrementi testati attraverso le API
esistenti; non autorizzano riscritture generali dei sottosistemi.

## Rischi e scelte esplicite

| Rischio | Gestione prevista |
| --- | --- |
| Provider pubblico disponibile oggi ma non domani | Default di prototipo configurabile; CI senza rete; produzione differita |
| Rate limiter e retry duplicano le attese | Un solo scheduler governa ogni tentativo; tempo in coda distinto dal timeout attivo |
| Solo rendering aggiornato, collider obsoleti | Commit del chunk in sessione prima di marcarlo ACTIVE |
| Resize o velocita' causano valanga di richieste | Domanda deduplicata, coda limitata, priorita', generazioni e cancellazione |
| Cache espelle ma lifecycle trattiene tutto | Rilascio record e risorse; test di 100 finestre |
| Strada sul bordo ancora indisponibile | Impronta fisica, pinned chunk e guardia di disponibilita' |
| Scope troppo ampio per una sessione | Una scheda S/M alla volta; dettagliare una sotto-slice prima di oltrepassare i confini |
| Vecchi documenti fanno ripartire task chiusi | Handoff corrente e copie storiche collegate sotto |

## Storico preservato

Il piano completato fino a P3.4 e la relativa checklist sono conservati in
[archivio piano](archive/2026-08-26-plan.md) e
[archivio checklist](archive/2026-08-26-todo.md). Gli execution log gia'
presenti restano evidenza storica e non sono task da rieseguire.
