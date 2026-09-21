# OpenGTA — Location Visual Profiles (LVP)
## Specifica completa per implementazione Codex

**Data:** 2026-09-21  
**Stato:** Proposed / Ready for implementation  
**Branch suggerito:** `feature/location-visual-profiles`  
**Obiettivo iniziale:** dimostrare che la stessa pipeline OpenGTA può assumere una forte identità locale automatica in base alla posizione geografica, senza modificare geometria, fisica o sorgente MVT.

---

# 0. Istruzione sintetica per Codex

Implementare un sistema **Location Visual Profiles** che:

1. ricavi da reverse geocoding un `LocationContext` strutturato;
2. risolva tale contesto in un `VisualProfile`;
3. applichi il profilo al renderer Pixi senza cambiare world geometry o physics;
4. supporti inizialmente:
   - `default`;
   - `france`;
   - `paris`;
   - `italy`;
   - `rome`;
5. supporti override di sviluppo:
   - `?theme=auto`
   - `?theme=default`
   - `?theme=paris`
   - `?theme=rome`
6. mantenga fallback deterministici;
7. mantenga invariati chunk, collisioni, posizione veicolo e streaming quando cambia tema;
8. non introduca ancora un servizio remoto di temi;
9. non introduca AI/generazione runtime;
10. non trasformi il lavoro in una riscrittura del renderer.

La milestone iniziale è riuscita quando, a parità di geometria, **Paris e Rome appaiono chiaramente diverse** tramite palette di edifici/tetti, strade, marciapiedi, terreno e acqua, senza refetch o recompilazione del mondo.

---

# 1. Perché esiste LVP

OpenGTA possiede già la parte difficile:

- mondo geografico reale;
- streaming;
- MVT;
- chunk;
- compilazione canonica;
- fisica;
- veicolo;
- zoom/LOD;
- rendering Pixi stabile;
- reverse geocoding del luogo corrente.

Il rischio attuale è che città diverse abbiano:

> geometrie differenti ma identità visiva troppo simile.

LVP introduce una nuova separazione:

```text
GEOGRAFIA = dove si trova il mondo
VISUAL PROFILE = come quel luogo viene rappresentato
```

Esempio:

```text
Paris
  geometry → dati reali di Paris
  theme    → palette fredda, pietra chiara, tetti zinco/grigio

Rome
  geometry → dati reali di Rome
  theme    → palette calda, ocra, terracotta, pietra/travertino
```

LVP non deve falsificare la geografia.

Deve dare **identità locale alla stessa pipeline grafica**.

---

# 2. Principio architetturale fondamentale

Il renderer **NON deve fare reverse geocoding**.

Il flusso corretto è:

```text
vehicle/world position
        ↓
PlaceTracker
        ↓
reverse geocoding
        ↓
LocationContext
        ↓
VisualProfileResolver
        ↓
ResolvedVisualProfile
        ↓
PixiRenderer.setVisualProfile(...)
```

Quindi:

```text
NETWORK / LOCATION LOGIC
```

rimane fuori da:

```text
src/render/
```

Il renderer riceve un profilo già risolto e non conosce Nominatim, città, paesi o URL.

---

# 3. Scope della prima versione

## In scope

LVP v1 controlla:

- background/base ground;
- land-use colors;
- water;
- road fill;
- road casing;
- sidewalk fill;
- sidewalk/curb visual color;
- road marking color;
- building roof palettes;
- building type overrides;
- transitional facade palette del renderer corrente;
- outline building;
- colori base coerenti con il luogo.

Deve esistere un hook pulito per futuri:

- roof props;
- alberi;
- lampioni;
- street furniture;
- parked cars;
- road materials;
- building shadows;
- 2D+ depth language.

Ma tali elementi **non fanno parte dell'MVP**.

---

## Out of scope

Non implementare ora:

- server remoto dei temi;
- database dei temi;
- AI generativa;
- download dinamico di texture;
- texture fotografiche;
- riconoscimento visivo da Street View;
- traffico locale;
- pedoni;
- modelli specifici di lampioni;
- alberi città-specifici;
- nuovi dati OSM;
- modifica delle collisioni;
- modifica delle larghezze fisiche stradali;
- modifica delle footprint;
- cambio renderer;
- Three.js;
- nuova pipeline di compilazione del mondo salvo necessità documentata.

---

# 4. Stato corrente del repository da rispettare

File già esistenti rilevanti:

```text
src/app/bootstrap.ts
src/app/geocode.ts
src/app/place-status.ts

src/render/lod-profile.ts

src/render/pixi/renderer.ts
src/render/pixi/presentation.ts
src/render/pixi/scene-order.ts

src/world/compiler/compiled.ts
src/world/model/types.ts
```

Lo stato corrente contiene già palette hardcoded in:

```text
src/render/pixi/renderer.ts
```

tra cui concettualmente:

```text
GROUND_FILL
GROUND_WATER
GROUND_BASE

ROAD_STYLE
ROAD_BASE

SIDEWALK_FILL
MARKING_FILL

ROOF_PALETTE
FACADE_PALETTE
TYPE_STYLE
```

LVP deve estrarre questa responsabilità dal renderer.

---

# 5. Nuova struttura file

Creare:

```text
src/render/theme/
  types.ts
  hash.ts
  merge.ts
  resolver.ts
  resolver.test.ts
  override.ts
  override.test.ts

  profiles/
    default.ts
    france.ts
    paris.ts
    italy.ts
    rome.ts

  index.ts
```

