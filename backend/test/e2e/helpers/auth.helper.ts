import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { REPOSITORY_TOKENS, IUserRepository } from '../../../src/shared/database/repositories';
import { User } from '../../../src/shared/database/entities';

export async function getAuthToken(app: INestApplication, mobileNumber: string): Promise<string> {
  await request(app.getHttpServer())
    .post('/auth/request-otp')
    .send({ mobileNumber })
    .expect((response) => {
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to request OTP: ${response.status} ${JSON.stringify(response.body)}`);
      }
    });

  await app.get<IUserRepository>(REPOSITORY_TOKENS.User).updateMany(
    { mobileNumber },
    {
      otpHash: await bcrypt.hash('123456', 12),
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as Partial<User>,
  );

  const response = await request(app.getHttpServer())
    .post('/auth/verify-otp')
    .send({ mobileNumber, otp: '123456' })
    .expect((verifyResponse) => {
      if (verifyResponse.status < 200 || verifyResponse.status >= 300) {
        throw new Error(`Failed to verify OTP: ${verifyResponse.status} ${JSON.stringify(verifyResponse.body)}`);
      }
    });

  const token = response.body?.tokens?.accessToken ?? response.body?.accessToken;

  if (!token) {
    throw new Error(`Auth response did not include an access token: ${JSON.stringify(response.body)}`);
  }

  return token;
}

export function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}
