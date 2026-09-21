/**
 * Debug-only theme override from the URL (?theme=...).
 *
 * The value is matched against the closed registry of known theme ids, so
 * a path, a URL or any other junk is silently ignored (no throw, no crash).
 * "auto" (or anything unknown) means "no override".
 */
export function themeOverrideFromSearch(search: string, validThemeIds: ReadonlySet<string>): string | undefined {
  const raw = new URLSearchParams(search).get("theme");
  if (raw === null) return undefined;
  const id = raw.trim().toLowerCase();
  if (id === "" || id === "auto") return undefined;
  return validThemeIds.has(id) ? id : undefined;
}
