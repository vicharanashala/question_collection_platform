import {
  IsEmail,
  IsMobilePhone,
  IsNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';

// The longest address SMTP allows.
const MAX_EMAIL_LENGTH = 254;

export class RequestEmailOtpDto {
  @IsNotEmpty()
  @MaxLength(MAX_EMAIL_LENGTH)
  @IsEmail()
  email: string;
}

export class VerifyEmailOtpDto extends RequestEmailOtpDto {
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}

export class EmailLoginFallbackDto {
  @IsNotEmpty()
  @IsMobilePhone('en-IN')
  mobileNumber: string;
}
