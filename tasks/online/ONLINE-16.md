# ONLINE-16: Verificare il percorso completo e consegnare le evidenze

**Stato:** pianificato.
**Dipendenze:** ONLINE-01, ONLINE-02, ONLINE-03, ONLINE-04, ONLINE-05, ONLINE-06, ONLINE-07, ONLINE-08, ONLINE-09, ONLINE-10, ONLINE-11, ONLINE-12, ONLINE-13, ONLINE-14, ONLINE-15.
**Persona:** test-engineer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, fino a 5 file di test/config piu' documentazione di risultato.
**Finding:** F7 e gate finale F1-F6.

## Obiettivo

Dimostrare che la tranche funziona come esperienza completa e lasciare un
handoff basato su evidenze. I risultati verdi dell'analisi iniziale non sono
una prova di chiusura: tutte le nuove condizioni devono essere verificabili.
Non e' un task di deploy o una licenza a correggere problemi estranei.

## READ

- Letture comuni, checkpoint del piano e log ONLINE-01..15.
- I test live in `tests/e2e/`, `playwright.config.ts`, `package.json`.
- `docs/testing/benchmark-protocol-v0.md`, `docs/testing/v0-test-strategy.md`.
- `docs/analysis/ONLINE-RUNTIME-ANALYSIS-2026-09-08.md` e handoff corrente.

## MAY MODIFY / DO NOT TOUCH

Modificabili: configurazione Playwright e fino a quattro test/helper E2E
pertinenti; `docs/results/ONLINE-RUNTIME-RESULT.md` (nuovo), documenti testing,
README/handoff/SPEC solo per stato e comandi realmente verificati.
Nessuna modifica al motore per rendere verdi le asserzioni. Se emerge un bug,
riaprire il task responsabile con riproduzione e lasciare questo gate incompleto.

## Esecuzione

1. Costruire una matrice F1-F7 -> test -> evidenza. Verificare non vuoto,
   four-chunk rapido, 429/timeout/remark, avvio P0 indipendente, riprova,
   confini fisici, cache/retention, payload e consenso. Preservare smoke V0.
   Le fixture restano deterministiche e tutta la rete provider e' intercettata.
2. Rendere la porta E2E configurabile con `OPENGTA_E2E_PORT`, validata, e usarla
   coerentemente in baseURL, comando Vite con strictPort e webServer.url.
   Non riusare automaticamente un server qualunque su 5173; di default il
   test avvia il proprio server o fallisce chiaramente se la porta e' occupata.
   Documentare l'override, senza dipendere dai file temporanei dell'analisi.
3. Eseguire suite completa, typecheck, build ed E2E sul dev server. Servire
   anche dist con Vite preview su porta libera per uno smoke di asset, V0 e
   configurazione live di build con rete intercettata. La policy dev non deve
   filtrare accidentalmente nel bundle di produzione.
4. Raccogliere misure con fixture e ambiente dichiarati: tempo al primo frame
   giocabile, completamento dei neighbor, p95 frame, contatori rete/queue,
   active/warm/record e collider dopo percorso/ritorno. Per cold/warm ripetere
   tre volte nelle stesse condizioni, distinguendo cache sessione e HTTP cache.
   Un loader lento simulato dimostra causalmente la non dipendenza da neighbor.
5. Usare screenshot e movimento reale per verificare dati e collisioni. La
   prova di 100 finestre puo' restare integration con tempo simulato; non
   trasformarla in 100 richieste pubbliche. Browser headless/software GPU va
   dichiarato e non usato per promettere FPS dell'hardware dell'utente.

## Accettazione

- [ ] AC1: matrice completa con prove passate per F1-F7 e requisiti ONLINE-13..15;
  zero dipendenze dai servizi pubblici nella suite e V0 ancora funzionante.
- [ ] AC2: test/ports/dev/build ripetibili, geometria e collisioni verificate,
  misure cold/warm e memoria con ambiente/metodo riportati, limiti espliciti.
- [ ] AC3: risultato, handoff, SPEC, piano e todo concordano con il codice;
  nessun task incompleto marcato chiuso, nessun deploy o SLA dichiarato.

## Verifica

`npm run typecheck`

`npm run test:run`

`npm run build`

`OPENGTA_E2E_PORT=5175 npm run test:e2e`

Scegliere una porta effettivamente libera. Per lo smoke dist:
`npx vite preview --host 127.0.0.1 --port 5176 --strictPort`, usando un config
di test coerente con quel server. Verificare anche diff/status e lint N/A
se lo script continua a non esistere. Fermare i soli server avviati dal task.

## Handoff

Il risultato deve distinguere ripristino locale del prototipo, limiti
geografici/del provider, performance misurate e aspetti di produzione non
verificati. Una prova live pubblica opzionale ha data/endpoint/esito separati
e non cambia il criterio di passaggio della CI.
