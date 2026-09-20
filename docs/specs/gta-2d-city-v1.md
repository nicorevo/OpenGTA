# Spec: citta' GTA 2D, strade e palazzi

Data: 2026-09-20. Stato: proposta eseguibile, non implementata.
Baseline: `758255a`. [Analisi](../analysis/GTA-2D-VISUAL-GAP-2026-09-20.md).
[ADR-013](../adr/ADR-013-gta-top-down-presentation.md).
[Task](../../tasks/gta-2d/README.md).

## Obiettivo e confini

Guidare il taxi in una citta' dall'alto con proporzioni, materiali stradali,
marciapiedi e facciate paragonabili allo screenshot fornito. Prima consegna:
un incrocio giocabile e due isolati con finestre, tetti e ombre; poi applicazione
alle geometrie reali offline e MVT. Collisioni e sagome geografiche restano 2D.

Inclusi: camera top-down, scala visiva del taxi, materiali, geometria visiva
degli incroci, facciate, tetti, ombre, pochi props decorativi, LOD e streaming.
Differiti: traffico, pedoni, missioni, armi, HUD imitativo, ciclo giorno/notte,
interni, nuova fisica, nuova mappa di gioco fatta a mano, rework prima persona.
La vista prima persona esistente deve continuare a consumare gli stessi chunk.

## Direzione artistica e proporzioni

- Asfalto grigio/blu scuro a contrasto moderato; pavimentazione chiara a moduli,
  cordoli chiari, linea centrale gialla come preset GTA e bordi chiari selettivi.
  La segnaletica e' stilizzazione di gioco, non descrizione normativa locale.
- Facciate mattone, intonaco, cemento e vetro; finestre ripetute, basamento e
  cornicione. Tetti opachi, dettagli pochi e leggibili.
- Vista standard di prova 640 x 480: taxi lungo 35-55 px, larghezza 16-27 px;
  scala visiva iniziale 1.0-1.3 rispetto a 4.2 x 1.8 m, da calibrare sullo
  sprite mantenendone l'aspect ratio. Una strada da 6 m deve contenere almeno
  due larghezze visive del taxi. Sono obiettivi proposti, non misure del GTA.
- Target massimo zoom separato dal preset di guida. Ridimensionamento desktop
  e mobile deve conservare un tratto di strada davanti all'auto; fisica e
  velocita' massima non vengono ritoccate per compensare il renderer.
- Texture inizialmente a densita' nominale 16 texel/m, da validare sul fixture;
  filtro coerente per classe di materiale, niente sfarfallio durante scroll.

## Proiezione dei palazzi

Il punto al suolo conserva la trasformazione top-down esistente. Per la quota
visiva z si prova una proiezione radiale: `q = c + (g - c) * H / (H - z)`,
dove g e' il punto suolo in pixel, c il centro ottico e H la quota virtuale
espressa nelle stesse unita' di z. La quota visiva deriva da
`visualHeightMeters`, compressa dal preset: `0 <= z <= 0.35 * H`.
Le costanti sono parametri sperimentali da chiudere in G2D-02.

Tetto e base delimitano facce per i soli bordi esterni veri. Il tetto si
allontana dal centro ottico con l'altezza; la parete collega esattamente gli
estremi della base e del tetto. Fori, cortili, concavita' e lati posteriori
richiedono triangolazione/visibilita' corretta. Suddividere le facce o usare
interpolazione prospettica degli UV per evitare finestre deformate lungo la
diagonale dei triangoli. Prima si prova un edificio rettangolare, poi gli altri.

Nessuna nuova estrusione sui bordi prodotti da clipping. Culling e bounds
includono tetto proiettato e ombra anche quando la base e' fuori viewport.
Se il PoC non soddisfa continuita', ordinamento e costo, registrare il limite
e mantenere il fallback piatto prima di espandere il lavoro.

## Strade, marciapiedi e incroci

