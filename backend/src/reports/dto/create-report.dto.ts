import { IsString, IsEnum, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ReportCategory } from '../../common/enums';

export class CreateReportDto {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsEnum(ReportCategory)
  category: ReportCategory;

  /** Optional: ID of the entity this report relates to */
  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  /** Optional: type of the related entity ('question' | 'withdrawal' | 'wallet') */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relatedEntityType?: string;
}