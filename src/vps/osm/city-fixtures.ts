import type { OsmArea, OsmCellFeatures, OsmNode, OsmWay } from "./types.ts";

/**
 * Per-city synthetic OSM cells for the VPS-09 offline end-to-end tests
 * (spec 105: "coordinate note di test"). They stand in for what the
 * service-side Overpass client will fetch in VPS-10: plain tagged
 * geometries, no provider payload. Each city leans on the tags the real
 * OSM data carries there (Rome: tiled roofs on ochre masonry and
 * cobbles; Paris: zinc/metal roofs on cream stone; Tokyo: flat concrete
 * boxes in grey/dark, asphalt, little green).
 */
const area = (areaM2: number, tags: Record<string, string> = {}): OsmArea => ({ areaM2, tags });
const way = (lengthM: number, tags: Record<string, string> = {}): OsmWay => ({ lengthM, tags });
const node = (tags: Record<string, string> = {}): OsmNode => ({ tags });

function romeFeatures(): OsmCellFeatures {
  const areas: OsmArea[] = [];
  // roofs: tiles (12+8) x 1200 = 24000 vs flat 3 x 2000 = 6000 -> terracotta 0.8
  for (let i = 0; i < 12; i += 1) areas.push(area(1200, { building: "yes", "roof:material": "roof_tiles", "building:colour": "ochre" }));
  for (let i = 0; i < 8; i += 1) areas.push(area(1200, { building: "yes", "roof:material": "roof_tiles", "building:material": "brick", "building:colour": "yellow" }));
  for (let i = 0; i < 3; i += 1) areas.push(area(2000, { building: "yes", "roof:shape": "flat" }));
  for (let i = 0; i < 4; i += 1) areas.push(area(900, { building: "yes" }));
  // ~4% green: above the sparseness threshold, OSM asserts no character
  areas.push(area(3000, { landuse: "grass" }));
  areas.push(area(2500, { natural: "wood" }));
  areas.push(area(1200, { leisure: "park" }));

  const ways: OsmWay[] = [];
  for (let i = 0; i < 8; i += 1) ways.push(way(400, { highway: "residential", surface: "cobblestone" }));
  for (let i = 0; i < 6; i += 1) ways.push(way(400, { highway: "residential", surface: "asphalt" }));
  for (let i = 0; i < 5; i += 1) ways.push(way(200, { highway: "footway", surface: "paving_stones" }));
  for (let i = 0; i < 6; i += 1) ways.push(way(300, { highway: "residential" }));
  ways.push(way(300, { highway: "residential", lighting: "street" }));
  ways.push(way(200, { highway: "residential", parking: "lane" }));

  const nodes: OsmNode[] = [];
  for (let i = 0; i < 25; i += 1) nodes.push(node({ natural: "tree" }));
  for (let i = 0; i < 3; i += 1) nodes.push(node({ amenity: "bench" }));
  for (let i = 0; i < 8; i += 1) nodes.push(node({ barrier: "bollard" }));

  return { ways, areas, nodes };
}

function parisFeatures(): OsmCellFeatures {
  const areas: OsmArea[] = [];
  // Haussmann cell: all roofs tagged metal (zinc), cream stone facades
  for (let i = 0; i < 14; i += 1) areas.push(area(1100, { building: "yes", "roof:material": "metal", "building:material": "stone", "building:colour": "cream" }));
  for (let i = 0; i < 4; i += 1) areas.push(area(1100, { building: "yes", "roof:material": "metal", "building:material": "stone" }));
  // very little central green (~1-2%): below the sparseness threshold
  areas.push(area(2000, { landuse: "grass" }));

  const ways: OsmWay[] = [];
  for (let i = 0; i < 10; i += 1) ways.push(way(400, { highway: "residential", surface: "asphalt" }));
  for (let i = 0; i < 2; i += 1) ways.push(way(300, { highway: "residential" }));
  for (let i = 0; i < 4; i += 1) ways.push(way(200, { highway: "footway", surface: "paving_stones" }));
  ways.push(way(400, { highway: "residential", lighting: "street" }));

  const nodes: OsmNode[] = [];
  for (let i = 0; i < 10; i += 1) nodes.push(node({ natural: "tree" }));
  for (let i = 0; i < 2; i += 1) nodes.push(node({ amenity: "bench" }));
  for (let i = 0; i < 6; i += 1) nodes.push(node({ barrier: "bollard" }));

  return { ways, areas, nodes };
}

function tokyoFeatures(): OsmCellFeatures {
  const areas: OsmArea[] = [];
  // dense modern cell: flat concrete roofs, grey/dark concrete and glass
  for (let i = 0; i < 10; i += 1) areas.push(area(900, { building: "yes", "roof:material": "concrete", "building:material": "concrete", "building:colour": "grey" }));
  for (let i = 0; i < 4; i += 1) areas.push(area(900, { building: "yes", "roof:material": "concrete", "building:material": "glass", "building:colour": "black" }));
  for (let i = 0; i < 4; i += 1) areas.push(area(900, { building: "yes", "roof:material": "concrete", "building:colour": "grey" }));

  const ways: OsmWay[] = [];
  for (let i = 0; i < 14; i += 1) ways.push(way(350, { highway: "residential", surface: "asphalt" }));
  for (let i = 0; i < 2; i += 1) ways.push(way(300, { highway: "residential" }));
  for (let i = 0; i < 4; i += 1) ways.push(way(150, { highway: "footway", surface: "concrete" }));
  for (let i = 0; i < 4; i += 1) ways.push(way(300, { highway: "residential", surface: "asphalt", lighting: "street" }));

  const nodes: OsmNode[] = [];
  for (let i = 0; i < 6; i += 1) nodes.push(node({ natural: "tree" }));
  nodes.push(node({ amenity: "bench" }));

  return { ways, areas, nodes };
}

export const OSM_CITY_FEATURES: Readonly<Record<"rome" | "paris" | "tokyo", OsmCellFeatures>> = {
  rome: romeFeatures(),
  paris: parisFeatures(),
  tokyo: tokyoFeatures(),
};
