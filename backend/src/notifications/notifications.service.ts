import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { User } from '../database/entities/user.entity';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Shape of a single Expo push notification payload.
 * See https://docs.expo.dev/push-notifications/sending-notifications/
 */
export interface ExpoPushPayload {
  to: string;            // Expo push token
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Send an Expo push notification to a specific user's saved push token.
   * Silently ignores failures so a missing/invalid token does not crash the request.
   */
  async sendToUser(
    userId: string,
    payload: Omit<ExpoPushPayload, 'to'>,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['expoPushToken'],
    });

    if (!user?.expoPushToken) return;

    try {
      await axios.post(
        EXPO_PUSH_URL,
        { ...payload, to: user.expoPushToken },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8_000,
        },
      );
    } catch {
      // Token may be expired or invalid — next token update will fix it.
      // Do not throw; the in-app notification is still persisted.
    }
  }

  /**
   * Send a batch of Expo push notifications.
   * Individual failures are swallowed; the in-app notification is always persisted first.
   */
  async sendBatch(payloads: ExpoPushPayload[]): Promise<void> {
    if (payloads.length === 0) return;

    // Expo accepts up to 100 per request
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
          .catch(() => {
            /* swallow individual chunk failures */
          }),
      ),
    );
  }
}