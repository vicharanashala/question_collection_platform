import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemContent, SystemContentType } from '../database/entities/system-content.entity';
import { UpsertSystemContentDto } from './dto/system-content.dto';

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(SystemContent)
    private readonly repo: Repository<SystemContent>,
  ) {}

  async getByType(type: SystemContentType): Promise<SystemContent | null> {
    return this.repo.findOne({ where: { type } });
  }

  async getPublicContent(): Promise<{
    termsOfService: SystemContent | null;
    privacyPolicy: SystemContent | null;
  }> {
    const [tos, pp] = await Promise.all([
      this.repo.findOne({ where: { type: SystemContentType.TERMS_OF_SERVICE } }),
      this.repo.findOne({ where: { type: SystemContentType.PRIVACY_POLICY } }),
    ]);
    return { termsOfService: tos, privacyPolicy: pp };
  }

  async upsert(
    type: SystemContentType,
    dto: UpsertSystemContentDto,
    updatedBy: string,
  ): Promise<SystemContent> {
    let record = await this.repo.findOne({ where: { type } });
    if (record) {
      await this.repo.update(record.id, {
        title: dto.title,
        description: dto.description ?? null,
        content: dto.content ?? null,
        isActive: dto.isActive ?? record.isActive,
        updatedBy,
        updatedAt: new Date(),
      });
    } else {
      const created = this.repo.create({
        type,
        title: dto.title,
        description: dto.description ?? null,
        content: dto.content ?? null,
        isActive: dto.isActive ?? true,
        updatedBy,
        updatedAt: new Date(),
      });
      record = await this.repo.save(created);
    }
    return this.repo.findOne({ where: { id: record.id } }) as Promise<SystemContent>;
  }

  async getAll(): Promise<SystemContent[]> {
    return this.repo.find({ order: { type: 'ASC' } });
  }
}