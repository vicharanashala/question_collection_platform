import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbedService {
  private readonly logger = new Logger(EmbedService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('embed.baseUrl')!;
  }

  /**
   * Returns a vector embedding for the given text by calling the
   * external embedding service at {baseUrl}/embed.
   *
   * Returns null when the service is unreachable or returns an invalid response.
   * Callers should handle null gracefully (e.g. store null in the DB and log a warning).
   */
  async embed(text: string): Promise<number[] | null> {
    try {
      const res = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        this.logger.warn(`Embedding service returned ${res.status} for text: "${text.slice(0, 80)}"`);
        return null;
      }

      const json = await res.json() as { embedding?: number[] };

      if (!json.embedding || !Array.isArray(json.embedding)) {
        this.logger.warn(`Embedding service returned unexpected shape: ${JSON.stringify(json)}`);
        return null;
      }

      return json.embedding;
    } catch (err) {
      this.logger.error(`Failed to reach embedding service: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}