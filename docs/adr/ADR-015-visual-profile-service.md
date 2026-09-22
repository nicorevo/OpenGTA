# ADR-015: Visual Profile Service — profili generati da evidenza geografica, a strati separati

Data: 2026-09-21.
Stato: Accepted for prototype.
Contesto: `Location Visual Profiles v1` (+ profilo `tokyo`) completato e
validato dal gate visuale utente (3 famiglie rome/paris/tokyo distinte,
commit `8b8d192`). Spec:
`docs/specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md`.

## Decisione

I `VisualProfile` OpenGTA possono essere generati dall'evidenza geografica
reale (OSM + street imagery) attraverso una pipeline provider-neutral a
quattro strati mai fusi:

```text
OBSERVE    → VisualEvidenceProfile (evidenze strutturate, vocabolario chiuso)
INTERPRET  → aggregazione pesata con confidence (0..1)
COMPILE    → ProfileCompiler: funzione pura evidence + catalog + parent → GeneratedVisualProfile
SERVE      → servizio: API, cache evidence/profile separate, fallback LVP
```

- Il vision/provider **osserva** (enum + confidence, mai testo libero, mai
  colori esadecimali). Il `VisualCatalog` **decide i colori veri**.
  OpenGTA **disegna** (spec sez. 3/47).
- Il core VPS (`src/vps/`: evidence, catalog, compiler) è TypeScript puro
  nel repository: nessuna DOM, nessuna rete, nessun provider, nessuna
  credenziale. Riutilizza i contratti LVP (`VisualProfile`,
  `mergeVisualProfile`, `stableStringHash`) senza modificarli.
- `GeneratedVisualProfile extends VisualProfile` con metadati di
  generazione deterministici (`cellId`, `evidenceRevision`,
  `compilerRevision`, `catalogRevision`, `confidence`). Il timestamp
  `generatedAt` NON è prodotto dal compiler puro (violerebbe il
  determinismo, spec sez. 116): lo aggiunge il servizio al write in cache;
  nell'hook offline di sviluppo assume il `retrievedAt` dell'evidence
  fixture.
- Il compiler traduce le famiglie pesate in palette concrete in modo
  deterministico: slot di palette assegnati per copertura cumulativa dei
  pesi, variante scelta con `stableStringHash(profileId + slot)`.
  Mai `Math.random()` (spec sez. 51).
- Confidence per categoria: `< 0.35` → il campo riprende il parent profile
  (mai inventare, spec sez. 68). Il blend 0.35–0.60 è rimandato post-MVP
  (spec sez. 70).
- `SpatialCell` è un contratto (`id`, `center`, `bounds`, `resolution`);
  l'implementazione (H3 o equivalente) non fa parte del contratto pubblico
  (spec sez. 10).
- Il `VisualCatalog` minimum (spec sez. 138) è semiato dall'esplosione dei
  6 profili LVP validati (rome/paris/tokyo/italy/france/default): le
  famiglie esistenti diventano i definitori di catalogo, così i profili
  generati partono coerenti con lo stile già passato al gate utente.
- Mapillary, vision analyzer e runtime API sono slice successive
  (VPS-05..10), solo dopo il gate offline del compiler. Credenziali
  server-side; il browser non parla mai ai provider (spec sez. 82-84).
- In questa slice di validazione esiste un hook di sviluppo
  `?vps=<fixture>` (stessa classe del `?theme=`): compila offline una
  evidence fixture con il catalogo default e il parent LVP risolto, e
  applica il profilo generato. Non è la runtime API.

## Alternative considerate

| Opzione | Vantaggio | Limite / decisione |
| --- | --- | --- |
| Vision che emette direttamente colori/asset | Veloce | Viola spec sez. 3/47/147: niente controllo artistico, niente determinismo; rifiutata |
| Backend-first: Mapillary API prima del compiler | Dati reali subito | Settimane di infrastruttura prima di validare il cuore (spec sez. 140/152); rifiutata per la slice iniziale |
| Logica VPS dentro il renderer | Nessun servizio | Accoppia rendering a provider/credenziali; viola spec sez. 82; rifiutata |
| Core VPS in un repository separato | Pulizia del monorepo | Duplica i contratti LVP e il toolchain; i contratti sono pure TS e riusabili in entrambi; rifiutata per v1 |
| Rigenerare il profilo a ogni richiesta | Sempre fresco | Viola cache/costo/determinismo (spec sez. 54/121); rifiutata |

## Conseguenze

- Nuovo modulo `src/vps/` (`evidence/`, `catalog/`, `compiler/`) accanto a
  `src/render/theme/`; `docs/results/VISUAL-PROFILE-SERVICE-V1-RESULT.md`
  con il gate di slice.
- In v1 i campi che l'evidence non copre ancora (`ground`, `typeStyles`,
  `outline`, `depth2d`) ereditano integralmente dal parent profile.
- Se il gate offline fallisce (città non distinte, output instabile),
  si degrada a "country/city profile recommender" senza scartare il
  progetto (spec sez. 110-111).

## Riferimenti

- Spec: `docs/specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md`.
- Precedenti: ADR-014 (Location Visual Profiles), gate utente
  `docs/results/LVP-VALIDATION-RESULT.md`,
  `docs/results/LOCATION-VISUAL-PROFILES-V1-RESULT.md`.
