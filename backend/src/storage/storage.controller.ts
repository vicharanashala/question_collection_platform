import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StorageService } from './storage.service';
import { AdminService } from '../admin/admin.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
  file?: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  };
}

// Allowed MIME types
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mp4', 'audio/mpeg', 'audio/webm',
  'audio/ogg', 'audio/aac', 'audio/x-m4a',
]);

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly adminService: AdminService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: AuthenticatedRequest['file'], @Req() req: AuthenticatedRequest) {
    if (!file) {
      throw new BadRequestException('No file provided — expected field named "file"');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG and WEBP images are supported',
      );
    }

    const maxSizeMb = await this.adminService.getConfigValue('max_image_size_mb');
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new PayloadTooLargeException(
        `Image exceeds maximum allowed size of ${maxSizeMb} MB`,
      );
    }

    const url = await this.storageService.upload(
      file.buffer,
      file.mimetype,
      file.originalname,
      'questions/images',
    );

    return { url, sizeBytes: file.size };
  }

  /**
   * Upload a single audio recording.
   * Dev: stored in-memory + disk via MockStorageService (served at /static/...).
   * Prod: stored in GCP Nearline via GcpStorageService (public CDN URL).
   */
  @Post('upload/audio')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAudio(@UploadedFile() file: AuthenticatedRequest['file'], @Req() req: AuthenticatedRequest) {
    if (!file) {
      throw new BadRequestException('No audio file provided — expected field named "file"');
    }

    if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only MP4, MPEG, WEBM, OGG and AAC audio formats are supported',
      );
    }

    // 10 MB default; override with max_audio_size_mb config or QUESTION_AUDIO_MAX_SIZE_MB env var
    const maxSizeMb =
      (await this.adminService.getConfigValue('max_audio_size_mb')) ?? 10;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new PayloadTooLargeException(
        `Audio exceeds maximum allowed size of ${maxSizeMb} MB`,
      );
    }

    const url = await this.storageService.upload(
      file.buffer,
      file.mimetype,
      file.originalname,
      'questions/audio',
    );

    return { url, sizeBytes: file.size };
  }
}