# Review end-to-end del codice V0 — 2026-08-25

## Esito

**Verdetto:** REQUEST CHANGES

Il vertical slice V0 è eseguibile e dimostrabile, ma lo stato corrente non è
ancora una baseline sufficientemente controllata per aprire lo streaming
multi-chunk. Non sono emersi problemi Critical; sono emerse divergenze
Important tra contratti, comportamento e copertura dei test.

La review riguarda il working tree corrente, inclusi cambi non ancora
committati, e non soltanto il commit `d89826c` in `HEAD`.

## Perimetro

Percorso revisionato:

```text
fixture OSM locale
  -> proiezione WGS84/local plane
  -> normalizzazione e clipping
  -> canonical world
  -> compiler e collision shapes
  -> Rapier/gameplay fixed-step
  -> PixiJS/bootstrap/browser
```

Assi applicati: correttezza, leggibilità e semplicità, architettura,
sicurezza, prestazioni e qualità della verifica.

## Finding Important

### R1 — I multipolygon composti vengono convertiti in geometria errata

Riferimenti:

- `src/geo/normalize/osm.ts:14`
- `src/geo/normalize/osm.ts:32`
- `docs/specs/osm-normalization-v0.md:172`

`closedPolygon` accetta qualsiasi sequenza di almeno tre punti e la chiude
implicitamente, anche se la way OSM è aperta. Per una relazione viene inoltre
usato soltanto il primo member `outer`; i member non vengono uniti in anelli.

Impatto verificato:

- il fixture contiene 76 relazioni edilizie;
- 2 relazioni hanno outer composti da più way aperte;
- una riproduzione sintetica con due way che formano un quadrato produce il
  triangolo della prima way, senza warning;
- il test corrente usa un solo outer già chiuso e non copre la ricostruzione
  richiesta dalla specifica.

Rimedio richiesto: introdurre un assembler deterministico di ring per ruolo,
rifiutare way edilizie aperte fuori da una relazione ricostruibile, validare
unicità/finiteness/winding e aggiungere regressioni sul fixture reale.

### R2 — Gli hole canonici non arrivano a rendering e collisione

Riferimenti:

- `src/render/pixi/renderer.ts:19`
- `src/render/pixi/renderer.ts:52`
- `src/render/pixi/renderer.ts:64`
- `src/physics/rapier/adapter.ts:16`
- `docs/specs/building-fake-2_5d-v0.md:42`
- `docs/adr/ADR-002-physics-for-v0.md`

Renderer e adapter consumano solo `polygon.outer`. I tetti riempiono quindi i
cortili; Rapier crea una parete solo sul bordo esterno e non sui ring interni.

Impatto sul fixture corrente:

- 66 edifici solidi contengono hole;
- i ring interni complessivi sono 249;
- vengono creati 161 collider statici, uno per edificio solido, senza collider
  per i ring interni.

Rimedio richiesto: disegnare poligoni con hole e creare collider per outer e
inner ring, con test su un veicolo collocato o introdotto in un cortile.

### R3 — Il clipping concatena parti disconnesse di una polyline

Riferimenti:

- `src/world/model/clip.ts:45`
- `src/geo/normalize/osm.ts:43`

Il tipo di ritorno `Vec2[]` non può rappresentare più segmenti. Quando una
linea esce dal bounds e poi rientra, gli estremi visibili vengono concatenati e
il renderer/compiler inventa un collegamento tra exit e re-entry.

Riproduzione osservata:

```text
input:  inside -> outside -> outside -> inside
output: inside -> boundary exit -> boundary re-entry -> inside
```

Rimedio richiesto prima del multi-chunk: restituire parti separate oppure
emettere una feature compilata per ogni parte, con test di uscita/rientro.

### R4 — Il contratto collisioni e i diagnostics non sono affidabili

Riferimenti:

