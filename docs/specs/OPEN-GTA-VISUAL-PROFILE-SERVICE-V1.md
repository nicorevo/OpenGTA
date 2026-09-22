# OpenGTA — Visual Profile Service (VPS)
## Specifica completa per la fase successiva a Location Visual Profiles

**Data:** 2026-09-21  
**Stato:** Future implementation / da iniziare solo dopo validazione LVP  
**Dipendenza obbligatoria:** `Location Visual Profiles v1` completato e validato  
**Branch suggerito:** `feature/visual-profile-service`  
**Nome sistema:** `Visual Profile Service`  
**Acronimo:** `VPS`

---

# 0. Premessa

Questo documento descrive la fase successiva a `Location Visual Profiles (LVP)`.

LVP dimostra che OpenGTA può cambiare identità visiva in base alla posizione geografica:

```text
LocationContext
      ↓
VisualProfileResolver
      ↓
VisualProfile
      ↓
Renderer
```

VPS estende questo concetto eliminando progressivamente la necessità di definire manualmente ogni città.

L'obiettivo diventa:

> date coordinate geografiche, osservare automaticamente l'ambiente reale circostante, estrarne caratteristiche visuali robuste e tradurle nel linguaggio grafico OpenGTA.

In forma sintetica:

```text
lat/lon
   ↓
Visual Profile Service
   ↓
Visual evidence
   ↓
Semantic interpretation
   ↓
OpenGTA profile compilation
   ↓
VisualProfile
```

Il servizio NON deve riprodurre fotografie.

Il servizio NON deve generare texture fotografiche.

Il servizio NON deve copiare fedelmente Street View.

Il servizio deve produrre una **descrizione semantica e stilizzata del carattere visivo locale** compatibile con OpenGTA.

---

# 1. Precondizione obbligatoria

Non iniziare VPS finché LVP non ha dimostrato almeno:

- `Paris` e `Rome` visualmente distinguibili;
- stesso mondo/chunk, diverso tema;
- renderer indipendente dalla città;
- `VisualProfile` stabile;
- query override funzionante;
- profili locali applicabili runtime;
- nessuna dipendenza del world compiler dal tema.

Se LVP fallisce il test:

```text
same geometry
+ Paris profile
+ Rome profile
```

e il risultato sembra soltanto un filtro colore, NON iniziare VPS.

Prima migliorare il linguaggio grafico OpenGTA.

VPS ha senso soltanto se OpenGTA possiede già un vocabolario visuale utile.

---

# 2. Visione del sistema

Il sistema completo futuro:

```text
                       Coordinates
                           │
                           ▼
                   Profile Request API
                           │
                           ▼
                     Spatial Cell
                           │
                    cache available?
                     │             │
                    yes            no
                     │             │
                     │      Evidence Collector
                     │       ├─ OSM
                     │       ├─ Mapillary
                     │       ├─ future imagery
                     │       └─ curated data
                     │             │
                     │             ▼
                     │       Visual Analyzer
                     │             │
                     │             ▼
                     │      Evidence Aggregator
                     │             │
                     │             ▼
                     │       Profile Compiler
                     │             │
                     │             ▼
                     └──────── VisualProfile
                                   │
                                   ▼
                                 Cache
                                   │
                                   ▼
                                OpenGTA
```

La pipeline deve essere divisa chiaramente in quattro responsabilità:

```text
OBSERVE
INTERPRET
COMPILE
SERVE
```

---

# 3. Principio fondamentale

L'AI o il computer vision system **osserva**.

Il `Profile Compiler` **interpreta**.

OpenGTA **disegna**.

Mai fondere queste tre responsabilità.

Forma corretta:

```text
imagery
   ↓
VisualEvidenceProfile
   ↓
ProfileCompiler
   ↓
VisualProfile
```

Forma vietata:

```text
imagery
   ↓
AI inventa direttamente colori, texture e asset OpenGTA
```

---

# 4. Obiettivo del servizio

Input:

```json
{
  "latitude": 41.9028,
  "longitude": 12.4964
}
```

Output concettuale:

```json
{
  "schemaVersion": 1,
  "profileId": "cell:rome:8a1f",
  "location": {
    "countryCode": "IT",
    "region": "Lazio",
    "locality": "Roma"
  },
  "visualProfile": {
    "buildingPalette": "warm-stone",
    "roofFamily": "terracotta-urban",
    "roadMaterialFamily": "warm-asphalt",
    "sidewalkFamily": "warm-stone",
    "vegetationFamily": "mediterranean-urban",
    "streetFurnitureFamily": "southern-europe-classic"
  },
  "confidence": {
    "overall": 0.86
  }
}
```

OpenGTA non deve sapere come il profilo è stato derivato.

---

# 5. Non dipendere direttamente da Mapillary

Mapillary è un ottimo provider iniziale, ma non deve diventare parte del core.

Definire:

```ts
export interface StreetImageryProvider {
  sample(
    area: GeoArea,
    options: StreetSamplingOptions,
  ): Promise<StreetSampleBatch>;
}
```

Implementazioni possibili:

```text
MapillaryImageryProvider
FutureLicensedProvider
OwnImageryProvider
TestImageryProvider
```

Il resto del VPS deve dipendere solo da `StreetImageryProvider`.

Mai:

```text
ProfileCompiler → Mapillary API
```

Sempre:

```text
ProfileCompiler ← VisualEvidenceProfile
```

---

# 6. Fonti iniziali

## VPS v1

Usare inizialmente:

```text
OpenStreetMap
+
Mapillary
```

Solo queste due fonti.

Non aggiungere contemporaneamente:

- satellitare;
- Copernicus;
- Wikimedia;
- Google;
- provider commerciali;
- climate datasets.

Motivo:

> prima validare la pipeline, poi aumentare le fonti.

---

# 7. Ruolo di OpenStreetMap

OSM deve fornire evidenze semanticamente forti quando disponibili.

Possibili tag utili:

```text
building
building:material
building:colour
roof:material
roof:colour
roof:shape
surface
highway
landuse
natural
leisure
amenity
```

OSM non deve essere usato come unica fonte di stile.

Deve avere priorità alta quando possiede un tag esplicito pertinente.

