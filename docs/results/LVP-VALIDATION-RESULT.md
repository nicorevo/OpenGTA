# OpenGTA — LVP Validation Result

**Data:** 2026-09-21  
**Feature:** Location Visual Profiles (LVP)  
**Stato:** **GO — primo gate superato**

---

## Obiettivo del test

Verificare che OpenGTA possa applicare identità visive differenti alla **stessa identica geometria**, senza modificare:

- world data;
- chunk;
- fisica;
- collisioni;
- camera;
- posizione del veicolo;
- provider geografico.

Il test è stato eseguito forzando manualmente il tema tramite query string.

Esempi:

```text
?theme=france
?theme=rome
```

---

## Setup

Stessa area geografica:

```text
Lecce, Puglia, Italia
```

Stessa:

- posizione;
- camera;
- zoom;
- geometria;
- world provider;
- sessione di rendering.

Unica variabile modificata:

```text
VisualProfile
```

---

## Risultato

### France

Il profilo `france` produce una resa:

- più fredda;
- più neutra;
- più grigio/blu;
- con tetti e superfici che suggeriscono pietra chiara, ardesia e zinco;
- complessivamente più sobria.

### Rome

Il profilo `rome` produce una resa:

- più calda;
- più ocra;
- più terracotta;
- più sabbia/beige;
- con una sensazione più mediterranea.

---

## Esito visuale

La differenza fra i due profili è percepibile anche senza leggere il parametro `theme`.

La stessa geometria assume due identità chiaramente differenti.

Questo valida il principio architetturale:

```text
same world
+
different VisualProfile
=
different local visual identity
```

---

## Cosa dimostra il test

Il test conferma che:

1. il tema è separato dalla geografia;
2. il renderer può cambiare identità senza cambiare il mondo;
3. il world compiler non deve conoscere la città;
4. il profilo visuale può essere sostituito runtime;
5. la stessa area può essere usata per confronti controllati;
6. la feature LVP è abbastanza forte da giustificare sviluppo ulteriore;
7. OpenGTA può distinguere località tramite art direction, non tramite nuova geometria.

---

## Gate result

### LVP visual gate

**GO**

Il sistema non si comporta come un semplice cambio di un singolo colore.

La combinazione di:

```text
building palette
roof palette
ground
roads
sidewalks
```

è sufficiente per produrre una differenza percepibile.

---

## Osservazioni

### Rome

Il profilo `rome` risulta attualmente più espressivo.

Punti forti:

- terracotta leggibile;
- palette coerente;
- identità immediata;
- buona separazione dal profilo France.

### France

Il profilo `france` funziona ma appare ancora più vicino a una resa cartografica neutra.

Possibili miglioramenti:

- maggiore varietà cream / limestone / taupe;
- meno uniformità nei tetti;
- migliore separazione fra roof e facade;
- introdurre più varianti senza aumentare saturazione.

---

## Limiti del test

Questo test non valida ancora:

- correttezza geografica automatica;
- `theme=auto`;
- reverse geocoding completo;
- fallback country/city;
- materiali procedurali;
- props locali;
- vegetazione locale;
- street furniture;
- Visual Profile Service;
- Mapillary;
- generazione automatica dei profili.

Valida solamente il principio:

> un `VisualProfile` può cambiare in modo convincente l'identità locale della stessa geometria.

---

## Prossimi step raccomandati

### 1. Stabilizzare LVP

Rifinire:

```text
default
france
paris
italy
rome
```

---

### 2. Validare auto-resolution

Testare:

```text
?theme=auto
```

e verificare correttamente:

```text
LocationContext
→ resolver
→ VisualProfile
```

---

### 3. Aggiungere un terzo profilo molto diverso

Raccomandato:

```text
tokyo
```

oppure:

```text
nairobi
```

Scopo:

> verificare che il sistema non funzioni soltanto con differenze europee caldo/freddo.

---

### 4. Validare tre famiglie visuali

Esempio target:

```text
Rome
Paris
Tokyo
```

Se tutte risultano distinguibili:

```text
LVP architecture = validated
```

---

### 5. Solo dopo iniziare VPS

Avviare:

```text
Visual Profile Service
```

con ordine:

```text
VisualEvidenceProfile
↓
VisualCatalog
↓
ProfileCompiler
↓
fixtures Rome/Paris/Tokyo
↓
Mapillary
↓
Vision
↓
runtime service
```

---

## Decisione

Il test LVP è considerato riuscito.

La direzione:

```text
location-aware visual identity
```

rimane attiva.

Non tornare a una soluzione basata esclusivamente su:

```text
fake 3D
building extrusion
camera-dependent projection
```

per ottenere il salto visuale.

La nuova direzione del progetto resta:

```text
real geography
+
2D visual language
+
location-specific VisualProfile
```

---

## Conclusione

Il primo esperimento ha dimostrato che OpenGTA può separare:

```text
WHERE
```

dal:

```text
HOW IT LOOKS
```

La geografia determina il mondo.

Il `VisualProfile` determina la sua identità.

Questo risultato autorizza il proseguimento di LVP e, dopo la validazione completa, l'avvio del `Visual Profile Service`.
