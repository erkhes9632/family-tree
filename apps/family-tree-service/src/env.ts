import type { Database } from './db';

export type Bindings = Env;

export interface Variables {
  db: Database;
  /** authenticated user id (Clerk user id), null for anonymous requests */
  userId: string | null;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}

/** Treat empty strings from .dev.vars as "not configured". */
export function configured(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
