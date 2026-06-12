import { IsMobilePhone, IsNotEmpty } from 'class-validator';

export class RequestOtpDto {
  @IsNotEmpty()
  @IsMobilePhone('en-IN')
  mobileNumber: string;
}