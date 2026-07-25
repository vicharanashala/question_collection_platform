/**
 * mongo-utils.ts
 *
 * Translates PostgreSQL/TypeORM query patterns to their MongoDB equivalents.
 * Used by mongo.repository.ts to implement the same query semantics when DB=mongo.
 */

// ─── Comparison operators ───────────────────────────────────────────────────

/** $gte — greater-than-or-equal */
export const mongoGte = (val: unknown) => ({ $gte: val });

/** $lte — less-than-or-equal */
export const mongoLte = (val: unknown) => ({ $lte: val });

/** $gt — greater-than */
export const mongoGt = (val: unknown) => ({ $gt: val });

/** $lt — less-than */
export const mongoLt = (val: unknown) => ({ $lt: val });

/** $ne — not-equal */
export const mongoNe = (val: unknown) => ({ $ne: val });

/** $in — any of (replaces TypeORM `In([...])`) */
export const mongoIn = <T>(arr: T[]) => ({ $in: arr });

/** $nin — none of */
export const mongoNin = <T>(arr: T[]) => ({ $nin: arr });

/** $all — contains all (replaces TypeORM `ArrayContains([...])` for "must contain all" semantics) */
export const mongoAll = <T>(arr: T[]) => ({ $all: arr });

// ─── String operators ───────────────────────────────────────────────────────

/**
 * Case-insensitive substring match — replaces PostgreSQL ILIKE '%val%'.
 * Returns a $regex expression; pass { $options: 'i' } for case-insensitive.
 */
export const mongoLike = (val: string) => ({
  $regex: escapeRegex(val),
  $options: 'i',
});

/**
 * Case-insensitive prefix match — replaces PostgreSQL ILIKE 'val%'.
 */
export const mongoStartsWith = (val: string) => ({
  $regex: `^${escapeRegex(val)}`,
  $options: 'i',
});

/**
 * Case-insensitive suffix match — replaces PostgreSQL ILIKE '%val'.
 */
export const mongoEndsWith = (val: string) => ({
  $regex: `${escapeRegex(val)}$`,
  $options: 'i',
});

// ─── Regex escape ───────────────────────────────────────────────────────────

/** Escape special regex characters in a user-supplied string */
const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
export const escapeRegex = (str: string) => str.replace(ESCAPE_RE, '\\$&');

// ─── Array operators ────────────────────────────────────────────────────────

/**
 * Converts TypeORM ArrayContains([domains]) semantics to MongoDB.
 *
 * - "contains ALL" → { domains: { $all: [domains] } }
 * - "contains ANY" → { domains: { $in: [domains] } }
 *
 * Default: $all (replaces the semantics of TypeORM ArrayContains which checks
 * that the PostgreSQL array column contains all the given values).
 */
export const mongoFilter = (
  field: string,
  values: string[],
  mode: 'all' | 'any' = 'all',
): Record<string, unknown> => ({
  [field]: mode === 'all' ? mongoAll(values) : mongoIn(values),
});

// ─── Date range ─────────────────────────────────────────────────────────────

/** Builds a MongoDB date filter for a between query (PostgreSQL BETWEEN) */
export const mongoBetween = (
  field: string,
  from: Date,
  to: Date,
): Record<string, unknown> => ({
  [field]: { $gte: from, $lte: to },
});

/** Single-sided date filter (from OR to only) */
export const dateRangeFilter = (
  field: string,
  opts: { from?: Date; to?: Date },
): Record<string, unknown> => {
  if (opts.from && opts.to) return mongoBetween(field, opts.from, opts.to);
  if (opts.from) return { [field]: mongoGte(opts.from) };
  if (opts.to) return { [field]: mongoLte(opts.to) };
  return {};
};

// ─── Pagination helpers ─────────────────────────────────────────────────────

export interface SkipLimit {
  skip?: number;
  limit?: number;
}

/** Converts { page, limit } to { skip, limit } for MongoDB .skip()/.limit() */
export const toSkipLimit = (
  page?: number,
  limit?: number,
): SkipLimit => ({
  skip: page != null && limit != null ? (page - 1) * limit : undefined,
  limit,
});

// ─── TypeORM value type guards ───────────────────────────────────────────────

function isTypeormBetween(val: unknown): val is { __type: 'between'; value: [Date, Date] } {
  return (
    typeof val === 'object' &&
    val !== null &&
    '__type' in (val as Record<string, unknown>) &&
    (val as Record<string, unknown>).__type === 'between' &&
    Array.isArray((val as { value: unknown }).value)
  );
}

/** Detects TypeORM FindOperator instances (e.g. MoreThanOrEqual, LessThan) by their Symbol key */
function isTypeormFindOperator(val: unknown): val is { _type: string; _value: unknown } {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  const instanceofVal = obj['@instanceof'];
  if (typeof instanceofVal !== 'symbol') return false;
  return (
    Symbol.keyFor(instanceofVal) === 'FindOperator' ||
    String(instanceofVal) === 'Symbol(FindOperator)'
  ) && typeof obj._type === 'string';
}

