# Gate di consistenza documentale

**Stato:** attivo. Creato da SOLID-06 (2026-09-11).
**Quando:** prima di chiudere una milestone o una tranche, prima di una release
o di un'esposizione pubblica, e ogni volta che un documento dichiara lo stato
del repository.
**Durata target:** < 15 minuti (esecuzione completa ~12 min su repository caldo).
**Cosa NON è:** non sostituisce typecheck, suite deterministica, E2E, build né
un audit di sicurezza. Verifica solo che i documenti non descrivano superfici,
fasi o numeri diversi dal codice.

## Perché esiste

Il difetto che questo gate previene è la **deriva tra stato dichiarato e stato
reale**. Esempio storico: `SECURITY.md` affermava che il repository non
conteneva un'applicazione eseguibile mentre il runtime offline e lo streaming
live erano già in produzione di prototipo; il threat model descriveva Worker e
IndexedDB come superfici presenti, ma nel codice non esistevano.

Regola: un documento di stato può usare il futuro solo per superfici che nel
codice **non esistono**, e in quel caso deve nominare il trigger che le
introdurrà.

## Ambito

Documenti di stato (devono descrivere il presente):

```text
SECURITY.md, README.md, AGENTS.md, CODING-STANDARDS.md
docs/SPEC.md, docs/results/*.md, docs/specs/*.md, docs/architecture/*.md
docs/process/*.md, docs/legal/*.md, docs/handoff/CURRENT.md
tasks/plan.md, tasks/todo.md, tasks/city/*.md, tasks/online/*.md
```

Esclusi per costruzione: `docs/archive/`, `docs/execution/`, `docs/idea/`,
`docs/handoff/CODEX-*.md`, `tasks/archive/`, `tasks/executions/` (storici) e le
schede di task che citano una frase obsoleta come oggetto del lavoro da fare.

## Passo 1 — Baseline (1 min)

```bash
git rev-parse --short HEAD
git status --short
```

Annota commit e diff: un gate eseguito su un albero sporco vale solo per il
diff dichiarato. Se l'albero è sporco per lavoro concorrente di altre schede,
elenca i path che non appartengono al task sotto gate e verifica che il suo
diff tocchi solo i file consentiti dalla scheda. Registra l'esito in
`tasks/executions/YYYY-MM-DD-<ID>.md` (template `tasks/online/EXECUTION-TEMPLATE.md`).

## Passo 2 — Frasi di stato obsolete (3 min)

```bash
grep -rInE \
  --exclude=documentation-consistency-gate.md \
  "non contiene ancora|prima del primo prototipo|non esiste codice|quando verrà scelto|verrà introdotto l'hosting|non ancora eseguibile" \
  SECURITY.md README.md AGENTS.md CODING-STANDARDS.md docs tasks/plan.md tasks/todo.md tasks/city tasks/online
```

`documentation-consistency-gate.md` è escluso perché contiene i pattern stessi
e si auto-segnalerebbe.

Atteso: **nessuna riga**. Ogni riga è un difetto da correggere prima di chiudere
la milestone: la frase va rimossa o riscritta al presente con il riferimento
alla superficie reale. Le occorrenze in schede di task (`tasks/city/*.md`) che
descrivono un difetto da correggere sono legittime.

## Passo 3 — Superfici rivendicate vs codice (3 min)

Per ogni superficie che un documento cita al presente, il codice deve
contenerla. Le superfici seguenti non esistono oggi: un hit in `src/` significa
che la documentazione va aggiornata (o che il codice è cambiato e la scheda va
riaperta).

```bash
for surface in "new Worker" "indexedDB" "localStorage" "Content-Security-Policy" "navigator.sendBeacon" "telemetry"; do
  printf '%-28s %s file\n' "$surface" "$(grep -rIl --include='*.ts' --include='*.html' -- "$surface" src index.html vite.config.ts 2>/dev/null | wc -l)"
done
```

Atteso oggi: **0 file per ogni voce**. Quando una voce diventa diversa da zero,
`SECURITY.md` deve spostarla da "Superfici future" ai presidi presenti, e la
scheda del task che l'ha introdotta deve dichiararne i controlli.

Controllo inverso — i file citati nei presidi devono esistere:

