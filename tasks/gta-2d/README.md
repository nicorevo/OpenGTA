# GTA 2D: ingresso esecutore

Data: 2026-09-20. Stato: G2D-00..01 consegnati; G2D-02..18 da fare.
Baseline: `758255a`.

Leggere [analisi](../../docs/analysis/GTA-2D-VISUAL-GAP-2026-09-20.md),
[spec](../../docs/specs/gta-2d-city-v1.md),
[ADR proposta](../../docs/adr/ADR-013-gta-top-down-presentation.md),
[piano](../plan.md) e la scheda assegnata.

## Regole comuni

- Persona esecutrice: fullstack-developer; TDD e incremental-implementation.
- Stati iniziali: tutte le schede da fare; la consegna di questi documenti non
  equivale a implementazione o accettazione del PoC.
- Una scheda = un risultato verificabile, un commit; target S/M, circa 3-5 file.
  Percorsi nuovi indicati esplicitamente. I test mirati citati diventano
  eseguibili quando vengono creati nella relativa scheda.
- Prima test che fallisce per logica nuova; poi minimo codice e verifica browser.
  Gli asset statici si verificano visivamente e per formato/provenienza.
- Gate comune per codice: test mirato della scheda, `npm run typecheck`,
  `npm run build` per asset/runtime, `git diff --check`, stato e diff revisionati.
  Lint non configurato: non dichiararlo eseguito. Suite completa ai checkpoint.
- Le prove iniziali operano sul quartiere offline; G2D-13/16 estendono e
  verificano la continuita' live. Non dichiarare il PoC valido per tutta la citta'.
- Nessun cambio di fisica/provider; nuovi metadati rispettano cache e consumer
  esistenti, inclusa la prima persona. Nessun fetch remoto di materiali.
- Log in `tasks/executions/YYYY-MM-DD-G2D-NN.md`: baseline, file, RED/GREEN,
  comandi, esito visuale, limiti. Aggiornare piano/todo oltre ai file della scheda.
- Risultati e misure vivono in `docs/results/`; screenshot, trace e video
  runtime fuori dal repository. Eventuali baseline di test sono asset espliciti,
  mai approvate automaticamente solo per far passare il confronto.
- Se una scheda richiede piu' di cinque file o piu' sessioni, prima suddividerla
  in sotto-schede con lo stesso esito finale; non ampliare silenziosamente lo scope.

## Sequenza e checkpoint

| Gate | Task | Risultato |
| --- | --- | --- |
| A | 00-02 | proporzioni e fattibilita' proiezione, GO/NO-GO |
| B | 03-06 | un incrocio completo giocabile |
| Dati | 07-09 | identita', bordi e cache prima delle facciate live |
| C | 10-12 | quartiere con facciate, tetti e ombre |
| D | 13-16 | continuita', LOD, citta' reale; 15 = arredo separabile |
| E | 17-18 | misure, regressioni e consegna |

Eseguire una verifica intermedia dopo 03-04, 07-08 e 13-14 oltre ai gate,
cosi' nessun blocco procede per piu' di tre task senza confronto visivo/test.
Il filone 07-09 puo' procedere indipendentemente da 03-06 dopo il PoC; non
eseguire modifiche concorrenti sugli stessi file. Questo piano non avvia agenti.

## Schede

- [x] [G2D-00](G2D-00.md): Quartiere di riferimento ripetibile.
- [x] [G2D-01](G2D-01.md): Proporzioni taxi, strada e camera.
- [ ] [G2D-02](G2D-02.md): Prova della profondita' prospettica.
- [ ] [G2D-03](G2D-03.md): Asfalto con materiale continuo.
- [ ] [G2D-04](G2D-04.md): Marciapiedi pavimentati e cordoli.
- [ ] [G2D-05](G2D-05.md): Incroci raccordati X, T e Y.
- [ ] [G2D-06](G2D-06.md): Segnaletica coerente con l'incrocio.
- [ ] [G2D-07](G2D-07.md): Contratto dei metadati visivi e cache.
- [ ] [G2D-08](G2D-08.md): Provenienza dei contorni dalle tile.
- [ ] [G2D-09](G2D-09.md): Metadati continui dopo compilazione e partizione.
- [ ] [G2D-10](G2D-10.md): Facciate modulari nel renderer di gioco.
- [ ] [G2D-11](G2D-11.md): Tetti, cornici e dettagli degli edifici.
- [ ] [G2D-12](G2D-12.md): Ombre e visibilita' del taxi.
- [ ] [G2D-13](G2D-13.md): Continuita' grafica tra chunk.
- [ ] [G2D-14](G2D-14.md): LOD e culling della profondita'.
- [ ] [G2D-15](G2D-15.md): Arredo urbano decorativo essenziale.
- [ ] [G2D-16](G2D-16.md): Verifica sulla citta' reale e sulle tile MVT.
- [ ] [G2D-17](G2D-17.md): Budget di rendering e lifecycle.
- [ ] [G2D-18](G2D-18.md): Confronto finale e consegna.

## Stima

19 schede M: taglia relativa, non promessa di 19 sessioni effettive o di durata
in giorni. Rischio maggiore in 02, 05, 08, 13 e 16; rivedere il breakdown dopo
il PoC. Produzione/revisione artistica degli atlas e test su dispositivi reali
richiedono disponibilita' dedicata. G2D-15 puo' essere posticipato in una prima
consegna centrata su palazzi/strade, aggiornando esplicitamente G2D-17/18.

