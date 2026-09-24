import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IAgriEntityRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AgriEntityStatus, AgriEntityType } from '../../shared/classes/enums';
import { isStorageUri } from '../storage/storage.service';
import { getAgriEntityImageCategory } from './agri-entities.constants';
import { SubmitAgriEntityDto, SubmitAgriEntityResponseDto } from './dto';

@Injectable()
export class AgriEntitiesService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AgriEntity)
    private readonly agriEntityRepo: IAgriEntityRepository,
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
