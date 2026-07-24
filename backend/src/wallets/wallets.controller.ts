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
import { AddPaymentDetailDto } from './dto/payment-details.dto';
import { Request } from 'express';
import { CacheInvalidate } from '../cache/decorators/cache-invalidate.decorator';
import { Cacheable } from '../cache/decorators/cacheable.decorator';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @Cacheable('wallet', 60)
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
  @Cacheable('reward_tier', 600)
  async getRewardTier(@Req() req: AuthenticatedRequest, @Query('approvedCount') approvedCount: string) {
    const count = approvedCount !== undefined ? parseInt(approvedCount, 10) : 0;
    return this.walletsService.getRewardTier(count);
  }

  /**
   * Returns wallet configuration values needed by the client.
   * Includes razorpayKeyId so the mobile app can initialise the native SDK.
   */
  @Get('me/config')
  @HttpCode(HttpStatus.OK)
  @Cacheable('wallet_config', 3600)
  async getWalletConfig(@Req() req: AuthenticatedRequest) {
    return this.walletsService.getWalletConfig();
  }

  @Get('me/transactions')
  @HttpCode(HttpStatus.OK)
  @Cacheable('transactions', 60)
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

  @Get('withdrawals/:id')
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `withdrawal:${args[0]}`, 60)
  async getWithdrawal(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.walletsService.getWithdrawal(req.user.id, id);
  }

  @Get('me/withdrawals')
  @HttpCode(HttpStatus.OK)
  @Cacheable('withdrawals', 60)
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
  @CacheInvalidate('wallet:*')
  async withdraw(@Req() req: AuthenticatedRequest, @Body() dto: WithdrawDto) {
    return this.walletsService.withdraw(req.user.id, dto);
  }

  @Delete('withdrawals/:id')
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('wallet:*')
  async cancelWithdrawal(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.walletsService.cancelWithdrawal(req.user.id, id);
  }

  // ─── Payment Details ─────────────────────────────────────────────────────

  /** Add a new payment detail and initiate ₹1 micro-transaction verification. */
  @Post('payment-details')
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('wallet:*')
  async addPaymentDetail(@Req() req: AuthenticatedRequest, @Body() dto: AddPaymentDetailDto) {
    return this.walletsService.addPaymentDetail(req.user.id, dto);
  }

  /** Get all payment details for the current user (masked). */
  @Get('payment-details')
  @HttpCode(HttpStatus.OK)
  @Cacheable('payment_details', 60)
  async getPaymentDetails(@Req() req: AuthenticatedRequest) {
    return this.walletsService.getPaymentDetails(req.user.id);
  }

  /** Delete a payment detail (only allowed for non-verified details). */
  @Delete('payment-details/:id')
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('wallet:*')
  async deletePaymentDetail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.walletsService.deletePaymentDetail(req.user.id, id);
    return { success: true };
  }

  /**
   * Auto-verify a payment detail (dev/demo only).
   * Only works when PINELABS_MOCK_VERIFICATION=true on the server.
   * Skips the ₹1 micro-transaction and marks the detail as verified immediately.
   */
  @Post('payment-details/:id/auto-verify')
  @HttpCode(HttpStatus.OK)
  async autoVerifyPaymentDetail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.walletsService.autoVerifyPaymentDetail(req.user.id, id);
  }
}