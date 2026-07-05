/** Turns any string into a URL-safe slug, e.g. "My Cool Product!" -> "my-cool-product". */
export function slugify(input: string): string {
  return input
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Appends a short random suffix to reduce collisions for user-generated slugs. */
export function slugifyUnique(input: string): string {
  const base = slugify(input) || "item";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}
