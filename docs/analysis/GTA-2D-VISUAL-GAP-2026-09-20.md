# Analisi: strade e palazzi nello stile GTA dall'alto

Data: 2026-09-20. Baseline ispezionata: `758255a`, PixiJS 8.19.0.
Stato: analisi e proposta; nessuna delle funzionalita' pianificate e' implementata
da questa tranche. [Spec](../specs/gta-2d-city-v1.md),
[piano](../../tasks/plan.md), [schede](../../tasks/gta-2d/README.md).

## Riferimento e assunzioni

Riferimento visivo primario: screenshot 640 x 480 allegato dall'utente il
20 settembre (incrocio, asfalto blu/grigio, marciapiedi a piastrelle, facciate
con finestre). Il [video indicato](https://www.youtube.com/watch?v=KYhTmJI5oHk)
non e' stato accessibile tramite il browser di ricerca: nessuna analisi dei
fotogrammi, delle animazioni o della tecnologia originale e' rivendicata.

La proposta assume una citta' reale stilizzata, guida dall'alto e priorita' a
palazzi/strade. Traffico, pedoni, missioni e HUD del riferimento sono filoni
successivi. La mappa reale resta la base del gioco; un quartiere sintetico
serve esclusivamente per prove ripetibili e confronto artistico.

## Cosa produce l'effetto della figura

La sensazione e' quella di una vista 2D con profondita' degli edifici: il suolo
resta leggibile dall'alto, le facciate mostrano piani e finestre, i tetti sono
visibili verso i bordi. Riprodurre questo effetto richiede una proiezione
visiva dei palazzi, oltre a una palette di colori. Questa e' una lettura dello
screenshot, non un'affermazione sull'implementazione interna del GTA originale.

| Elemento osservato | Stato del codice | Intervento necessario |
| --- | --- | --- |
| Auto piccole rispetto a incrocio e isolati | `VEHICLE_VISUAL_SCALE = 3.0`, zoom fino a x14 | Ricalibrare insieme auto e camera; rapporto dimensionale prima dei dettagli |
| Asfalto con grana, bordi chiari e variazioni sobrie | Stroke uniforme per classe, senza texture | Materiale ripetibile, UV metriche ancorate al mondo, bordi esterni continui |
| Marciapiede largo, piastrellato e raccordato agli angoli | Stroke allargato di 1.8 m, colore unico | Fasce pavimentate con cordoli; sottrarre carreggiate e rispettare edifici |
| Incrocio con centro sgombro e segnaletica interrotta | Sovrapposizione di stroke; tratteggio per ogni centerline | Area di incrocio comune, raccordi, maschera delle strisce |
| Linee gialle e bordi bianchi leggibili | Tratteggio bianco su tutte le strade, fase da zero su ogni frammento | Preset artistico, esclusione vicoli, distanza cumulativa e fase continua |
| Facciate con finestre e profondita' dipendente dalla camera | Copia traslata del poligono, offset fisso diagonale; tetto sulla base | Bordi di base e tetto collegati da facce, proiezione top-down dipendente dalla camera |
| Materiali distinti e tetti lavorati | Palette per tipo o seed della bounding box del frammento | Piccolo catalogo di materiali, cornici e dettagli deterministici |
| Ombre di contatto e ordine credibile | Ombra del taxi; edifici mascherati dalle strade; auto sopra lo statico | Ombre degli edifici e politica esplicita di occlusione/visibilita' del taxi |
| Citta' continua mentre si guida | Presentazioni per chunk, geometrie tagliate ai bordi | Identita' e contorni sorgente, UV stabili, nessuna facciata sui tagli artificiali |

## Evidenze nel repository

- [`renderer.ts`](../../src/render/pixi/renderer.ts): `buildPresentation`
  disegna prima una copia traslata della sagoma e poi il tetto. Non costruisce
  quadrilateri di facciata per lato. `updateCamera` trasforma il contenitore;
  non aggiorna alcuna proiezione dei palazzi rispetto alla camera.
- Nello stesso file: `strokeRoadNetwork`, `drawCenterDashes`, layer `corridor`
  e maschera inversa su `buildingsLayer`. Quest'ultima protegge la strada ma
  taglierebbe anche nuove facciate proiettate se mantenuta indiscriminatamente.
- [`scene-order.ts`](../../src/render/pixi/scene-order.ts): ordinamento
  diagonale fisso; nel renderer l'ordinamento tra chunk usa una chiave aggregata.
  Non basta per facciate proiettate in direzioni diverse.
- [`compiled.ts`](../../src/world/compiler/compiled.ts): gia' presenti
  sagome, fori, altezze visive, superfici stradali, centerline e larghezze.
  Altezza = dato sorgente, oppure piani x 3, oppure 9 m. Le altezze MVT sono
  quindi gia' utilizzabili; non occorre attendere un nuovo provider.
- [`mvt-buildings.ts`](../../src/geo/normalize/mvt-buildings.ts): legge
  `render_height`, tipo edificio impostato a `unknown`.
  [`mvt-roads.ts`](../../src/geo/normalize/mvt-roads.ts): conserva classe e
  centerline, non importa attualmente corsie, senso unico o livello stradale.
- [`types.ts`](../../src/world/model/types.ts): il canonico contempla piani,
  corsie, senso unico, ponte/tunnel e livello; il compilato non li conserva.
  La loro disponibilita' va provata per fonte, mai presunta dal tipo TypeScript.
- [`partition.ts`](../../src/world/compiler/partition.ts) taglia i tetti;
  [`mvt.ts`](../../src/geo/normalize/mvt.ts) li taglia gia' ai confini tile.
  Calcolare il materiale dalla bounding box del pezzo puo' assegnare colori
  diversi allo stesso edificio: il commento attuale sul seed non costituisce
  una garanzia di continuita'. Questo e' un rischio dedotto dal codice, da
  riprodurre con fixture prima del fix.
- Cache persistente: [`persistent-codec.ts`](../../src/world/chunk/persistent-codec.ts);
  versione compiler impostata in [`runtime-session.ts`](../../src/app/runtime-session.ts).
  Nuovi metadati richiedono validazione e invalidazione coerenti.

## Soluzione raccomandata

Mantenere PixiJS/WebGL, collisioni e geografia 2D. Usare superfici testurizzate
per il suolo e mesh di facciata/tetto come presentazione. PixiJS offre geometrie
con UV e mesh per trasformazioni prospettiche; l'uso concreto e il costo vanno
validati nel prototipo G2D-02. [Documentazione Mesh](https://pixijs.com/8.x/guides/components/scene-objects/mesh).

Texture statiche e geometrie preparate all'ingresso del chunk; durante il
movimento aggiornare solo proiezione e ordinamento necessari. Atlanti, pochi
materiali e lifecycle esplicito riducono cambi texture e ricostruzioni.
Le maschere vanno misurate, non moltiplicate per ogni finestra/edificio.
[Indicazioni prestazionali PixiJS](https://pixijs.com/8.x/guides/concepts/performance-tips).

Per l'arte: minimo 2 asfalti, 2 pavimentazioni, 4 facciate modulari e 3 tetti,
con scala dei dettagli e illuminazione coerenti. Risorse originali o con
licenza adatta, incorporate nel progetto e accompagnate da provenienza.
Finestre/cornici ripetute nel materiale: evitare un oggetto Pixi per finestra.
La scelta della libreria non crea automaticamente texture artisticamente valide.

## Sequenza e criteri di decisione

1. Provare proporzioni e un edificio con facciate in un quartiere sintetico.
2. Consegnare un incrocio completo: asfalto, pavimentazione, cordolo, segnaletica.
3. Completare edifici: materiali, tetti, ombre, visibilita' dell'auto.
4. Verificare su Lecce e su fixture MVT confinanti: continuita', streaming,
   memoria e velocita'. Dettagli decorativi solo dopo la leggibilita'.

Una citta' storica con vicoli curvi non avra' la stessa composizione di una
griglia americana disegnata a mano. Il risultato atteso e' la stessa grammatica
visiva sulla geografia disponibile. Un livello interamente disegnato a mano
richiederebbe una richiesta di prodotto distinta.

I rischi principali sono i contorni tagliati, le intersezioni ambigue, le
occlusioni tra palazzi e l'arte incoerente. Sono inclusi nel piano con fixture
dedicate e fallback espliciti. Nessun target FPS e' gia' misurato per il renderer
proposto. Le stime delle schede sono taglie relative, da aggiornare dopo G2D-02.