Per il contesto geografico creare preferibilmente:

```text
src/app/location-context.ts
src/app/location-context.test.ts
```

Non mettere il resolver dei temi in `src/app`.

Il contratto visuale appartiene al presentation layer.

---

# 6. LocationContext

Creare un contratto provider-neutral.

File:

```text
src/app/location-context.ts
```

Schema:

```ts
export interface LocationContext {
  readonly latitude: number;
  readonly longitude: number;

  /** ISO 3166-1 alpha-2 uppercase when known, e.g. IT, FR. */
  readonly countryCode?: string;

  readonly country?: string;

  /** State / region / first-order administrative area. */
  readonly region?: string;

  /** City/town/village/municipality normalized into one field. */
  readonly locality?: string;

  /** Borough / suburb / district / neighbourhood where available. */
  readonly district?: string;

  /** Geocoder source identifier, not used for rendering decisions. */
  readonly source: "nominatim";

  /** Optional source place id for diagnostics only. */
  readonly placeId?: string;

  /** Human-readable reverse-geocoded label for UI/debug. */
  readonly displayName?: string;
}
```

## Regole

`LocationContext`:

- non deve contenere logica Pixi;
- non deve contenere `themeId`;
- non deve contenere palette;
- non deve dipendere dal renderer;
- non deve usare il testo `displayName` per decidere il paese quando esiste `countryCode`;
- deve tollerare dati incompleti.

---

# 7. Reverse geocoding strutturato

Lo stato attuale di `src/app/geocode.ts` ritorna essenzialmente:

```ts
GeocodeCandidate {
  name,
  latitude,
  longitude,
  placeId
}
```

Per LVP serve anche l'address strutturato del reverse result.

---

## 7.1 Nuovo contratto reverse

Aggiungere:

```ts
export interface ReverseGeocodeResult extends GeocodeCandidate {
  readonly countryCode?: string;
  readonly country?: string;
  readonly region?: string;
  readonly locality?: string;
  readonly district?: string;
}
```

Cambiare:

```ts
GeocodeClient.reverse(...)
```

in modo che ritorni:

```ts
Promise<ReverseGeocodeResult | undefined>
```

La search normale può continuare a usare `GeocodeCandidate[]`.

---

## 7.2 Richiesta Nominatim

Nel reverse URL aggiungere:

```text
addressdetails=1
```

Non cambiare endpoint.

Non aggiungere endpoint esterni.

La risposta deve continuare a passare attraverso:

```text
readBoundedJson(...)
```

e gli stessi timeout/limiti già presenti.

---

## 7.3 Parsing address

Dal campo `address` del reverse response ricavare:

```text
country_code
country
state / region
city / town / village / municipality
city_district / borough / suburb / neighbourhood
```

Regole suggerite:

```ts
countryCode =
  normalizeCountryCode(address.country_code)

region =
  firstString(
    address.state,
    address.region
  )

locality =
  firstString(
    address.city,
    address.town,
    address.village,
    address.municipality
  )

district =
  firstString(
    address.city_district,
    address.borough,
    address.suburb,
    address.neighbourhood
  )
```

`country_code` Nominatim è normalmente lowercase.

Convertirlo in uppercase:

```text
it → IT
fr → FR
```

Validare:

```text
^[A-Z]{2}$
```

Non accettare valori arbitrari.

---

# 8. PlaceTracker

Lo stato corrente mantiene soltanto:

```ts
place(): string | undefined
```

Estenderlo mantenendo backward compatibility.

Nuova API:

```ts
export interface PlaceTracker {
  track(x: number, y: number): void;

  /** Existing UI-readable name. */
  place(): string | undefined;

  /** Structured context used by LVP. */
  location(): LocationContext | undefined;

  dispose(): void;
}
```

Quando il reverse lookup riesce:

```text
placeName   ← candidate.name
locationCtx ← candidate converted to LocationContext
```

Un errore di reverse geocoding:

- non deve cancellare l'ultimo context valido;
- non deve cambiare il tema a `default`;
- non deve generare theme flicker.

Conservare l'ultimo `LocationContext` valido fino a nuovo successo.

---

# 9. Frequenza del location tracking

Per MVP mantenere il meccanismo corrente:

```text
PLACE_ZONE_METERS = 1000
minIntervalMs = 5000
```

Non creare richieste geocoder nel render loop.

Non fare reverse lookup a ogni frame.

LVP deve reagire soltanto a un nuovo context risolto.

In futuro si potrà rivedere la strategia vicino ai confini, ma non in questa milestone.

---

# 10. VisualProfile

File:

```text
src/render/theme/types.ts
```

Il profilo deve descrivere **dati visuali**, non comportamento runtime.

Contratto v1:

