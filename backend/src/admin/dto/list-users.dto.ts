import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { VerificationStatus, UserCategory } from '../../common/enums';

export class ListUsersDto {
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

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsIn(['farmer', 'fpo', 'student', 'volunteer', 'ngo'])
  category?: UserCategory;

  @IsOptional()
  @IsIn(['pending', 'manual_review', 'verified', 'suspended', 'banned'])
  status?: VerificationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  excludeId?: string;

  @IsOptional()
  @IsIn(['createdAt', 'name', 'state', 'verificationStatus'])
  sortBy?: 'createdAt' | 'name' | 'state' | 'verificationStatus';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}