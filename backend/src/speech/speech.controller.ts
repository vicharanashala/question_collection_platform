import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SarvamService } from './sarvam.service';
import { IsString, IsNotEmpty, IsOptional, IsUrl, IsIn } from 'class-validator';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

class TranscribeDto {
  @IsUrl()
  @IsNotEmpty()
  audioUrl: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'as-IN','bn-IN','brx-IN','doi-IN','gu-IN','hi-IN','kn-IN','ks-IN',
    'kok-IN','mai-IN','ml-IN','mni-IN','mr-IN','ne-IN','or-IN','pa-IN',
    'sa-IN','sat-IN','sd-IN','ta-IN','te-IN','ur-IN','en-IN',
  ])
  languageCode: string;
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
    'sa-IN','sat-IN','sd-IN','ta-IN','te-IN','ur-IN',
  ])
  targetLanguage: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string = 'en-IN';
}

@Controller('speech')
@UseGuards(JwtAuthGuard)
export class SpeechController {
  constructor(private readonly sarvamService: SarvamService) {}

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  async transcribe(
    @Body() dto: TranscribeDto,
    @Req() _req: AuthenticatedRequest,
  ) {
    return this.sarvamService.transcribeAudio(dto.audioUrl, dto.languageCode);
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
      dto.sourceLanguage,
    );
  }
}