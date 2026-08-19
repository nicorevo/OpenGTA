# Synthetic Mini-City Expected Invariants

Compiler tests should verify at minimum:

- 4 building feature IDs survive into feature lookup metadata;
- 2 road features compile to non-empty road surfaces;
- building B retains a courtyard/hole in canonical input;
- buildings receive collision output except an explicit policy says otherwise;
- road surfaces do not produce building-style solid collision;
- all compiled coordinates remain inside a reasonable expansion of the
  canonical bounds;
- deterministic compiler runs produce equivalent structural output.
