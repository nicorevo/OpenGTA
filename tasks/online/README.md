# Esecuzione dei task online

Data: 2026-09-10. Stato: tranche completata (ONLINE-01..16, C1..C6); le
schede restano riferimento dei contratti implementati e dei criteri
verificati. Risultato: [`docs/results/ONLINE-RUNTIME-RESULT.md`](../../docs/results/ONLINE-RUNTIME-RESULT.md).
Indice operativo: [piano](../plan.md), [checklist](../todo.md).

## Avvio per un modello senza contesto

Prompt di assegnazione riutilizzabile:

```text
Esegui il task ONLINE-NN in tasks/online/ONLINE-NN.md.
Leggi prima AGENTS.md e tasks/online/README.md, poi solo le letture
richieste dalla scheda. Verifica che le dipendenze siano completate nel
codice e nei log. Implementa con TDD entro il perimetro indicato, esegui
le verifiche e aggiorna piano, checklist e log. Non implementare gli altri
task e non trattare il piano come descrizione di API gia' esistenti.
```

La consegna della tranche e' completata: ogni scheda riporta il log di
esecuzione che ne attesta i criteri. Le schede restano valide per riaprire
un task in caso di regressione, con le stesse regole di esecuzione.

## Letture comuni obbligatorie

I percorsi sono relativi alla radice del repository, anche nelle schede.

- `AGENTS.md`, `CODING-STANDARDS.md`, `SECURITY.md`.
- `docs/SPEC.md`, `docs/handoff/CURRENT.md`.
- `docs/codex/architecture-guardrails.md`.
- Questo README, la scheda assegnata e il finding citato in
  `docs/analysis/ONLINE-RUNTIME-ANALYSIS-2026-09-08.md`.
- `.opencode/references/definition-of-done.md`.

Attivare la persona indicata nella scheda e le skill del routing in AGENTS.
Per i fix: `root-cause-debugger`, `debugging-and-error-recovery`,
`browser-testing-with-devtools`, piu' `test-driven-development` per TDD.
Per sviluppo: `fullstack-developer`, `test-driven-development`,
`incremental-implementation`; aggiungere `browser-testing-with-devtools`
per renderer, bootstrap e UI. Per QA: `test-engineer` e TDD.
Le skill sono in `.opencode/skills/<nome>/SKILL.md`, le persone in
`.opencode/agents/<nome>.md`. Non caricare tutte le skill insieme.

MODEL CLASS e REASONING nelle schede sono metadati di complessita' del
template locale; non richiedono cambio modello o delega automatica.

## Regole di esecuzione e consegna

1. Leggere `git status --short` e i file effettivi. Non toccare modifiche
   estranee, fra cui `.serena/` o eventuali file di ripresa dell'utente.
2. Verificare le dipendenze nei log `tasks/executions/*-ONLINE-NN.md` e nelle
   API/test implementati. Se una dipendenza manca, registrare il prerequisito
   e non incorporare di nascosto l'intero task precedente.
3. Scrivere il test che riproduce il comportamento richiesto e osservarlo
   fallire per la causa prevista. Implementare il minimo cambiamento e
   verificarne il passaggio. Non lasciare una consegna con test rossi.
4. I file MAY MODIFY includono produzione e test. Sono inoltre ammessi il
   log del task, la relativa checkbox in piano/todo e le sole righe di
   documentazione necessarie a descrivere le API cambiate. Se serve ampliare
   sostanzialmente lo scope, esplicitare una sotto-slice prima di procedere.
5. Eseguire i comandi della scheda e il gate comune sotto. Registrare gli
   esiti reali, non riusare i risultati dell'analisi dell'8 settembre.
6. Scrivere `tasks/executions/YYYY-MM-DD-ONLINE-NN.md` seguendo
   [il template](EXECUTION-TEMPLATE.md). Aggiornare stato e checkbox solo
   dopo il passaggio dei criteri. Commit piccoli e atomici, con messaggi
   imperativi, limitati ai file del task; niente push, merge o deploy impliciti.

Dipendenze e contratti sono sufficienti a proseguire un lavoro assegnato:
un checkpoint tecnico superato non e' una richiesta di nuova autorizzazione.
Se emerge una scelta di prodotto esterna al piano, documentare la domanda
concreta e proseguire solo le parti indipendenti gia' assegnate.

## Contratti condivisi

Questa sezione fissa il comportamento concordato tra schede. Le firme esatte
possono adattarsi al codice, ma l'esecutore deve annotare firma finale,
ownership e test nel log; un cambiamento semantico richiede riallineamento
delle schede dipendenti. Non aggiungere astrazioni solo per imitare i nomi.

### C-SOURCE: acquisizione e scheduler (ONLINE-01..03)

- Conservare `GeoDataSource.acquire(request)`; aggiungere opzioni facoltative
  per AbortSignal e priorita' numerica 0/1/2, con default 2. Il core della
  source non importa PixiJS, Rapier, DOM o il selettore della finestra.
