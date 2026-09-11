# ZOOM-03: Controlli zoom +/−

**Stato:** pianificato.
**Dipendenze:** ZOOM-02.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Pulsanti `[-] [+]` sopra il canvas (overlay compatto, stile dei controlli
live esistenti) con `aria-label`, focus visibile, stato disabilitato ai
limiti; scorciatoie `+`/`-`. I pulsanti non devono intrappolare i tasti di
guida: dopo il click il focus torna al gioco (blur dell'elemento attivo,
stesso pattern del pannello live). Accessibili da mouse, tastiera e touch.

## READ

- `src/app/bootstrap.ts` (keydown/legend), `src/app/live-controls.ts`
  (pattern UI), `src/app/camera.ts`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: bootstrap (nuovo mini-modulo `src/app/zoom-controls.ts` o
inline), test E2E. Non cambiare renderer, sessione o input di guida.

## Esecuzione TDD

1. Test E2E RED: click `+` cambia `zoomLevel` nello snapshot e il mondo
   cresce; click `-` al minimo non fa nulla e il pulsante e' disabilitato.
2. Implementare i controlli; test GREEN.
3. Verifica accessibilita': aria-label, focus, nessun page error; guida
   (W) funziona subito dopo il click.

## Accettazione

- [ ] AC1: + zoom in, - zoom out, limiti rispettati con stato disabilitato.
- [ ] AC2: guida continua dopo i click (nessun focus trap); tastiera +/−.
- [ ] AC3: responsive 1280x720/390x844; nessun page error; attribuzione e
  legenda restano visibili.

## Verifica

`npm run test:e2e -- tests/e2e/zoom.spec.ts` (nuovo) + gate comune.

## Handoff

ZOOM-04 osserva la reazione dello streaming ai click; LOD-03 usa il livello
per la facade.