```bash
for path in src/world/runtime/live-config.ts src/world/runtime/source.ts src/world/runtime/response-reader.ts \
  src/world/runtime/request-scheduler.ts src/geo/normalize/osm.ts src/world/chunk/cache.ts \
  src/world/chunk/lifecycle.ts src/render/pixi/renderer.ts src/physics/rapier/adapter.ts \
  src/app/bootstrap.ts src/app/runtime-session.ts; do
  [ -e "$path" ] || echo "FILE CITATO MANCANTE: $path"
done
```

## Passo 4 — Link interni risolti (2 min)

```bash
git ls-files '*.md' | grep -vE '^(docs|tasks)/archive/' | while IFS= read -r file; do
  dir=$(dirname "$file")
  awk '/^```/{fence=!fence; next} !fence' "$file" | grep -oE '\]\([^)]+\)' | sed -E 's/^\]\(//; s/\)$//' |
  while IFS= read -r link; do
    case "$link" in http*|mailto:*|"#"*) continue;; esac
    target="${link%%#*}"; [ -z "$target" ] && continue
    [ -e "$dir/$target" ] || echo "LINK ROTTO: $file -> $link"
  done
done
```

Atteso: nessun link rotto nei documenti correnti. Al 2026-09-11 l'unico residuo
noto è `docs/SPEC.md` → `../results/ONLINE-RUNTIME-RESULT.md` (fuori dal
perimetro di SOLID-06, da correggere con il prossimo tocco a `docs/SPEC.md`).
I documenti in `docs/archive/` e `tasks/archive/` sono esclusi: descrivono
stato passato e non vengono mantenuti.

## Passo 5 — Claim numerici e citazioni (2 min)

Ogni numero o SHA citato in un documento di stato deve essere ricontrollabile:

- SHA della baseline: `git log --oneline -5` e confronto con `README.md` e
  `docs/results/ONLINE-RUNTIME-RESULT.md`;
- conteggi test, E2E e esiti del gate: confronto con la sezione "Verifiche" del
  log di consegna o del result della tranche;
- endpoint, porte e variabili d'ambiente: confronto con
  `src/world/runtime/source.ts` (`DEFAULT_OVERPASS_ENDPOINT`),
  `src/world/runtime/live-config.ts` (`DEFAULT_ENDPOINT_POLICY`) e
  `playwright.config.ts` (`OPENGTA_E2E_PORT`).

Un numero non ricontrollabile va rimosso o accompagnato dal riferimento
all'evidenza.

## Passo 6 — Registrazione ed escalation (1 min)

- Registra l'esito (comandi eseguiti, hit trovati, correzioni) nel log di
  consegna della milestone; per una tranche, nella sezione "Verifiche" del
  result.
- **Nessuna milestone si chiude con un disallineamento aperto.** Se la
  correzione esce dal perimetro del task corrente, apri una scheda di follow-up
  in `tasks/` e citala nel log; il gate successivo la ritrova.
- Se il codice contraddice il documento su un confine di sicurezza (endpoint,
  storage, worker, telemetria), la correzione del documento non è sufficiente:
  serve una voce nella sezione "Verifiche di milestone" di `SECURITY.md`.

## Uso nelle milestone

- **SOLID/CITY**: esecuzione a chiusura della tranche, prima di marcare le
  checkbox in `tasks/plan.md` e `tasks/todo.md`.
- **CITY-02** (gate "City Drive Stable"): riesegue il gate insieme alle
  verifiche funzionali; l'esito è parte della definition of done.
- **CITY-01** (canary live): il canary rispetta i confini dichiarati in
  `SECURITY.md` (endpoint in allowlist, sorgente pinnata, nessuna rotazione di
  mirror) e non introduce nuove superfici senza aggiornare il documento.

## Limiti

- Il gate trova solo ciò che è cercabile: frasi chiave, percorsi, pattern. Un
  claim ambiguo può richiedere lettura manuale; in caso di dubbio vale la
  lettura.
- Non verifica la correttezza tecnica del codice, solo la corrispondenza tra
  documenti e superfici dichiarate.
- Le esclusioni (archivi, log storici) sono intenzionali: se un documento
  storico viene promosso a documento di stato, va prima riallineato o spostato.
