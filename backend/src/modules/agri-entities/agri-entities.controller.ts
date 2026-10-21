import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { UserRole } from '../../shared/classes/enums';
import { AgriEntitiesService } from './agri-entities.service';
import { AnveshanSubmissionsOpenGuard } from '../user/guards/anveshan-submissions-open.guard';
import { CacheInvalidate } from '../../shared/database/cache/decorators/cache-invalidate.decorator';
import { AnveshanUsersQueryDto, ListAgriEntitiesDto, SubmitAgriEntityDto, SubmitAgriEntityResponseDto } from './dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('agri-entities')
@UseGuards(JwtAuthGuard)
export class AgriEntitiesController {
  constructor(private readonly agriEntitiesService: AgriEntitiesService) {}

  // GET /agri-entities — the caller's own submissions (filter by ?type=&status=).
  @Get()
  async listMine(@Query() dto: ListAgriEntitiesDto, @Req() req: AuthenticatedRequest) {
    return this.agriEntitiesService.listMine(req.user.id, dto);
  }

  // GET /agri-entities/counts/me — the caller's submission count per type.
  @Get('counts/me')
  async countsMine(@Req() req: AuthenticatedRequest) {
    return this.agriEntitiesService.getSubmittedCountsByType(req.user.id);
  }

  // GET /agri-entities/all — every user's submissions, for staff review.
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CURATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async listAll(@Query() dto: ListAgriEntitiesDto, @Req() req: AuthenticatedRequest) {
    return this.agriEntitiesService.listAll(dto, req.user.role);
  }

  // GET /agri-entities/anveshan-users — Anveshan users for the entity user filter (?search=).
  @Get('anveshan-users')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async anveshanUsers(@Query() query: AnveshanUsersQueryDto) {
    return this.agriEntitiesService.searchAnveshanUsers(query);
  }

  // GET /agri-entities/export — Excel export of Anveshan users' entities, honouring the list filters.
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async exportAnveshan(@Query() dto: ListAgriEntitiesDto, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const file = await this.agriEntitiesService.exportAnveshanEntities(dto, req.user.role);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="anveshan_entities_${Date.now()}.xlsx"`);
    res.send(file);
  }

  // POST /agri-entities — submit a crop, weed, pest or disease record.
  @Post()
  @UseGuards(AnveshanSubmissionsOpenGuard)
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('anveshan_milestone*')
  async submit(
    @Body() dto: SubmitAgriEntityDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SubmitAgriEntityResponseDto> {
    return this.agriEntitiesService.submit(req.user.id, dto);
  }
}
