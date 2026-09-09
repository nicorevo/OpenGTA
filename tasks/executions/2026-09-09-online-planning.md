# Pianificazione del ripristino online

Data: 2026-09-09.
Stato: pianificazione completata; implementazione ONLINE-01..16 non avviata.
Baseline esaminata: `4ad9836`; analisi del 2026-09-08.

## Consegna

- Piano corrente e checklist con 16 task, dipendenze e sei checkpoint.
- Una scheda per task con obiettivo, persona, complessita', READ, MAY MODIFY,
  DO NOT TOUCH, passi TDD, tre criteri di accettazione e comandi di verifica.
- README comune con contratti pianificati, procedura di esecuzione e prompt
  di assegnazione per un modello senza la conversazione originale.
- Template del log di consegna e quattro filoni differiti con condizioni di
  apertura: produzione, prestazioni, cache persistente e pacchetti precompilati.
- SPEC, handoff e indice tasks riallineati al lavoro pianificato.
- Piano e checklist precedenti preservati integralmente in `tasks/archive/`.

## Verifiche della documentazione

Un controllo Node in sola lettura ha verificato:

- 16 schede e 48 criteri di accettazione espliciti.
- 38 dipendenze, tutte esistenti e compatibili con l'ordine numerico, senza cicli.
- Corrispondenza delle dipendenze/taglie fra piano e schede e presenza in todo.
- Letture di file futuri collegate a un task produttore fra i prerequisiti.
- 63 link locali risolti in 24 documenti, fence chiusi e assenza di whitespace
  finale o caratteri non ASCII nelle nuove schede.
- Copie archiviate byte-per-byte identiche ai precedenti file in HEAD.

`git diff --check`: passato. `git status --short`: esaminato.
Nessuna sorgente, dipendenza o configurazione runtime modificata; le suite
applicative non sono state rieseguite per questa attivita' di soli Markdown.
I risultati dell'analisi restano baseline storica, non verifiche dei task futuri.

## Handoff

Primo task nell'ordine previsto: `tasks/online/ONLINE-01.md`, preceduto dalla
lettura di `tasks/online/README.md`. Nessuna checkbox ONLINE e' marcata completa.
I file estranei `.serena/` e `resume.txt` sono rimasti invariati.
Non sono stati creati commit, merge o deploy in questa attivita'.
