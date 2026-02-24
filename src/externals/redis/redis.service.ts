import { Injectable, type OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private isConnecting = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy() {
    await this.disconnect();
  }

  async tryAcquireLock(
    key: string,
    ttlMs: number,
    value?: string | number,
  ): Promise<boolean> {
    const client = await this.getClient();

    const lockContent = value ?? '1';
    const result = await client.set(key, lockContent, {
      PX: ttlMs,
      NX: true,
    });
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.del(key);
    return result > 0;
  }

  async getClient(): Promise<RedisClientType> {
    if (!this.client?.isReady) {
      await this.createConnection();
    }

    if (!this.client?.isReady) {
      throw new Error('Failed to establish Redis connection');
    }

    return this.client;
  }

  private async createConnection() {
    if (this.isConnecting) return;

    const redisUrl = this.configService.get('cache.redisConnectionString');

    if (!redisUrl) {
      this.logger.error('Redis connection string not configured');
      return;
    }

    this.isConnecting = true;

    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              this.logger.error('Max retries reached, stopping reconnection');
              return new Error('Max retries reached');
            }
            this.logger.warn(`Reconnecting to Redis, attempt ${retries}`);
            return Math.min(retries * 1000, 30000);
          },
        },
      });

      this.setupEventListeners();
      await this.client.connect();

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      this.logger.error(`Failed to create Redis connection: ${error.message}`);
    }
  }

  private setupEventListeners() {
    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis client error: ${error.message}`);
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis client reconnecting...');
    });
  }

  private async disconnect(): Promise<void> {
    if (!this.client) return;

    try {
      if (this.client.isOpen) {
        await this.client.quit();
        this.logger.log('Redis connection closed gracefully');
      }
    } catch (error) {
      this.logger.error('Error during graceful Redis disconnect:', error);
      // Force disconnect if graceful quit fails
      this.client.disconnect();
    } finally {
      this.client = null;
    }
  }
}
