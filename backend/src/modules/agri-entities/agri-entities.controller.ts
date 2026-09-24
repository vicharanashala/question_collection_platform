import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { UserRole } from '../../shared/classes/enums';
import { AgriEntitiesService } from './agri-entities.service';
import { ListAgriEntitiesDto, SubmitAgriEntityDto, SubmitAgriEntityResponseDto } from './dto';

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

  // GET /agri-entities/all — every user's submissions, for staff review.
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CURATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async listAll(@Query() dto: ListAgriEntitiesDto) {
    return this.agriEntitiesService.listAll(dto);
  }

  // POST /agri-entities — submit a crop, weed, pest or disease record.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Body() dto: SubmitAgriEntityDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SubmitAgriEntityResponseDto> {
    return this.agriEntitiesService.submit(req.user.id, dto);
  }
}
