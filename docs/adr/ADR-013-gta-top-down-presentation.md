# ADR-013: Presentazione GTA dall'alto con PixiJS e profondita' visiva

Data: 2026-09-20.
Stato: Proposed; il PoC G2D-02 deve validare tecnica e limiti prima dell'adozione.
Contesto: [analisi](../analysis/GTA-2D-VISUAL-GAP-2026-09-20.md),
[spec](../specs/gta-2d-city-v1.md).

## Decisione proposta

Mantenere il mondo canonico e le collisioni nel piano 2D. Aggiungere al renderer
PixiJS superfici con texture e facciate derivate dai bordi reali degli edifici,
con tetti proiettati rispetto alla camera top-down. Materiali locali condivisi,
geometrie statiche preparate per chunk e aggiornamento dei soli elementi visivi
dipendenti dalla camera. Il dettaglio degrada tramite LOD.

Separare seed/identita'/bordi sorgente dai frammenti di streaming; estendere in
modo opzionale il compilato e validare la cache. Risolvere occlusione e bounds
proiettati nel PoC, prima di applicare la tecnica alla citta' intera.

## Alternative considerate

| Opzione | Vantaggio | Limite / decisione |
| --- | --- | --- |
| Ricolorare i poligoni attuali | Piccolo costo | Non produce pareti, texture o raccordi; insufficiente per il riferimento |
| Sprite prerenderizzato per ogni edificio | Resa controllata | Poco adatto a sagome arbitrarie e prospettiva che cambia con camera; utile solo per props |
| Pixi con mesh e materiali | Riusa stack e core; controlla UV e proiezione | Ordinamento, clipping e mesh concave vanno provati; opzione raccomandata |
| Citta' 3D in un altro motore | Depth buffer e proiezione nativi | Migrazione e pipeline aggiuntive; rivalutare solo se PoC mostra costo/complessita' Pixi inaccettabili |

## Conseguenze

Il look richiede produzione artistica oltre al codice. I dati geografici non
forniscono texture di finestre e facciate. Il clipping preesistente deve
conservare la provenienza dei bordi. Il semplice painter order per chunk e
l'attuale maschera stradale non sono compatibili con tutte le nuove occlusioni.

L'esito del PoC puo' restringere il dettaglio o richiedere una revisione di
questa ADR; non autorizza implicitamente cambio motore, nuove dipendenze o
fisica tridimensionale. La specifica precedente `gta-world-detail-v1` resta
evidenza della palette consegnata; questa proposta ne estende il livello visivo.

## Evidenza richiesta per accettazione

Un incrocio giocabile con edificio rettangolare, concavo e con cortile; camera
in quattro quadranti; nessuna discontinuita' tra triangoli delle finestre;
ordine tra due edifici di altezze diverse e taxi leggibile. Registrare costo
di aggiornamento/proiezione, bounds e fallback. Risultato in
`docs/results/GTA-2D-PROJECTION-RESULT.md` da creare in G2D-02.

## Riferimenti tecnici

- [Mesh PixiJS](https://pixijs.com/8.x/guides/components/scene-objects/mesh): geometria, UV e proiezioni.
- [Prestazioni PixiJS](https://pixijs.com/8.x/guides/concepts/performance-tips): batching, texture, maschere e oggetti statici.
