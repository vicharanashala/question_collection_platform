import type { Connection, Query, Schema } from 'mongoose';
import { hideDeleted } from '../abstractions/mongo-utils';

const READ_HOOKS = /^(find|findOne|countDocuments|distinct)$/;

// Hides soft deleted documents from reads on every schema that has an isDeleted field.
// A query or aggregation that sets isDeleted explicitly keeps full control.
export function softDeletePlugin(schema: Schema): void {
  if (!schema.path('isDeleted')) return;

  schema.pre(READ_HOOKS, function (this: Query<unknown, unknown>) {
    this.setQuery(hideDeleted(this.getFilter() as Record<string, unknown>));
  });

  schema.pre('aggregate', function () {
    const pipeline = this.pipeline();
    const setsIsDeleted = pipeline.some(
      (stage) =>
        '$match' in stage &&
        typeof stage.$match === 'object' &&
        stage.$match !== null &&
        'isDeleted' in stage.$match,
    );
    if (!setsIsDeleted) {
      pipeline.unshift({ $match: { isDeleted: { $ne: true } } });
    }
  });
}

// Registers the soft delete plugin for every model compiled on the connection.
export function softDeleteConnectionFactory(connection: Connection): Connection {
  connection.plugin(softDeletePlugin);
  return connection;
}
