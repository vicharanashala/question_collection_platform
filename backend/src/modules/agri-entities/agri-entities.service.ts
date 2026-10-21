import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { findTesterUserIds } from '../../shared/utils/tester.util';
import { resolveUserIdScope } from '../../shared/utils/anveshan-mode.util';
import { IAgriEntityRepository, IUserRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AgriEntityStatus, AgriEntityType, UserRole } from '../../shared/classes/enums';
import { isStorageUri } from '../storage/storage.service';
import { getAgriEntityImageCategory } from './agri-entities.constants';
import { AnveshanUsersQueryDto, ListAgriEntitiesDto, SubmitAgriEntityDto, SubmitAgriEntityResponseDto } from './dto';
import { UserService } from '../user/user.service';

const ENTITY_EXPORT_COLUMNS = [
  'type', 'localName', 'englishName', 'botanicalName', 'localNameSource', 'alternateNames',
  'imageCount', 'userName', 'userMobileNumber', 'submittedAt', 'state', 'district', 'block', 'village', 'createdAt',
];

// Formats a date as DD/MM/YYYY HH:MM:SS in Indian Standard Time, or an empty string when missing.
function formatExportDate(value?: Date | null): string {
  if (!value) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

@Injectable()
export class AgriEntitiesService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AgriEntity)
    private readonly agriEntityRepo: IAgriEntityRepository,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    private readonly userService: UserService
  ) {}

  // Stores a user's crop, weed, pest or disease record for later review.
  // async submit(userId: string, dto: SubmitAgriEntityDto): Promise<SubmitAgriEntityResponseDto> {
  //     const now = new Date();
  //       const submissionLocation = dto.submissionLocation
  //     ? { ...dto.submissionLocation, capturedAt: now }
  //     : undefined;
  //   this.assertImagesOwnedByUser(dto.imageUrls, dto.type, userId);

  //   const saved = await this.agriEntityRepo.create({
  //     userId,
  //     type: dto.type,
  //     localName: dto.localName,
  //     englishName: dto.englishName,
  //     botanicalName: dto.botanicalName,
  //     localNameSource: dto.localNameSource,
  //     alternateNames: dto.alternateNames.map(({ name, source }) => ({ name, source })),
  //     imageUrls: dto.imageUrls,
  //     status: AgriEntityStatus.PENDING,
  //     ...(submissionLocation ? { submissionLocation } : {}),
      
  //   });

  //   return {
  //     id: saved.id,
  //     status: saved.status,
  //     message: 'Submitted successfully',
  //   };
  // }

  async submit(userId: string, dto: SubmitAgriEntityDto): Promise<SubmitAgriEntityResponseDto> {
    const user = await this.userService.getProfile(userId);
    if (user?.isAnveshanUser && !dto.submissionLocation) {
      throw new BadRequestException(
        'Location is required for Anveshan users when submitting an entry.',
      );
    }

    const now = new Date();
    const submissionLocation = dto.submissionLocation
      ? { ...dto.submissionLocation, capturedAt: now }
      : undefined;
    this.assertImagesOwnedByUser(dto.imageUrls, dto.type, userId);

    const saved = await this.agriEntityRepo.create({
      userId,
      type: dto.type,
      localName: dto.localName,
      englishName: dto.englishName,
      botanicalName: dto.botanicalName,
      localNameSource: dto.localNameSource ?? '',
      alternateNames: (dto.alternateNames ?? []).map(({ name, source }) => ({ name, source: source ?? '' })),
      imageUrls: dto.imageUrls,
      status: AgriEntityStatus.PENDING,
      ...(submissionLocation ? { submissionLocation } : {}),
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

  // Lists every user's submissions for staff review, ordered by submission date, each with the submitter's name.
  async listAll(dto: ListAgriEntitiesDto, role?: string) {
    const { page = 1, limit = 20, sortOrder = 'desc' } = dto;
    const [filter, testerIds] = await Promise.all([this.buildStaffFilter(dto, role), findTesterUserIds(this.userRepo)]);
    const { data, total } = await this.agriEntityRepo.findOrderedBySubmission({ filter, order: sortOrder, page, limit });
    const submitters = await this.userRepo.findByIds(data.map((entity) => entity.userId));
    const byId = new Map(submitters.map((user) => [user.id, user]));
    return {
      items: data.map((entity) => {
        const submitter = byId.get(entity.userId);
        return { ...entity, submitter: submitter ? { ...submitter, isTester: testerIds.includes(submitter.id) } : null };
      }),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // Searches Anveshan users by name or mobile number for the Super Admin user filter, honouring the tester and Anveshan scopes.
  async searchAnveshanUsers(query: AnveshanUsersQueryDto = {}, limit = 500) {
    const term = query.search?.trim().toLowerCase();
    const [users, scope] = await Promise.all([
      this.userRepo.findAll({ isAnveshanUser: true }),
      resolveUserIdScope(this.userRepo, query),
    ]);
    const inScope = (id: string) =>
      !scope || ((scope.$in as string[] | undefined)?.includes(id) ?? !(scope.$nin as string[] | undefined)?.includes(id));
    return users
      .filter((user) => inScope(user.id))
      .filter((user) => !term || user.name?.toLowerCase().includes(term) || user.mobileNumber?.includes(term))
      .slice(0, limit)
      .map((user) => ({ id: user.id, name: user.name, mobileNumber: user.mobileNumber }));
  }

  // Builds an Excel file of the Anveshan users' entities matching the same filters as the list.
  async exportAnveshanEntities(dto: ListAgriEntitiesDto, role?: string): Promise<Buffer> {
    const filter = await this.buildStaffFilter({ ...dto, anveshanScope: 'only' }, role);
    const { data } = await this.agriEntityRepo.findOrderedBySubmission({
      filter,
      order: dto.sortOrder ?? 'desc',
    });
    const users = await this.userRepo.findAll({ isAnveshanUser: true });
    const byId = new Map(users.map((user) => [user.id, user]));
    const rows = data.map((entity) => {
      const user = byId.get(entity.userId);
      const location = entity.submissionLocation;
      return {
        type: entity.type,
        localName: entity.localName,
        englishName: entity.englishName,
        botanicalName: entity.botanicalName,
        localNameSource: entity.localNameSource,
        alternateNames: (entity.alternateNames ?? []).map((alt) => `${alt.name} (${alt.source})`).join(', '),
        imageCount: entity.imageUrls?.length ?? 0,
        userName: user?.name ?? '',
        userMobileNumber: user?.mobileNumber ?? '',
        submittedAt: formatExportDate(location?.capturedAt ?? entity.createdAt),
        state: location?.state ?? '',
        district: location?.district ?? '',
        block: location?.block ?? '',
        village: location?.village ?? '',
        createdAt: formatExportDate(entity.createdAt),
      };
    });
    const columns = ENTITY_EXPORT_COLUMNS;
    // json2xls reads column types from the first row, so it needs at least one
    const json2xls = require('json2xls');
    const xls = json2xls(rows.length ? rows : [Object.fromEntries(columns.map((c) => [c, '']))], { fields: columns });
    return Buffer.from(xls, 'binary');
  }

  // Mongo filter for the staff list and export: type, status, tester and Anveshan scope, and selected users.
  private async buildStaffFilter(dto: ListAgriEntitiesDto, role?: string): Promise<Record<string, unknown>> {
    const { type, status, userIds } = dto;
    if (userIds?.length && role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admins can filter by users');
    }
    let userId = await resolveUserIdScope(this.userRepo, dto);
    if (userIds?.length) {
      const anveshanIds = new Set((await this.userRepo.findAll({ isAnveshanUser: true })).map((user) => user.id));
      const allowed = userIds.filter((id) => anveshanIds.has(id));
      const scopeIn = userId?.$in as string[] | undefined;
      const scopeNin = userId?.$nin as string[] | undefined;
      userId = {
        $in: allowed.filter((id) => (scopeIn ? scopeIn.includes(id) : true) && !scopeNin?.includes(id)),
      };
    }
    return { ...(userId ? { userId } : {}), ...(type ? { type } : {}), ...(status ? { status } : {}) };
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

  // Creation times of the user's earliest submissions of each type, up to `limit` per type, oldest first.
  async getEarliestSubmissionDatesByType(
    userId: string,
    limit: number,
  ): Promise<{ crop: Date[]; weed: Date[]; pest: Date[]; disease: Date[] }> {
    const earliest = (type: AgriEntityType) =>
      this.agriEntityRepo
        .findAll({ userId, type }, { pagination: { page: 1, limit, sort: { createdAt: 1 } } })
        .then((items) => items.map((item) => item.createdAt));

    const [crop, weed, pest, disease] = await Promise.all([
      earliest(AgriEntityType.CROP),
      earliest(AgriEntityType.WEED),
      earliest(AgriEntityType.PEST),
      earliest(AgriEntityType.DISEASE),
    ]);
    return { crop, weed, pest, disease };
  }

  private async findPage(scope: { userId?: string | Record<string, unknown> }, dto: ListAgriEntitiesDto) {
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
