import { BaseRepository } from '../abstractions/base.repository';
import { AdminConfig } from '../entities';

export interface IAdminConfigRepository extends BaseRepository<AdminConfig> {
  findByKey(key: string): Promise<AdminConfig | null>;
}