```ts
export type ThemeColor = number;

export interface RoadVisualStyle {
  readonly fill: ThemeColor;
  readonly casing: ThemeColor;
}

export interface BuildingTypeVisualStyle {
  readonly roof: ThemeColor;

  /**
   * Transitional field for the current fake-depth renderer.
   * It may later become unused when OpenGTA 2D+ removes fake facades.
   */
  readonly facade: ThemeColor;
}

export interface VisualProfile {
  readonly schemaVersion: 1;

  /** Stable machine id: default, italy, rome, france, paris... */
  readonly id: string;

  /** Human-readable diagnostics only. */
  readonly label: string;

  /** Revision for future cache/service evolution. */
  readonly revision: number;

  readonly ground: {
    readonly base: ThemeColor;
    readonly water: ThemeColor;

    readonly land: Readonly<Record<string, ThemeColor>>;
  };

  readonly roads: {
    readonly base: RoadVisualStyle;
    readonly classes: Readonly<Record<string, RoadVisualStyle>>;

    readonly sidewalk: {
      readonly fill: ThemeColor;
      readonly curb: ThemeColor;
    };

    readonly markings: {
      readonly fill: ThemeColor;
    };
  };

  readonly buildings: {
    /** Used for generic building variants. */
    readonly roofPalette: readonly ThemeColor[];

    /** Transitional palette for current fake facade. */
    readonly facadePalette: readonly ThemeColor[];

    /** Overrides keyed by current building style class. */
    readonly typeStyles: Readonly<Record<string, BuildingTypeVisualStyle>>;

    readonly outline: ThemeColor;

    /**
     * Reserved for the OpenGTA 2D+ direction.
     * Renderer MVP does not have to consume all of these fields yet.
     */
    readonly depth2d: {
      readonly shadowColor: ThemeColor;
      readonly shadowAlpha: number;
      readonly edgeLight: ThemeColor;
      readonly edgeDark: ThemeColor;
    };
  };

  /**
   * Semantic future hooks.
   * Do not load assets in LVP-01.
   */
  readonly identity: {
    readonly roofFamily: string;
    readonly sidewalkFamily: string;
    readonly vegetationFamily: string;
    readonly streetFurnitureFamily: string;
  };
}
```

---

# 11. Regole dello schema VisualProfile

## Deve essere completo

Il renderer non deve dover fare:

```ts
profile.roads?.classes?.primary ?? OLD_CONSTANT
```

Ogni `ResolvedVisualProfile` deve essere completo.

I fallback vengono risolti prima.

---

## Il renderer non deve conoscere parent themes

Niente:

```ts
if (profile.id === "rome") ...
```

nel renderer.

Niente:

```ts
if (country === "IT") ...
```

nel renderer.

Il renderer deve chiedere soltanto:

```ts
roadStyle(profile, roadClass)
buildingStyle(profile, class, seed)
groundFill(profile, kind, class)
```

---

# 12. VisualProfilePatch e inheritance

Per evitare duplicazione, le definizioni specifiche possono essere patch.

Creare in:

```text
src/render/theme/merge.ts
```

un merge esplicito e tipizzato.

Schema indicativo:

```ts
export interface VisualProfilePatch {
  readonly id: string;
  readonly label: string;
  readonly revision?: number;

  readonly ground?: {
    readonly base?: ThemeColor;
    readonly water?: ThemeColor;
    readonly land?: Readonly<Record<string, ThemeColor>>;
  };

  readonly roads?: {
    readonly base?: Partial<RoadVisualStyle>;
    readonly classes?: Readonly<Record<string, Partial<RoadVisualStyle>>>;
    readonly sidewalk?: {
      readonly fill?: ThemeColor;
      readonly curb?: ThemeColor;
    };
    readonly markings?: {
      readonly fill?: ThemeColor;
    };
  };

  readonly buildings?: {
    readonly roofPalette?: readonly ThemeColor[];
    readonly facadePalette?: readonly ThemeColor[];
    readonly typeStyles?: Readonly<Record<string, Partial<BuildingTypeVisualStyle>>>;
    readonly outline?: ThemeColor;
    readonly depth2d?: Partial<VisualProfile["buildings"]["depth2d"]>;
  };

  readonly identity?: Partial<VisualProfile["identity"]>;
}
```

Funzione:

```ts
export function mergeVisualProfile(
  parent: VisualProfile,
  patch: VisualProfilePatch,
): VisualProfile
```

Deve:

- creare un nuovo oggetto;
- non mutare il parent;
- preservare campi non sovrascritti;
- mergeare mappe per chiave;
- sostituire le palette interamente quando specificate;
- validare palette non vuote;
- restituire un profilo completo.

Non usare una libreria deep-merge esterna.

---

# 13. Gerarchia iniziale

La gerarchia logica iniziale:

```text
default
├── france
│   └── paris
└── italy
    └── rome
```

Implementazione:

```text
profiles/default.ts → VisualProfile completo

profiles/france.ts  → merge(default, FrancePatch)
profiles/paris.ts   → merge(france, ParisPatch)

profiles/italy.ts   → merge(default, ItalyPatch)
profiles/rome.ts    → merge(italy, RomePatch)
```

---

# 14. Profili iniziali

I valori seguenti sono **baseline artistiche**, non verità cartografiche.

Devono essere sobri.

Non usare bandiere letterali o rosso/bianco/blu aggressivo per Paris.

Non usare verde/bianco/rosso aggressivo per Rome.

L'identità deve derivare da materiali e palette urbane.

---

## 14.1 Default

Il profilo `default` deve riprodurre il più possibile l'aspetto corrente.

Obiettivo:

> introdurre LVP senza creare una regressione visuale per luoghi non riconosciuti.

Trasferire quindi nel `default` i valori attualmente hardcoded in `renderer.ts`.

Esempio concettuale:

```text
ground:
  palette GTA corrente

roads:
  palette corrente

buildings:
  ROOF_PALETTE corrente
  FACADE_PALETTE corrente
  TYPE_STYLE corrente
```

---

## 14.2 Italy

Direzione:

```text
temperatura: più calda
edifici: sabbia / crema / ocra soft
tetti: terracotta + marroni caldi + grigi caldi
strade: grigio neutro/caldo
sidewalk: pietra calda
```

