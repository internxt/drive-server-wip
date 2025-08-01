import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = configService.get('cache.redisConnectionString');

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: false,
      },
    });

    this.client
      .connect()
      .catch((err) =>
        this.logger.error(
          `There was an error while connecting to redis err: ${JSON.stringify(err)}`,
        ),
      );
    this.client.on('connect', () => this.logger.log('Connected to redis'));
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  async tryAcquireLock(
    key: string,
    ttlMs: number,
    value?: string | number,
  ): Promise<boolean> {
    const lockContent = value ?? '1';
    const result = await this.client.set(key, lockContent, {
      PX: ttlMs,
      NX: true,
    });
    return result === 'OK';
  }
}
