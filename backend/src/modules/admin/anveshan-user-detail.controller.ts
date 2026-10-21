import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { UserRole } from '../../shared/classes/enums';
import { AnveshanUserDetailService } from './anveshan-user-detail.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
export class AnveshanUserDetailController {
  constructor(private readonly detailService: AnveshanUserDetailService) {}

  // GET /admin/users/:id/anveshan — full review data for one Anveshan user.
  @Get(':id/anveshan')
  @HttpCode(HttpStatus.OK)
  async getAnveshanDetail(@Param('id') id: string) {
    return this.detailService.getDetail(id);
  }
}
