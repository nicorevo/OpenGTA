import { createTangentProjector } from "../../src/geo/coordinates/projector.ts";
import type { RawOsm } from "../../src/geo/normalize/osm.ts";

export const liveOrigin = { latitude: 40.35316888888889, longitude: 18.17259 };
const projector = createTangentProjector(liveOrigin);
const node = (id: number, x: number, y: number) => {
  const point = projector.unproject({ x, y });
  return { type: "node" as const, id, lat: point.latitude, lon: point.longitude };
};
const roadNodes = Array.from({ length: 41 }, (_, index) => node(index + 1, -2000 + index * 100, 30));
const buildingNodes = [node(101, 445, 48), node(102, 465, 48), node(103, 465, 68), node(104, 445, 68)];
export const liveWorld: RawOsm = { elements: [...roadNodes, ...buildingNodes, node(201, 1080, 15), node(202, 1080, 45),
  { type: "way", id: 1000, nodes: roadNodes.map((entry) => entry.id), tags: { highway: "residential", width: "8", name: "Via Continua" } },
  { type: "way", id: 2000, nodes: [101, 102, 103, 104, 101], tags: { building: "yes", name: "Edificio 450" } },
  { type: "way", id: 3000, nodes: [201, 202], tags: { barrier: "fence" } },
] };
