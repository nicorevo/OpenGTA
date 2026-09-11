# Checklist: City Drive Stable

Data: 2026-09-11.
Stato: pianificato; nessun task avviato.

Fonte: [piano](plan.md). Prima di eseguire leggere
[contratti e procedura](city/README.md). Le checkbox sono una vista sintetica:
l'accettazione resta nella scheda, il dettaglio delle prove nel log.

## Solidità

- [x] [SOLID-01](city/SOLID-01.md): metriche compiler reali.
- [x] [SOLID-02](city/SOLID-02.md): cancellazione compile.
- [ ] [SOLID-03](city/SOLID-03.md): benchmark patologici.
- [ ] [SOLID-04](city/SOLID-04.md): renderer incrementale.
- [ ] [SOLID-05](city/SOLID-05.md): long-drive regression.
- [x] [SOLID-06](city/SOLID-06.md): SECURITY e gate docs.
- [ ] C-A: solidità.

## Zoom

- [x] [ZOOM-01](city/ZOOM-01.md): stato camera.
- [ ] [ZOOM-02](city/ZOOM-02.md): API zoom renderer.
- [ ] [ZOOM-03](city/ZOOM-03.md): controlli +/−.
- [ ] [ZOOM-04](city/ZOOM-04.md): streaming reagisce allo zoom.
- [ ] [ZOOM-05](city/ZOOM-05.md): test zoom.
- [ ] C-B: zoom base.

## LOD

- [x] [LOD-01](city/LOD-01.md): politica zoom→LOD.
- [ ] [LOD-02](city/LOD-02.md): label per tier.
- [ ] [LOD-03](city/LOD-03.md): facade per tier.
- [ ] [LOD-04](city/LOD-04.md): road detail per tier.
- [ ] [LOD-05](city/LOD-05.md): culling feature.
- [ ] C-C: LOD.

## Cache persistente

- [x] [CACHE-01](city/CACHE-01.md): contratto storage.
- [ ] [CACHE-02](city/CACHE-02.md): esperimento IndexedDB.
- [ ] [CACHE-03](city/CACHE-03.md): versioning e integrità.
- [ ] [CACHE-04](city/CACHE-04.md): eviction.
- [ ] C-D: cache persistente.

## Gate

- [ ] [CITY-01](city/CITY-01.md): canary reale.
- [ ] [CITY-02](city/CITY-02.md): gate City Drive Stable.
- [ ] C-E: gate finale.

## Storico

La tranche ONLINE completata (ONLINE-01..16, C1..C6) è conservata in
[archivio piano](archive/2026-09-10-plan.md) e
[archivio checklist](archive/2026-09-10-todo.md).
Il [backlog differito](online/FOLLOW-UPS.md) resta fuori da questa consegna
salvo riapertura esplicita (cache persistente = NEXT-03).
