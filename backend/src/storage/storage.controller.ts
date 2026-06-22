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
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
    // Multer populates @UploadedFile() (single file, field name 'file')
    if (!file) {
      throw new BadRequestException('No file provided — expected field named "file"');
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG and WEBP images are supported',
      );
    }

    // Validate size against admin config (fetched live from DB cache)
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
}