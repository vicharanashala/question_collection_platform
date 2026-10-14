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
import { detectImage, MAX_IMAGE_SIZE_BYTES } from "@/utils/image-validation";

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

const AGRI_ENTITY_MAX_BYTES = MAX_AGRI_ENTITY_IMAGE_SIZE_MB * 1024 * 1024;

const GENERIC_IMAGE_UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
};
const AGRI_ENTITY_UPLOAD_OPTIONS = {
  limits: { fileSize: AGRI_ENTITY_MAX_BYTES, files: 1 },
};

@Controller("storage")
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly adminService: AdminService,
  ) {}

@Post("upload")
@HttpCode(HttpStatus.OK)
@UseInterceptors(FileInterceptor("file", GENERIC_IMAGE_UPLOAD_OPTIONS))
async uploadFile(
  @UploadedFile() file: AuthenticatedRequest["file"],
  @Req() req: AuthenticatedRequest,
) {
  const { file: image, detected } = this.assertValidImage(
    file,
    MAX_IMAGE_SIZE_BYTES,
  );
  const base = image.originalname.replace(/\.[^/.]+$/, "");

  const url = await this.storageService.upload(
    image.buffer,
    detected.mime,
    `${base}.${detected.ext}`,
    req.user.id,
    "images",
  );

  return { url, sizeBytes: image.size };
}

@Post("upload/agri-entity-image")
@HttpCode(HttpStatus.OK)
@UseInterceptors(FileInterceptor("file", AGRI_ENTITY_UPLOAD_OPTIONS))
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

  const { file: image, detected } = this.assertValidImage(
    file,
    AGRI_ENTITY_MAX_BYTES,
  );
  const base = image.originalname.replace(/\.[^/.]+$/, "");

  const url = await this.storageService.upload(
    image.buffer,
    detected.mime,
    `${base}.${detected.ext}`,
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
  // private async assertValidImage(
  //   file: AuthenticatedRequest["file"],
  // ): Promise<NonNullable<AuthenticatedRequest["file"]>> {
  //   if (!file) {
  //     throw new BadRequestException(
  //       'No file provided — expected field named "file"',
  //     );
  //   }

  //   if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
  //     throw new BadRequestException(
  //       "Only JPEG, PNG and WEBP images are supported",
  //     );
  //   }

  //   return file;
  // }

  private assertValidImage(
    file: AuthenticatedRequest["file"],
    maxBytes = MAX_IMAGE_SIZE_BYTES,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file provided — expected field named "file"',
      );
    }
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `Each image must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller`,
      );
    }
    const detected = detectImage(file.buffer);
    if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
      throw new BadRequestException(
        "Only JPEG, PNG and WEBP images are supported",
      );
    }
    return { file, detected };
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
