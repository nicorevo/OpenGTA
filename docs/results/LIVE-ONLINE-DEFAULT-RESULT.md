# Risultato: Live online di default (MVT pinnata, consenso implicito)

Data: 2026-09-17. Stato: consegnato.
Baseline di partenza: `4142db4`. Commit finale della tranche: `9e72120`.
Piano: `tasks/plan.md`. Checklist: `tasks/todo.md`. ADR: ADR-012
(supersede ADR-009).

## Esito

La modalità live è attiva di default al load: l'app avvia subito una sessione
con la sorgente vettoriale OpenFreeMap (MVT) pinnata a un dataset versionato.
L'endpoint è una costante di compile-time (mai input utente), il consenso è
implicito (casella fissa, non revocabile) e l'unico dato inviato al provider è
l'origine della mappa. L'opt-out dalla rete è la scelta esplicita della
modalità offline. I provider opt-in `osm`/`http` restano subordinati
all'allowlist di endpoint.

## Matrice requisiti → prove

| Requisito | Prova |
| --- | --- |
| Online di default al load | `live-config.ts`: `readRuntimeConfig` senza `consent` ritorna online su MVT pinnata; E2E `live-startup` / `bootstrap` (il percorso offline richiede esplicitamente `?mode=offline`) |
| Sorgente MVT pinnata, mai input utente | `live-config.ts`: provider/endpoint fissi; `live-controls.ts`: nessun campo provider/endpoint nel form; ADR-012 |
| Consenso implicito, non revocabile | `live-controls.ts`: `consent.checked=true; consent.disabled=true`, nessuna `stop(revoked)`; `bootstrap.ts`: `stopCurrent()` senza parametro `revoked` |
| Opt-out offline senza rete | `live-controls.ts`: selezione "Offline"; E2E `live-config` / `persistent-cache` (offline = 0 richieste provider) |
| Provider opt-in in allowlist | `live-config.ts` (`EndpointPolicy`); `SECURITY.md` (righe endpoint e consenso aggiornate) |
| Coerenza documentale | `SECURITY.md`, `README.md`, ADR-012 creati, ADR-009 marcato superseded |

## Limiti dichiarati

- Il provider MVT resta quello pinnato: nessuna rotazione di mirror.
- I provider `osm`/`http` opt-in richiedono l'allowlist di endpoint; nel build
  di produzione l'eccezione dev (origine locale con path `/__test-geo`) non è
  abilitata.

## Verifiche finali

- `npm run typecheck`: PASS.
- `npx vitest run`: PASS — 56 file, 415 test.
- `npm run build`: PASS (warning dimensione bundle preesistente).
- `npm run test:e2e`: 25 PASS, 1 skipped (canary).
- Gate di consistenza documentale: vedi log di consegna.
