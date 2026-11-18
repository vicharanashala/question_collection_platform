export type MockRepository = Record<string, jest.Mock>;

const BASE_METHODS = [
  'find',
  'findOne',
  'findById',
  'findAll',
  'findByIds',
  'findAndCount',
  'create',
  'save',
  'update',
  'updateMany',
  'count',
  'delete',
] as const;

// Builds a repository double with jest mocks for the shared base methods plus any extra method names.
export function createMockRepository(...extraMethods: string[]): MockRepository {
  return Object.fromEntries([...BASE_METHODS, ...extraMethods].map((name) => [name, jest.fn()]));
}
