/**
 * Pre-select heuristic for BookableUsersPicker (D-03 in 57-CONTEXT.md):
 *   - If `initialSelected` is an explicit array → use it (already-saved set).
 *   - Else if any user has hasRecentActivity=true → pre-select those.
 *   - Else (zero recent activity) → pre-select ALL users.
 *
 * Pure helper extracted from the JSX file so it's unit-testable without a JSX
 * parser/loader. Re-exported by BookableUsersPicker.jsx.
 *
 * @param {Array<{id: string, hasRecentActivity?: boolean}>} users
 * @param {string[]|null|undefined} initialSelected
 * @returns {Set<string>}
 */
export function computeDefaultSelected(users, initialSelected) {
  if (initialSelected && Array.isArray(initialSelected)) return new Set(initialSelected);
  const list = users ?? [];
  if (list.some((u) => u.hasRecentActivity)) {
    return new Set(list.filter((u) => u.hasRecentActivity).map((u) => u.id));
  }
  return new Set(list.map((u) => u.id));
}
