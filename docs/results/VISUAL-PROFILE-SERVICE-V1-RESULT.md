# Visual Profile Service — slice offline VPS-00..04 + gate (2026-09-21)

Branch `opcl-location`. Spec: `docs/specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md`
(§140: primo esperimento = 3 profili evidence manuali → compiler → rendering;
§152: gate offline prima di qualsiasi provider). Decisioni: `docs/adr/ADR-015-visual-profile-service.md`.

## Cosa è stato consegnato

- **VPS-00** — ADR-015 + allineamento `docs/SPEC.md`, `docs/adr/README.md`,
  `tasks/plan.md`, `tasks/todo.md`, `docs/handoff/CURRENT.md`.
- **VPS-01** — `src/vps/evidence/`: tipi provider-neutral con vocabolari
  chiusi (8 dimensioni di `Distribution<T>`), `SpatialCell` (contratto, H3 non
  esposto), `VisualEvidenceProfile`; 3 fixture offline Rome/Paris/Tokyo-like
  (`evidenceRevision: fixture-v1`, cell `vps-fixture-{rome-historic,
  paris-central, tokyo-dense}`). La fixture rome replica l'esempio spec §85
  (ocra dominante, terracotta-tile 0.63).
- **VPS-02** — `src/vps/catalog/`: `VisualCatalog` revision 1 con i minimi
  spec §138 (4 facade / 4 roof / 3 road / 4 sidewalk / 3 vegetation /
  3 furniture), semiato dai 6 profili LVP validati: i colori veri vivono solo
  qui (§47). Decisione: `cool-zinc` taggato solo `cool-grey` (con i tag
  extra batteva `cream-stone` su Parigi, 0.88 vs 0.68).
- **VPS-03** — `src/vps/compiler/`: `ProfileCompiler` puro (nessun DOM,
  network, provider, timestamp, `Math.random`):
  - famiglie pesate → palette concrete (§50-51): slot i, centro
    `(i+0.5)/8`, copertura cumulativa dei pesi normalizzati, variante
    `stableStringHash("<profileId>:roof:<i>") % n`;
  - confidenza categoria < 0.35 → valore parent LVP (§68; banda 0.35–0.60
    rinviata, §70);
  - id versionato `vps:v1:<cellId>:c<compilerRevision>` (§53; cellId senza
    due punti);
  - `generatedAt` = `retrievedAt` dell'evidence: il compiler resta puro, il
    service timbra la sua wall-clock al cache-write (§116);
  - decisione v1 documentata: roads (base+classes), ground base/water,
    typeStyles, outline, depth2d, markings ereditano il parent — il material
    della superficie stradale non determina la tint OpenGTA, quella è
    art direction LVP; le `roadFamilies` del catalogo restano versionate per
    una revisione compiler successiva;
   - hook dev `?vps=rome|paris|tokyo` in `src/app/bootstrap.ts` (registro
     chiuso, ignora silenzioso di id sconosciuti, stessa disciplina di
     `?theme=`): compila la fixture sul parent risolto da LVP, quindi la
     gerarchia di fallback generated → LVP → default è preservata e il
     renderer non blocca mai il client.
- **VPS-04** — `src/vps/cell/` + `src/vps/cache/`: `cellForCoordinates`
  (h3-js, res 9) e le due cache separate §56 (`EvidenceCache`,
  `ProfileCache`) con chiavi §55. Dettaglio nella sezione VPS-04 qui sotto.

## VPS-04 — celle spaziali + cache

- **Dipendenza**: `h3-js` (binding ufficiali H3). Nota: il pacchetto npm
  `h3` è la lib HTTP di Hono, **non** Uber H3 — il nome corretto è `h3-js`.
  Il contratto pubblico resta `SpatialCell` (§10): l'id è una stringa opaca
  `h3:<index>` e il codice non espone l'indice H3 altrove.
- **Risoluzione**: res 9. Misurato con il build h3-js in uso: bounding box
  ~413 m N-S / ~374 m E-W a 42°N → dentro la banda MVP 300-700 m (§12).
  (Res 8 misurerebbe ~1060 m: fuori banda; res 10 ~150 m: troppo fine.)
- **Celle**: deterministiche (stesse coordinate → stessa cella, sempre),
  punto ∈ bounds, ~50 m di offset restano nella stessa cella, le 3 città
  delle fixture + Lecce su celle distinte, validazione `RangeError` per
  lat/lon fuori range o non finiti. Limitazione MVP documentata: le bounds
  sono la scatola assiale dell'esagono, celle che attraversano l'antimeridiano
  (±180°) non supportate.