- Una source possiede una coda e un solo tentativo attivo. FIFO a parita'
  di priorita'; 0 precede 1, che precede 2. Un nuovo P0 non interrompe una
  richiesta ancora utile gia' in corso. Il runtime cancella lavori obsoleti.
- Massimo 32 lavori in attesa per source, configurabile e validato. Un lavoro
  oltre il limite fallisce come `queue-full`, senza rete. In coda si applica
  un budget separato di 120 secondi; cancellazione o scadenza rimuovono il job.
- Timeout attivo: 30 secondi negli adapter HTTP/Overpass, dal primo tentativo
  fino al parsing finale, inclusi retry e attese successive. La coda precedente
  al primo tentativo non consuma questo budget. Timeout e timer devono essere
  iniettabili o controllabili dai fake timer, senza attese reali nei test.
- Spaziatura minima fra inizi di tentativi: Overpass 2.000 ms, HTTP 1.000 ms;
  anche i retry sono tentativi. Un unico proprietario coordina rate limit e
  retry: non reinserire il retry nella coda mentre si tiene il suo slot.
- Retry Overpass: massimo due oltre al primo tentativo; solo errori di
  trasporto e HTTP 429/5xx. Backoff di base 1.500, poi 3.000 ms; l'inizio
  effettivo rispetta anche intervallo minimo e Retry-After valido. Nessuna
  rotazione automatica di endpoint, neppure dopo 429. Non abbreviare il
  cooldown del provider per farlo entrare nel budget: terminare con errore.
- Errori discriminabili almeno come invalid-request, http, network, timeout,
  aborted, invalid-response, provider-error, queue-full e queue-timeout;
  aggiungere response-too-large in ONLINE-13. Conservare status HTTP quando
  presente. La UI usa codici stabili, non confronti su stringhe arbitrarie.
- `elements: []` senza errore resta un risultato geografico valido. Un
  `remark` Overpass non vuoto e' un errore del provider, anche con HTTP 200
  e dati parziali: non compilare un mondo parziale come completo. Non fare
  retry automatici per errori semantici, JSON invalido o input non valido.
- Abort gia' impostato, durante coda, fetch, backoff o lettura deve terminare
  senza ulteriori tentativi. Ripulire timer/listener in tutti i percorsi.

Un loader arbitrario che ignora AbortSignal non e' interrompibile fisicamente
dal chiamante: in quel caso sono garantiti la conclusione della promessa
pubblica e lo scarto del risultato tardivo, non la terminazione del suo codice.

I limiti numerici sono default conservativi del prototipo e devono restare
configurabili internamente, non diventare una promessa di servizio pubblico.

### C-RESOURCES: rendering e fisica (ONLINE-04..05)

- Il renderer accetta un nuovo insieme di `CompiledChunkV0`, incluso vuoto,
  senza cambiare pose del veicolo, stato label o camera. Un set immutato non
  ricrea risorse. La sostituzione con nuovo contenuto dello stesso chunkId
  deve invece aggiornare la scena: schemaVersion da sola non e' una revisione
  del contenuto. Sono ammessi rebuild dei layer statici al cambio set per
  preservare ordine globale/mask; non ricostruire tutto a ogni frame.
- Esporre i bounds della camera in metri locali, coerenti con resize e
  inversione Y. Conservare `render`, `updateVehicle` e `toggleLabels` per
  compatibilita' con V0; rendere esplicito il teardown.
- La fisica aggiorna i collider statici per chunk senza ricreare World,
  body dinamico o stato auto. La chiave risorsa distingue chunk e frammento;
  il solo featureId OSM non e' unico fra chunk. Rimozione idempotente e
  distruzione della sessione liberano handle e risorse.
- La sagoma autorevole e' quella fisica attuale: semilunghezza 2 m e
  semilarghezza 0,82 m. La scala decorativa dell'auto nel renderer non entra
  nei test di spawn o disponibilita'. ONLINE-05 la centralizza in un helper
  di progetto utilizzabile senza importare Rapier nel gameplay.

### C-RUNTIME: finestre, generazioni e cache (ONLINE-06..08)

- Distinguere wanted, pending, ready e active. READY significa compilato;
  ACTIVE, nel percorso integrato, significa applicato con successo a scena
  e collisioni. P0/P1/P2 sono priorita', non garanzie di giocabilita'.
- Estendere `loadWindow` con notifica per singolo chunk pronto e rimozione,
  mantenendo un risultato finale per loaded/failed. La notifica ready deve
  poter essere attesa: solo dopo il commit del chiamante il chunk diventa
  ACTIVE. Il chiamante senza adapter mantiene la compatibilita' dei test core.
- Ogni nuova domanda ha una generazione. Lavori ancora necessari si riusano;
  quelli obsoleti si cancellano. Una risposta vecchia non riattiva un chunk
  rimosso, neanche dopo release e nuovo caricamento della stessa chiave.
- Il lifecycle possiede gli AbortController dei caricamenti deduplicati.
  Cancel/release riguardano il caricamento condiviso, non un singolo waiter.
  Dispose termina pending, callback, timer e record della sessione.
