import { createConnection, Schema } from 'mongoose';
import { softDeletePlugin } from './soft-delete.plugin';

// Hooks run before execution, so a disconnected model is enough to inspect the rewritten query.
let modelCount = 0;
function buildModel(withFlag: boolean) {
  modelCount += 1;
  const connection = createConnection();
  connection.plugin(softDeletePlugin);
  const definition: Record<string, unknown> = { name: String };
  if (withFlag) definition.isDeleted = { type: Boolean, default: false };
  const schema = new Schema(definition, { bufferCommands: false });
  return connection.model(`${withFlag ? 'WithFlag' : 'WithoutFlag'}${modelCount}`, schema);
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

  it('treats an undefined isDeleted as not set', async () => {
    const query = buildModel(true).find({ name: 'a', isDeleted: undefined });
    await query.exec().catch(() => undefined);
    expect(query.getFilter()).toMatchObject({ name: 'a', isDeleted: { $ne: true } });
  });

  it('treats an undefined isDeleted in an aggregation as not set', async () => {
    const aggregate = buildModel(true).aggregate([{ $match: { isDeleted: undefined } }]);
    await aggregate.exec().catch(() => undefined);
    expect(aggregate.pipeline()[0]).toEqual({ $match: { isDeleted: { $ne: true } } });
  });

  const writeQueries = [
    ['updateOne', () => buildModel(true).updateOne({ name: 'a' }, { $set: { name: 'b' } })],
    ['updateMany', () => buildModel(true).updateMany({ name: 'a' }, { $set: { name: 'b' } })],
    ['findOneAndUpdate', () => buildModel(true).findOneAndUpdate({ name: 'a' }, { $set: { name: 'b' } })],
    ['deleteOne', () => buildModel(true).deleteOne({ name: 'a' })],
    ['deleteMany', () => buildModel(true).deleteMany({ name: 'a' })],
    ['findOneAndDelete', () => buildModel(true).findOneAndDelete({ name: 'a' })],
  ] as const;

  it.each(writeQueries)('hides deleted documents from %s', async (_name, build) => {
    const query = build();
    await query.exec().catch(() => undefined);
    expect(query.getFilter()).toEqual({ name: 'a', isDeleted: { $ne: true } });
  });

  it('lets a write that sets isDeleted explicitly reach deleted documents', async () => {
    const query = buildModel(true).updateMany({ isDeleted: true }, { $set: { isDeleted: false } });
    await query.exec().catch(() => undefined);
    expect(query.getFilter()).toEqual({ isDeleted: true });
  });

  it('ignores schemas without an isDeleted field', async () => {
    const query = buildModel(false).find({ name: 'a' });
    await query.exec().catch(() => undefined);
    expect(query.getFilter()).toEqual({ name: 'a' });
  });
});