Esempio:

```text
roof:material=roof_tiles
```

è una evidenza più forte di:

```text
vision model: roof looks probably like terracotta tiles, confidence 0.56
```

---

# 8. Ruolo di Mapillary

Mapillary deve fornire:

1. immagini street-level vicine;
2. metadata temporali/spaziali;
3. detections disponibili;
4. map features disponibili;
5. copertura dell'area.

Le immagini devono essere campionate.

Non scaricare indiscriminatamente tutte le immagini.

---

# 9. Sampling geografico

Il servizio non deve analizzare una sola coordinata.

Una singola immagine può essere:

- parcheggio;
- tunnel;
- muro;
- cantiere;
- autostrada;
- panorama non rappresentativo.

Usare un'area di campionamento.

Prima baseline:

```text
raggio: 300-500 m
```

Valore configurabile.

---

# 10. Spatial cells

Non generare un profilo diverso per ogni lat/lon.

Convertire le coordinate in una cella spaziale.

Tecnologia possibile:

```text
H3
```

oppure alternativa equivalente.

Non vincolare l'architettura a H3 nel contratto pubblico.

Contratto:

```ts
export interface SpatialCell {
  readonly id: string;
  readonly center: GeoPoint;
  readonly bounds: GeoBounds;
  readonly resolution: number;
}
```

L'implementazione può usare H3.

---

# 11. Perché usare celle

Vantaggi:

- cache;
- determinismo;
- riuso;
- analisi una sola volta;
- transizioni gestibili;
- aggregazione regionale;
- costo controllabile.

Flusso:

```text
lat/lon
 ↓
cell id
 ↓
profile cache
```

---

# 12. Primo schema geografico consigliato

Per MVP:

```text
cella urbana:
~300-700 m scala utile
```

Non fissare subito una risoluzione globale definitiva.

Testare:

- centro storico;
- residenziale;
- industriale;
- suburbano.

La risoluzione deve essere sufficientemente grande da catturare un carattere urbano ma sufficientemente piccola da non fondere quartieri completamente diversi.

---

# 13. Street sampling

Schema:

```ts
export interface StreetSamplingOptions {
  readonly radiusMeters: number;
  readonly maxSamples: number;
  readonly preferredRecencyYears?: number;
  readonly minDirectionalSpread?: number;
}
```

Baseline:

```text
radiusMeters = 400
maxSamples = 20-30
```

---

# 14. Selezione immagini

Preferire immagini:

- distribuite nello spazio;
- distribuite per heading;
- recenti;
- con qualità sufficiente;
- non duplicate;
- non concentrate sulla stessa strada.

Evitare:

```text
20 immagini consecutive della stessa sequence
```

Meglio:

```text
5-10 posizioni
×
2-3 heading
```

---

# 15. StreetSample

Contratto provider-neutral:

```ts
export interface StreetSample {
  readonly provider: string;
  readonly sourceId: string;

  readonly latitude: number;
  readonly longitude: number;

  readonly capturedAt?: string;
  readonly heading?: number;

  readonly imageUrl?: string;

  readonly detections?: readonly ProviderDetection[];

  readonly provenance: EvidenceProvenance;
}
```

---

# 16. Provenance

Ogni evidenza deve conoscere la propria provenienza.

```ts
export interface EvidenceProvenance {
  readonly provider: string;
  readonly sourceId?: string;
  readonly sourceUrl?: string;

  readonly capturedAt?: string;

  readonly license?: string;
  readonly attribution?: string;

  readonly retrievedAt: string;
}
```

La provenance non è opzionale nel design.

---

# 17. Licenze

Prima di usare un provider in produzione:

- verificare termini aggiornati;
- verificare diritto di elaborazione;
- verificare diritto di memorizzare metadata derivati;
- verificare attribution;
- verificare diritto di redistribuzione;
- verificare eventuale obbligo share-alike;
- verificare eventuali limiti per AI/ML.

Non codificare nel software assunzioni legali non verificate.

Il provider deve essere disattivabile.

---

# 18. Visual Analyzer

Il `VisualAnalyzer` riceve immagini selezionate e produce osservazioni strutturate.

Non deve produrre testo libero come output principale.

API:

```ts
export interface VisualAnalyzer {
  analyze(
    sample: StreetSample,
  ): Promise<VisualObservation>;
}
```

---

# 19. VisualObservation

Schema iniziale:

```ts
export interface VisualObservation {
  readonly sampleId: string;

  readonly facadeColor?: ClassificationResult<FacadeColorClass>;
  readonly facadeMaterial?: ClassificationResult<FacadeMaterialClass>;

  readonly roofType?: ClassificationResult<RoofTypeClass>;

  readonly sidewalkType?: ClassificationResult<SidewalkTypeClass>;

  readonly roadSurface?: ClassificationResult<RoadSurfaceClass>;

  readonly vegetationCharacter?: ClassificationResult<VegetationClass>;

  readonly urbanCharacter?: ClassificationResult<UrbanCharacterClass>;

  readonly streetFurnitureCharacter?: ClassificationResult<StreetFurnitureClass>;

  readonly quality: number;

  readonly provenance: EvidenceProvenance;
}
```

---

# 20. ClassificationResult

```ts
export interface ClassificationResult<T extends string> {
  readonly value: T;
  readonly confidence: number;
}
```

`confidence` deve essere:

```text
0..1
```

Clippare valori esterni.

---

# 21. Vocabolario chiuso

Il modello non deve inventare categorie.

## FacadeColorClass

```ts
type FacadeColorClass =
  | "white"
  | "cream"
  | "sand"
  | "ochre"
  | "terracotta"
  | "red"
  | "brown"
  | "warm-grey"
  | "cool-grey"
  | "dark"
  | "mixed"
  | "unknown";
```

---

# 22. FacadeMaterialClass

```ts
type FacadeMaterialClass =
  | "plaster"
  | "stone"
  | "brick"
  | "concrete"
  | "glass"
  | "metal"
  | "wood"
  | "mixed"
  | "unknown";
```

---

# 23. RoofTypeClass

