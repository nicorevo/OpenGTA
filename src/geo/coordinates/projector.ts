export interface GeoCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocalPoint {
  readonly x: number;
  readonly y: number;
}

export interface GeoProjector {
  project(coordinate: GeoCoordinate): LocalPoint;
  unproject(point: LocalPoint): GeoCoordinate;
}

const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;

function assertCoordinate(coordinate: GeoCoordinate): void {
  if (!Number.isFinite(coordinate.latitude) || coordinate.latitude < -90 || coordinate.latitude > 90) {
    throw new RangeError("latitude must be finite and between -90 and 90");
  }
  if (!Number.isFinite(coordinate.longitude) || coordinate.longitude < -180 || coordinate.longitude > 180) {
    throw new RangeError("longitude must be finite and between -180 and 180");
  }
}

export function createTangentProjector(origin: GeoCoordinate): GeoProjector {
  assertCoordinate(origin);
  const phi0 = origin.latitude * Math.PI / 180;
  const lambda0 = origin.longitude * Math.PI / 180;
  const eccentricitySquared = WGS84_F * (2 - WGS84_F);
  const sinPhi = Math.sin(phi0);
  const denominator = Math.sqrt(1 - eccentricitySquared * sinPhi * sinPhi);
  const primeVerticalRadius = WGS84_A / denominator;
  const meridianRadius = WGS84_A * (1 - eccentricitySquared) / Math.pow(1 - eccentricitySquared * sinPhi * sinPhi, 1.5);
  const eastScale = primeVerticalRadius * Math.cos(phi0);

  return {
    project(coordinate) {
      assertCoordinate(coordinate);
      return {
        x: (coordinate.longitude * Math.PI / 180 - lambda0) * eastScale,
        y: (coordinate.latitude * Math.PI / 180 - phi0) * meridianRadius,
      };
    },
    unproject(point) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new RangeError("local point must be finite");
      return {
        latitude: (phi0 + point.y / meridianRadius) * 180 / Math.PI,
        longitude: (lambda0 + point.x / eastScale) * 180 / Math.PI,
      };
    },
  };
}