- La sessione comunica pinned keys: almeno i chunk intersecati dalla sagoma
  fisica del veicolo. Essi non si rimuovono durante il passo di fisica. Fuori
  da wanted/pinned non devono restare risorse attive o record compilati;
  gli eventuali dati riutilizzabili restano solo nella warm cache.
- La warm cache conserva al massimo 9 chunk per default. Namespace include
  origine WGS84, cell size, identificatore provider/dataset, profilo query,
  coordinate-model e schema; la versione compiler resta nella chiave.
  Non modificare featureId o id dei chunk per nascondere namespace interni.
- Per questa tranche restano celle di 300 m, compatibili col clipping V0.
  Il punto iniziale (0,0) e' un incrocio di quattro celle: la prima area
  giocabile richiede uno spawn la cui sagoma stia nelle celle gia' applicate.
- Snapshot diagnostico in sola lettura: generazione, id wanted/pending/active/
  pinned, errori per chunk, conteggi di record e warm cache. Niente dati
  sensibili, log incontrollati o oggetti Pixi/Rapier esposti.

### C-SESSION: avvio e movimento (ONLINE-09..12,15)

- Stati utente distinti: loading, ready, degraded, empty, error. Un'area
  senza strade percorribili non avvia un'auto in un mondo apparentemente pronto.
- La sessione applica ogni chunk a renderer e fisica prima del passo successivo,
  con rollback del cambiamento se un adapter fallisce. Solo dopo parte il gioco
  o si allarga la zona percorribile. Non attendere tutti i neighbor per avviare.
- Riprova termina la vecchia sessione prima di crearne una nuova; un solo loop
  RAF e un solo insieme di listener. Cancel/revoca interrompono anche la rete.
- Lo spawn sceglie una strada con spazio libero, sagoma interamente disponibile
  e ordinamento deterministico dei candidati. Non sintetizzare strade/dati
  per nascondere un fallimento del provider.
- Streaming: rivalutare domanda su cambio cella, direzione o camera; coalescere
  a massimo 5 aggiornamenti al secondo. Non fare fetch da ogni frame. Nessun
  retrigger automatico di failure a ogni rivalutazione invariata.
- La disponibilita' viene verificata a ogni passo fisico: l'auto non entra in
  celle non ancora applicate. Usare la sagoma e un margine conservativo, non
  solo il centro. Devono restare possibili sterzata/retromarcia verso spazio
  disponibile; non accumulare debito temporale mentre il movimento e' fermo.
- Il default `/` resta offline; nessun geocoding, geolocalizzazione automatica
  o rete live prima dell'azione di consenso. UI operativa piccola sopra il gioco,
  non landing page. Attribuzione OSM sempre visibile.

## Verifiche comuni

Per ogni modifica applicativa: comando focalizzato della scheda,
`npm run typecheck`, `npm run test:run`, `npm run build`, `git diff --check`
e `git status --short`. Eseguire E2E quando cambiano bootstrap, renderer,
fisica integrata o flusso utente. Non c'e' uno script lint: registrare N/A,
senza inventarlo o introdurre un toolchain change in questa tranche.

I test devono essere offline e deterministici: intercettare tutte le richieste
live del contesto Playwright, fallire su un host remoto inatteso, usare fixture
committate o sintetiche. Non scaricare una nuova mappa a ogni esecuzione.
I mock Fetch usano Headers realistici e status/body coerenti. Le fixture di
streaming devono contenere una strada continua per almeno 1 km con featureId
stabili, non uno stesso chunk traslato arbitrariamente a ogni richiesta.

Per HTTP generico usare negli E2E l'endpoint locale della stessa origine
`/__test-geo`, intercettato dal test. Questo evita di dipendere da un host
fittizio che ONLINE-15 dovra' giustamente rifiutare nella policy di produzione.
L'eccezione locale e' di development trusted, mai un parametro URL che
disabilita la allowlist.

Per i test browser usare condizioni osservabili e `expect.poll`, non sleep
arbitrari. I contatori diagnostici aiutano, ma non sostituiscono geometria
visibile, spostamento e collisioni. Baseline unit 89/E2E 3 non significa
copertura sufficiente. I nuovi test includono esplicitamente `provider=osm`.

La porta 5173 puo' ospitare un'altra app. Verificare titolo e origine prima
del riuso. Se occupata, scegliere una porta libera e un config Playwright
temporaneo che imposti baseURL e webServer coerentemente; non dipendere dal
file `/tmp` dell'analisi e non arrestare processi estranei. ONLINE-16 rende
questo override ripetibile nella configurazione del progetto.

Screenshot/trace/build/cache sono artefatti runtime: conservarli fuori dai
file committati. Per rendering/UI verificare almeno desktop 1280x720 e resize
a 390x844; non si richiede in questa tranche un nuovo sistema touch mobile.
Per un check live pubblico opzionale usare richieste limitate, non ruotare
mirror per aggirare rifiuti e riportare separatamente i risultati dalla CI.