```ts
type RoofTypeClass =
  | "terracotta-tile"
  | "red-tile"
  | "dark-tile"
  | "slate"
  | "zinc"
  | "metal"
  | "flat-concrete"
  | "green-roof"
  | "mixed"
  | "unknown";
```

---

# 24. SidewalkTypeClass

```ts
type SidewalkTypeClass =
  | "light-stone"
  | "warm-stone"
  | "dark-stone"
  | "concrete"
  | "pavers"
  | "brick"
  | "asphalt"
  | "mixed"
  | "unknown";
```

---

# 25. RoadSurfaceClass

```ts
type RoadSurfaceClass =
  | "asphalt"
  | "concrete"
  | "cobblestone"
  | "pavers"
  | "gravel"
  | "dirt"
  | "mixed"
  | "unknown";
```

---

# 26. VegetationClass

```ts
type VegetationClass =
  | "mediterranean-urban"
  | "temperate-urban"
  | "continental-urban"
  | "tropical-urban"
  | "arid-urban"
  | "sparse"
  | "mixed"
  | "unknown";
```

Questa classe deve essere considerata "carattere", non identificazione botanica precisa.

---

# 27. UrbanCharacterClass

```ts
type UrbanCharacterClass =
  | "historic-dense"
  | "historic-medium"
  | "modern-dense"
  | "modern-medium"
  | "residential-lowrise"
  | "suburban"
  | "industrial"
  | "commercial"
  | "mixed"
  | "unknown";
```

---

# 28. StreetFurnitureClass

```ts
type StreetFurnitureClass =
  | "classic-europe"
  | "modern-europe"
  | "north-american"
  | "east-asian"
  | "minimal"
  | "mixed"
  | "unknown";
```

Questa è una prima tassonomia.

Non assumere che sia definitiva.

---

# 29. No free-form visual AI output

Vietato usare l'output principale:

```text
"questa zona ricorda una città mediterranea elegante..."
```

Può esistere solo come diagnostica.

Il pipeline data deve usare enum + confidence.

---

# 30. Prompt / analyzer contract

Se si usa un vision-language model:

- fornire schema chiuso;
- richiedere JSON strutturato;
- rifiutare campi extra;
- validare con schema;
- retry limitato;
- fallback `unknown`.

Mai accettare output non validato.

---

# 31. Mapillary detections

Quando il provider offre detections già pronte, usarle come evidenza separata.

Esempi concettuali:

```text
tree
bench
bollard
street_light
traffic_sign
vehicle
```

Non assumere nomi esatti delle classi senza verificare API/provider corrente.

Mappare le classi provider-specific in un contratto interno.

---

# 32. ProviderDetection

```ts
export interface ProviderDetection {
  readonly canonicalClass: string;
  readonly providerClass: string;

  readonly confidence?: number;

  readonly provenance: EvidenceProvenance;
}
```

---

# 33. Evidence normalization

Prima dell'aggregazione:

```text
Mapillary detections
OSM tags
Vision observations
```

devono essere convertiti in un modello comune.

---

# 34. VisualEvidenceProfile

Questo è il cuore della pipeline.

Schema concettuale:

```ts
export interface VisualEvidenceProfile {
  readonly cellId: string;

  readonly facadeColors: Distribution<FacadeColorClass>;
  readonly facadeMaterials: Distribution<FacadeMaterialClass>;

  readonly roofTypes: Distribution<RoofTypeClass>;

  readonly sidewalkTypes: Distribution<SidewalkTypeClass>;
  readonly roadSurfaces: Distribution<RoadSurfaceClass>;

  readonly vegetation: Distribution<VegetationClass>;
  readonly urbanCharacter: Distribution<UrbanCharacterClass>;
  readonly streetFurniture: Distribution<StreetFurnitureClass>;

  readonly observedDensities: {
    readonly tree: number;
    readonly streetLight: number;
    readonly bench: number;
    readonly bollard: number;
    readonly parkedVehicle: number;
  };

  readonly coverage: EvidenceCoverage;
  readonly provenanceSummary: ProvenanceSummary;
}
```

---

# 35. Distribution

```ts
export interface Distribution<T extends string> {
  readonly scores: Readonly<Record<T, number>>;
  readonly dominant?: T;
  readonly confidence: number;
}
```

Scores normalizzati:

```text
0..1
```

somma approssimativa:

```text
1
```

esclusi unknown / insufficient evidence secondo decisione implementativa documentata.

---

# 36. Weighted aggregation

Non usare semplice majority vote.

Formula concettuale:

```text
weight =
  modelConfidence
× sampleQuality
× recencyWeight
× spatialWeight
× sourceTrustWeight
```

Poi:

```text
score(category) =
  Σ weight(observation category)
  /
  Σ weight(all observations)
```

---

# 37. Recency weighting

Immagini più recenti possono avere peso maggiore.

Non fare:

```text
old = invalid
```

ma:

```text
newer = stronger
```

Esempio iniziale:

```text
< 2 anni  → 1.0
2-5 anni  → 0.85
5-8 anni  → 0.65
> 8 anni  → 0.45
```

Configurabile.

---

# 38. Spatial weighting

Evitare che molte foto dalla stessa strada dominino il risultato.

Possibile strategia:

```text
cluster samples spatially
normalize weight per cluster
```

oppure:

```text
max contribution per sequence/road
```

Non implementare sistemi complessi nel primo spike.

Ma impedire almeno duplicazione evidente.

---

# 39. EvidenceCoverage

```ts
export interface EvidenceCoverage {
  readonly requestedSamples: number;
  readonly usableSamples: number;

  readonly spatialCoverage: number;
  readonly directionalCoverage: number;

  readonly imageryConfidence: number;
  readonly osmConfidence: number;

  readonly overall: number;
}
```

---

# 40. Fonte prioritaria per attributo

Regola iniziale:

```text
OSM explicit tag
     ↓
street imagery aggregated evidence
     ↓
location profile inheritance
     ↓
OpenGTA default
```

Non usare OSM con priorità alta quando il tag è assente.

---

# 41. Esempio di roof evidence

Caso:

```text
OSM:
roof:material=roof_tiles
```

Vision:

```text
terracotta-tile 0.62
flat-concrete   0.21
unknown         0.17
```

Compiler può interpretare:

```text
roof family:
terracotta urban
confidence high
```

