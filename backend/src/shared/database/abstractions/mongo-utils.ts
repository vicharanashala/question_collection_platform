/**
 * mongo-utils.ts
 *
 * Small builders for MongoDB filters, projections and aggregation stages.
 */

import { Types } from 'mongoose';

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

/** $in — any of */
export const mongoIn = <T>(arr: T[]) => ({ $in: arr });

/** $nin — none of */
export const mongoNin = <T>(arr: T[]) => ({ $nin: arr });

/** $all — contains all */
export const mongoAll = <T>(arr: T[]) => ({ $all: arr });

// ─── String operators ───────────────────────────────────────────────────────

/** Case-insensitive substring match. */
export const mongoLike = (val: string) => ({
  $regex: escapeRegex(val),
  $options: 'i',
});

/** Case-insensitive prefix match. */
export const mongoStartsWith = (val: string) => ({
  $regex: `^${escapeRegex(val)}`,
  $options: 'i',
});

/** Case-insensitive suffix match. */
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
 * Array membership filter for a field.
 *
 * - "all" → the array must contain every value ($all), the default
 * - "any" → the array must contain at least one value ($in)
 */
export const mongoFilter = (
  field: string,
  values: string[],
  mode: 'all' | 'any' = 'all',
): Record<string, unknown> => ({
  [field]: mode === 'all' ? mongoAll(values) : mongoIn(values),
});

// ─── Date range ─────────────────────────────────────────────────────────────

/** Builds an inclusive date range filter for a field */
export const mongoBetween = (
  field: string,
  from: Date,
  to: Date,
): Record<string, unknown> => ({
  [field]: { $gte: from, $lte: to },
});

/**
 * Value-level inclusive range, for use as a field's value:
 *   { submittedAt: mongoRange(from, to) }
 * `mongoBetween` builds the whole `{ field: ... }` object instead.
 */
export const mongoRange = (from: Date, to: Date): Record<string, Date> => ({
  $gte: from,
  $lte: to,
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

// ─── ObjectId coercion ───────────────────────────────────────────────────────

/**
 * Build an `ObjectId` from a 24-char hex string. Returns `null` when the
 * input is not a valid ObjectId (must be exactly 24 hex chars and pass
 * `Types.ObjectId.isValid`) — callers should treat that as "no match" rather
 * than crashing. Already-ObjectId inputs are returned as-is.
 *
 * Used by repositories to convert incoming string FKs (over JSON / HTTP) into
 * real `ObjectId` instances for query filters, and by services that need to
 * coerce snapshot fields from a source document into the persisted type.
 */
export function toObjectIdOrNull(
  value: string | Types.ObjectId | null | undefined,
): Types.ObjectId | null {
  if (value == null) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length !== 24) return null;
  return Types.ObjectId.isValid(trimmed) ? new Types.ObjectId(trimmed) : null;
}

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

// ─── Soft delete filters ────────────────────────────────────────────────────

// isDeleted value that matches deleted, active and legacy documents without the flag.
export const INCLUDE_DELETED = { $in: [true, false, null] };

// Hides soft deleted documents unless the filter sets isDeleted explicitly.
// An undefined isDeleted counts as not set, since Mongoose strips undefined values from filters.
export function hideDeleted(
  filter: Record<string, unknown>,
): Record<string, unknown> {
  return filter.isDeleted !== undefined ? filter : { ...filter, isDeleted: { $ne: true } };
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

export function lookupByStringId(from: string, localField: string, as: string) {
  return [
    {
      $lookup: {
        from,
        let: { ref: { $toString: `$${localField}` } },
        pipeline: [
          { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$ref'] } } },
          { $limit: 1 },
        ],
        as,
      },
    },
    { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },
  ];
}
