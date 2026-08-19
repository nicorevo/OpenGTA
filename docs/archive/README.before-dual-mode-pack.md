# OpenGTA Web

OpenGTA Web è un motore e una sandbox geospaziale browser-first: trasforma
una zona urbana reale, descritta da dati OpenStreetMap, in un ambiente 3D
top-down riconoscibile, esplorabile e guidabile.

Il progetto punta a rendere giocabile una città senza costruirne manualmente la
mappa. Il primo risultato sarà una validazione tecnica della guida e della
generazione urbana, non un gioco completo in stile GTA.

## Stato del progetto

Il repository è nella fase di definizione e revisione tecnica. Contiene la
baseline di prodotto, una bozza architetturale da valutare e l'infrastruttura di
processo per lo sviluppo assistito da agenti. Non contiene ancora codice
applicativo, dipendenze, build o test eseguibili.

Le tecnologie citate nella bozza, tra cui Three.js, Rapier, Overpass, Nominatim
e le alternative di networking, sono candidate: non sono decisioni
architetturali accettate.

## Prima validazione

Il primo prototipo deve verificare un unico percorso verticale:

1. caricare una zona urbana prefissata da dati OpenStreetMap;
2. convertirla in una scena top-down riconoscibile;
3. consentire la guida di un veicolo;
4. gestire collisioni stabili con l'ambiente;
5. mantenere prestazioni fluide su un PC di fascia media, secondo metriche e
   hardware di riferimento ancora da definire.

Il progetto è pensato per una persona o un team molto piccolo e procederà per
incrementi verificabili, iniziando dal browser desktop.

## Evoluzioni previste

Questi elementi sono parte della visione, ma non della prima validazione:

- selezione arbitraria di città o coordinate;
- streaming e cache alla scala di un'intera città;
- texture regionali generate offline con AI;
- supporto mobile e controlli touch;
- multiplayer con prediction e reconciliation;
- pedoni, traffico e sistemi di gameplay completi.

Le evoluzioni future verranno considerate nella revisione architetturale senza
anticiparne l'implementazione.

## Documentazione

- [Intento confermato](docs/intent/open-gta-web.md): fonte corrente per
  obiettivo, vincoli, perimetro e ricostruzione del contesto.
- [Bozza city-scale](docs/idea/OpenGTA%20Web%20City%20Scale%20Idea.md): proposta
  tecnica da analizzare; i suoi valori e le sue tecnologie sono ipotesi.
- [Istruzioni per gli agenti](AGENTS.md): regole operative e routing delle
  skill.
- [Standard di codice](CODING-STANDARDS.md): convenzioni che valgono prima e
  dopo la scelta dello stack.
- [Sicurezza](SECURITY.md): confini di fiducia e requisiti minimi del progetto.

Le decisioni tecniche costose da invertire verranno registrate come ADR soltanto
dopo la valutazione delle alternative e delle conseguenze.

## Metodo di revisione tecnica

Ogni proposta della bozza riceverà uno dei seguenti giudizi:

- valida;
- valida con condizioni o misurazioni;
- da rinviare;
- da sostituire.

Per ogni scelta verranno indicati motivazione, rischi, alternative, dipendenze e
la prova minima necessaria per validarla.

## Comandi di sviluppo

Non sono ancora definiti: il repository non possiede uno stack applicativo o
un ambiente di test. Questa sezione e `AGENTS.md` dovranno essere aggiornati
nello stesso incremento che introdurrà lo scaffolding eseguibile.

## Licenza

Il codice del repository è distribuito con licenza [MIT](LICENSE). Licenze,
policy d'uso e obblighi di attribuzione relativi a dati, servizi e asset esterni
dovranno essere verificati separatamente prima di integrarli.
