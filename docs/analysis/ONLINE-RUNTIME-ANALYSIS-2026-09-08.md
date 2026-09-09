# Analisi del funzionamento online

Data: 2026-09-08. Revisione esaminata: `4ad9836`.

## Esito

Il percorso OpenStreetMap live e' riproducibilmente difettoso anche con test,
typecheck e build verdi. Il default restituisce un mondo vuoto per Lecce;
configurando un endpoint che fornisce i dati richiesti resta il problema dei
chunk vicini scartati dal rate limiter locale. Lo streaming durante la guida
non e' collegato al ciclo di gioco.

Questa attivita' produce una diagnosi e una proposta di intervento. Non modifica
il codice applicativo e non dichiara risolti i difetti.

## Perimetro e stato del progetto

L'analisi interpreta "online" come `mode=open-world-live`, il percorso di rete
presente nel repository. Non e' stato fornito un URL di produzione, quindi
deployment, DNS e configurazione dell'hosting non sono stati verificati.

Il progetto e' una sandbox browser TypeScript/Vite, con PixiJS per rendering e
Rapier per collisioni. Il percorso dati e' separato in acquisizione,
normalizzazione, compilazione e partizione; lifecycle e cache hanno test
dedicati. Sono buone basi per correggere il flusso senza cambiare stack.
Non risultano server applicativo o multiplayer implementati.

Le funzioni di active window e cache esistono, ma non equivalgono ancora a un
mondo che si aggiorna progressivamente seguendo il veicolo. La documentazione
di completamento va interpretata come completamento della fondazione tecnica.

## Prove eseguite

Server locale dedicato: `http://127.0.0.1:5174/`. La porta 5173 era occupata da
un'altra applicazione; non e' stata arrestata o modificata.

| Verifica | Risultato |
| --- | --- |
| `npm run test:run` | 89 test passati, 22 file |
| `npm run typecheck` | Passato |
| `npm run build` | Passata; warning sul bundle principale di 2.409,09 kB, 785,28 kB gzip |
| `npm run test:e2e -- --config=/tmp/opengta-online-analysis.playwright.config.ts` | I 3 test esistenti passano su Chrome; override temporaneo della porta e degli artefatti |
| Lint | Nessuno script lint presente in `package.json` |
| Browser reale, default live a Lecce | HTTP 200, `elements: []`, nessun mondo visibile |
| Browser reale, endpoint esplicito `overpass-api.de` | HTTP 200, 8.059 elementi; un solo chunk visibile |
| Riproduzioni isolate, senza rete | Confermati rate limit dei neighbor, backoff nullo, perdita di `remark`, attesa dei neighbor e retention del lifecycle |

Le prove live hanno prodotto una POST per ciascuna configurazione. Le altre
prove non dipendono dai servizi pubblici. In Chrome headless compaiono warning
del backend grafico software; gli FPS osservati non costituiscono un benchmark
rappresentativo dell'hardware dell'utente.

## Finding ordinati per priorita'

### F1. Alta: il default live non fornisce i dati di Lecce

Riferimenti: `src/world/runtime/source.ts:119`, `:153`, `:56`;
`src/world/runtime/open-world.ts:58`.

