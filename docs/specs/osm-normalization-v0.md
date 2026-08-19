# OSM Normalization Profile V0

**Status:** Normative V0 mapping

## Input

Overpass-style OSM JSON containing:

- nodes;
- ways;
- relations;
- tags;
- member references.

Normalization converts raw source data to the Canonical World V0 contract.

## Stable IDs

Recommended format:

```text
osm:node:<id>
osm:way:<id>
osm:relation:<id>
```

Generated component IDs, if needed:

```text
osm:relation:<id>:part:<index>
```

Keep parent source identity in metadata.

## Buildings

Source:

```text
way/relation with building=*
```

Map `building` value approximately:

```text
apartments, house, detached, residential -> residential
retail, commercial                      -> commercial
industrial, warehouse                   -> industrial
civic, public, government               -> civic
church, cathedral, chapel, mosque,
synagogue, temple                       -> religious
garage, garages                         -> garage
shed                                    -> shed
roof                                    -> roof
mixed_use                               -> mixed
other                                   -> unknown
```

If `historic=*` materially marks the feature, set `buildingType=historic` only
when a more precise gameplay category is not needed; preserve raw tags either
way.

## Height

Parse `height` conservatively:

- bare finite number -> metres;
- `<number> m` -> metres;
- `<number> ft` -> × 0.3048;
- malformed/multiple ambiguous values -> undefined + warning.

Preserve `building:levels` separately as positive finite numeric value.

Do not derive fallback height during normalization.

## Roads

Source:

```text
way with highway=*
```

Mapping:

```text
motorway                    -> motorway
trunk                       -> trunk
primary                     -> primary
secondary                   -> secondary
tertiary                    -> tertiary
residential, living_street  -> residential
service                     -> service
pedestrian                  -> pedestrian
footway, path, cycleway     -> path
service + service=parking_aisle -> parking-aisle
other                       -> unknown
```

Preserve:

```text
width
lanes
oneway
surface
bridge
tunnel
layer
access
motor_vehicle
foot
service
```

Parse explicit `width` using the same basic unit parser as building height.

Parse `lanes` only when it is one unambiguous positive numeric value.

`oneway=yes|1|true` -> true  
`oneway=no|0|false` -> false  
unknown -> undefined.

## Land

Map polygons from selected tags:

```text
leisure=park                 -> park
landuse=grass                -> grass
landuse=forest               -> forest
natural=wood                 -> forest
landuse=industrial           -> industrial
landuse=residential          -> residential
landuse=commercial|retail    -> commercial
highway=pedestrian area      -> pedestrian where represented as area
amenity=parking              -> parking
natural=sand                 -> sand
natural=bare_rock            -> bare
other selected polygon       -> generic/unknown
```

## Water

```text
natural=water polygon -> WaterFeature.area
waterway=* line       -> WaterFeature.line
```

Preserve water/waterway class tags.

## Barriers

Selected V0 barrier semantics:

```text
wall, retaining_wall, city_wall -> solid
fence                           -> solid
bollard                         -> solid point/small obstacle downstream
gate                            -> conditional
entrance                        -> passable/unknown depending source context
```

Do not attempt sophisticated open/closed gate simulation in V0.

## Trees

`node natural=tree` -> TreeFeature.

No tree collision is required in initial V0 unless explicitly activated.

## Multipolygons

Normalization must reconstruct supported multipolygon relations.

Requirements:

- join member ways into rings;
- preserve outer/inner roles;
- validate finite rings;
- normalize winding;
- keep warnings for unreconstructable members.

Do not silently convert a broken multipolygon to an unrelated filled shape.

## Unsupported features

V0 ignores as gameplay/render input unless a later profile adds them:

- shops/POIs;
- addresses;
- public transport details;
- turn restrictions;
- indoor mapping;
- power/network infrastructure;
- 3D building parts;
- terrain elevation.

Ignoring does not mean deleting source tags from the original raw fixture.
