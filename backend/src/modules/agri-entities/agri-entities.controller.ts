import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
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