La carreggiata parte da `surface`, centerline e larghezza effettiva compilata.
Il disegno mantiene un materiale coerente nelle sovrapposizioni, con maschere
aggregate per zona visibile per eliminare bordi interni e doppio alpha.
G2D-05 prova X, T, Y e curva prima di scegliere la costruzione definitiva;
nessuna libreria geometrica aggiuntiva e' gia' selezionata.

Marciapiede = fascia disponibile esterna alla carreggiata, esclusa l'impronta
degli edifici, con cordolo continuo; ridurre o omettere nei passaggi stretti.
I marciapiedi dei rami confluenti non attraversano l'asfalto dell'incrocio.
Piastrelle in coordinate metriche globali, mai ricominciate al chunk.

Segnaletica interrotta nella zona di confluenza, niente mezzeria su path/vicoli
troppo stretti. Corsie e senso unico si usano solo se presenti e validati;
in assenza si applica un preset semplice basato su classe/larghezza, senza
frecce direzionali inventate. Incroci senza informazioni di livello restano
ambigui: non generare attraversamenti o semafori a ogni intersezione geometrica.
Ponti/tunnel multilivello completi sono differiti; riconoscere dati disponibili
e adottare rendering conservativo quando la fonte non risolve l'ambiguita'.

## Contratti proposti

Nomi indicativi da materializzare nelle schede: nessun tipo Pixi nei moduli
`geo`/`world`, tutti i vettori nel piano metrico dichiarato dal chunk.

| Contratto | Contenuto e invarianti | Confine |
| --- | --- | --- |
| `VisualCamera` | centro mondo, centro viewport, pixel/m, quota virtuale, tier | render; cambia senza ricompilare geografia/collisioni |
| `CityMaterialPreset` | ID finito, tile size in metri, variante, filtro, revisione asset | render; ID risolto da catalogo locale, mai URL dai dati geografici |
| `BuildingVisualMetadata` | `styleSeed`, `sourceKey?`, `boundaryEdges` con segmenti veri e stato `complete`/`partial` | opzionale nel compilato; quote gia' in `visualHeightMeters` |
| `RoadVisualMetadata` | `sourceKey?`, `distanceStartMeters?`, `direction?`, `laneCount?`, `oneWay?`, `level?`, `continuity: known/unknown` | opzionale nel compilato; campi mancanti restano sconosciuti |
| `ChunkPresentationResources` | mesh, materiali condivisi, bounds estesi, revisioni e risorse possedute | render; unload distrugge risorse locali, mai texture condivise ancora usate |

`sourceKey` deve includere provider/layer/identita' sorgente, senza suffissi di
frammento o indice di enumerazione. Piu' parti della stessa sorgente non sono
necessariamente un unico poligono. Gli ID non affidabili richiedono materiale
neutro e UV globali; non promettere identita' edificio tramite centroidi tagliati.

`boundaryEdges` conserva la provenienza dei lati prima dei tagli tile/chunk;
un MVT gia' tagliato puo' non contenere l'intero contorno. Ricostruire solo con
evidenza dai tile confinanti disponibili. Incompletezza: omettere il muro sul
bordo ambiguo, esporre contatore diagnostico, mantenere il tetto continuo.
Un eventuale halo deve avere dimensione massima dichiarata e rispettare coda,
rate limit e cache esistenti; nessun fetch per edificio.

`distanceStartMeters` e `direction` riferiscono lo stesso tracciato sorgente
prima del clipping. Se una tile non permette di conoscere tale riferimento,
marcare `unknown`: usare tratto continuo neutro sulla giunzione oppure omettere
localmente i trattini. Vietato dichiarare continuita' usando offset zero per
ogni pezzo. Traduzione dei chunk sposta punti/anchor, non distanze/seed.

Compatibilita': estensioni opzionali del contratto V0, vecchi chunk leggibili
con fallback. Metadati presenti ma invalidi causano cache miss; porre limiti a
lunghezze array, stringhe e numeri. L'attivazione del producer incrementa
`compilerVersion` per warm cache e IndexedDB; bump del codec se cambia il
formato di storage, nessuna migrazione distruttiva dei dati geografici.

## Ordine visivo e leggibilita'

