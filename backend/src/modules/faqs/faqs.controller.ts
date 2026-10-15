import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
  StreamableFile,
  Req,
  Logger,
} from '@nestjs/common';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { FaqsService } from './faqs.service';
import { CreateFaqDto, UpdateFaqDto, ToggleVisibilityDto, ListFaqsQueryDto } from './dto';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { Public } from '../../shared/middleware/decorators/public.decorator';
import { ActorType, AuditAction, OutcomeStatus, UserRole } from '../../shared/classes/enums';
import { ReqMeta, RequestMeta } from '@/shared/middleware/decorators/request-meta.decorator';
import { AuditLogDto } from '../audit-logs/dto/audit_log-dto';
import { AuditService } from '../audit-logs/audit.service';
import { Faq } from '@/shared/database/mongodb/schemas/faq.schema';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
    name: string;
  };
}

@Controller()
export class FaqsController {
  constructor(private readonly faqsService: FaqsService, private readonly auditService: AuditService, private readonly logger: Logger = new Logger(FaqsController.name),) {}

  private toActorType(role: UserRole): ActorType {
  switch (role) {
    case UserRole.SUPER_ADMIN: return ActorType.SUPER_ADMIN;
    case UserRole.ADMIN:       return ActorType.ADMIN;
    case UserRole.FINANCE:     return ActorType.FINANCE;
    default:                   return ActorType.CURATOR;
  }
}

private async safeAudit(payload: AuditLogDto) {
    try {
      await this.auditService.createAuditLog({
        ...payload,
        changes: payload.changes ?? undefined,
        context: payload.context ?? undefined,
        outcome: payload.outcome ?? undefined,
      });
    } catch (e) {
      this.logger.error(
        "Failed to write audit log",
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  // Reads the FAQ identifier from either the mapped `id` or the raw `_id`.
  private faqId(faq: Faq): string {
    const doc = faq as unknown as { id?: unknown; _id?: unknown };
    return String(doc.id ?? doc._id);
  }

  // Builds an audit snapshot of a FAQ. The repository returns `id` and clears `_id`.
  private faqSnapshot(faq: Faq): Record<string, unknown> {
    return {
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      isVisible: faq.isVisible,
      displayOrder: faq.displayOrder,
    };
  }

  // ─── Public/user-facing ──────────────────────────────────────────────────

  @Public()
  @Get('faqs')
  async listVisible(@Query() query: ListFaqsQueryDto) {
    return this.faqsService.findAllVisible(query);
  }

  /**
   * Serves the FAQ video embed page from the API origin so YouTube accepts
   * the embed request (YouTube requires a valid HTTPS referer).
   *
   * YouTube iframe parameters:
   *   autoplay=1        — starts immediately when the page loads
   *   playsinline=1     — prevents fullscreen takeover on iOS
   *   rel=0             — hides related videos from other channels
   *   modestbranding=1  — reduces YouTube logo in corner
   */
  @Public()
  @Get('embed/faq-video')
  getFaqVideoEmbed(@Query('videoId') videoId: string, @Res() res: Response) {
    const id = videoId || 'dQw4w9WgXcQ';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Referrer-Policy', 'origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>FAQ Video</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:100%;height:100%;background:#000;overflow:hidden;}
    #player{position:absolute;top:0;left:0;width:100%;height:100%;}
  </style>
</head>
<body>
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player;
    YT.ready(function() {
      player = new YT.Player('player', {
        videoId: '${id}',
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
        },
        events: {
          onStateChange: function(event) {
            // When video ends, loop it back to prevent the related-videos overlay
            if (event.data === YT.PlayerState.ENDED) {
              player.stopVideo();
              player.playVideo();
            }
          }
        }
      });
    });
  </script>
</body>
</html>`);
  }

  @Public()
  @Get('videos/:filename')
  streamVideo(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(__dirname, '..', 'public', 'videos', filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Video '${filename}' not found`);
    }

    const stat = statSync(filePath);
    const fileSize = stat.size;
    const range = (res as any).req?.headers['range'];

    if (range) {
      // Partial content (range request) — required for <video> seek/play
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', String(chunkSize));
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.status(HttpStatus.PARTIAL_CONTENT);
      return new StreamableFile(createReadStream(filePath, { start, end }));
    }

    // Full file response
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', String(fileSize));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return new StreamableFile(createReadStream(filePath));
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/faqs/stats')
  async getStats(@Query('category') category?: string) {
    return this.faqsService.getStats(category);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Get('admin/faqs')
  async listAll(@Query() query: ListFaqsQueryDto) {
    return this.faqsService.findAllPaginated(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Post('admin/faqs')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFaqDto, @Req() req: AuthenticatedRequest, @ReqMeta() meta:RequestMeta) {
    const base: AuditLogDto = {
          actionType: AuditAction.CREATE_FAQ,
          actor: {
            id: req.user.id,
            actorType: this.toActorType(req.user.role as UserRole),
            name: req.user.name,
          },
          resource: {
            requestId: meta.requestId,
            ipAddress: meta.ipAddress,
          },
          context: {
            question: dto.question,
            answer: dto.answer,
            category: dto.category,
            isVisible: dto.isVisible 
          },
        };

    let result: Faq;
    try{
      result =  await this.faqsService.create(dto);
    }catch(err){
            await this.safeAudit({
              ...base,
              changes: {
                before: {},
                after: {},
              },
              outcome: {
                status: OutcomeStatus.FAILURE,
                errorMessage: err instanceof Error ? err.message : String(err),
              },
            });
            throw err;
    }

        await this.safeAudit({
          ...base,
          changes: {
            before: {},
            after: { id: this.faqId(result) },
          },
          outcome: { status: OutcomeStatus.SUCCESS },
        });

    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Patch('admin/faqs/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateFaqDto, @Req() req: AuthenticatedRequest, @ReqMeta() meta:RequestMeta) {
    const base: AuditLogDto = {
      actionType: AuditAction.UPDATE_FAQ,
      actor: {
        id: req.user.id,
        actorType: this.toActorType(req.user.role as UserRole),
        name: req.user.name,
      },
      resource: { requestId: meta.requestId, ipAddress: meta.ipAddress },
      context: { faqId: id, ...dto },
    };
    let before: Record<string, unknown> = {};
    try {
      before = this.faqSnapshot(await this.faqsService.findOne(id) as Faq);
      const result = await this.faqsService.update(id, dto) as Faq;
      await this.safeAudit({
        ...base,
        changes: { before, after: this.faqSnapshot(result) },
        outcome: { status: OutcomeStatus.SUCCESS },
      });
      return result;
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: { before, after: before },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Patch('admin/faqs/:id/visibility')
  async toggleVisibility(@Param('id') id: string, @Body() dto: ToggleVisibilityDto, @Req() req: AuthenticatedRequest, @ReqMeta() meta:RequestMeta) {
    const base: AuditLogDto = {
      actionType: AuditAction.UPDATE_FAQ,
      actor: {
        id: req.user.id,
        actorType: this.toActorType(req.user.role as UserRole),
        name: req.user.name,
      },
      resource: { requestId: meta.requestId, ipAddress: meta.ipAddress },
      context: { faqId: id, operation: 'visibility_changed', isVisible: dto.isVisible },
    };
    let before: Record<string, unknown> = {};
    try {
      before = this.faqSnapshot(await this.faqsService.findOne(id) as Faq);
      const result = await this.faqsService.toggleVisibility(id, dto) as Faq;
      await this.safeAudit({
        ...base,
        changes: { before, after: this.faqSnapshot(result) },
        outcome: { status: OutcomeStatus.SUCCESS },
      });
      return result;
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: { before, after: before },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Delete('admin/faqs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest, @ReqMeta() meta:RequestMeta) {
    const base: AuditLogDto = {
      actionType: AuditAction.DELETE_FAQ,
      actor: {
        id: req.user.id,
        actorType: this.toActorType(req.user.role as UserRole),
        name: req.user.name,
      },
      resource: { requestId: meta.requestId, ipAddress: meta.ipAddress },
      context: { faqId: id },
    };
    let before: Record<string, unknown> = {};
    try {
      before = this.faqSnapshot(await this.faqsService.findOne(id) as Faq);
      await this.faqsService.delete(id);
      await this.safeAudit({
        ...base,
        changes: { before, after: {} },
        outcome: { status: OutcomeStatus.SUCCESS },
      });
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: { before, after: before },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }
}
