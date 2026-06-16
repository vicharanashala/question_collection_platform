import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';
import { WithdrawDto } from './dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getBalance(@Req() req: AuthenticatedRequest) {
    return this.walletsService.getBalance(req.user.id);
  }

  @Get('me/transactions')
  @HttpCode(HttpStatus.OK)
  async getTransactions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletsService.getTransactions(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  async withdraw(@Req() req: AuthenticatedRequest, @Body() dto: WithdrawDto) {
    return this.walletsService.withdraw(req.user.id, dto);
  }
}