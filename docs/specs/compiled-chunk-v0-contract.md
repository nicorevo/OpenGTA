# CompiledChunk V0 — In-Memory Contract

**Status:** Normative V0 semantic output  
**Persistence:** not yet a final serialized format

## Purpose

Provide one renderer/physics-neutral compiled unit.

V0 may compile the whole 600 m fixture into one logical chunk if that keeps the
first implementation simpler.

## Conceptual structure

```ts
interface CompiledChunkV0 {
  readonly schemaVersion: 0;
  readonly id: string;

  readonly spatial: {
    readonly regionId: string;
    readonly bounds: Bounds2D;
    readonly originOffset: Vec2;
  };

  readonly ground: readonly CompiledAreaVisual[];
  readonly roads: readonly CompiledRoadVisual[];
  readonly buildings: readonly CompiledBuildingVisual[];

  readonly collisions: readonly CollisionShape2D[];

  readonly featureIndex: Readonly<Record<FeatureId, CompiledFeatureRef>>;

  readonly diagnostics: CompileDiagnostics;
}
```

## Road visual

```ts
interface CompiledRoadVisual {
  readonly featureId: FeatureId;
  readonly surface: Polygon2D;
  readonly styleKey: string;
}
```

## Building visual

```ts
interface CompiledBuildingVisual {
  readonly featureId: FeatureId;
  readonly roof: Polygon2D;
  readonly visualHeightMeters: number;
  readonly styleKey: string;

  // Renderer-neutral hints. The renderer may create actual facade geometry.
  readonly fakeDepth: {
    readonly enabled: boolean;
    readonly scale: number;
  };
}
```

## Collision

V0 neutral shapes:

```ts
type CollisionShape2D =
  | {
      readonly kind: "polygon";
      readonly featureId: FeatureId;
      readonly polygon: Polygon2D;
    }
  | {
      readonly kind: "segment";
      readonly featureId: FeatureId;
      readonly a: Vec2;
      readonly b: Vec2;
      readonly thicknessMeters?: number;
    }
  | {
      readonly kind: "circle";
      readonly featureId: FeatureId;
      readonly center: Vec2;
      readonly radiusMeters: number;
    };
```

Rapier adapter decides how to decompose/instantiate these.

## Diagnostics

```ts
interface CompileDiagnostics {
  readonly inputFeatureCount: number;
  readonly compiledFeatureCount: number;
  readonly skippedFeatureCount: number;
  readonly warnings: readonly string[];
  readonly stageDurationsMs: Readonly<Record<string, number>>;
}
```

## Explicit exclusions

Do not store in CompiledChunk:

- PixiJS containers/graphics/meshes;
- Rapier body/collider handles;
- HTML elements;
- current vehicle state;
- live network handles.
