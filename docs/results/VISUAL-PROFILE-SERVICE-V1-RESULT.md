# Visual Profile Service — slice offline VPS-00..03 + gate (2026-09-21)

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

## Test

- Nuovi: **19/19** in `src/vps` (evidence 6, catalog 4, compiler 9):
  validità fixture, minimi catalogo + seed deep-equal da LVP + risolvibilità
  dei dominanti delle fixture, palette per città, distinzione 3 famiglie,
  determinismo (deep-equal + JSON), low-confidence → parent, completezza del
  `GeneratedVisualProfile` (id/versioni/confidenza, nessun `undefined`),
  ereditarietà campi non coperti, override `?vps=` (closed registry).
- Gate completa: `typecheck` pulito; unit **569/569** (baseline 550 + 19);
  `build` ok (warning chunk size preesistente); e2e **42 passed + 1 skipped**
  (canary) — identico alla baseline.

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

**GO** — le condizioni della slice offline sono soddisfatte. Prossime tranche
(secondo la roadmap spec): cell spaziale + contratto service
(`GET /v1/profile?lat&lon`, cache evidenza/profilo separate, credenziali
server-side) e poi primo provider reale (Mapillary, §152: mai prima di questo
gate). E2E del flow VPS in VPS-10. Se il gate futuro fallisse: degrado a
recommender paese/città (§110-111), mai blocco del client.