---

# 42. Caso senza OSM

Vision:

```text
terracotta 0.61
flat       0.25
dark-tile  0.10
unknown    0.04
```

Produrre mix:

```text
terracotta weight 0.65
flat-warm  weight 0.25
dark       weight 0.10
```

---

# 43. Profile Compiler

Il compiler traduce:

```text
VisualEvidenceProfile
```

in:

```text
GeneratedVisualProfile
```

Non vede immagini.

Non chiama provider.

Deve essere una funzione quasi completamente pura.

---

# 44. API ProfileCompiler

```ts
export interface ProfileCompiler {
  compile(
    evidence: VisualEvidenceProfile,
    context: ProfileCompilationContext,
  ): GeneratedVisualProfile;
}
```

---

# 45. ProfileCompilationContext

```ts
export interface ProfileCompilationContext {
  readonly countryCode?: string;
  readonly region?: string;
  readonly locality?: string;

  readonly parentProfile?: VisualProfile;

  readonly catalog: VisualCatalog;
}
```

---

# 46. Visual Catalog

Il catalogo contiene il linguaggio artistico OpenGTA.

Questo è il componente più importante insieme al compiler.

```ts
export interface VisualCatalog {
  readonly facadePalettes: readonly FacadePaletteDefinition[];
  readonly roofFamilies: readonly RoofFamilyDefinition[];
  readonly roadFamilies: readonly RoadFamilyDefinition[];
  readonly sidewalkFamilies: readonly SidewalkFamilyDefinition[];
  readonly vegetationFamilies: readonly VegetationFamilyDefinition[];
  readonly streetFurnitureFamilies: readonly StreetFurnitureFamilyDefinition[];
}
```

---

# 47. Il catalogo decide i colori reali

Il vision model può dire:

```text
ochre
```

Non deve dire:

```text
#c68b43
```

Il catalogo decide:

```text
ochre → OpenGTA palette warm-ochre-01
```

---

# 48. Facade palette example

```ts
{
  id: "warm-stone",
  semanticTags: [
    "cream",
    "sand",
    "ochre",
    "warm-grey"
  ],
  colors: [
    0xd8bd91,
    0xcaa575,
    0xb98c5c,
    0xb4a28f
  ]
}
```

Valori artistici da calibrare.

---

# 49. Roof family example

```ts
{
  id: "terracotta-urban",
  semanticTags: [
    "terracotta-tile",
    "red-tile"
  ],
  variants: [
    "terracotta-light",
    "terracotta-mid",
    "terracotta-dark"
  ]
}
```

---

# 50. Weighted families

Un profilo può contenere più famiglie.

```ts
export interface WeightedFamily {
  readonly id: string;
  readonly weight: number;
}
```

Esempio:

```json
[
  { "id": "terracotta-urban", "weight": 0.65 },
  { "id": "flat-warm", "weight": 0.25 },
  { "id": "dark-tile", "weight": 0.10 }
]
```

---

# 51. Determinismo in renderer

Il renderer deve scegliere varianti con:

```text
hash(featureStableId + profileId + semanticSlot)
```

Esempio:

```ts
hash(`${featureId}:${profile.id}:roof`)
```

Mai:

```text
Math.random()
```

---

# 52. GeneratedVisualProfile

Estendere o adattare il contratto LVP.

Schema futuro indicativo:

```ts
export interface GeneratedVisualProfile extends VisualProfile {
  readonly generation: {
    readonly source: "generated";
    readonly cellId: string;
    readonly generatedAt: string;
    readonly evidenceRevision: string;
    readonly compilerRevision: string;
    readonly confidence: number;
  };
}
```

---

# 53. Non creare profile id casuali

Profile id deve essere deterministico/versionato.

Esempio:

```text
vps:v1:h3:891e8052cb3ffff:compiler3
```

oppure equivalente.

---

# 54. Cache

Tre livelli possibili:

```text
Memory cache
Persistent local/server cache
Long-term profile store
```

MVP:

```text
persistent server cache
```

---

# 55. Cache key

Deve includere almeno:

```text
cell id
schema version
compiler revision
catalog revision
```

Esempio:

```text
cell:123|schema:1|compiler:4|catalog:7
```

Se cambia il catalogo:

```text
recompile
```

non necessariamente:

```text
reanalyze imagery
```

---

# 56. Separare evidence cache da profile cache

Fondamentale.

```text
Evidence cache
```

contiene:

```text
VisualEvidenceProfile
```

`Profile cache` contiene:

```text
GeneratedVisualProfile
```

Vantaggio:

se cambi la direzione artistica OpenGTA:

```text
nuovo catalog/compiler
```

puoi ricompilare i profili senza rieseguire vision sulle immagini.

---

# 57. Evidence revision

Ogni evidence profile deve avere:

```text
evidenceRevision
```

che cambia quando:

- nuove immagini;
- dati OSM aggiornati;
- nuovo analyzer;
- nuovo sampling.

---

# 58. Profile revision

Ogni profilo deve contenere:

```text
compilerRevision
catalogRevision
```

---

# 59. API esterna

Endpoint minimo:

```http
GET /v1/profile?lat=<lat>&lon=<lon>
```

Risposta:

```json
{
  "schemaVersion": 1,
  "cellId": "cell-id",
  "status": "ready",
  "profile": {},
  "confidence": {},
  "coverage": {}
}
```

---

# 60. API asincrona opzionale

Analizzare una cella può richiedere tempo.

Possibile:

```http
GET /v1/profile?lat=...&lon=...
```

Risposta iniziale:

```json
{
  "status": "pending",
  "fallbackProfile": "italy"
}
```

OpenGTA usa fallback.

Più tardi:

```text
generated profile
```

---

# 61. Non bloccare il gioco

OpenGTA non deve aspettare VPS per caricare il mondo.

Flusso corretto:

```text
world loads
↓
LVP local/country fallback
↓
VPS request async
↓
profile arrives
↓
renderer.setVisualProfile()
```

---

# 62. Fallback hierarchy

```text
generated cell profile
↓
district profile
↓
city profile
↓
country profile
↓
default
```

LVP rimane parte del sistema.

VPS non lo sostituisce.

