import { Op, Sequelize, type WhereOptions } from 'sequelize';

// Postgres keeps microseconds, JS Date doesn't — read/compare timestamps as raw strings so we do not lose precision when using keyset pagination

/** Raw SELECT expression preserving full microsecond precision of a timestamptz column. */
export function cursorUpdatedAtAttribute(
  timestampColumn = 'updated_at',
  alias = 'updatedAtCursor',
): [ReturnType<typeof Sequelize.literal>, string] {
  return [
    Sequelize.literal(
      `to_char("${timestampColumn}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    ),
    alias,
  ];
}

/** Keyset pagination filter: (timestampColumn, tieBreakerColumn) > (cursorTimestamp, cursorTieBreaker). */
export function cursorTimestampTupleFilter(
  cursorTimestamp: string,
  cursorTieBreaker: string,
  { timestampColumn = 'updated_at', tieBreakerColumn = 'uuid' } = {},
): { where: WhereOptions; replacements: Record<string, string> } {
  return {
    where: {
      [Op.and]: [
        Sequelize.literal(
          `("${timestampColumn}", "${tieBreakerColumn}") > (:cursorTimestamp::timestamptz, :cursorTieBreaker)`,
        ),
      ],
    },
    replacements: { cursorTimestamp, cursorTieBreaker },
  };
}
