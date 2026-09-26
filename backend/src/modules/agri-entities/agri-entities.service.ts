import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IAgriEntityRepository, IUserRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AgriEntityStatus, AgriEntityType } from '../../shared/classes/enums';
import { isStorageUri } from '../storage/storage.service';
import { getAgriEntityImageCategory } from './agri-entities.constants';
import { ListAgriEntitiesDto, SubmitAgriEntityDto, SubmitAgriEntityResponseDto } from './dto';

@Injectable()
export class AgriEntitiesService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AgriEntity)
    private readonly agriEntityRepo: IAgriEntityRepository,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
  ) {}

  // Stores a user's crop, weed, pest or disease record for later review.
  async submit(userId: string, dto: SubmitAgriEntityDto): Promise<SubmitAgriEntityResponseDto> {
    this.assertImagesOwnedByUser(dto.imageUrls, dto.type, userId);

    const saved = await this.agriEntityRepo.create({
      userId,
      type: dto.type,
      localName: dto.localName,
      englishName: dto.englishName,
      botanicalName: dto.botanicalName,
      localNameSource: dto.localNameSource,
      alternateNames: dto.alternateNames.map(({ name, source }) => ({ name, source })),
      imageUrls: dto.imageUrls,
      status: AgriEntityStatus.PENDING,
    });

    return {
      id: saved.id,
      status: saved.status,
      message: 'Submitted successfully',
    };
  }

  // Lists the user's own submissions, newest first, optionally narrowed by type and status.
  async listMine(userId: string, dto: ListAgriEntitiesDto) {
    const { data, ...rest } = await this.findPage({ userId }, dto);
    return { items: data, ...rest };
  }

  // Lists every user's submissions for staff review, each with the submitter's name.
  async listAll(dto: ListAgriEntitiesDto) {
    const { data, ...rest } = await this.findPage({}, dto);
    const submitters = await this.userRepo.findByIds(data.map((entity) => entity.userId));
    const byId = new Map(submitters.map((user) => [user.id, user]));
    return {
      items: data.map((entity) => ({ ...entity, submitter: byId.get(entity.userId) ?? null })),
      ...rest,
    };
  }

  async getSubmittedCountsByType(userId: string): Promise<{
  crop: number;
  weed: number;
  pest: number;
  disease: number;
}> {
  const [crop, weed, pest, disease] = await Promise.all([
    this.agriEntityRepo.count({ where: { userId, type: AgriEntityType.CROP } }),
    this.agriEntityRepo.count({ where: { userId, type: AgriEntityType.WEED } }),
    this.agriEntityRepo.count({ where: { userId, type: AgriEntityType.PEST } }),
    this.agriEntityRepo.count({ where: { userId, type: AgriEntityType.DISEASE } }),
  ]);

  return { crop, weed, pest, disease };
}

  private async findPage(scope: { userId?: string }, dto: ListAgriEntitiesDto) {
    const { type, status, page = 1, limit = 20 } = dto;
    const { data, total } = await this.agriEntityRepo.findAndCount(
      { ...scope, ...(type ? { type } : {}), ...(status ? { status } : {}) },
      { pagination: { page, limit, sort: { createdAt: -1 } } },
    );
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // Only accepts images this user uploaded into the folder for this entity type,
  // so a client cannot attach arbitrary URLs or another user's files.
  private assertImagesOwnedByUser(imageUrls: string[], type: AgriEntityType, userId: string): void {
    const expectedSegment = `/${getAgriEntityImageCategory(type)}/${userId}/`;
    const invalid = imageUrls.some((url) => !isStorageUri(url) || !url.includes(expectedSegment));
    if (invalid) {
      throw new BadRequestException('Images must be uploaded through the image upload endpoint');
    }
  }
}
