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
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { FaqsService } from './faqs.service';
import { CreateFaqDto, UpdateFaqDto, ToggleVisibilityDto, ListFaqsQueryDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums';

@Controller()
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  // ─── Public/user-facing ──────────────────────────────────────────────────

  // ─── Public/user-facing ──────────────────────────────────────────────────

  @Public()
  @Get('faqs')
  async listVisible(@Query() query: ListFaqsQueryDto) {
    return this.faqsService.findAllVisible(query);
  }

  @Public()
  @Get('videos/:filename')
  streamVideo(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const filePath = join(__dirname, '..', 'public', 'videos', filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Video '${filename}' not found`);
    }
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000',
    });
    const stream = createReadStream(filePath);
    return new StreamableFile(stream);
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Get('admin/faqs')
  async listAll(@Query() query: ListFaqsQueryDto) {
    return this.faqsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Post('admin/faqs')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFaqDto) {
    return this.faqsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Patch('admin/faqs/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.faqsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Patch('admin/faqs/:id/visibility')
  async toggleVisibility(@Param('id') id: string, @Body() dto: ToggleVisibilityDto) {
    return this.faqsService.toggleVisibility(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Delete('admin/faqs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.faqsService.delete(id);
  }
}