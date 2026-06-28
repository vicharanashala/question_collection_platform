import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Req,
  ParseFilePipe,
  MaxFileSizeValidator,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SystemService } from './system.service';
import { UpsertSystemContentDto } from './dto/system-content.dto';
import { SystemContentType } from '../database/entities/system-content.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, ActorType } from '../common/enums';
import { AuditLog } from '../database/entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Minimal shape of the uploaded file we care about */
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('system-content')
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // ── Public: registration consent screen reads both from here ─────────────

  /** Returns terms_of_service and privacy_policy content for the consent/registration screen */
  @Public()
  @Get('public')
  async getPublicContent() {
    const { termsOfService, privacyPolicy } = await this.systemService.getPublicContent();
    return {
      termsOfService: termsOfService
        ? {
            title: termsOfService.title,
            description: termsOfService.description,
            content: termsOfService.content,
            isActive: termsOfService.isActive,
          }
        : null,
      privacyPolicy: privacyPolicy
        ? {
            title: privacyPolicy.title,
            description: privacyPolicy.description,
            content: privacyPolicy.content,
            isActive: privacyPolicy.isActive,
          }
        : null,
    };
  }

  // ── Admin: read all system content ──────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get()
  async getAll() {
    return this.systemService.getAll();
  }

  // ── Admin: upload .md file and return raw content ───────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: UploadedFile,
  ) {
    const content = file.buffer.toString('utf-8');
    return { content };
  }

  // ── Admin: upsert terms of service ──────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('terms-of-service')
  async upsertTos(@Body() dto: UpsertSystemContentDto, @Req() req: { user: { id: string } }) {
    const record = await this.systemService.upsert(SystemContentType.TERMS_OF_SERVICE, dto, req.user.id);
    await this.logAudit(req.user.id, 'UPDATE', 'system_content', record.id, { type: SystemContentType.TERMS_OF_SERVICE });
    return record;
  }

  // ── Admin: upsert privacy policy ────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('privacy-policy')
  async upsertPrivacy(@Body() dto: UpsertSystemContentDto, @Req() req: { user: { id: string } }) {
    const record = await this.systemService.upsert(SystemContentType.PRIVACY_POLICY, dto, req.user.id);
    await this.logAudit(req.user.id, 'UPDATE', 'system_content', record.id, { type: SystemContentType.PRIVACY_POLICY });
    return record;
  }

  // ── Admin: PATCH (alias — same as POST, accepts partial update) ─────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch('terms-of-service')
  async patchTos(@Body() dto: UpsertSystemContentDto, @Req() req: { user: { id: string } }) {
    return this.upsertTos(dto, req);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch('privacy-policy')
  async patchPrivacy(@Body() dto: UpsertSystemContentDto, @Req() req: { user: { id: string } }) {
    return this.upsertPrivacy(dto, req);
  }

  private async logAudit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.auditRepo.save({
        actorId,
        actorType: ActorType.ADMIN,
        action,
        entityType,
        entityId,
        metadata,
      });
    } catch {
      // Non-critical — don't fail the main operation
    }
  }
}