Non saturare.

---

## 14.3 Rome

Override rispetto a Italy:

```text
edifici:
  più ocra / beige / terracotta

tetti:
  maggiore presenza terracotta
  alcuni flat roof neutrali

sidewalk:
  travertino / stone warm impression

identity:
  roofFamily = "rome-warm-roofs"
  sidewalkFamily = "rome-stone"
  vegetationFamily = "rome-mediterranean"
  streetFurnitureFamily = "rome-urban"
```

In LVP-01 le family sono metadati.

---

## 14.4 France

Direzione:

```text
temperatura: neutra/fredda
edifici: crema / pietra chiara / taupe
tetti: grigio, ardesia, zinco
strade: grigio leggermente freddo
sidewalk: stone grey
```

---

## 14.5 Paris

Override rispetto a France:

```text
edifici:
  limestone / cream / light beige

tetti:
  zinc grey / slate / muted blue-grey

sidewalk:
  light cool stone

identity:
  roofFamily = "paris-zinc-slate"
  sidewalkFamily = "paris-stone"
  vegetationFamily = "paris-temperate"
  streetFurnitureFamily = "paris-urban"
```

---

# 15. Deterministic style hashing

File:

```text
src/render/theme/hash.ts
```

Estrarre la logica di hash dal renderer.

Creare:

```ts
export function stableStringHash(value: string): number
```

Usare FNV-1a 32-bit o equivalente deterministico semplice.

---

## 15.1 Building seed

Per LVP v1 usare preferibilmente:

```ts
stableStringHash(`${building.featureId}:${profile.id}`)
```

invece dell'attuale:

```text
positionSeed(centerX, centerY)
```

Questo rende il visual variant dipendente da:

```text
stable feature identity + theme
```

e non dalla bounding box.

---

## 15.2 Nota importante sui featureId

Prima di considerare definitiva questa strategia, Codex deve verificare che `featureId`:

- resti stabile tra reload;
- non cambi per la stessa feature durante partition/clipping;
- non sia un indice locale del chunk.

Se la verifica dimostra che `featureId` non è stabile abbastanza, non inventare una soluzione.

Documentare il finding e usare temporaneamente:

```text
featureId
```

solo per LVP-01, aprendo un follow-up per una stable visual identity provider-neutral.

Non modificare il canonical world contract senza necessità.

---

# 16. Helper di stile

Creare helper puri, per esempio in:

```text
src/render/theme/index.ts
```

API consigliata:

```ts
export function groundFill(
  profile: VisualProfile,
  kind: "water" | "land",
  cls: string,
): number;

export function roadStyle(
  profile: VisualProfile,
  cls: string,
): RoadVisualStyle;

export function buildingStyle(
  profile: VisualProfile,
  cls: string,
  seed: number,
): BuildingTypeVisualStyle;
```

Regole:

```text
ground class unknown → profile.ground.base
road class unknown   → profile.roads.base
building typed       → profile.buildings.typeStyles[class]
generic building     → palette[seed % palette.length]
```

Nessun accesso a DOM/network.

---

# 17. VisualProfileResolver

File:

```text
src/render/theme/resolver.ts
```

API:

```ts
export interface ThemeResolution {
  readonly profile: VisualProfile;

  readonly matchedBy:
    | "forced"
    | "locality"
    | "region"
    | "country"
    | "default";

  readonly location?: LocationContext;
}

export interface VisualProfileResolver {
  resolve(
    location: LocationContext | undefined,
    forcedThemeId?: string,
  ): ThemeResolution;
}
```

---

# 18. Normalizzazione geografica

Il resolver deve normalizzare i nomi.

Funzione interna pura:

```ts
normalizeLocationToken(value: string): string
```

Comportamento:

- trim;
- lowercase;
- collapse whitespace;
- rimozione diacritici via `normalize("NFD")`;
- rimozione combining marks;
- nessuna fuzzy matching complessa.

Esempi:

```text
"Roma"   → "roma"
"ROME"   → "rome"
"Parigi" → "parigi"
"Paris"  → "paris"
```

---

# 19. Registry dei temi

Non mettere if sparsi.

Definire registry esplicito.

Esempio:

```ts
const THEME_BY_ID = new Map<string, VisualProfile>([
  ["default", defaultProfile],
  ["italy", italyProfile],
  ["rome", romeProfile],
  ["france", franceProfile],
  ["paris", parisProfile],
]);
```

Mapping località:

```ts
const LOCALITY_RULES = [
  {
    countryCode: "IT",
    aliases: ["roma", "rome"],
    themeId: "rome",
  },
  {
    countryCode: "FR",
    aliases: ["paris", "parigi"],
    themeId: "paris",
  },
] as const;
```

Country:

```ts
const COUNTRY_RULES = {
  IT: "italy",
  FR: "france",
} as const;
```

In futuro si potranno aggiungere region rules.

---

# 20. Ordine del resolver

Se esiste un override valido:

```text
forced theme
```

ha priorità assoluta.

Altrimenti:

```text
locality exact rule
↓
region rule
↓
country rule
↓
default
```

Per LVP-01 le `region rules` possono essere una registry vuota.

Non dedurre un paese da una città se `countryCode` contraddice.

Esempio:

```text
locality = Paris
countryCode = US
```

non deve selezionare automaticamente `paris`.

La città deve essere qualificata almeno dal paese quando disponibile.

---

