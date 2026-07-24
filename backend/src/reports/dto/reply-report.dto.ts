import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReplyReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;
}