---

# 63. Profile blending

Non implementare nella v1.

Future:

```text
cell A profile
+
cell B profile
↓
interpolation zone
```

Possibili dati blendabili:

- palette weights;
- vegetation density;
- roof distribution;
- road family.

Non blendare arbitrariamente asset incompatibili senza regole.

---

# 64. District clustering

Fase futura.

Dopo molte celle generate, clusterizzare profili simili.

Esempio:

```text
Rome Historic
Rome Residential
Rome Modern
Rome Industrial
```

Non hardcodare quartieri all'inizio.

---

# 65. Clustering input

Possibile vector representation:

```text
facade distribution
roof distribution
sidewalk distribution
road distribution
vegetation distribution
urban character
street furniture
```

---

# 66. Non fare clustering prima di avere dati

Prima produrre profili cell-level.

Poi misurare.

Solo successivamente creare regioni.

---

# 67. Confidence model

Ogni profilo deve avere confidence per categoria.

```ts
export interface ProfileConfidence {
  readonly overall: number;

  readonly buildings: number;
  readonly roofs: number;
  readonly roads: number;
  readonly sidewalks: number;
  readonly vegetation: number;
  readonly streetFurniture: number;
}
```

---

# 68. Comportamento con bassa confidence

Non inventare.

Esempio:

```text
roof confidence = 0.22
```

Usare:

```text
parentProfile roofFamily
```

e non il valore generato.

---

# 69. Threshold iniziale

Esempio configurabile:

```text
< 0.35 → fallback
0.35-0.60 → blend parent/generated
> 0.60 → generated
```

Non considerare questi valori definitivi.

Testare.

---

# 70. Blending con parent

Esempio:

```text
generated terracotta confidence 0.45
parent Italy terracotta prior 0.30
```

possibile risultato:

```text
generated 50%
parent 50%
```

Implementare solo dopo MVP se necessario.

---

# 71. Analyzer cost control

Vision è probabilmente il costo maggiore.

Ridurre:

- immagini duplicate;
- immagini di scarsa qualità;
- immagini inutili;
- repeat analysis;
- richiesta full-resolution quando non serve.

---

# 72. Progressive analysis

Possibile strategia:

```text
analyze 8 samples
↓
confidence sufficient?
   yes → stop
   no  → analyze next 8
```

max:

```text
24-32
```

---

# 73. Early stopping

Se:

```text
roof dominant > 0.75
coverage good
confidence high
```

non serve analizzare altre 20 immagini solo per il roof.

Ma altre categorie potrebbero richiedere campioni.

Non implementare ottimizzazione prematura.

---

# 74. Pre-generation

Per città principali:

```text
offline batch
```

Meglio che on-demand.

Esempio:

```text
Rome
Paris
London
Tokyo
New York
Berlin
Madrid
```

generare le celle in anticipo.

---

# 75. On-demand

Usare per:

- aree non ancora viste;
- esplorazione;
- QA;
- espansione progressiva.

---

# 76. Privacy

Il servizio non deve tentare di identificare:

- persone;
- targhe;
- abitanti;
- individui;
- proprietà personali.

L'analisi è esclusivamente ambientale.

---

# 77. Analyzer instruction

Ignorare:

- volti;
- persone;
- targhe;
- testo personale;
- dettagli identificativi.

Classificare solo:

- materiali;
- colori;
- forma urbana;
- vegetazione;
- superfici;
- arredo.

---

# 78. Security

Il VPS deve trattare:

```text
provider payloads
model outputs
OSM tags
```

come untrusted data.

Richiesto:

- JSON schema validation;
- limiti dimensione;
- timeout;
- retry limitato;
- sanitizzazione stringhe;
- URL allowlist provider;
- niente dynamic code execution.

---

# 79. API rate limits

Ogni provider deve avere:

```text
rate limiter
retry/backoff
quota monitor
```

Mai creare una chiamata provider per frame o per veicolo.

---

# 80. Provider failures

Se Mapillary fallisce:

```text
OSM-only evidence
↓
parent fallback
```

Il servizio deve comunque rispondere.

---

# 81. Provider adapter isolation

Struttura futura:

```text
services/vps/
  providers/
    street-imagery/
      types.ts
      mapillary.ts
      test-provider.ts

    osm/
      osm-evidence.ts

  analysis/
    visual-analyzer.ts
    visual-schema.ts

  evidence/
    aggregate.ts
    confidence.ts
    types.ts

  compiler/
    catalog.ts
    compiler.ts
    mappings.ts

  cache/
    evidence-cache.ts
    profile-cache.ts

  api/
    profile-route.ts
```

Adattare alla struttura reale del repository/backend scelto.

---

# 82. Non mettere il backend dentro il renderer

Il browser OpenGTA deve ricevere il risultato.

Non deve:

- chiamare direttamente Mapillary;
- scaricare 20 immagini;
- eseguire vision;
- gestire provider credentials.

Questo appartiene al servizio.

---

# 83. Credenziali

API token provider:

```text
server-side only
```

Mai bundle client.

---

# 84. Dati che OpenGTA riceve

Solo il manifest finale necessario.

Non inviare:

- immagini;
- token;
- raw provider data;
- migliaia di detections.

---

# 85. Esempio Evidence Profile

```json
{
  "cellId": "rome-cell-001",

  "facadeColors": {
    "scores": {
      "cream": 0.18,
      "sand": 0.31,
      "ochre": 0.34,
      "warm-grey": 0.17
    },
    "dominant": "ochre",
    "confidence": 0.84
  },

  "roofTypes": {
    "scores": {
      "terracotta-tile": 0.63,
      "flat-concrete": 0.24,
      "dark-tile": 0.09,
      "unknown": 0.04
    },
    "dominant": "terracotta-tile",
    "confidence": 0.81
  },

  "sidewalkTypes": {
    "scores": {
      "warm-stone": 0.58,
      "pavers": 0.21,
      "concrete": 0.14,
      "unknown": 0.07
    },
    "dominant": "warm-stone",
    "confidence": 0.76
  },

  "vegetation": {
    "scores": {
      "mediterranean-urban": 0.72,
      "temperate-urban": 0.20,
      "unknown": 0.08
    },
    "dominant": "mediterranean-urban",
    "confidence": 0.73
  }
}
```

