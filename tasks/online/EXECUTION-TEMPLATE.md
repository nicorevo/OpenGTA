# Template di consegna ONLINE-NN

Creare `tasks/executions/YYYY-MM-DD-ONLINE-NN.md` usando questa struttura.
Sostituire i placeholder; non marcare complete verifiche non eseguite.

```markdown
# ONLINE-NN: Titolo

Data:
Stato: completato | parziale | bloccato
Commit di partenza:
Dipendenze verificate:

## Risultato

Comportamento osservabile ottenuto e limiti ancora presenti.

## TDD

Test scritto per primo, comando, fallimento osservato e causa;
poi comando e risultato dopo il fix. Se il problema era gia' risolto,
indicare il test esistente che lo dimostra, senza fingere una fase rossa.

## Modifiche

File cambiati e motivo. Firme API finali, ownership, cancellazione,
codici errore e compatibilita' rilevanti per il task successivo.

## Accettazione

- [ ] AC1: prova precisa.
- [ ] AC2: prova precisa.
- [ ] AC3: prova precisa.

## Verifiche

| Comando/check | Esito | Note |
| --- | --- | --- |
| Test focalizzati | | |
| typecheck | | |
| suite completa | | |
| build | | |
| E2E / browser | | |
| lint | N/A se assente | |
| diff/check/status | | |

## Handoff

Task successivo sbloccato, API da usare, debiti tecnici residui e scostamenti
dal piano. Per misure: fixture, ambiente e metodo. Per un blocco: evidenza e
informazione concreta mancante, non un generico bisogno di chiarimento.

## Commit

Commit atomici del lavoro, oppure motivo per cui non e' stato creato un commit.
Niente credenziali, raw dump live, trace o snapshot nel commit.
```