function isTypeormComparison(
  val: unknown,
): val is { __type: string; value: unknown } {
  return (
    typeof val === 'object' &&
    val !== null &&
    '__type' in (val as Record<string, unknown>) &&
    ['lessThanOrEqual', 'moreThanOrEqual', 'lessThan', 'moreThan'].includes(
      (val as Record<string, unknown>).__type as string,
    )
  );
}

const TYPEORM_LIKE_TYPES = new Set(['like', 'ilike', 'LIKE', 'ILIKE']);
function isTypeormLike(val: unknown): val is { __type: string; value: string } {
  return (
    typeof val === 'object' &&
    val !== null &&
    '__type' in (val as Record<string, unknown>) &&
    TYPEORM_LIKE_TYPES.has((val as Record<string, unknown>).__type as string)
  );
}

function isTypeormIn(val: unknown): val is { __type: 'in'; value: unknown[] } {
  return (
    typeof val === 'object' &&
    val !== null &&
    '__type' in (val as Record<string, unknown>) &&
    (val as Record<string, unknown>).__type === 'in'
  );
}

// ─── TypeORM filter → MongoDB filter translator ─────────────────────────────

/**
 * Translates a single TypeORM-style filter value to its MongoDB equivalent.
 *
 * Handles:
 *   - Between(from, to)      → { $gte: from, $lte: to }
 *   - LessThanOrEqual(val)   → { $lte: val }
 *   - MoreThanOrEqual(val)   → { $gte: val }
 *   - LessThan(val)          → { $lt: val }
 *   - MoreThan(val)          → { $gt: val }
 *   - Like(val) / ILike(val) → { $regex: ..., $options: 'i' }
 *   - In([...])              → { $in: [...] }
 *   - ArrayContains([...])   → { $all: [...] }
 *   - plain objects           → recurse via toMongoFilter
 *   - primitives             → pass through unchanged
 */
export function translateValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;

  // TypeORM FindOperator (MoreThanOrEqual, LessThan, etc.) — has Symbol(@instanceof) = FindOperator
  if (isTypeormFindOperator(val)) {
    const typeToMongo: Record<string, string> = {
      moreThanOrEqual: '$gte',
      lessThanOrEqual: '$lte',
      moreThan: '$gt',
      lessThan: '$lt',
      equal: '$eq',
      notEqual: '$ne',
    };
    const mongoOp = typeToMongo[val._type];
    if (mongoOp) return { [mongoOp]: val._value };
    return val._value;
  }

  if (isTypeormBetween(val)) {
    return { $gte: val.value[0], $lte: val.value[1] };
  }

  if (isTypeormComparison(val)) {
    return { [val.__type]: val.value };
  }

  if (isTypeormLike(val)) {
    return mongoLike(String(val.value));
  }

  if (isTypeormIn(val)) {
    return mongoIn(val.value as unknown[]);
  }

  if (typeof val === 'object' && !Array.isArray(val)) {
    if ('__type' in (val as Record<string, unknown>) && (val as Record<string, unknown>).__type === 'array') {
      return mongoAll((val as { value: unknown[] }).value);
    }
    const translated = toMongoFilter(val);
    if (Object.keys(translated).length > 0) return translated;
    return val;
  }

  return val;
}

/**
 * Translates a full TypeORM-style where clause to a MongoDB filter.
 *
 * Usage:
 *   const filter = toMongoFilter({ status: 'APPROVED', submittedAt: Between(from, to) });
 *   await model.countDocuments(filter);
 *
 * Handles all TypeORM operator objects listed under translateValue().
 */
export function toMongoFilter(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {};

  // Unwrap { where: { ... } } wrapper used by the repository interface
  const unwrapped = (obj as Record<string, unknown>).where ?? obj;
  const result: Record<string, unknown> = {};
  const entries = Object.entries(unwrapped as Record<string, unknown>);

  for (const [key, val] of entries) {
    result[key] = translateValue(val);
  }

  return result;
}

// ─── Null-aware field builder ───────────────────────────────────────────────

/**
 * Builds a MongoDB field projection/exclude object.
 * Usage: { ...excludeFields(['password', 'otpHash']) }
 */
export const excludeFields = (
  fields: string[],
): Record<string, 0 | 1> =>
  Object.fromEntries(fields.map((f) => [f, 0]));

/**
 * Builds a MongoDB field include-only projection.
 * Usage: { ...includeFields(['id', 'mobileNumber', 'name']) }
 */
export const includeFields = (
  fields: string[],
): Record<string, 0 | 1> =>
  Object.fromEntries(fields.map((f) => [f, 1]));