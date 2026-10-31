import { createConnection, Schema } from 'mongoose';
import { softDeletePlugin } from './soft-delete.plugin';

// Hooks run before execution, so a disconnected model is enough to inspect the rewritten query.
function buildModel(withFlag: boolean) {
  const connection = createConnection();
  connection.plugin(softDeletePlugin);
  const definition: Record<string, unknown> = { name: String };
  if (withFlag) definition.isDeleted = { type: Boolean, default: false };
  const schema = new Schema(definition, { bufferCommands: false });
  return connection.model(withFlag ? 'WithFlag' : 'WithoutFlag', schema);
}

describe('softDeletePlugin', () => {
  it('hides deleted documents from find queries', async () => {
    const query = buildModel(true).find({ name: 'a' });
    await query.exec().catch(() => undefined);
    expect(query.getFilter()).toEqual({ name: 'a', isDeleted: { $ne: true } });
  });

  it('keeps an explicit isDeleted condition', async () => {
    const query = buildModel(true).findOne({ isDeleted: true });
    await query.exec().catch(() => undefined);
    expect(query.getFilter()).toEqual({ isDeleted: true });
  });

  it('prepends the filter to aggregations', async () => {
    const aggregate = buildModel(true).aggregate([{ $group: { _id: null } }]);
    await aggregate.exec().catch(() => undefined);
    expect(aggregate.pipeline()[0]).toEqual({ $match: { isDeleted: { $ne: true } } });
  });

  it('does not touch aggregations that already set isDeleted', async () => {
    const aggregate = buildModel(true).aggregate([{ $match: { isDeleted: true } }]);
    await aggregate.exec().catch(() => undefined);
    expect(aggregate.pipeline()).toEqual([{ $match: { isDeleted: true } }]);
  });

  it('ignores schemas without an isDeleted field', async () => {
    const query = buildModel(false).find({ name: 'a' });
    await query.exec().catch(() => undefined);
    expect(query.getFilter()).toEqual({ name: 'a' });
  });
});
