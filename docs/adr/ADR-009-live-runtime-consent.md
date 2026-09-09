# ADR-009 — Provider-neutral live runtime and explicit consent

**Status:** Accepted for prototype
**Date:** 2026-08-26

## Context

Open World Runtime deve poter acquisire dati geografici live, ma il progetto
non ha ancora scelto provider, policy commerciale o consenso prodotto.
Attivare una rete pubblica implicitamente dal bootstrap renderebbe il runtime
non deterministico e trasferirebbe dati senza un’azione esplicita dell’utente.

## Decision

- Il core usa un `GeoDataSource` provider-neutral.
- Il live adapter HTTP riceve l’endpoint esplicitamente configurato.
- La modalità live richiede `mode=open-world-live`, `endpoint=<url>` e
  `consent=1`.
- Per OpenStreetMap è disponibile `provider=osm`, che usa l’endpoint Overpass
  predefinito e invia una query POST con bbox.
- Le risposte transitorie `429` e `503` vengono ritentate con backoff bounded
  sullo stesso endpoint; non si ruotano mirror per aggirare rate limit.
- L’endpoint deve usare `http` o `https`, avere lunghezza bounded e passare dal
  timeout/rate-limit boundary.
- Il default resta offline e deterministico sul fixture.
- La scelta del provider e l’eventuale UI di consenso definitiva sono separate
  decisioni di prodotto e non sono hard-coded nel core.

## Consequences

Il runtime è testabile senza rete pubblica e non effettua acquisizioni live
implicite. Un prodotto distribuito dovrà fornire una UI di consenso e una
allowlist/policy endpoint prima di esporre il modo live agli utenti finali.
Overpass pubblico è un endpoint condiviso e non va trattato come backend di
produzione senza una policy dedicata. Il client applica retry limitati sul
default pubblico, senza fallback automatici o rotazione di mirror.
