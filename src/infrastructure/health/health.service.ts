import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { CacheManagerService } from '../../modules/cache-manager/cache-manager.service';

export enum HealthStatus {
  Ok = 'ok',
  Degraded = 'degraded',
  Failed = 'failed',
}

export enum CheckStatus {
  Ok = 'ok',
  Error = 'error',
}

type CheckResult = { status: CheckStatus; ping?: number; error?: string };
type HealthPayload = {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  checks: Record<string, CheckResult>;
  failedChecks: string[];
};
type ServiceDefinition = {
  required: boolean;
  check: () => Promise<CheckResult>;
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @Inject() private readonly cacheManager: CacheManagerService,
  ) {}

  private get services(): Record<string, ServiceDefinition> {
    return {
      db: {
        required: true,
        check: async () => {
          const start = Date.now();
          await this.sequelize.authenticate();
          return { status: CheckStatus.Ok, ping: Date.now() - start };
        },
      },
      redis: {
        required: false,
        check: async () => {
          const start = Date.now();
          await this.cacheManager.checkHealth();
          return { status: CheckStatus.Ok, ping: Date.now() - start };
        },
      },
    };
  }

  async check(): Promise<HealthPayload> {
    const services = this.services;

    const checks: Record<string, CheckResult> = Object.fromEntries(
      await Promise.all(
        Object.entries(services).map(async ([name, { check }]) => {
          const start = Date.now();
          try {
            return [name, await check()];
          } catch (err) {
            return [
              name,
              {
                status: CheckStatus.Error,
                ping: Date.now() - start,
                error: String(err),
              },
            ];
          }
        }),
      ),
    );

    const failedChecks = Object.entries(checks)
      .filter(([, r]) => r.status !== CheckStatus.Ok)
      .map(([name]) => name);

    const hasRequiredFailure = failedChecks.some(
      (name) => services[name].required,
    );

    const payload: HealthPayload = {
      status: hasRequiredFailure
        ? HealthStatus.Failed
        : failedChecks.length > 0
          ? HealthStatus.Degraded
          : HealthStatus.Ok,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
      failedChecks,
    };

    this.logger.debug(`Health check: ${JSON.stringify(payload)}`);

    if (hasRequiredFailure) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
