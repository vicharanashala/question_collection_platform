import { Injectable, Inject } from '@nestjs/common';
import axios from 'axios';
import { IUserRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'normal' | 'high';
  channelId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
  ) {}

  async sendToUser(
    userId: string,
    payload: Omit<ExpoPushPayload, 'to'>,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) return;
    const expoPushToken = (user as unknown as { expoPushToken?: string }).expoPushToken;
    if (!expoPushToken) return;

    try {
      await axios.post(
        EXPO_PUSH_URL,
        { ...payload, to: expoPushToken },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8_000,
        },
      );
    } catch {
      // Token may be expired or invalid — next token update will fix it.
    }
  }

  async sendBatch(payloads: ExpoPushPayload[]): Promise<void> {
    if (payloads.length === 0) return;
    const chunks: ExpoPushPayload[][] = [];
    for (let i = 0; i < payloads.length; i += 100) {
      chunks.push(payloads.slice(i, i + 100));
    }
    await Promise.allSettled(
      chunks.map((chunk) =>
        axios
          .post(EXPO_PUSH_URL, chunk, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15_000,
          })
          .catch(() => { /* swallow */ }),
      ),
    );
  }
}