# 21. Theme override da query string

File:

```text
src/render/theme/override.ts
```

Supportare:

```text
?theme=auto
?theme=default
?theme=italy
?theme=rome
?theme=france
?theme=paris
```

API suggerita:

```ts
export function themeOverrideFromSearch(
  search: string,
  validThemeIds: ReadonlySet<string>,
): string | undefined;
```

Regole:

```text
missing       → undefined
theme=auto    → undefined
valid id      → id
invalid id    → undefined
```

Non lanciare su input non valido.

Non permettere URL o path.

Non usare il valore della query per caricare risorse remote.

---

# 22. Integrazione renderer

Modificare l'interfaccia:

```ts
export interface PixiRenderer {
  ...
  setVisualProfile(profile: VisualProfile): void;
  visualProfileId(): string;
}
```

`createPixiRenderer` deve partire con:

```text
defaultProfile
```

oppure accettare opzionalmente:

```ts
createPixiRenderer(canvas, { visualProfile?: ... })
```

ma scegliere **una sola** strategia semplice.

Raccomandazione:

```ts
createPixiRenderer(canvas, {
  visualProfile: defaultProfile,
})
```

con default interno se omesso.

---

# 23. Cambio tema runtime

Quando:

```ts
renderer.setVisualProfile(newProfile)
```

e:

```text
newProfile.id === currentProfile.id
```

non fare nulla.

Se l'id cambia:

1. aggiornare `activeVisualProfile`;
2. ricostruire le sole presentazioni Pixi dei chunk già caricati;
3. non richiedere nuovi chunk;
4. non ricompilare `CompiledChunkV0`;
5. non modificare physics;
6. non modificare pose;
7. non resettare camera;
8. non ricreare il taxi;
9. non fare chiamate di rete.

La transizione istantanea è accettabile nell'MVP.

Fade/crossfade è fuori scope.

---

# 24. Refactor renderer

Le costanti visuali hardcoded devono uscire gradualmente da:

```text
src/render/pixi/renderer.ts
```

Sostituire:

```ts
groundFill(kind, cls)
```

con:

```ts
groundFill(activeVisualProfile, kind, cls)
```

Sostituire:

```ts
roadStyle(cls)
```

con:

```ts
roadStyle(activeVisualProfile, cls)
```

Sostituire:

```ts
buildingStyle(cls, seed)
```

con:

```ts
buildingStyle(activeVisualProfile, cls, seed)
```

Sostituire:

```text
SIDEWALK_FILL
MARKING_FILL
```

con valori del profilo.

Il renderer può mantenere **dimensioni geometriche** quali:

```text
SIDEWALK_WIDTH_METERS
MARKING_DASH_METERS
MARKING_GAP_METERS
MARKING_WIDTH_METERS
```

fuori dal VisualProfile in LVP-01.

Motivo:

> LVP-01 tematizza l'aspetto, non cambia la geometria visiva delle strade.

Le convenzioni nazionali di segnaletica potranno essere una fase successiva.

---

# 25. Fake facades: trattamento temporaneo

Il renderer corrente possiede fake depth/facade.

LVP non deve riaprire G2D-02.

Per compatibilità temporanea:

```text
facadePalette
typeStyles[].facade
```

rimangono nel `VisualProfile`.

Questo serve solo a tematizzare il renderer corrente.

Quando il branch OpenGTA 2D+ rimuoverà fake facades:

- i campi possono restare backward-compatible;
- oppure saranno deprecati in una schemaVersion successiva.

LVP-01 non deve trasformarsi in un refactor 2D+.

---

# 26. Bootstrap integration

In:

```text
src/app/bootstrap.ts
```

istanziare:

```text
VisualProfileResolver
```

una volta per sessione/runtime.

Leggere una volta:

```text
theme override
```

dalla query string.

Pseudo-flusso:

```ts
const forcedThemeId = themeOverrideFromSearch(
  window.location.search,
  knownThemeIds,
);

let activeThemeId: string | undefined;

function syncVisualTheme(): void {
  const resolution = themeResolver.resolve(
    placeTracker?.location(),
    forcedThemeId,
  );

  if (resolution.profile.id === activeThemeId) return;

  activeThemeId = resolution.profile.id;
  renderer.setVisualProfile(resolution.profile);
}
```

Chiamare `syncVisualTheme`:

- dopo creazione renderer;
- dopo nuovo `LocationContext` risolto;
- non necessariamente a ogni frame se si può evitare.

---

# 27. Evitare polling inutile nel RAF

Lo stato attuale chiama:

```text
placeTracker.track(...)
```

nel loop applicativo.

Questo può restare.

Ma non è necessario fare ogni frame una nuova risoluzione completa del tema.

Due opzioni accettabili:

### Opzione A — semplice MVP

Nel RAF:

```text
location = placeTracker.location()
if location object reference changed → resolve
```

### Opzione B — callback

Estendere PlaceTracker con:

```ts
onLocationChanged?: (context: LocationContext) => void
```

La B è più pulita ma modifica più API.

Per LVP-01 è accettabile A.

Non introdurre event emitter.

---

# 28. Debug / observability

Aggiungere al debug snapshot:

```text
theme
location
themeMatchedBy
```

Esempio:

```ts
{
  theme: {
    id: "rome",
    matchedBy: "locality",
  },
  location: {
    countryCode: "IT",
    locality: "Roma",
    region: "Lazio",
  },
}
```

Non è necessario mostrare tutto nell'HUD principale.

