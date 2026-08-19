# Security Policy

## Segnalazione delle vulnerabilità

Non aprire issue pubbliche per vulnerabilità. Usa un canale privato del progetto
quando verrà definito; fino ad allora non pubblicare dettagli sfruttabili o dati
sensibili nel repository.

## Stato e modello di minaccia iniziale

Il repository non contiene ancora un'applicazione eseguibile. I controlli
concreti verranno aggiunti insieme alle prime superfici runtime, ma i confini di
fiducia sono già identificati:

- nomi di città, coordinate e input inseriti dall'utente;
- risposte, geometrie e metadati provenienti da OpenStreetMap o altri servizi;
- messaggi tra main thread, worker e cache browser;
- texture, modelli e asset importati o generati offline;
- dipendenze e script della supply chain;
- messaggi inviati da client multiplayer non attendibili, quando esisteranno.

Gli asset da proteggere includono disponibilità del client e dei servizi,
integrità della simulazione, credenziali di deployment, privacy degli utenti e
rispetto delle quote e delle policy dei provider esterni.

## Requisiti obbligatori

### Input e dati geospaziali

- Valida coordinate, stringhe di ricerca, tag, dimensioni delle risposte e
  complessità delle geometrie prima dell'elaborazione.
- Imposta limiti a vertici, relazioni, profondità, payload e tempo di calcolo per
  evitare blocchi o esaurimento della memoria con dati patologici.
- Considera non attendibili anche i messaggi ricevuti da un Web Worker; valida
  i contratti su entrambi i lati del confine.
- Non inserire testo esterno nel DOM tramite `innerHTML` e non eseguire dati con
  `eval` o costruttori equivalenti.

### Servizi esterni

- Usa HTTPS e una allowlist esplicita degli endpoint contattabili.
- Applica timeout, cancellazione, backoff e limiti di concorrenza alle
  richieste.
- Rispetta policy d'uso, quote e attribuzione dei provider; non ruotare mirror
  per aggirare intenzionalmente i rate limit.
- Se in futuro un server recupererà URL influenzati dall'utente, limita schema e
  host e blocca indirizzi privati o riservati per prevenire SSRF.
- Non includere chiavi private nel client browser.

### Browser e cache

- Definisci una Content Security Policy restrittiva per script, worker, asset e
  connessioni di rete quando verrà introdotto l'hosting.
- Valida versione, origine e integrità dei dati letti da IndexedDB.
- Imposta quote, eviction e invalidazione della cache; una risposta esterna non
  deve poter causare crescita illimitata dello storage.
- Non conservare token di autenticazione accessibili a JavaScript in
  `localStorage` o IndexedDB.

### Multiplayer futuro

- Considera ogni client ostile e valida frequenza, forma e intervalli di tutti
  gli input.
- Il client non deve essere autorità per stato condiviso, collisioni decisive,
  inventario o altre regole sfruttabili.
- Applica autenticazione, autorizzazione, rate limiting e limiti di interesse
  spaziale sul server.
- Non fidarti di posizioni o risultati fisici calcolati esclusivamente dal
  client senza una strategia esplicita di verifica.

### Asset e AI offline

- Registra provenienza, modello, licenza e termini d'uso degli asset generati.
- Tratta file, metadati e output dei generatori come input non attendibili;
  valida formato e dimensione prima di inserirli nella pipeline.
- Non includere prompt contenenti segreti o dati personali.
- Il runtime non deve dipendere da credenziali AI incorporate nel client.

### Segreti e supply chain

- Non committare `.env`, chiavi, token, certificati privati o credenziali.
- Usa variabili d'ambiente o un secret manager per la configurazione sensibile.
- Quando verrà scelto il package manager, commetti un unico lockfile e usa
  installazioni riproducibili con script di dipendenza bloccati finché non
  vengono revisionati.
- Revisiona proprietà, manutenzione, licenza, provenienza e grafo transitivo di
  ogni nuova dipendenza.
- Non applicare automaticamente correzioni forzate degli audit di sicurezza.

## Verifiche per fase

Prima del primo prototipo eseguibile:

- documentare dataset e hardware di riferimento;
- limitare input e payload esterni;
- definire CSP e destinazioni di rete ammesse;
- verificare che nessun segreto sia presente nel bundle o nel repository;
- eseguire l'audit nativo del package manager scelto sul lockfile committato.

Prima di introdurre il multiplayer, aggiornare il threat model con abuso del
protocollo, cheating, denial of service, autenticazione, privacy e logging degli
eventi di sicurezza.
