# ADR-014: Location Visual Profiles — identita' visiva locale risolta a runtime

Data: 2026-09-21.
Stato: Accepted for prototype.
Contesto: [spec](../specs/OPEN-GTA-LOCATION-VISUAL-PROFILES-V1.md),
tranche ZP (luogo corrente, reverse geocoding) e tranche WD (palette GTA
hardcodata nel renderer).

## Decisione

L'identita' visiva locale e' risolta a runtime dal `LocationContext`
(reverse geocoding strutturato, provider-neutral) e consegnata al renderer
come `VisualProfile` completo e provider-neutral; i temi sono dati
locali/statici TypeScript in v1 (registry chiusa, nessun servizio remoto,
nessun dynamic import da input utente).

- Il renderer non fa reverse geocoding e non conosce citta', paesi o
  endpoint: riceve un profilo gia' risolto (`setVisualProfile`) e interroga
  solo helper puri (`groundFill`, `roadStyle`, `buildingStyle`).
- `CompiledChunkV0` non contiene alcun `themeId`: lo stesso chunk resta
  presentabile con ogni profilo senza ricompilazione. Il cambio tema e'
  solo-presentazione: rebuild delle presentazioni dei chunk gia' caricati,
  senza refetch, senza fisica, senza camera/zoom, senza rete.
- La variante visiva degli edifici e' deterministica:
  `stableStringHash(featureId + ":" + profile.id)` (FNV-1a 32-bit);
  nessun `Math.random()` per lo styling persistente.
- Fallback deterministico: nessun contesto o errore geocoder → `default` o
  ultimo profilo valido mantenuto; il gioco non si ferma mai per il
  geocoder.

## Alternative considerate

| Opzione | Vantaggio | Limite / decisione |
| --- | --- | --- |
| Palette per citta' hardcodate nel renderer | Immediato | Il renderer si accoppia alla geografia (`if (city === "Rome")`); non estendibile; rifiutata |
| Servizio remoto dei temi (manifest versionato) | Gestione centralizzata | Nuova superficie di sicurezza/disponibilita'; v1 richiede solo dati locali; rimandata dopo validazione di piu' citta' |
| Tema dentro `CompiledChunkV0` | Nessuna risoluzione runtime | Il chunk non e' piu' riutilizzabile tra temi; viola il criterio "stesso chunk, identita' diverse"; rifiutata |
| Identita' visiva da tag OSM per feature | Fedelta' reale | Dati non presenti nelle tile correnti; out of scope v1; follow-up |

## Conseguenze

- Nuovo modulo `src/render/theme/` (types, hash, merge, resolver, override,
  profiles) e `src/app/location-context.ts`; il reverse geocoding restituisce
  l'address strutturato (`addressdetails=1`) e `PlaceTracker` espone
  `location()` oltre a `place()`.
- Limitazione nota v1: il `featureId` MVT incorpora un indice
  per-assemblea, quindi un edificio che rientra in una nuova finestra di
  streaming potra' presentare una variante di palette diversa tra sessioni.
  La spec (sez. 15.2) prescrive di documentare il finding, usare
  `featureId` in v1 e aprire il follow-up per una stable visual identity
  provider-neutral.
- Le fake facades restano tematizzate tramite campi transitori
  (`facadePalette`, `typeStyles[].facade`), da deprecare quando OpenGTA 2D+
  rimuovera' il fake depth.

## Riferimenti

- Spec: `docs/specs/OPEN-GTA-LOCATION-VISUAL-PROFILES-V1.md`.
- Precedenti: ADR-013 (presentazione top-down), ADR-012 (live online by
  default), tranche ZP (luogo corrente nella barra di stato).
