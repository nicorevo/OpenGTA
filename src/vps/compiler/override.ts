/**
 * Dev-only VPS override from the URL (?vps=<fixture-id>). Same discipline as
 * the LVP ?theme= override: matched against a closed id set, anything else
 * (including "auto" and junk) means "no override". Never a runtime API.
 */
export function vpsFixtureFromSearch<K extends string>(search: string, validFixtureIds: ReadonlySet<K>): K | undefined {
  const raw = new URLSearchParams(search).get("vps");
  if (raw === null) return undefined;
  const id = raw.trim().toLowerCase();
  if (id === "" || id === "auto") return undefined;
  return validFixtureIds.has(id as K) ? (id as K) : undefined;
}
