/**
 * Provider-neutral location context: what the world is, without any Pixi or
 * theme knowledge. Built from a structured reverse-geocoding result; the
 * resolver (never the renderer) turns it into a visual profile.
 */
export interface LocationContext {
  readonly latitude: number;
  readonly longitude: number;

  /** ISO 3166-1 alpha-2 uppercase when known, e.g. IT, FR. */
  readonly countryCode?: string;

  readonly country?: string;

  /** State / region / first-order administrative area. */
  readonly region?: string;

  /** City/town/village/municipality normalized into one field. */
  readonly locality?: string;

  /** Borough / suburb / district / neighbourhood where available. */
  readonly district?: string;

  /** Geocoder source identifier, not used for rendering decisions. */
  readonly source: "nominatim";

  /** Optional source place id for diagnostics only. */
  readonly placeId?: string;

  /** Human-readable reverse-geocoded label for UI/debug. */
  readonly displayName?: string;
}

/** Structured address fields carried by a reverse-geocoding result. */
export interface LocationAddress {
  readonly countryCode?: string;
  readonly country?: string;
  readonly region?: string;
  readonly locality?: string;
  readonly district?: string;
}

/**
 * Nominatim ships country codes lowercase; accept only well-formed
 * two-letter ISO 3166-1 alpha-2 codes, uppercased.
 */
export function normalizeCountryCode(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

/**
 * Map a reverse-geocoding result (with or without a structured address) to
 * the provider-neutral context. Pure and tolerant of incomplete data:
 * missing address fields simply stay undefined.
 */
export function toLocationContext(
  location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly name: string;
    readonly placeId: string;
  } & LocationAddress,
): LocationContext {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    countryCode: location.countryCode,
    country: location.country,
    region: location.region,
    locality: location.locality,
    district: location.district,
    source: "nominatim",
    placeId: location.placeId,
    displayName: location.name,
  };
}
