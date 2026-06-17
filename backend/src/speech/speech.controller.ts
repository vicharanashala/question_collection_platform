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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SarvamService } from './sarvam.service';
import { IsString, IsNotEmpty, IsNumber, Min, IsIn, IsOptional } from 'class-validator';
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
    'as-IN','bn-IN','brx-IN','doi-IN','gu-IN','hi-IN','kn-IN','ks-IN',
    'kok-IN','mai-IN','ml-IN','mni-IN','mr-IN','ne-IN','or-IN','pa-IN',
    'sa-IN','sat-IN','sd-IN','ta-IN','te-IN','ur-IN','en-IN',
  ])
  targetLanguage: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string;
}

@Controller('speech')
@UseGuards(JwtAuthGuard)
export class SpeechController {
  constructor(private readonly sarvamService: SarvamService) {}

  /**
   * Transcribe a rolling audio chunk.
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