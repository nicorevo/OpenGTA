import { describe, expect, it } from "vitest";
import { groupRoadsByWidth, sortBuildingsForPainter } from "./scene-order.ts";

const road = (featureId: string, widthMeters: number) => ({ featureId, widthMeters });
const building = (featureId: string, x: number, y: number) => ({ featureId, roof: { outer: [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }] } });

describe("road stroke grouping", () => {
  it("groups roads sharing a width so the network is stroked as one path", () => {
    const groups = groupRoadsByWidth([road("a", 6), road("b", 9), road("c", 6)]);
    expect(groups.map((group) => group.widthMeters)).toEqual([6, 9]);
    expect(groups[0].roads.map((entry) => entry.featureId)).toEqual(["a", "c"]);
  });

  it("paints narrow roads before wide ones so major roads stay continuous at junctions", () => {
    expect(groupRoadsByWidth([road("wide", 12), road("alley", 2), road("street", 6)]).map((group) => group.widthMeters)).toEqual([2, 6, 12]);
  });

  it("ignores roads without a usable width", () => {
    expect(groupRoadsByWidth([road("broken", 0), road("ok", 6)]).map((group) => group.widthMeters)).toEqual([6]);
  });
});

describe("building painter order", () => {
  it("paints a building after the neighbour whose facade would cover it", () => {
    const south = building("south", 0, 0);
    const north = building("north", 0, 40);
    expect(sortBuildingsForPainter([north, south]).map((entry) => entry.featureId)).toEqual(["south", "north"]);
  });

  it("orders along the fake-depth direction so western neighbours win as well", () => {
    const east = building("east", 40, 0);
    const west = building("west", 0, 0);
    expect(sortBuildingsForPainter([west, east]).map((entry) => entry.featureId)).toEqual(["east", "west"]);
  });

  it("is deterministic for buildings sharing the same depth key", () => {
    const first = building("b", 0, 0);
    const second = building("a", 10, 10);
    expect(sortBuildingsForPainter([first, second]).map((entry) => entry.featureId)).toEqual(["a", "b"]);
    expect(sortBuildingsForPainter([second, first]).map((entry) => entry.featureId)).toEqual(["a", "b"]);
  });
});
