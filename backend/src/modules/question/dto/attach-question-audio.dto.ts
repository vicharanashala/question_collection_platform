import { IsArray, ArrayMinSize, ArrayMaxSize, IsString } from 'class-validator';
import { NormalizeMediaUrls } from '../../../shared/middleware/transformers/normalize-media-urls.transformer';

export class AttachQuestionAudioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @NormalizeMediaUrls()
  audioUrls!: string[];
}
