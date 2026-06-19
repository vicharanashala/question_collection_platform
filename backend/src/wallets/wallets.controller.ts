import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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

  /**
   * Returns the user's current reward tier based on approved question count.
   * The query param `approvedCount` is supplied by the client (from its own tally
   * or from the user profile).  The service does NOT query the DB for the count
   * — it simply computes the tier from the provided number.
   */
  @Get('me/tier')
  @HttpCode(HttpStatus.OK)
  async getRewardTier(@Req() req: AuthenticatedRequest, @Query('approvedCount') approvedCount: string) {
    const count = approvedCount !== undefined ? parseInt(approvedCount, 10) : 0;
    return this.walletsService.getRewardTier(count);
  }

  /** Returns wallet configuration values needed by the client. */
  @Get('me/config')
  @HttpCode(HttpStatus.OK)
  async getWalletConfig(@Req() req: AuthenticatedRequest) {
    return this.walletsService.getWalletConfig();
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

  @Get('me/withdrawals')
  @HttpCode(HttpStatus.OK)
  async getWithdrawals(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletsService.getWithdrawals(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  async withdraw(@Req() req: AuthenticatedRequest, @Body() dto: WithdrawDto) {
    return this.walletsService.withdraw(req.user.id, dto);
  }

  @Delete('withdrawals/:id')
  @HttpCode(HttpStatus.OK)
  async cancelWithdrawal(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.walletsService.cancelWithdrawal(req.user.id, id);
  }
}