Ma deve essere accessibile in:

```text
window.__opengtaV0Debug
```

o equivalente debug già esistente.

---

# 29. UI del place name

La visualizzazione corrente del luogo deve continuare a funzionare.

Non sostituire:

```text
placeTracker.place()
```

con il theme id.

L'utente deve vedere il luogo reale, non:

```text
rome
```

Il tema è uno stato di presentazione.

Il luogo è uno stato geografico.

Sono concetti diversi.

---

# 30. Zero coupling con CompiledChunk

LVP-01 **non deve aggiungere `themeId` a `CompiledChunkV0`**.

Motivo:

```text
CompiledChunk = geometria / dati compilati
VisualProfile = presentazione runtime
```

Lo stesso chunk deve poter essere ridisegnato:

```text
default
→ paris
→ rome
```

senza recompilazione.

Questo è un criterio architetturale obbligatorio.

---

# 31. Zero coupling con physics

Non modificare:

```text
src/physics/
src/gameplay/vehicle/
collisions
road widths
building footprints
```

Un cambio:

```text
Paris → Rome
```

deve lasciare invariati:

```text
vehicle pose
velocity
heading
collisions
active chunks
camera
zoom
```

---

# 32. Test richiesti — location parsing

In:

```text
src/app/geocode.test.ts
src/app/location-context.test.ts
src/app/place-status.test.ts
```

coprire almeno:

### Country code

```text
"it" → "IT"
"fr" → "FR"
invalid → undefined
```

### Locality priority

```text
city > town > village > municipality
```

### District priority

```text
city_district > borough > suburb > neighbourhood
```

### Missing address

Reverse result valido senza address:

```text
place() funziona
location() contiene lat/lon/source/displayName
theme può fallbackare default
```

### Failure

Errore successivo non cancella l'ultimo context valido.

---

# 33. Test richiesti — merge

Testare:

```text
parent non mutato
patch id/label applicati
land map merged
road class map merged
building type map merged
palette sostituita, non concatenata
nested values preserved
```

Testare errore o guard su:

```text
roofPalette = []
facadePalette = []
```

Un resolved profile non deve avere palette vuote.

---

# 34. Test richiesti — resolver

Casi obbligatori:

```text
undefined location
→ default
```

```text
countryCode=IT
→ italy
```

```text
countryCode=FR
→ france
```

```text
countryCode=IT locality=Roma
→ rome
```

```text
countryCode=IT locality=Rome
→ rome
```

```text
countryCode=FR locality=Paris
→ paris
```

```text
countryCode=FR locality=Parigi
→ paris
```

```text
countryCode=US locality=Paris
→ default (o future US, ma NON paris)
```

```text
forcedThemeId=rome
location=Paris
→ rome / matchedBy=forced
```

```text
invalid forcedThemeId
→ auto resolution
```

---

# 35. Test richiesti — determinismo

Per uno stesso:

```text
featureId
profile.id
```

`stableStringHash` deve dare sempre lo stesso risultato.

Testare:

```text
buildingStyle(profile, cls, seed)
```

stabile.

Cambiare profile id deve poter selezionare una variante diversa.

Nessun `Math.random()` nella selezione visuale.

---

# 36. Test richiesti — renderer

Aggiungere test per:

```text
renderer parte con default
setVisualProfile cambia profile id
setVisualProfile stesso id è no-op
cambio tema conserva numero chunk
cambio tema non altera cameraState
cambio tema non altera zoom
dispose continua a funzionare
```

Dove testare colori Pixi direttamente è fragile, testare gli helper puri.

Non rendere la suite dipendente da screenshot pixel-perfect se non già supportato dal progetto.

---

# 37. Test manuale richiesto

Aggiungere una procedura di validazione.

Su una stessa area:

```text
...?theme=paris
```

catturare screenshot.

Poi:

```text
...?theme=rome
```

stessa:

- posizione;
- zoom;
- area;
- chunks;
- camera.

Criterio:

> La differenza visiva deve essere percepibile senza leggere il nome del tema.

Non basta cambiare un singolo colore.

Devono cambiare almeno:

- building palette;
- roof character;
- road tone;
- sidewalk tone.

---

# 38. Primo test reale geografico

Dopo il test forzato:

1. aprire/navigare Paris;
2. lasciare `?theme=auto`;
3. verificare:
   - `countryCode=FR`;
   - `locality=Paris` o alias previsto;
   - profile `paris`.

Ripetere Rome:

```text
countryCode=IT
locality=Roma/Rome
profile=rome
```

Se Nominatim produce una variante non prevista ma semanticamente corretta:

- documentare il payload fixture;
- aggiungere alias specifico;
- non introdurre fuzzy matching generale.

---

# 39. Fallback offline / geocode failure

OpenGTA non deve dipendere dal geocoder per funzionare.

Se reverse geocoding:

- non risponde;
- va in timeout;
- viene rate-limited;
- è offline;

il motore deve continuare.

Comportamento:

```text
nessun context precedente
→ defaultProfile
```

```text
context precedente disponibile
→ mantiene ultimo profile valido
```

Nessun errore geocoder deve interrompere:

- guida;
- streaming;
- rendering;
- input.

---

# 40. Performance

Il cambio profilo è un evento raro.

Per LVP-01 è accettabile ricostruire le presentazioni dei chunk attivi.

Non è accettabile:

- ricostruire ogni frame;
- rifare fetch MVT;
- ricompilare world;
- creare una texture per edificio;
- fare richieste HTTP per colori;
- usare CSS/DOM per ogni feature.