Suolo e carreggiata, pavimentazione/cordoli, segnaletica, ombre di contatto,
oggetti a quota suolo, facciate/tetti ordinati, overlay di leggibilita' e UI.
Non basta assegnare uno zIndex a ciascun chunk. Il PoC misura l'ordinamento
per facce/superfici visibili; il piano non presume che una sola distanza del
centro edificio risolva tutte le sovrapposizioni.

Il taxi non deve sparire dietro un tetto: riduzione continua dell'opacita' del
solo edificio occludente oppure silhouette discreta, selezionata in G2D-12.
Eliminare il taglio globale delle facciate tramite corridor mask; mantenere
la protezione del suolo e la policy di occlusione dell'auto. Nessuna collisione
deriva dalla proiezione o dai props decorativi.

## Qualita', asset e budget proposti

- Far: colori/silhouette; medium: texture semplici, facciate ridotte; near:
  facciate complete, cordoli, finestre e pochi props. Cambiare tier non modifica
  featureId, collider o materiale assegnato allo stesso edificio.
- Catalogo iniziale: 11 tile ripetibili (2 asfalti, 2 pavimenti, 4 facciate,
  3 tetti); cornici tramite geometria o atlas. Manifest con autore, provenienza,
  licenza, revisione, dimensioni, scala e filtro. AI solo offline se scelta.
- Budget iniziale materiali: massimo 16 MiB RGBA decodificati condivisi,
  includendo padding/mipmap se presenti; nessuna texture per finestra.
- Obiettivo desktop: p95 frame <= 16.7 ms su dispositivo GPU dichiarato;
  fallback mobile <= 33.3 ms sul dispositivo scelto in G2D-00. Sono target da
  misurare, non certificabili con Chrome headless software.
- Test durata: 100 transizioni di finestra piu' ritorno al punto iniziale;
  numero risorse locali entro il budget fissato sulla scena e rilascio completo
  dopo dispose. Warm route non deve accumulare risorse per ogni passaggio.

## Verifica e criteri di successo

Fixture offline: incroci X/T/Y, curva, vicolo, palazzo rettangolare, concavo,
cortile e edificio su confine tile/chunk; scena densa e tratto reale Lecce.
Confronti a camera identica 640 x 480, desktop 1280 x 800, mobile 390 x 844.
Un'immagine fissa non prova il risultato: registrare anche scroll, zoom e curva.

| Gate | Condizione verificabile |
| --- | --- |
| A: proporzioni/proiezione | taxi nel range dimensionale, base stabile, facciata continua muovendo camera nei quattro quadranti |
| B: incrocio | texture ancorate, cordolo esterno continuo, nessuna linea/marciapiede attraverso il centro X/T/Y |
| C: palazzi | almeno 4 famiglie di facciate, tetti con fori corretti, ombre e taxi leggibile |
| D: integrazione | stesse varianti e UV su frammenti, nessun muro di taglio; fallback documentato sui dati incompleti |
| E: consegna | streaming bounded, target performance misurato o limite dichiarato, suite e build verdi, confronto visivo |

Comandi nativi: `npm run dev`, `npm run typecheck`,
`npm run test:run -- --maxWorkers=2`, `npm run test:e2e -- --workers=2`,
`npm run build`. Non esiste uno script lint al momento della pianificazione.
Unit test accanto ai moduli; E2E in `tests/e2e`; riferimenti visivi autorizzati
come asset di test espliciti, screenshot di esecuzione fuori dal repository.
Ogni scheda specifica test mirati, TDD per logica e verifica browser per resa.

TypeScript strict, funzioni pure per proiezione/geometria, risorse Pixi solo
nel renderer; convenzioni in `CODING-STANDARDS.md`, confini in `SECURITY.md`.
Sempre: testare, misurare, registrare provenienza. Decisioni da chiudere col
PoC: tecnica di ordinamento/UV e budget. Cambi di provider, nuove dipendenze,
fisica o scope di gameplay richiedono una decisione distinta dalla presente.
Mai: cambiare collisioni per correggere un difetto grafico, segreti nel bundle,
texture remote a runtime, affermazioni di prestazioni senza misure.