- `src/world/compiler/compiled.ts:4`
- `src/world/compiler/compiled.ts:67`
- `src/physics/rapier/adapter.ts:16`
- `docs/specs/compiled-chunk-v0-contract.md`

L'union pubblica espone `polygon`, `segment` e `circle`, ma l'adapter ignora
silenziosamente `segment`. Una prova con un solo segment restituisce zero
collider.

Il compiler conta water, barrier e tree come input, non li compila e non li
conta come skipped. Una regione con un barrier e un tree riporta quindi:

```text
inputFeatureCount: 2
compiledFeatureCount: 0
skippedFeatureCount: 0
warnings: []
```

Sul fixture Lecce il rapporto è `546 input`, `535 compiled`, `0 skipped`.

Rimedio richiesto: implementare le shape dichiarate oppure restringere il
contratto V0; rendere l'invariante dei conteggi esplicita e testata.

### R5 — Le metriche physics non misurano i fixed step

Riferimenti:

- `src/app/metrics.ts:22`
- `src/app/bootstrap.ts:67`
- `src/app/bootstrap.ts:73`
- `docs/testing/benchmark-protocol-v0.md:55`

`RuntimeMetrics.recordFrame` incrementa `physicsSteps` una volta per frame e
riceve il costo aggregato di tutti i catch-up step. Con frame lenti il runtime
esegue fino a cinque step, ma il risultato continua a mostrare un solo step.

La prova browser ha riportato `708 frames` e `708 physicsSteps` nonostante un
p95 di circa 133 ms e debito scartato, condizione che attiva più step per frame.
Il dato `averagePhysicsMs` è quindi costo fisica per frame, non costo medio per
step. Il benchmark storico non può essere usato per validare questa metrica.

Rimedio richiesto: registrare numero e durata dei singoli step o almeno durata
aggregata più conteggio reale; aggiungere p95 step e drop count richiesti dal
protocollo.

### R6 — Il freno può invertire il senso di marcia

Riferimenti:

- `src/gameplay/vehicle/controller.ts:8`
- `docs/specs/vehicle-controller-v0.md:37`

La sottrazione del braking delta non usa un `moveTowards(0)`. A bassa velocità
positiva, il freno supera lo zero e produce velocità negativa. Con velocità
iniziale `0.1 m/s`, throttle zero e freno pieno, la prova restituisce
`-0.1583 m/s` e sposta il veicolo all'indietro nello stesso step.

Rimedio richiesto: portare la componente longitudinale verso zero senza
oltrepassarlo e coprire freno, retromarcia, steering e input combinati.

### R7 — Il profilo OSM normativo è implementato solo in parte

Riferimenti:

- `src/geo/normalize/osm.ts:12`
- `src/geo/normalize/osm.ts:24`
- `src/geo/normalize/osm.ts:27`
- `docs/specs/osm-normalization-v0.md`
- `SECURITY.md`

Sono assenti o incompleti: warning per misure malformate, parking aisle,
bridge/tunnel/layer, waterway line, barrier semantics e validazione strutturale
runtime del payload. Il limite a 100.000 elementi è utile ma tronca senza un
diagnostic esplicito e non sostituisce limiti per way/relation/ring.

Questo non blocca l'esecuzione del fixture locale, ma deve essere risolto o
esplicitamente ridotto nella specifica prima di trattare nuovi dati OSM come
input supportato. Prima di una sorgente live è anche un requisito di sicurezza.

### R8 — La suite verde non realizza la test strategy dichiarata

Riferimenti:

- `tests/bootstrap.test.ts:1`
- `docs/testing/v0-test-strategy.md:33`
- `docs/testing/v0-test-strategy.md:62`

`tests/bootstrap.test.ts` verifica soltanto `expect(true).toBe(true)`. Non
esiste un harness browser automatizzato nel progetto. Dei casi errore richiesti
dalla strategia, risultano coperti in modo diretto solo missing node e un
poligono con hole già chiuso; mancano almeno malformed height, open building,
missing relation member, duplicate points, unknown highway, coordinate non
finite e road zero/very-short.

