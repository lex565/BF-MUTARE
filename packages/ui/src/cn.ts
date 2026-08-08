/**
 * Minimal class joiner. Both sites author Tailwind classes in a single place
 * per element, so full tailwind-merge conflict resolution is not needed and
 * would only add a dependency.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