Misurare almeno che:

```text
theme change
```

non comporti crescita permanente del numero di presentation objects dopo più switch:

```text
paris → rome → paris → rome
```

---

# 41. Memory lifecycle

Quando una presentation viene ricostruita per cambio tema:

- rimuovere i Graphics vecchi dai layer;
- distruggerli come avviene già per il chunk replacement;
- non lasciare Text/Graphics orfani;
- non duplicare label containers;
- non duplicare chunk entries nella `presentations` map.

Riutilizzare il lifecycle già esistente invece di creare un secondo sistema.

---

# 42. Sicurezza / robustness

`?theme=`:

- deve accettare solo id presenti nel registry;
- non deve diventare un path;
- non deve essere interpolato in `import()`;
- non deve diventare URL;
- non deve generare fetch.

Dati del geocoder:

- trattare come untrusted;
- limiti stringa;
- normalizzazione;
- niente HTML;
- niente `innerHTML`.

---

# 43. Documentazione da aggiornare

Prima o insieme all'implementazione creare:

```text
docs/specs/location-visual-profiles-v1.md
```

Questo documento può essere usato come base.

Creare una ADR:

```text
docs/adr/ADR-0XX-location-visual-profiles.md
```

con decisione:

> visual identity is resolved at runtime from location context and supplied to the renderer as a complete provider-neutral profile; themes are local/static in v1.

Aggiornare:

```text
docs/SPEC.md
docs/handoff/CURRENT.md
tasks/plan.md
tasks/todo.md
```

seguendo il lifecycle del repository.

Non inventare numero ADR: usare il prossimo realmente libero.

---

# 44. Task breakdown consigliato

## LVP-00 — Decision + documentation

Creare:

```text
spec
ADR
tasks
handoff
```

Nessun production code.

**Done quando:** il branch ha una decisione architetturale non ambigua.

---

## LVP-01 — Structured reverse location

Modificare:

```text
src/app/geocode.ts
src/app/place-status.ts
```

Aggiungere:

```text
src/app/location-context.ts
```

Implementare:

```text
ReverseGeocodeResult
countryCode
region
locality
district
PlaceTracker.location()
```

**Done quando:** test deterministici passano e l'UI place-name precedente non regredisce.

---

## LVP-02 — Theme contracts + default profile

Creare:

```text
src/render/theme/types.ts
src/render/theme/hash.ts
src/render/theme/merge.ts
src/render/theme/profiles/default.ts
```

Spostare valori visuali correnti nel default.

Non cambiare ancora output del renderer se non necessario.

**Done quando:** default profile rappresenta la baseline attuale.

---

## LVP-03 — Italy/Rome + France/Paris profiles

Creare:

```text
italy.ts
rome.ts
france.ts
paris.ts
```

Aggiungere resolver.

**Done quando:** resolver puro passa tutti i test.

---

## LVP-04 — Renderer theme injection

Aggiungere:

```text
setVisualProfile
visualProfileId
```

Refactor palette hardcoded.

**Done quando:** il renderer può cambiare `default → paris → rome` senza cambiare chunk/physics.

---

## LVP-05 — Runtime auto selection + query override

Integrare:

```text
bootstrap
PlaceTracker.location
resolver
?theme=
debug
```

**Done quando:** auto mode seleziona il profilo e forced mode è riproducibile.

---

## LVP-06 — Visual validation

Produrre confronto:

```text
same camera / same chunk / paris
same camera / same chunk / rome
```

Verificare live Paris e Rome.

Registrare risultato:

```text
docs/results/LOCATION-VISUAL-PROFILES-V1-RESULT.md
```

**Done quando:** identità differente chiaramente visibile e nessuna regressione runtime.

---

# 45. Criteri di accettazione globali

LVP v1 è completato se:

- [ ] `LocationContext` esiste ed è provider-neutral;
- [ ] reverse geocode fornisce `countryCode`;
- [ ] località viene normalizzata;
- [ ] errori geocoder non interrompono il gioco;
- [ ] `VisualProfile` è un contratto completo;
- [ ] default replica ragionevolmente la baseline;
- [ ] Italy e France ereditano da default;
- [ ] Rome eredita da Italy;
- [ ] Paris eredita da France;
- [ ] resolver usa locality/country fallback;
- [ ] resolver non usa `displayName` come parsing fragile;
- [ ] query override funziona;
- [ ] renderer non conosce Nominatim;
- [ ] renderer non contiene `if Rome/Paris`;
- [ ] `CompiledChunkV0` non contiene theme id;
- [ ] physics non viene toccata;
- [ ] world geometry non cambia;
- [ ] theme switch non refetcha dati;
- [ ] theme switch non resetta camera/veicolo;
- [ ] building variant è deterministica;
- [ ] niente `Math.random()` per styling persistente;
- [ ] Paris e Rome sono distinguibili a parità di geometria;
- [ ] test/typecheck/build passano.

---

# 46. Definition of Done tecnica

Prima di chiudere ogni task:

```bash
npm run typecheck
npm run test:run
npm run build
git diff --check
git status --short
```

Se la suite E2E è prevista dal task:

```bash
npm run test:e2e
```

Non dichiarare completato un task visuale senza verifica manuale.

---

# 47. Cose che Codex NON deve fare

## Non creare un servizio remoto

Per ora:

```text
themes = local TypeScript data
```

Non:

