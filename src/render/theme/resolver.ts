import type { LocationContext } from "../../app/location-context.ts";
import type { VisualProfile } from "./types.ts";
import { athensProfile, defaultProfile, franceProfile, italyProfile, parisProfile, romeProfile, santiagoProfile, tokyoProfile } from "./profiles/index.ts";

/**
 * Closed, in-repo theme registry. Adding a theme means adding a profile +
 * its rules here; there is no remote service in LVP.
 */
export const THEME_BY_ID: ReadonlyMap<string, VisualProfile> = new Map<string, VisualProfile>([
  ["default", defaultProfile],
  ["italy", italyProfile],
  ["rome", romeProfile],
  ["france", franceProfile],
  ["paris", parisProfile],
  ["tokyo", tokyoProfile],
  ["santiago", santiagoProfile],
  ["athens", athensProfile],
]);

export const knownThemeIds: ReadonlySet<string> = new Set(THEME_BY_ID.keys());

/**
 * City key of a resolved LVP profile (v1.1): every registered profile is
 * named after its theme id, which is the same city identity the service's
 * parent resolver approximates. The VPS client uses it to keep generated
 * profiles sticky within a city (spec 106).
 */
export function themeIdOfProfile(profile: VisualProfile): string {
  return profile.id;
}

export type ThemeMatchedBy = "forced" | "locality" | "region" | "country" | "default";

export interface ThemeResolution {
  readonly profile: VisualProfile;
  readonly matchedBy: ThemeMatchedBy;
  readonly location?: LocationContext;
}

export interface VisualProfileResolver {
  resolve(location: LocationContext | undefined, forcedThemeId?: string): ThemeResolution;
}

interface PlaceRule {
  readonly countryCode: string;
  readonly aliases: readonly string[];
  readonly themeId: string;
}

/**
 * City-level rules. A locality only qualifies when it is qualified by its
 * own country code: "Paris" alone never selects the Paris theme.
 */
const LOCALITY_RULES: readonly PlaceRule[] = [
  { countryCode: "IT", aliases: ["roma", "rome"], themeId: "rome" },
  { countryCode: "FR", aliases: ["paris", "parigi"], themeId: "paris" },
  { countryCode: "JP", aliases: ["tokyo"], themeId: "tokyo" },
  { countryCode: "CL", aliases: ["santiago", "santiago de chile"], themeId: "santiago" },
  { countryCode: "GR", aliases: ["athens", "atene"], themeId: "athens" },
] as const;

/** Region-level registry: empty in LVP, ready for future regional themes. */
const REGION_RULES: readonly PlaceRule[] = [];

const COUNTRY_THEMES: Readonly<Record<string, string>> = {
  IT: "italy",
  FR: "france",
} as const;

/**
 * Exact matching only: trim, lowercase, collapse whitespace, strip
 * diacritics. No fuzzy/alias matching beyond the rule registries above.
 */
export function normalizeLocationToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function ruleMatch(rules: readonly PlaceRule[], countryCode: string, token: string | undefined): string | undefined {
  if (token === undefined) return undefined;
  const normalized = normalizeLocationToken(token);
  return rules.find((rule) => rule.countryCode === countryCode && rule.aliases.includes(normalized))?.themeId;
}

export function createVisualProfileResolver(): VisualProfileResolver {
  return {
    resolve(location, forcedThemeId) {
      if (forcedThemeId !== undefined) {
        const forced = THEME_BY_ID.get(forcedThemeId);
        // an invalid forced id degrades to auto resolution, never throws
        if (forced) return { profile: forced, matchedBy: "forced", location };
      }
      if (location?.countryCode !== undefined) {
        const { countryCode } = location;
        const localityTheme = ruleMatch(LOCALITY_RULES, countryCode, location.locality);
        if (localityTheme) {
          return { profile: THEME_BY_ID.get(localityTheme)!, matchedBy: "locality", location };
        }
        const regionTheme = ruleMatch(REGION_RULES, countryCode, location.region);
        if (regionTheme) {
          return { profile: THEME_BY_ID.get(regionTheme)!, matchedBy: "region", location };
        }
        const countryTheme = COUNTRY_THEMES[countryCode];
        if (countryTheme) {
          return { profile: THEME_BY_ID.get(countryTheme)!, matchedBy: "country", location };
        }
      }
      return { profile: defaultProfile, matchedBy: "default", location };
    },
  };
}
