import {
  Controller,
  Get,
  Patch,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Param,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto, UpdateCropDetailsDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /users/me
   * Returns the authenticated user's full profile including crops.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: AuthenticatedRequest) {
    const user = await this.userService.getProfile(req.user.id);
    return {
      id: user.id,
      mobileNumber: user.mobileNumber,
      name: user.name,
      category: user.category,
      state: user.state,
      district: user.district,
      block: user.block,
      village: user.village,
      languagePreference: user.languagePreference,
      verificationStatus: user.verificationStatus,
      role: user.role,
      age:              user.age,
      gender:           user.gender,
      farmSize:         user.farmSize,
      season:           user.season,
      cropType:         user.cropType,
      courseName:       user.courseName,
      collegeName:      user.collegeName,
      universityName:   user.universityName,
      organisationType: user.organisationType,
      organizationName: user.organizationName,
      organizationRole: user.organizationRole,
      consentGiven: user.consentGiven,
      consentTimestamp: user.consentTimestamp,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      crops: user.crops,
    };
  }

  /**
   * GET /users/me/leaderboard
   * Returns the top users ranked by total earnings, with the current user's position.
   */
  @Get('me/leaderboard')
  @HttpCode(HttpStatus.OK)
  async getLeaderboard(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.userService.getLeaderboard(req.user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * PATCH /users/me
   * Update editable profile fields (name, location, language preference, crops).
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.userService.updateProfile(req.user.id, dto);
    return { user };
  }

  /**
   * GET /users/me/notifications
   * Paginated notification list with unread count.
   */
  @Get('me/notifications')
  @HttpCode(HttpStatus.OK)
  async getNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.getNotifications(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * PATCH /users/me/notifications/read-all
   * Mark all unread notifications as read.
   */
  @Patch('me/notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Req() req: AuthenticatedRequest) {
    await this.userService.markAllNotificationsRead(req.user.id);
    return { success: true };
  }

  /**
   * PATCH /users/me/notifications/:id/read
   * Mark a single notification as read.
   */
  @Patch('me/notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.userService.markAsRead(req.user.id, id);
    return { success: true };
  }

  /**
   * PATCH /users/me/crops
   * Replace the user's crop list (full upsert). Crops can also be set via PATCH /users/me.
   */
  @Patch('me/crops')
  @HttpCode(HttpStatus.OK)
  async updateCropDetails(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCropDetailsDto,
  ) {
    const crops = await this.userService.updateCropDetails(req.user.id, dto);
    return { crops };
  }
}