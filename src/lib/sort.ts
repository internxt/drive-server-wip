import { Sequelize } from 'sequelize';
import type { Model, ModelStatic } from 'sequelize';
import type { Literal } from 'sequelize/types/utils';

const UNIQUE_SORT_FIELDS = new Set(['uuid', 'id']);

/**
 * Applies the custom numeric collation to plainName sorts and appends a
 * unique tiebreaker column so paginated listings keep a stable total order.
 * Without it, rows tied on the sort field can shift between LIMIT/OFFSET
 * pages, returning duplicated and missing items across pages.
 */
export function applyCollateAndTiebreakerToSort<Field extends string>(
  model: ModelStatic<Model>,
  order: Array<[Field, string]>,
): Array<[Field, string] | Literal> {
  if (order.length === 0) {
    return order;
  }

  const newOrder: Array<[Field, string] | Literal> = structuredClone(order);

  const plainNameIndex = order.findIndex(([field]) => field === 'plainName');
  const isPlainNameSort = plainNameIndex !== -1;

  if (isPlainNameSort) {
    const [, orderDirection] = order[plainNameIndex];
    newOrder[plainNameIndex] = Sequelize.literal(
      `"${model.name}"."plain_name" COLLATE "custom_numeric" ${
        orderDirection === 'ASC' ? 'ASC' : 'DESC'
      }`,
    );
  }

  const hasUniqueSortField = order.some(([field]) =>
    UNIQUE_SORT_FIELDS.has(field),
  );
  if (!hasUniqueSortField) {
    newOrder.push(['uuid' as Field, 'ASC']);
  }

  return newOrder;
}