---

# 86. Esempio compiled profile

```json
{
  "id": "vps:rome-cell-001:v1",

  "buildings": {
    "facadePalette": "warm-stone",

    "roofFamilies": [
      {
        "id": "terracotta-urban",
        "weight": 0.65
      },
      {
        "id": "flat-warm",
        "weight": 0.25
      },
      {
        "id": "dark-tile",
        "weight": 0.10
      }
    ]
  },

  "roads": {
    "materialFamily": "warm-asphalt"
  },

  "sidewalk": {
    "family": "warm-stone"
  },

  "vegetation": {
    "family": "mediterranean-urban",
    "density": 0.48
  },

  "confidence": {
    "overall": 0.82
  }
}
```

---

# 87. OpenGTA rendering rule

Il renderer non deve interpretare confidence.

Il client riceve un profilo già risolto.

Tutte le decisioni di fallback appartengono al compiler/service.

---

# 88. Catalog mapping

Esempio:

```text
terracotta-tile
   ↓
terracotta-urban
```

```text
zinc
   ↓
zinc-city
```

```text
slate
   ↓
slate-cool
```

---

# 89. Mapping facade

```text
cream + light stone
      ↓
cream-stone
```

```text
sand + ochre + plaster
      ↓
warm-stone
```

```text
brick dominant
      ↓
red-brick
```

---

# 90. Mapping sidewalks

```text
light-stone
  ↓
light-stone-v1
```

```text
warm-stone
  ↓
warm-stone-v1
```

```text
pavers
  ↓
pavers-neutral-v1
```

---

# 91. Urban character as modifier

`historic-dense` può influenzare:

- prop density;
- palette variation;
- roof detail density;
- parked car density limits;
- sidewalk style preference.

Non deve modificare world geometry.

---

# 92. Vegetation density

Vision/detections possono produrre:

```text
treeDensity
```

Il profilo può restituire:

```text
0..1
```

Il renderer/prop system usa tale valore come densità procedurale.

---

# 93. Street furniture density

Analogamente:

```text
bench density
bollard density
lamp density
```

non corrisponde necessariamente a oggetti reali uno-a-uno.

È una guida stilistica.

---

# 94. Due modalità future

## Semantic mode

Il servizio produce solo:

```text
families + distributions
```

Raccomandato.

## Feature placement mode

Il servizio produce anche:

```text
specific geolocated props
```

Non implementare nel VPS v1.

---

# 95. Perché evitare exact feature placement iniziale

Problemi:

- copertura incompleta;
- imagery datata;
- errori triangolazione;
- costi;
- collisioni;
- sincronizzazione world;
- removal/change nel tempo.

Prima creare carattere locale.

---

# 96. Roadmap VPS

## VPS-00 — Architecture decision

Creare:

```text
spec
ADR
tasks
handoff
```

Decisioni:

- provider-neutral;
- evidence layer;
- compiler separato;
- cache evidence/profile separata.

---

# 97. VPS-01 — Offline fixture

Prima di Mapillary live creare fixtures manuali.

Tre `VisualEvidenceProfile`:

```text
Rome-like
Paris-like
Tokyo-like
```

Compilare in profili.

Validare renderer.

Obiettivo:

> verificare il compiler senza provider/network/AI.

---

# 98. VPS-02 — Visual Catalog

Costruire catalogo minimo:

```text
4 facade palettes
4 roof families
3 road families
4 sidewalk families
3 vegetation families
3 street furniture families
```

Non costruire 100 asset.

---

# 99. VPS-03 — Profile Compiler

Implementare:

```text
Evidence → VisualProfile
```

con test puri.

Nessun provider.

---

# 100. VPS-04 — Spatial cells + caches

Implementare:

```text
coordinates → cell
evidence cache
profile cache
```

---

# 101. VPS-05 — OSM evidence collector

Produrre:

```text
building material stats
roof stats
surface stats
land-use context
```

quando disponibili.

---

# 102. VPS-06 — Mapillary provider

Implementare provider adapter.

Obiettivo:

```text
area → sample batch
```

Nessun analyzer ancora.

Verificare:

- rate limits;
- metadata;
- image selection;
- provenance.

---

# 103. VPS-07 — Visual analyzer

Integrare modello vision.

Limitare v1 a:

```text
facade color
facade material
roof type
sidewalk type
road surface
vegetation character
urban character
```

---

# 104. VPS-08 — Evidence aggregator

Unire:

```text
OSM
vision
detections
```

con confidence.

Produrre `VisualEvidenceProfile`.

---

# 105. VPS-09 — End-to-end Rome/Paris/Tokyo

Testare:

```text
Rome
Paris
Tokyo
```

Coordinate note di test.

Per ciascuna:

```text
collect
analyze
aggregate
compile
cache
serve
render
```

---

# 106. VPS-10 — Runtime API

Integrare OpenGTA:

```text
GET /v1/profile
```

fallback LVP immediato.

Switch a generated profile quando disponibile.

---

# 107. VPS-11 — Performance/cost measurement

Misurare:

```text
provider requests per cell
images analyzed per cell
analysis duration
cache hit rate
cost per generated cell
```

Non scalare prima di conoscere questi valori.

---

# 108. VPS-12 — Coverage QA

Testare:

- centro città;
- periferia;
- industriale;
- suburbano;
- area con scarsa imagery.

Validare fallback.

---

# 109. Gate VPS v1

VPS è GO solo se:

1. Rome/Paris/Tokyo risultano distinti;
2. profilo generato è più utile del solo country theme;
3. output deterministico;
4. costi controllabili;
5. cache efficace;
6. provider failure non rompe OpenGTA;
7. visual identity resta coerente con stile OpenGTA.

---

# 110. NO-GO conditions

Fermare o ripensare se:

- il risultato sembra casuale;
- la vision produce instabilità;
- differenze fra città sono minime;
- costo per cella troppo alto;
- imagery insufficiente in gran parte delle aree;
- licensing rende impossibile persistere i dati necessari;
- OpenGTA non possiede abbastanza asset/families per rappresentare le osservazioni.

---