```text
GET /api/themes/rome
```

---

## Non caricare temi con dynamic import da input utente

No:

```ts
import(`./profiles/${query}.ts`)
```

Usare registry chiuso.

---

## Non cambiare geometria per differenziare città

No:

```text
Rome road width multiplier
Paris building footprint offset
```

in LVP-01.

---

## Non hardcodare città nel renderer

No:

```ts
if (city === "Rome") roof = ...
```

Il renderer consuma `VisualProfile`.

---

## Non usare bandiere come palette primaria

L'identità deve essere urbana, non nazionale-cartoon.

---

## Non aggiungere asset prima della prova colore/materiale

Prima provare che il sistema architetturale funziona.

---

## Non fondere LVP con il lavoro 2D+

I due sistemi devono essere compatibili ma indipendenti:

```text
LVP = quale identità visuale
2D+ = quale linguaggio di profondità/dettaglio
```

Più avanti:

```text
Rome VisualProfile
+
2D+ renderer
=
Rome 2D+ presentation
```

---

# 48. Evoluzione futura prevista — NON implementare ora

La struttura deve poter crescere verso:

```text
default
  ↓
continent
  ↓
country
  ↓
region
  ↓
city
  ↓
district
```

Possibile esempio futuro:

```text
Europe
└── Italy
    ├── Rome
    │   ├── Centro Storico
    │   └── EUR
    ├── Milan
    └── Naples
```

Ma v1 non deve introdurre tutta questa matrice.

---

# 49. Evoluzione futura: asset families

Le stringhe:

```text
roofFamily
sidewalkFamily
vegetationFamily
streetFurnitureFamily
```

sono hook intenzionali.

In futuro un catalogo locale potrà risolvere:

```text
"rome-mediterranean"
```

in:

```text
stone pine sprite
plane tree sprite
olive variation
```

e:

```text
"paris-urban"
```

in:

```text
lamp family
bollard family
bench family
```

LVP-01 non deve avere un asset resolver.

---

# 50. Evoluzione futura: servizio remoto

Solo dopo aver validato almeno diverse città si potrà estrarre:

```text
VisualProfile manifest
```

in JSON/versioned schema.

Architettura futura possibile:

```text
OpenGTA
   ↓
ThemeManifestProvider
   ├── local built-in
   ├── persistent cache
   └── remote service
```

Il renderer continuerà a vedere soltanto:

```text
VisualProfile
```

Quindi il passaggio a un servizio remoto non richiederà di riscrivere il renderer.

---

# 51. Evoluzione futura: generazione assistita

Un eventuale sistema AI futuro non deve generare grafica a ogni frame.

Può generare offline/server-side una volta:

```text
city metadata
+ climate
+ OSM statistics
+ curated rules
        ↓
VisualProfile manifest
        ↓
validation
        ↓
versioned cache
```

Il runtime scarica dati deterministici.

Mai:

```text
AI request per building
AI request per frame
```

---

# 52. Compatibilità con OpenGTA 2D+

LVP è progettato per diventare il data source visivo di OpenGTA 2D+.

Esempio futuro:

```ts
profile.buildings.depth2d.shadowColor
profile.buildings.depth2d.shadowAlpha
profile.buildings.depth2d.edgeLight
profile.buildings.depth2d.edgeDark
```

Il renderer 2D+ userà questi valori per:

```text
shadow
roof
edge shading
roof props
```

senza conoscere:

```text
Rome
Paris
Italy
France
```

Questo è il confine architetturale da preservare.

---

# 53. Risultato atteso della prima milestone

Su **identica geometria**:

## Paris

Deve suggerire:

```text
pietra chiara
crema
grigi freddi
zinco/ardesia
asfalto leggermente freddo
sidewalk chiaro
```

## Rome

Deve suggerire:

```text
ocra
sabbia
beige caldo
terracotta
grigi caldi
stone/travertino
```

Non deve sembrare:

```text
Paris = blu
Rome = rosso
```

Deve sembrare una differenza di **materialità urbana**.

---

# 54. Criterio GO / NO-GO

Dopo LVP-06 confrontare due screenshot della stessa scena:

```text
theme=paris
theme=rome
```

## GO

Se un osservatore può percepire:

> "sono due identità urbane differenti"

senza conoscere il codice.

Procedere con:

```text
roof families
road material families
vegetation
street furniture
parked cars
```

---

## NO-GO

Se l'effetto sembra soltanto:

> "la stessa mappa con un filtro colore"

non aggiungere immediatamente altre 100 città.

Prima migliorare lo schema con:

- materiali;
- props;
- roof treatment;
- sidewalk patterns;

e ripetere il test Paris/Rome.

---

# 55. Principio finale

OpenGTA deve separare tre livelli:

```text
WORLD DATA
cosa esiste e dove

VISUAL LANGUAGE
come OpenGTA rappresenta un mondo 2D

LOCATION VISUAL PROFILE
quale identità locale usa quel linguaggio
```

In forma completa:

```text
MVT / OSM
   ↓
Canonical World
   ↓
CompiledChunk
   ↓
                 LocationContext
                       ↓
                 ThemeResolver
                       ↓
                VisualProfile
                       ↓
CompiledChunk ───→ Pixi Renderer
                       ↓
                Local identity
```

Il chunk resta riutilizzabile.

Il tema resta sostituibile.

Il renderer resta provider-neutral.

La posizione reale decide automaticamente l'identità.

Questa è la base di **Location Visual Profiles v1**.
