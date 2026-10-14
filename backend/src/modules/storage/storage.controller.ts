import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
  Query,
  Get,
  Res,
  Headers,
  BadRequestException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../shared/middleware/guards/jwt-auth.guard";
import { StorageService } from "./storage.service";
import { AdminService } from "../admin/admin.service";
import { Request, Response } from "express";
import { Public } from "../../shared/middleware/decorators/public.decorator";
import { AgriEntityType } from "../../shared/classes/enums";
import {
  getAgriEntityImageCategory,
  MAX_AGRI_ENTITY_IMAGE_SIZE_MB,
} from "../agri-entities/agri-entities.constants";

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
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/mp4",
  "audio/mpeg",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",
]);

@Controller("storage")
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly adminService: AdminService,
  ) {}

  @Post("upload")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @UploadedFile() file: AuthenticatedRequest["file"],
    @Req() req: AuthenticatedRequest,
  ) {
    const image = await this.assertValidImage(file);

    const url = await this.storageService.upload(
      image.buffer,
      image.mimetype,
      image.originalname,
      req.user.id,
      "images",
    );

    return { url, sizeBytes: image.size };
  }

  /**
   * Upload one image for a crop, weed, pest or disease submission.
   * Stored privately under {env}/agri-entities/{type}s/{userId}/{yyyy-MM}/...
   */
  @Post("upload/agri-entity-image")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  async uploadAgriEntityImage(
    @UploadedFile() file: AuthenticatedRequest["file"],
    @Query("type") type: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!Object.values(AgriEntityType).includes(type as AgriEntityType)) {
      throw new BadRequestException(
        `type must be one of: ${Object.values(AgriEntityType).join(", ")}`,
      );
    }
    const image = await this.assertValidImage(file);
    if (image.size > MAX_AGRI_ENTITY_IMAGE_SIZE_MB * 1024 * 1024) {
      throw new PayloadTooLargeException(
        `Each image must be ${MAX_AGRI_ENTITY_IMAGE_SIZE_MB} MB or smaller`,
      );
    }

    const url = await this.storageService.upload(
      image.buffer,
      image.mimetype,
      image.originalname,
      req.user.id,
      getAgriEntityImageCategory(type as AgriEntityType),
    );

    return { url, sizeBytes: image.size };
  }

  /**
   * Streams a private object for a link minted by StorageService.getSignedUrl().
   * Public because the HMAC signature in the query string is the authorisation; supports
   * Range requests so audio can seek.
   */
  @Public()
  @Get("media")
  async getMedia(
    @Query("o") objectName: string,
    @Query("e") expires: string,
    @Query("s") signature: string,
    @Headers("range") range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const media = await this.storageService.openSignedObject(
      objectName,
      Number(expires),
      signature,
      range,
    );

    res.setHeader("Content-Type", media.contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=86400");
    if (media.range) {
      const { start, end } = media.range;
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${media.size}`);
      res.setHeader("Content-Length", end - start + 1);
    } else {
      res.setHeader("Content-Length", media.size);
    }

    media.stream.on("error", () => res.destroy());
    media.stream.pipe(res);
  }

  // Ensures an uploaded image is present, of an allowed type and within the configured size limit.
  private async assertValidImage(
    file: AuthenticatedRequest["file"],
  ): Promise<NonNullable<AuthenticatedRequest["file"]>> {
    if (!file) {
      throw new BadRequestException(
        'No file provided — expected field named "file"',
      );
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        "Only JPEG, PNG and WEBP images are supported",
      );
    }

    return file;
  }

  /**
   * Upload a single audio recording.
   * Stored privately in the environment's GCS bucket under {env}/audios/...; the
   * response carries a time-limited signed URL minted from the returned storage URI.
   */
  @Post("upload/audio")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  async uploadAudio(
    @UploadedFile() file: AuthenticatedRequest["file"],
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No audio file provided — expected field named "file"',
      );
    }

    if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        "Only MP4, MPEG, WEBM, OGG and AAC audio formats are supported",
      );
    }

    const url = await this.storageService.upload(
      file.buffer,
      file.mimetype,
      file.originalname,
      req.user.id,
      "audios",
    );

    return { url, sizeBytes: file.size };
  }
}
