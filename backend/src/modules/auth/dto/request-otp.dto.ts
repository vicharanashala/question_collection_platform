import { IsMobilePhone, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsNotEmpty()
  @IsMobilePhone('en-IN')
  mobileNumber: string;

  @IsOptional()
  @IsString()
  client?: string;
}