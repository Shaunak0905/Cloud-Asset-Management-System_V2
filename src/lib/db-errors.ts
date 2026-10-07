/** The subset of a PostgREST/Postgres error we inspect. */
export type DbError = { code?: string; message?: string };

export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";
export const PG_CHECK_VIOLATION = "23514";
export const PG_INSUFFICIENT_PRIVILEGE = "42501";
/** PostgREST: .single() matched no row (missing, or hidden by RLS). */
export const PGRST_NO_ROWS = "PGRST116";
/** PostgREST: requested page is past the last row. */
export const PGRST_RANGE_NOT_SATISFIABLE = "PGRST103";

/** Name of the violated constraint, e.g. "buildings_code_key", if any. */
export function violatedConstraint(error: DbError): string | null {
  return error.message?.match(/constraint "([^"]+)"/)?.[1] ?? null;
}

export function isUniqueViolation(error: DbError, constraint: string): boolean {
  return (
    error.code === PG_UNIQUE_VIOLATION &&
    violatedConstraint(error) === constraint
  );
}

export function isPermissionError(error: DbError): boolean {
  return error.code === PG_INSUFFICIENT_PRIVILEGE;
}
