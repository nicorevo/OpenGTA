# Execution Log — Runtime Alignment

Date: 2026-08-25

## Scope

Sanare due divergenze tra runtime e documentazione V0:

1. frame handling/fixed-step della fisica;
2. fallback di `visualHeightMeters` per gli edifici.

## Actions Performed

1. Aggiunti test dedicati per la schedulazione fixed-step.
2. Estratto un helper `app/fixed-step.ts` con:
   - dt fisso a `1/60 s`;
   - clamp del frame delta a `0.25 s`;
   - cap di `5` catch-up step;
   - scarto del debito eccedente.
3. Collegato `bootstrap.ts` al nuovo scheduler, mantenendo invariati adapter e
   wiring del runtime.
4. Aggiornato il fallback del compiler edifici da `6 m` a `9 m`.
5. Aggiunto un test che blocca esplicitamente il fallback documentato.

## Verification

- `npm run test:run` PASS (`13` file, `36` test)
- `npm run typecheck` PASS
- `npm run build` PASS

## Notes

Il warning Vite sul chunk > `500 kB` resta presente ed è coerente con lo stato
già documentato del prototipo V0.
