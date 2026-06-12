import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
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
   * Returns the authenticated user's full profile.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: AuthenticatedRequest) {
    const user = await this.userService.getProfile(req.user.id);
    const crops = await this.userService.getCropDetails(req.user.id);
    return {
      user: {
        id: user.id,
        mobileNumber: user.mobileNumber,
        name: user.name,
        category: user.category,
        state: user.state,
        district: user.district,
        block: user.block,
        languagePreference: user.languagePreference,
        verificationStatus: user.verificationStatus,
        role: user.role,
        profileData: user.profileData,
        consentGiven: user.consentGiven,
        consentTimestamp: user.consentTimestamp,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      crops,
    };
  }

  /**
   * PATCH /users/me
   * Update editable profile fields (name, location, language preference).
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
   * PATCH /users/me/crops
   * Replace the user's crop list (full upsert).
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