# 111. Prima alternativa a un NO-GO

Non buttare il progetto.

Ridurre VPS a:

```text
Country/City profile recommender
```

invece di:

```text
hyperlocal profile generator
```

Il servizio può ancora proporre profili a livello city.

---

# 112. QA visuale

Per ogni test:

- stessa camera;
- stesso zoom;
- stessa posizione;
- stessa geometria;
- profilo local fallback;
- profilo VPS.

Confrontare.

---

# 113. QA semantico

Verificare manualmente che il profilo non faccia errori grossi.

Esempio:

```text
Paris:
terracotta 80%
```

deve essere investigato.

Non accettare il risultato solo perché la pipeline funziona.

---

# 114. Dataset di validazione

Creare un piccolo set curated.

Esempio:

```text
Rome historic
Rome residential
Paris central
Paris residential
Tokyo dense
Tokyo residential
London
Berlin
Barcelona
```

Non serve inizialmente enorme.

Serve stabile.

---

# 115. Regression fixtures

Salvare:

```text
provider-independent observations
```

non immagini se licensing problematico.

Fixture:

```text
VisualObservation[]
OSM evidence
```

Così compiler/aggregator sono testabili offline.

---

# 116. Determinismo

A parità di:

```text
evidenceRevision
compilerRevision
catalogRevision
```

il profile deve essere identico.

---

# 117. Reproducibility

Ogni generated profile deve poter spiegare:

```text
quale evidence revision
quale compiler
quale catalog
```

lo ha prodotto.

---

# 118. Diagnostics

Endpoint/dev output:

```json
{
  "profileId": "...",
  "cellId": "...",
  "sources": {
    "osm": true,
    "streetImagery": true
  },
  "samples": 18,
  "coverage": 0.81,
  "confidence": 0.84,
  "compilerRevision": "5",
  "catalogRevision": "3"
}
```

---

# 119. Explainability

Per debug interno poter sapere:

```text
roofFamily terracotta
because:
  OSM roof tiles score
  vision terracotta 0.62
```

Non serve mostrare all'utente.

Serve per QA.

---

# 120. Profile evidence trace

Possibile:

```ts
export interface ProfileDecisionTrace {
  readonly field: string;
  readonly selected: string;
  readonly confidence: number;
  readonly reasons: readonly string[];
}
```

Solo debug/server.

---

# 121. Update policy

Una cella non deve essere rigenerata a ogni richiesta.

Possibile TTL:

```text
evidence: settimane/mesi
profile: finché catalog/compiler invariati
```

Configurabile.

---

# 122. Trigger update

Rigenerare evidence quando:

- imagery significativamente nuova;
- OSM aggiornato;
- analyzer revision importante;
- QA manuale richiede refresh.

---

# 123. Curated override

Deve esistere in futuro:

```text
manual profile override
```

per aree problematiche.

Priorità:

```text
manual override
↓
generated
↓
city/country
↓
default
```

---

# 124. Curated profile non è un fallimento

Alcuni luoghi importanti possono meritare art direction manuale.

VPS serve a coprire il mondo.

Non deve impedire cura artistica.

---

# 125. Versioning

API:

```text
/v1/profile
```

Schema:

```text
schemaVersion: 1
```

Catalog:

```text
catalogRevision
```

Compiler:

```text
compilerRevision
```

Evidence:

```text
evidenceRevision
```

---

# 126. Backward compatibility

OpenGTA deve poter usare:

```text
VisualProfile schema v1
```

anche quando il backend evolve.

Non cambiare frequentemente il contratto client.

---

# 127. Future satellite integration

Solo dopo VPS v1.

Possibili benefici:

- tree cover;
- built-up density;
- water proximity;
- large-scale land cover.

Non utile primariamente per facciate.

---

# 128. Future environmental context

Possibili dati:

- climate zone;
- elevation;
- coast proximity;
- vegetation zone.

Usarli come priors, non verità assolute.

---

# 129. Future multi-provider

Il sistema deve poter fare:

```text
provider A
+ provider B
```

con source trust weights.

---

# 130. Source trust

Configurabile per attributo.

Esempio:

```text
roof material:
OSM explicit    1.0
vision imagery  0.8

facade color:
OSM colour      1.0
vision imagery  0.9

vegetation:
imagery         0.8
OSM natural     0.6
```

Non hardcodare globalmente un singolo trust.

---

# 131. User-generated corrections

Future.

Possibile:

```text
"this area looks wrong"
```

per QA.

Non implementare inizialmente.

---

# 132. Profile service non deve diventare mission-critical

OpenGTA deve sempre funzionare senza VPS.

Principio:

```text
VPS enhances
LVP guarantees baseline
```

---

# 133. OpenGTA client flow finale

```text
startup
 ↓
world load
 ↓
LocationContext
 ↓
LVP immediate profile
 ↓
render

parallel:
 ↓
VPS request
 ↓
cached/generated profile
 ↓
renderer.setVisualProfile()
```

---

# 134. Evitare visual pop eccessivo

Quando VPS arriva:

MVP:

```text
instant switch
```

accettabile per debug.

Produzione futura:

```text
short palette/material transition
```

Non implementare prima che il profiling funzioni.

---

# 135. Relazione con OpenGTA 2D+

VPS decide:

```text
WHAT
```

2D+ decide:

```text
HOW
```

Esempio:

VPS:

```text
roofFamily = terracotta-urban
shadow = warm-neutral
vegetation = mediterranean
```

2D+:

```text
disegna tetto
applica edge shading
genera roof props
genera alberi
```

---

# 136. Relazione con world data

VPS non cambia:

- strade;
- geometria edifici;
- collisioni;
- world coordinates;
- MVT;
- Rapier.

---

# 137. Non confondere semantic appearance con geometry

Esempio:

```text
historic-dense
```

NON significa:

```text
aumentare artificialmente numero edifici
```

Significa:

```text
usare art direction coerente con quel carattere
```

---

# 138. Minimum viable catalog

Prima di VPS reale servono almeno:

## facades

```text
cream-stone
warm-stone
brick
modern-neutral
```

## roofs

```text
terracotta
zinc
slate
flat-neutral
```

## sidewalks

```text
light-stone
warm-stone
concrete
pavers
```

