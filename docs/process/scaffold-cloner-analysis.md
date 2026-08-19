# OpenGTA Web — Analisi dello scaffold AI-SDLC esistente

**Stato:** contesto di repository confermato dal cloner fornito  
**Data:** 2026-08-19

## 1. Perché questo documento esiste

OpenGTA Web non nasce da un repository vuoto.

Il progetto viene creato clonando un template AI-SDLC e rimuovendo dal clone
solo alcune parti considerate interne al template.

Questa origine deve essere rispettata: il nuovo piano OpenGTA deve sovrapporsi
all'infrastruttura agentica esistente, non sostituirla.

## 2. Flusso effettivo del cloner

Lo script:

1. individua, quando possibile, il remote `origin` del repository template;
2. esegue un clone shallow della branch `opcl`;
3. rimuove una lista esplicita di percorsi template-only;
4. elimina completamente la `.git` clonata;
5. inizializza un nuovo repository Git sulla branch `main`;
6. aggiunge tutti i file rimasti;
7. crea un nuovo initial commit.

Flusso:

```text
template branch opcl
        ↓ shallow clone depth=1
progetto temporaneo
        ↓ rimozione TEMPLATE_ONLY_PATHS
progetto applicativo
        ↓ delete .git
nuovo git init -b main
        ↓
initial commit
```

## 3. Percorsi rimossi dal cloner

La lista fornita rimuove:

```text
.opencode/evals
.opencode/guide
.opencode/hooks
.opencode/plans
.opencode/linkToClaude.txt
codesync
docs
prj-context-extract.py
clona-ai-sdlc-template.py
```

Conseguenza importante:

> `docs/` del template viene completamente eliminata prima della creazione del
> repository applicativo.

Per questo è corretto che OpenGTA costruisca successivamente una propria
struttura `docs/`.

## 4. Infrastruttura agentica preservata

La funzione di pulizia rimuove solo i percorsi elencati.

In particolare, dalla lista fornita **non risultano rimossi**:

```text
.opencode/agents
.opencode/skills
AGENTS.md
CODING-STANDARDS.md
SECURITY.md
README.md
LICENSE
```

Pertanto la strategia OpenGTA deve trattare questi elementi come
infrastruttura già esistente da preservare.

Il `AGENTS.md` fornito dall'attuale progetto è coerente con questa struttura:
rimanda infatti a `.opencode/agents/AGENTS.md` e `.opencode/skills/`.

## 5. Conseguenza per il nostro pack

Il planning pack deve essere un **overlay**.

Non deve:

- sostituire `.opencode/`;
- ricreare skill già presenti;
- imporre un secondo sistema di agent routing;
- cancellare standard o policy del template.

Le regole specifiche di architettura OpenGTA vivono sotto:

```text
docs/codex/
docs/architecture/
docs/adr/
docs/execution/
```

e completano il `AGENTS.md` esistente.

## 6. Git

Il cloner elimina la `.git` del template e crea un nuovo repository.

Conseguenze:

- la storia del template non viene ereditata;
- il progetto parte con un proprio commit iniziale;
- il remote del template non viene automaticamente ricreato nel nuovo `.git`
  dallo script fornito;
- eventuale remote applicativo deve essere configurato separatamente se
  necessario.

## 7. Identità Git

Lo script imposta localmente:

```text
user.name  = Developer
user.email = dev@example.com
```

prima dell'initial commit.

È una scelta operativa del cloner, non una regola OpenGTA.

Se il repository viene pubblicato, il maintainer può sostituire questi valori
con la propria identità Git.

## 8. Stato applicativo conseguente

Dato il comportamento del cloner e lo stato del repository fornito, la
situazione corrente è coerente con:

```text
process/scaffold infrastructure
+ agent skills
+ policy files
+ OpenGTA documentation
- application source code
- package manifest
- build
- runtime dependencies
- executable tests
```

Quindi non serve una fase di reverse engineering del codice esistente.

La prossima attività utile è definire e poi introdurre uno scaffolding
applicativo minimo compatibile con il template.

## 9. Regola di integrazione

Quando Codex introduce lo stack applicativo deve:

1. leggere `AGENTS.md`;
2. leggere solo le skill `.opencode/` pertinenti;
3. leggere `CODING-STANDARDS.md`;
4. leggere `SECURITY.md`;
5. leggere la baseline OpenGTA;
6. aggiungere lo scaffold applicativo senza modificare il sistema agentico se
   non strettamente necessario.

## 10. Implicazione per futuri cloni

Se OpenGTA venisse ricreato in futuro rilanciando lo stesso cloner:

- i documenti OpenGTA presenti nel template sotto `docs/` verrebbero rimossi;
- quindi OpenGTA non deve dipendere dal fatto che i propri documenti siano
  conservati nel template originale;
- il pack o il repository OpenGTA deve restare la fonte applicativa di questi
  documenti.

Se in futuro si vuole generare OpenGTA completamente pronto dal template,
occorrerà modificare la strategia del cloner o introdurre un livello di
bootstrap applicativo separato. Non è necessario farlo per il V0.
