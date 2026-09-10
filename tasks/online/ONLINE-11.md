# ONLINE-11: Impedire l'ingresso in aree non disponibili

**Stato:** completato. Log: `tasks/executions/2026-09-10-ONLINE-11.md`.
**Dipendenze:** ONLINE-05, ONLINE-09.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, 4 file di codice/test.
**Finding:** requisito di sicurezza funzionale per F3.

## Obiettivo

Un passo fisico non deve portare la sagoma dell'auto in una cella che non ha
ancora geometria e collisioni applicate. La verifica deve funzionare ai
bordi, agli angoli e dopo una spinta da collisione, senza ricopiare il motore
di guida nel runtime. L'attivazione nel loop avverra' in ONLINE-12.

## READ

- Letture comuni, C-RESOURCES/C-SESSION e log ONLINE-05/09.
- `src/world/chunk/availability.ts` e `src/world/chunk/availability.test.ts` introdotti in ONLINE-09.
- `src/world/chunk/grid.ts`, `src/world/model/types.ts`.
- `src/gameplay/vehicle/shape.ts`, `src/gameplay/vehicle/controller.ts`.
- `src/physics/rapier/adapter.ts`, `src/physics/rapier/adapter.test.ts`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: `src/world/chunk/availability.ts` e `src/world/chunk/availability.test.ts`
(funzioni pure introdotte in ONLINE-09), adapter e test. Non cambiare network, renderer,
bootstrap, accelerazioni o formula del controller. Non introdurre teletrasporto
pubblico o controlli test-only nella UI.

## Esecuzione TDD

1. Estendere le funzioni pure di ONLINE-09 alla verifica del movimento e della
   copertura da insieme ACTIVE. Testare coordinate negative, margine di 0,25 m, diagonali,
   rotazioni, bordo condiviso, quattro celle all'origine e un "buco" nel set.
   Un AABB conservativo e' accettabile; i soli quattro vertici/il centro non
   bastano a dimostrare copertura se c'e' una cella interna assente.
2. Aggiungere una guardia opzionale al passo dell'adapter, compatibile con
   i caller V0. Verificare la pose proposta e quella effettiva dopo Rapier:
   una collisione puo' spingere l'auto oltre il previsto. Se la pose finale
   e' invalida, ripristinare l'ultima pose valida e annullare la velocita'
   che la porterebbe nel vuoto; nessuna penetrazione resta tra due frame.
3. Non sospendere l'intero clock della simulazione o accumulare dt da recuperare.
   Quando il vicino diventa ACTIVE, lo stesso input deve consentire il passo.
   Un input di retromarcia verso la zona disponibile continua a funzionare;
   nessuno stato di blocco resta agganciato dopo che la causa scompare.
4. Rendere leggibile alla sessione l'esito "bloccato da area indisponibile"
   senza esportare oggetti Rapier. Testare timestep fisso, piena velocita'
   attuale e correzione di posizione dopo urto, non solo chiamate a un mock.

## Accettazione

- [x] AC1: la sagoma, incluso margine, resta nell'unione delle celle ACTIVE
  in casi di bordo, angolo, buco interno e spinta da collisione.
- [x] AC2: guardia disabilitata conserva V0; guardia abilitata permette ritorno
  verso spazio pronto e sblocca il movimento quando arriva il vicino.
- [x] AC3: nessun debito temporale o velocita' accumulata durante il blocco;
  funzioni di disponibilita' indipendenti da Rapier/Pixi e sagoma centralizzata.

## Verifica

`npm run test:run -- src/world/chunk/availability.test.ts src/physics/rapier/adapter.test.ts src/app/fixed-step.test.ts`

Gate comune. Simulare centinaia di step con Rapier reale e leggere la pose
effettiva dopo ciascuno. Il contenimento non deve basarsi solo su un warning UI.

## Handoff

Riportare API della guardia, come ottenere pinned keys ed esito di blocco,
e come cambia la lista ACTIVE. ONLINE-12 deve usarla a ogni step, non solo
quando viene rivalutata la domanda di streaming.