## roads

```text
cool-asphalt
neutral-asphalt
warm-asphalt
```

## vegetation

```text
mediterranean
temperate
continental
```

---

# 139. Senza catalogo VPS non ha valore

Se il renderer può rappresentare solo:

```text
un tetto
una strada
un marciapiede
```

l'AI può osservare il mondo quanto vuole ma non potrà mostrarlo.

Quindi prima di scalare VPS, aumentare lentamente la capacità espressiva OpenGTA.

---

# 140. Primo esperimento VPS consigliato

Non partire dal backend completo.

Creare manualmente tre evidence profiles:

```text
Rome evidence
Paris evidence
Tokyo evidence
```

Passarli al compiler.

Renderizzare.

Se funziona:

```text
Mapillary provider
```

Se non funziona:

```text
migliorare catalog/renderer
```

Questo evita settimane di infrastruttura inutile.

---

# 141. Secondo esperimento

Mapillary solo.

Una piccola area di Rome.

Estrarre:

```text
12-20 immagini
```

Analizzare solo:

```text
facade color
roof type
sidewalk
vegetation
```

Nient'altro.

Compilare.

Confrontare con profilo Rome manuale LVP.

---

# 142. Terzo esperimento

Ripetere:

```text
Paris
Tokyo
```

Se il sistema distingue bene tutte e tre:

```text
GO VPS
```

---

# 143. Target del progetto

A maturità:

```text
drive anywhere
↓
OpenGTA knows local visual identity
↓
world automatically adapts
```

Senza creare manualmente ogni città.

---

# 144. Principio di prodotto

OpenGTA non cerca di replicare il mondo fotograficamente.

Cerca di:

> riconoscere il carattere visivo di un luogo reale e reinterpretarlo in un linguaggio grafico coerente.

---

# 145. Distinzione fondamentale

Non è:

```text
Street View inside OpenGTA
```

È:

```text
Street imagery
   ↓
semantic understanding
   ↓
OpenGTA art direction
```

---

# 146. Proprietà intellettuale del sistema

La parte più distintiva del progetto non è il provider.

È:

```text
VisualEvidence schema
+
aggregation
+
confidence
+
Visual Catalog
+
Profile Compiler
```

Il provider può cambiare.

Questa pipeline resta.

---

# 147. Cosa NON fare

Non:

- usare immagini come texture dirette;
- generare asset casuali per cella;
- memorizzare provider token nel browser;
- dipendere da un provider unico;
- fare vision nel render loop;
- fare una richiesta per edificio;
- fare una richiesta per frame;
- usare free-form AI output;
- usare `Math.random()` nel profilo;
- rigenerare una cella a ogni visita;
- lasciare che l'AI scelga hex colors arbitrari;
- lasciare che l'AI inventi asset;
- cambiare geometry/physics in base al profilo;
- costruire clustering prima delle celle;
- costruire 100 città prima di Rome/Paris/Tokyo.

---

# 148. Documentazione richiesta quando si inizia VPS

Creare:

```text
docs/specs/visual-profile-service-v1.md
```

Creare ADR:

```text
ADR-0XX-visual-profile-service.md
```

Decisione centrale:

> OpenGTA visual profiles may be generated from geographic evidence through a provider-neutral evidence pipeline, but provider data, vision analysis, aggregation and rendering remain separate layers.

Aggiornare:

```text
docs/SPEC.md
docs/handoff/CURRENT.md
tasks/plan.md
tasks/todo.md
```

---

# 149. Definition of Done VPS v1

- [ ] spatial cell abstraction;
- [ ] provider-neutral imagery interface;
- [ ] OSM evidence collector;
- [ ] Mapillary provider;
- [ ] structured visual analyzer;
- [ ] closed vocabulary;
- [ ] evidence aggregation;
- [ ] confidence model;
- [ ] evidence cache;
- [ ] visual catalog;
- [ ] profile compiler;
- [ ] profile cache;
- [ ] API profile endpoint;
- [ ] LVP fallback;
- [ ] Rome test;
- [ ] Paris test;
- [ ] Tokyo test;
- [ ] reproducible output;
- [ ] provenance stored;
- [ ] provider credentials server-side;
- [ ] offline/compiler tests;
- [ ] visual QA documented;
- [ ] performance/cost measured.

---

# 150. Risultato atteso

Il risultato finale della fase non deve essere:

```text
Roma = un file theme scritto a mano
```

ma:

```text
Roma
↓
evidence from real world
↓
semantic profile
↓
OpenGTA interpretation
```

E analogamente per qualunque altra zona coperta.

---

# 151. Visione finale

La pipeline ideale:

```text
                     REAL WORLD
                         │
                         ▼
                 Geographic sources
                ┌────────┴────────┐
                │                 │
               OSM         street imagery
                │                 │
                └────────┬────────┘
                         ▼
                 Visual Evidence
                         │
                         ▼
                    Aggregator
                         │
                         ▼
                Semantic Profile
                         │
                         ▼
                 Profile Compiler
                         │
                         ▼
                  Visual Catalog
                         │
                         ▼
                 OpenGTA Profile
                         │
                         ▼
                  2D+ Renderer
                         │
                         ▼
               LOCAL VISUAL IDENTITY
```

Questa è la direzione del **Visual Profile Service v1**.

---

# 152. Decisione operativa

Quando il test LVP sarà positivo:

1. NON partire subito dalle API Mapillary.
2. Creare prima `VisualEvidenceProfile`.
3. Creare `VisualCatalog`.
4. Creare `ProfileCompiler`.
5. Testare Rome/Paris/Tokyo con evidence fixtures.
6. Solo dopo integrare Mapillary.
7. Solo dopo aggiungere vision.
8. Solo dopo creare il servizio runtime.
9. Misurare costi e qualità.
10. Estendere la copertura soltanto se il gate VPS è positivo.

---

# 153. Regola finale

Il sistema deve restare valido anche se domani Mapillary viene sostituito.

Se sostituire Mapillary richiede riscrivere:

```text
compiler
renderer
VisualProfile
```

l'architettura è sbagliata.

La sorgente osserva.

Il VPS interpreta.

OpenGTA rappresenta.