`DEFAULT_OVERPASS_ENDPOINT` punta a `https://overpass.osm.ch/api/interpreter`.
Il servizio si presenta come [Swiss Overpass API](https://overpass.osm.ch/).
La richiesta effettiva generata dal gioco per Lecce ha restituito HTTP 200 e
zero elementi. Il client accetta la risposta vuota; il fallback scatta solo per
errori di rete/HTTP e la partizione produce comunque un oggetto chunk.

Prova A: aprire
`/?mode=open-world-live&provider=osm&lat=40.35&lon=18.17&consent=1` e premere F3.
Osservato: `buildings: 0`, `roads: 0`, `compiled: 0`, `warnings: 0` e un unico
collider, quello dell'auto. Nessun errore applicativo segnala il mondo vuoto.

Prova B: aggiungere
`&endpoint=https%3A%2F%2Foverpass-api.de%2Fapi%2Finterpreter`.
La stessa query ha restituito 8.059 elementi: 7.044 node, 922 way, 93 relation.
Il chunk visualizzato contiene 44 edifici, 86 frammenti stradali e 133 feature
compilate. Questo separa il problema dei dati da un guasto generale del renderer.

Il commit corrente `4ad9836`, del 27 agosto, ha sostituito il precedente default
`overpass-api.de` con `overpass.osm.ch`. La modifica spiega la regressione di
copertura osservata; non e' necessario ipotizzare un problema CORS, poiche'
entrambe le risposte sono state lette correttamente dal browser.

Intervento: configurare un provider con copertura adeguata e rappresentare
esplicitamente l'esito "nessun dato". Non tutte le aree vuote sono errori:
distinguere copertura del provider, risposta valida senza feature e area non
giocabile. Non attivare automaticamente richieste a mirror per ogni area vuota.

### F2. Alta: le risposte rapide impediscono il caricamento dei neighbor

Riferimenti: `src/world/runtime/source.ts:80`, `:167`;
`src/world/runtime/open-world.ts:85`; `src/app/bootstrap.ts:65`.

L'adapter Overpass impone almeno 2.000 ms tra inizi di acquisizione, ma rifiuta
la chiamata anticipata invece di accodarla. `loadWindow` chiama i neighbor subito
dopo P0 e non riprogramma quelli rifiutati. Con una prima risposta sotto i due
secondi, i tre neighbor della finestra iniziale falliscono localmente senza
neppure inviare una richiesta HTTP.

Riproduzione con fetcher immediato: 1 richiesta, 1 chunk caricato, 3 fallimenti
`source rate limit interval has not elapsed`. Nella prova reale sull'endpoint
globale la prima richiesta dura circa 1.722 ms e il risultato visivo mostra
soltanto il quadrante nord-est. Anche l'adapter HTTP generico ha il problema,
con intervallo di 1.000 ms.

Intervento: scheduler cancellabile con coda, priorita' P0/P1/P2, concorrenza
limitata e rispetto dell'istante minimo della prossima richiesta. Esporre gli
errori dei neighbor senza perdere quelli gia' caricati.

### F3. Alta: non c'e' streaming durante la guida

Riferimenti: `src/app/bootstrap.ts:58`, `:65`, `:87`, `:124`;
`src/world/runtime/open-world.ts:29`.

Il bootstrap crea il runtime e chiama `loadWindow` una sola volta con posizione,
velocita' e bounds fissi. Nel frame loop vengono aggiornati soltanto fisica,
veicolo, camera e metriche. Nuove posizioni non generano richieste; renderer e
collider mantengono la finestra iniziale. I fallimenti iniziali restano tali.

Intervento: mantenere il runtime per tutta la sessione, aggiornare la domanda
quando cambiano chunk/camera, attivare i nuovi dati in renderer e fisica,
disattivare quelli lontani. Verificare l'attraversamento dei confini e impedire
che il veicolo entri senza segnalazione in una zona ancora indisponibile.

### F4. Media: l'avvio attende tutti i neighbor e perde la causa degli errori

Riferimenti: `src/world/runtime/open-world.ts:77`, `:85`;
`src/app/bootstrap.ts:65`, `:71`, `:87`; `src/main.ts:8`.

P0 viene marcato ACTIVE prima dei neighbor, ma il bootstrap attende il risultato
completo di `loadWindow` prima di inizializzare rendering, fisica e input.
Un neighbor lento puo' quindi bloccare anche un P0 gia' pronto. Riproduzione:
loader del neighbor lasciato in attesa, P0 ACTIVE, promessa `loadWindow` pendente.

Non esiste uno stato visibile di avanzamento. `activeWindow.failed` non viene
mostrato; se fallisce P0, il messaggio generico sostituisce la causa originale
come HTTP 429, timeout o errore di parsing. Non c'e' comando di riprova.

Intervento: avvio sul minimo insieme giocabile, completamento progressivo,
stati di caricamento/errore/area vuota e recupero senza ricaricare la pagina.

### F5. Media: retry e risposte di errore non sono affidabili

Riferimenti: `src/world/runtime/source.ts:56`, `:135`, `:153`, `:159`.

Con un vero oggetto Headers, un `Retry-After` assente restituisce `null`:
`Number(null)` vale zero. Il backoff configurato di 1.500 ms viene saltato.
La prova isolata ha misurato circa 1 ms tra una risposta 429 e il nuovo tentativo.
I test attuali omettono del tutto `headers`, producendo `undefined` e non
riproducendo il comportamento delle risposte Fetch reali. Anche la forma HTTP
date di `Retry-After` non viene interpretata.

Il default alterna endpoint anche dopo 429. Questo contraddice il vincolo del
progetto contro la rotazione dei mirror per aggirare rate limit. La
[documentazione Overpass](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
spiega il cooldown e il load shedding: l'attesa deve essere rispettata.

Inoltre, un payload `{ remark: "runtime error: Query timed out", elements: [] }`
viene accettato come successo e `remark` viene scartato. Riprodotto senza rete.
Il timeout complessivo di 30 secondi include tutti i tentativi e le attese:
un primo tentativo lento puo' consumare il budget del successivo.

Intervento: distinguere header assente da zero, supportare la data HTTP,
applicare backoff e budget espliciti, arrestarsi su cancellazione e mantenere
separati errori del provider, errori di trasporto e risposte vuote valide.

### F6. Media: la cache limitata non limita la memoria del lifecycle

Riferimenti: `src/world/chunk/lifecycle.ts:42`, `:64`, `:86`;
`src/world/runtime/open-world.ts:38`, `:89`; `src/world/chunk/cache.ts:46`.

La cache espelle i propri elementi, ma il lifecycle conserva una Map con i valori
compilati di ogni chunk caricato. Il runtime non disattiva i vecchi chunk e non
espone un'operazione di rilascio. Prova: quattro finestre successive con cache
di capacita' uno lasciano quattro chunk ACTIVE e ancora referenziati.

E' un difetto da correggere insieme allo streaming: oggi il caricamento singolo
del bootstrap limita la sua manifestazione. Un'estensione diretta del frame loop
senza lifecycle completo provocherebbe crescita della memoria.

Intervento: ownership esplicita dei dati fra active set e cache, rilascio dei
record e dei collider/render object non necessari. Prima di condividere o rendere
persistente la cache, includere origine geografica, griglia e provider nella
chiave: `chunk:0:0` con versione compiler da solo non identifica una localita'.

### F7. Media: i test verdi non verificano il risultato online utile

Riferimenti: `tests/e2e/bootstrap.spec.ts:58`;
`src/world/runtime/source.test.ts:91`; `src/world/runtime/open-world.test.ts:22`.

L'E2E live simula l'adapter HTTP con `elements: []` e verifica il testo della
regione. Non usa il ramo `provider=osm`, non richiede geometria visibile, non
verifica quattro chunk, recupero dagli errori o movimento verso nuove zone.
I test del coordinatore usano una source senza intervallo minimo.

Intervento: scenari offline deterministici con fixture geografiche non vuote,
Headers realistici, fake timer per scheduler/retry e test browser per le
condizioni osservate. Le prove live restano diagnostiche separate dalla CI.

## Altri miglioramenti mirati

- Acquisizione coerente con la normalizzazione: la query non seleziona
  `leisure=park` o `amenity=parking` come criteri autonomi, anche se il
  normalizzatore li supporta. Queste feature arrivano solo se corrispondono
  anche a un altro filtro; aggiungere copertura e fixture pertinenti.
- Limite ai byte prima di `response.json()`: il limite di 100.000 elementi
  interviene dopo lettura e parsing completo del payload. Non protegge dal
  costo di scaricare/parsing di una risposta eccessiva.
- Spawn: il veicolo parte sempre a `(0, 0)` senza selezionare una strada o
  verificare lo spazio libero. Per coordinate arbitrarie serve una posizione
  iniziale percorribile e coerente con le aree gia' disponibili.
- Prestazioni: compilazione sul main thread e import statico della fixture
  contribuiscono al lavoro iniziale. Misurare download, parse, compile e primo
  frame utile prima di introdurre worker, caricamento differito o cache persistente.
- Distribuzione: manca una configurazione di hosting verificata. Per il prodotto
  definire endpoint autorizzati, HTTPS, CSP compatibile con worker/rete e una
  UI di consenso/configurazione. Non assumere che parametri URL bastino al flusso
  utente finale.
- Produzione: valutare pacchetti geografici versionati su storage/CDN per aree
  note e un servizio di acquisizione/cache autorizzato per coordinate arbitrarie,
  come gia' previsto in `docs/architecture/data-acquisition-strategy.md`.
  I [gestori Overpass](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
  sconsigliano di basare un'app distribuita sugli endpoint pubblici condivisi.

## Ordine di intervento proposto

Ogni slice deve iniziare dai test che riproducono il difetto prima delle
modifiche applicative. Questa e' una proposta, non un backlog gia' eseguito.

| Ordine | Slice verificabile | Criterio di accettazione |
| --- | --- | --- |
| 1 | Provider e qualita' della risposta | Lecce con geometria non vuota; area vuota e errore `remark` riconoscibili |
| 2 | Scheduler e retry | Tutti i chunk richiesti arrivano anche con risposte rapide; intervalli e Retry-After rispettati; niente rotazione su 429 |
| 3 | Avvio progressivo e recupero | Prima area giocabile senza attendere neighbor lenti; errori comprensibili e riprova |
| 4 | Streaming e rilascio | Attraversare almeno tre confini aggiorna geometria/collider; dati lontani rilasciati; rete assente gestita |
| 5 | Robustezza e distribuzione | Payload limitati, cache identificata correttamente, provider autorizzato e build servita nell'ambiente previsto |

Cambiare solo endpoint permette una verifica parziale immediata, ma non risolve
rate limiter, assenza di streaming e gestione dell'avvio. La prima tranche utile
comprende le slice 1-3; lo streaming richiede anche la slice 4.