- **Cache** (in-memory pure, spec §54): `EvidenceCache` chiave
  `cell:<id>|schema:<v>|evidence:<rev>` (l'evidence non dipende da
  compiler/catalogo — §56: ricompilare non invalida l'analisi) e
  `ProfileCache` chiave `cell:<id>|schema:<v>|compiler:<c>|catalog:<k>`
  (esempio spec §55): nuovo catalogo o compiler → miss → ricompilazione,
  evidence intatta. Nuova revisione evidence non shadowing la precedente
  (§57). Persistenza/TTL sono concern del service (VPS-10), non del core.
- **Pipeline** (flusso §11): test end-to-end lat/lon → cell id → evidence
  cache → compiler → profile cache; la seconda richiesta alla stessa
  cella è servita interamente dalle cache (stessi riferimenti d'oggetto).
- Niente cambio bootstrap/hook: `?vps=` resta fixture-based; le celle
  servono il service (VPS-10) quando arriverà l'evidence reale per cella.

## Test

- VPS-00..03: **19** (evidence 6, catalog 4, compiler 9): validità fixture,
  minimi catalogo + seed deep-equal da LVP + risolvibilità dei dominanti
  delle fixture, palette per città, distinzione 3 famiglie, determinismo
  (deep-equal + JSON), low-confidence → parent, completezza del
  `GeneratedVisualProfile` (id/versioni/confidenza, nessun `undefined`),
  ereditarietà campi non coperti, override `?vps=` (closed registry).
- VPS-04: **17** (cell 8, cache+pipeline 9): contratto `SpatialCell`,
  determinismo cella, stabilità a ~50 m, 3 città distinte, punto ∈ bounds,
  banda 300-700 m, altre risoluzioni, validazione coordinate; formato chiavi
  §55, round-trip cache, miss su nuovo compiler/catalogo (recompile senza
  reanalyze), no-shadowing revisioni evidence, pipeline lat/lon→cell→cache.
- Gate completa (dopo VPS-04): `typecheck` pulito; unit **586/586**
  (baseline 550 + 19 + 17); `build` ok (warning chunk size preesistente);
  e2e **42 passed + 1 skipped** (canary) — identico alla baseline.
  Nota: `runtime-session.test.ts > drives a long looped route…` è un flake
  preesistente sotto carico della suite piena (test di timing ~5,7 s):
  nessun riferimento a vps/h3, 3/3 verde in isolamento, ricorre solo a suite
  completa (stesso pattern del flake 549/550 già documentato).

## Gate della slice (spec §140)

Geometria live Roma (lat 41.8992, lon 12.4769), 1280×720, dev server
effimero. Sei rendering, stessa geometria (strade/taxi/etichetta identici),
solo variabile il profilo applicato (verificato via
`window.__opengtaV0Debug.theme().id`):

- LVP (cura): `/tmp/vps-gate-rome-lvp.png` (sha256 `5304282e…`),
  `/tmp/vps-gate-paris-lvp.png` (`140d3e14…`),
  `/tmp/vps-gate-tokyo-lvp.png` (`d5ed0476…`);
- VPS generati (`vps:v1:vps-fixture-…:c1`):
  `/tmp/vps-gate-rome-vps.png` (`16a89ce7…`) — ocra/terracotta calda;
  `/tmp/vps-gate-paris-vps.png` (`dab69412…`) — zincato azzurro + facciate
  crema;
  `/tmp/vps-gate-tokyo-vps.png` (`fa895b5a…`) — carbone + acciaio, la più
  scura.

Esito: le 3 famiglie **generata** restano distinte a colpo d'occhio e
semanticamente coerenti (caldo romano / zincato parigino / scuro tokyota);
il rome generato è coerente con il rome curato LVP, come atteso perché il
catalogo è semiato da LVP. Zero pageerror sui tre casi VPS; un 504 transitorio
dell'endpoint OSM sul caso rome-lvp (fallback mirror, stato `ready`).

## Esito

**GO** — la slice offline (VPS-00..04) è completa: evidence, catalogo,
compiler, celle spaziali e le due cache sono pronti e testati. Prossime
tranche (roadmap spec): VPS-05 OSM evidence collector (statistiche materiali
tetti/superfici/land-use "quando disponibili"), poi VPS-06 Mapillary provider
(area → sample batch, rate limits, provenance) e VPS-10 runtime API
(`GET /v1/profile?lat&lon` sopra le cache qui definite, credenziali
server-side, e2e del flow). E2E del flow VPS in VPS-10. Se un gate futuro
fallisse: degrado a recommender paese/città (§110-111), mai blocco del client.
