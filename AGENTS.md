# Istruzioni per gli agenti

OpenGTA Web è nella fase di definizione e revisione tecnica. Il progetto usa le
skill e le persone definite in `.opencode/`; questo file contiene soltanto il
contesto e i vincoli che un agente deve conoscere sempre.

## Regole operative

- Leggi le istruzioni pertinenti prima di modificare il codice.
- Prima di lavorare sul prodotto, leggi `docs/intent/open-gta-web.md`; consulta
  la bozza city-scale solo per le decisioni tecniche pertinenti al task.
- Tratta stack, librerie e valori numerici proposti nella bozza come ipotesi,
  non come decisioni accettate.
- Mantieni il primo prototipo limitato a una zona prefissata, browser desktop,
  guida, collisioni e prestazioni misurabili su un PC di fascia media.
- Attiva solo le skill necessarie all'intento e alla superficie modificata.
- Per nuove feature chiarisci l'obiettivo, pianifica fette verificabili e usa
  TDD quando viene modificato il comportamento.
- Verifica il comportamento con i test e i comandi nativi del progetto prima
  di dichiarare completato un lavoro.
- Mantieni le modifiche focalizzate e non introdurre dipendenze o architetture
  non richieste.
- Non inserire segreti nel repository e tratta i dati provenienti da utenti,
  file, API e agenti come non attendibili ai confini del sistema.

## Routing delle skill

Per la mappatura tra intento, agente e skill consulta
`.opencode/agents/AGENTS.md`. Le skill dettagliate si trovano in
`.opencode/skills/` e vanno caricate on demand, non tutte insieme.

## Convenzioni del progetto

- Contesto prodotto confermato: `docs/intent/open-gta-web.md`.
- Bozza tecnica da revisionare: `docs/idea/OpenGTA Web City Scale Idea.md`.
- Nessun comando applicativo è ancora disponibile; documenta test, lint, build
  e avvio qui e nel `README.md` quando verrà introdotto lo scaffolding.
- Convenzioni generali: `CODING-STANDARDS.md`.
- Requisiti di sicurezza: `SECURITY.md`.

## Criteri di verifica

- Esegui la suite pertinente alle modifiche.
- Esegui lint e type-check quando previsti dallo stack.
- Controlla `git diff` e `git status --short`.
- Non includere cache, snapshot, credenziali o altri artefatti runtime.
