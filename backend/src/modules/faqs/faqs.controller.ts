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
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { FaqsService } from './faqs.service';
import { CreateFaqDto, UpdateFaqDto, ToggleVisibilityDto, ListFaqsQueryDto } from './dto';
import { JwtAuthGuard } from '../../shared/middleware/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/middleware/guards/roles.guard';
import { Roles } from '../../shared/middleware/decorators/roles.decorator';
import { Public } from '../../shared/middleware/decorators/public.decorator';
import { UserRole } from '../../shared/classes/enums';

@Controller()
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  // ─── Public/user-facing ──────────────────────────────────────────────────

  @Public()
  @Get('faqs')
  async listVisible(@Query() query: ListFaqsQueryDto) {
    return this.faqsService.findAllVisible(query);
  }

  /**
   * Serves the FAQ video embed page from the API origin so YouTube accepts
   * the embed request (YouTube requires a valid HTTPS referer).
   *
   * YouTube iframe parameters:
   *   autoplay=1        — starts immediately when the page loads
   *   playsinline=1     — prevents fullscreen takeover on iOS
   *   rel=0             — hides related videos from other channels
   *   modestbranding=1  — reduces YouTube logo in corner
   */
  @Public()
  @Get('embed/faq-video')
  getFaqVideoEmbed(@Query('videoId') videoId: string, @Res() res: Response) {
    const id = videoId || 'dQw4w9WgXcQ';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Referrer-Policy', 'origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>FAQ Video</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:100%;height:100%;background:#000;overflow:hidden;}
    #player{position:absolute;top:0;left:0;width:100%;height:100%;}
  </style>
</head>
<body>
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player;
    YT.ready(function() {
      player = new YT.Player('player', {
        videoId: '${id}',
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
        },
        events: {
          onStateChange: function(event) {
            // When video ends, loop it back to prevent the related-videos overlay
            if (event.data === YT.PlayerState.ENDED) {
              player.stopVideo();
              player.playVideo();
            }
          }
        }
      });
    });
  </script>
</body>
</html>`);
  }

  @Public()
  @Get('videos/:filename')
  streamVideo(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = join(__dirname, '..', 'public', 'videos', filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Video '${filename}' not found`);
    }

    const stat = statSync(filePath);
    const fileSize = stat.size;
    const range = (res as any).req?.headers['range'];

    if (range) {
      // Partial content (range request) — required for <video> seek/play
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', String(chunkSize));
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.status(HttpStatus.PARTIAL_CONTENT);
      return new StreamableFile(createReadStream(filePath, { start, end }));
    }

    // Full file response
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', String(fileSize));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return new StreamableFile(createReadStream(filePath));
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/faqs/stats')
  async getStats(@Query('category') category?: string) {
    return this.faqsService.getStats(category);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
  @Get('admin/faqs')
  async listAll(@Query() query: ListFaqsQueryDto) {
    return this.faqsService.findAllPaginated(query);
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