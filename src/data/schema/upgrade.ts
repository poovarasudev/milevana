import { ZodType } from 'zod';
import { DocKind, SCHEMA_VERSION } from './common';

// Lazy schema upgrades (FR-DATA-06, OQ-40): schemaVersion on every top-level
// document and entry selects an upgrader chain. v1 is the first version, so the
// registry is empty but the mechanism is exercised by tests.
//
// A document whose schemaVersion is NEWER than the app knows is skipped and
// reported exactly like a malformed one (DR-03g).

export class SchemaUpgradeError extends Error {
  constructor(
    public code: 'newer-schema' | 'no-upgrader',
    public version: unknown,
  ) {
    super(code);
    this.name = 'SchemaUpgradeError';
  }
}

type Upgrader = (doc: Record<string, unknown>) => Record<string, unknown>;

const upgraders: Record<DocKind, Record<number, Upgrader>> = {
  users: {},
  vehicles: {},
  entries: {},
  reminders: {},
  invites: {},
  checklistTemplates: {},
};

/** Register an upgrader from `fromVersion` to `fromVersion + 1` for a doc kind. */
export function registerUpgrader(kind: DocKind, fromVersion: number, fn: Upgrader): void {
  upgraders[kind][fromVersion] = fn;
}

/** Bring a raw document up to SCHEMA_VERSION or throw SchemaUpgradeError. */
export function upgradeDoc(kind: DocKind, raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const doc = raw as Record<string, unknown>;
  const v = doc.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v)) return doc; // schema parse will reject it
  if (v > SCHEMA_VERSION) throw new SchemaUpgradeError('newer-schema', v);
  let out = doc;
  for (let from = v; from < SCHEMA_VERSION; from++) {
    const up = upgraders[kind][from];
    if (!up) throw new SchemaUpgradeError('no-upgrader', from);
    out = up(out);
  }
  return out;
}

export interface ParseFailure {
  ok: false;
  /** Error code only — never document contents (PRV-03). */
  code: 'newer-schema' | 'no-upgrader' | 'invalid';
  /** Zod issue paths (field names), e.g. 'amount.minor'. */
  paths: string[];
}

export type ParseOutcome<T> = { ok: true; data: T } | ParseFailure;

/** Upgrade on read, then validate. Errors carry codes and paths only. */
export function parseDoc<T>(kind: DocKind, schema: ZodType<T>, raw: unknown): ParseOutcome<T> {
  let upgraded: unknown;
  try {
    upgraded = upgradeDoc(kind, raw);
  } catch (e) {
    if (e instanceof SchemaUpgradeError) return { ok: false, code: e.code, paths: ['schemaVersion'] };
    return { ok: false, code: 'invalid', paths: [] };
  }
  const r = schema.safeParse(upgraded);
  if (r.success) return { ok: true, data: r.data };
  return {
    ok: false,
    code: 'invalid',
    paths: r.error.issues.map((i) => i.path.map(String).join('.')),
  };
}