La prova manuale DevTools copre bootstrap, canvas, rete, F3 e L, ma non è una
regressione automatica e non espone uno stato semantico per verificare il
movimento del veicolo.

Rimedio richiesto: sostituire lo smoke placeholder, completare la matrice di
error path e introdurre un browser smoke ripetibile prima di dichiarare pieno
controllo sul codice ereditato.

## Suggerimenti e debito non bloccante

### S1 — Separare orchestrazione e trasformazioni

`normalizeOsm`, `compileRegion`, `createPhysicsAdapter` e il controller
concentrano più responsabilità in statement molto compressi. La forma corrente
rende difficile isolare invarianti e aggiungere Phase 2 senza regressioni.

Applicare la semplificazione insieme ai fix interessati: assembler ring,
normalizzatori per feature, compiler per categoria e factory collider. Evitare
un refactor cosmetico separato senza test.

### S2 — Rimuovere il fallback legacy non tipizzato

`src/world/compiler/compiled.ts:53` gestisce un `road.centerline` array che il
tipo `WorldRegion` non ammette. Va eliminato oppure modellato come boundary di
migrazione esplicito; oggi è un fallback silenzioso privo di test.

### S3 — Completare il bootstrap lifecycle

Il bootstrap non restituisce una funzione di dispose, non cancella il RAF e
non rimuove listener. L'errore della Promise viene inoltre ignorato da
`void bootstrap(root)`. Non impedisce il singolo avvio V0, ma rende rischiosi
reload applicativi, test ripetuti e futuri lifecycle di chunk.

### S4 — Aggiungere lint e coverage misurabile

Il repository non definisce uno script lint né un provider coverage. TypeScript
strict intercetta errori di tipo, non leggibilità, dead code o copertura. La
review ha inoltre rilevato trailing whitespace in tre documenti già modificati
nel working tree.

## Aspetti conformi

- TypeScript strict, build e lockfile sono presenti.
- I boundary `geo/world -> render/physics` rispettano la direzione documentata.
- PixiJS e Rapier restano confinati nei rispettivi adapter.
- Fixture e test non dipendono dalla rete pubblica.
- Proiettore, road fitting, painter order e fixed-step scheduler hanno test
  deterministici dedicati.
- La collisione usa il profilo concavo esterno invece di un convex hull che
  chiuderebbe notch e passaggi.
- `npm audit --audit-level=high` non rileva vulnerabilità.

## Verifica browser osservata

Su Chrome DevTools MCP in contesto isolato:

- pagina, canvas e fixture caricati;
- canvas `1280 x 720` con nome accessibile;
- tutte le 36 richieste locali hanno risposto `200`;
- nessun errore JavaScript uncaught;
- `F3` mostra/nasconde l'overlay;
- `L` cambia la modalità label;
- presenti warning WebGL del renderer software headless;
- screenshot ispezionato ma non conservato nel repository.

Il campione prestazionale ottenuto durante interazioni DevTools e screenshot
non rispetta il protocollo benchmark e non viene usato come nuova baseline.

## Gate per ripartire

Il repository può essere usato per una tranche di hardening della baseline,
non ancora per il primo slice di prodotto Phase 2.

Ordine raccomandato:

1. ring/multipolygon e test errore normalizzazione;
2. hole end-to-end in renderer e fisica;
3. clipping multi-part in vista del multi-chunk;
4. brake regression e metriche fixed-step corrette;
5. coerenza collision contract/diagnostics;
6. browser smoke automatizzato e chiusura della test matrix;
7. commit atomici e nuova review del gate.

Le estensioni OSM non usate dal fixture possono essere implementate prima del
live data oppure rimosse esplicitamente dallo scope normativo; non devono
restare dichiarate come supportate senza prova.
