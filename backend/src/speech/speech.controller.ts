import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SarvamService } from './sarvam.service';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Request } from 'express';

interface MultipartFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

class SttDto {
  @IsString()
  @IsOptional()
  language?: string;
}

class ChunkTranscribeDto {
  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @IsNumber()
  @Min(0)
  sequenceNumber: number;
}

class TranslateDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'as-IN', 'bn-IN', 'brx-IN', 'doi-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ks-IN',
    'kok-IN', 'mai-IN', 'ml-IN', 'mni-IN', 'mr-IN', 'ne-IN', 'or-IN', 'pa-IN',
    'sa-IN', 'sat-IN', 'sd-IN', 'ta-IN', 'te-IN', 'ur-IN', 'en-IN',
  ])
  targetLanguage: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string;
}

// ─── Controller ─────────────────────────────────────────────────────────────

@Controller('speech')
@UseGuards(JwtAuthGuard)
export class SpeechController {
  constructor(private readonly sarvamService: SarvamService) {}

  /**
   * One-shot STT: record → stop → upload → transcribe.
   * Accepts audio up to 100 MB. Chunks audio > 5 min into manageable
   * segments and processes sequentially.
   */
  @Post('stt')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async speechToText(
    @UploadedFile() file: MultipartFile,
    @Body() dto: SttDto,
  ) {
    if (!file) {
      throw new HttpException('No audio file provided', HttpStatus.BAD_REQUEST);
    }

    // Minimum viable audio: a few bytes. Blank recordings are rejected.
    if (file.size < 512) {
      throw new HttpException(
        'Audio is too short. Please record a longer message.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const languageCode = dto.language || 'unknown';

    const result = await this.sarvamService.transcribeFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      languageCode,
    );

    return { text: result.text };
  }

  /**
   * Transcribe a rolling audio chunk (used during active recording).
   * File is streamed directly to Sarvam — never written to disk.
   */
  @Post('transcribe-chunk')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeChunk(
    @UploadedFile() file: MultipartFile,
    @Body() dto: ChunkTranscribeDto,
  ) {
    if (!file) {
      return { sequenceNumber: dto.sequenceNumber, text: '', error: 'No audio file' };
    }
    try {
      const result = await this.sarvamService.transcribeBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        dto.languageCode,
      );
      return { sequenceNumber: dto.sequenceNumber, text: result.text, error: null };
    } catch {
      return { sequenceNumber: dto.sequenceNumber, text: '', error: 'Transcription failed' };
    }
  }

  /**
   * Final transcription when user stops recording.
   */
  @Post('transcribe-final')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeFinal(
    @UploadedFile() file: MultipartFile,
    @Body() dto: ChunkTranscribeDto,
  ) {
    if (!file) {
      return { sequenceNumber: dto.sequenceNumber, text: '', error: 'No audio file' };
    }
    try {
      const result = await this.sarvamService.transcribeBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        dto.languageCode,
      );
      return { sequenceNumber: dto.sequenceNumber, text: result.text, error: null };
    } catch {
      return { sequenceNumber: dto.sequenceNumber, text: '', error: 'Transcription failed' };
    }
  }

  @Post('translate')
  @HttpCode(HttpStatus.OK)
  async translate(
    @Body() dto: TranslateDto,
    @Req() _req: AuthenticatedRequest,
  ) {
    return this.sarvamService.translateText(
      dto.text,
      dto.targetLanguage,
      dto.sourceLanguage ?? 'en-IN',
    );
  }
}