import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { AgriEntityStatus, AgriEntityType } from '../../../shared/classes/enums';

export class ListAgriEntitiesDto {
  @IsOptional()
  @IsEnum(AgriEntityType)
  type?: AgriEntityType;

  @IsOptional()
  @IsEnum(AgriEntityStatus)
  status?: AgriEntityStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;
}
