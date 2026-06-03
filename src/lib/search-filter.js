/**
 * Escapes a user search term for safe interpolation into a PostgREST
 * .or()/.filter() value position (ilike/eq operands). Strips the
 * PostgREST-reserved characters (, ( ) and backslash) that let a value
 * break out of its operator slot. Leaves %, _, ., *, apostrophes, and
 * digits intact so legitimate searches (emails, names like O'Brien,
 * phone digits) are unaffected.
 * @param {string} term
 * @returns {string}
 */
export function escapeOrTerm(term) {
  return String(term ?? '').replace(/[,()\\]/g, ' ');
}
