import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LimitLabels } from './limits.enum';
import { FeatureLimitUsecases } from './feature-limit.usecase';
import { LimitTypeMapping } from './limits.attributes';
import {
  ApplyLimitMetadata,
  FEATURE_LIMIT_KEY,
} from './decorators/apply-limit.decorator';

@Injectable()
export class FeatureLimit implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureLimitsUseCases: FeatureLimitUsecases,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const metadata = this.reflector.get<ApplyLimitMetadata>(
      FEATURE_LIMIT_KEY,
      handler,
    );

    if (!metadata) {
      new Logger().error(
        `Missing metadata for feature limit guard! url: ${request.url} handler: ${handler.name}`,
      );
      return false;
    }

    const { limitLabel, dataSources } = metadata;

    if (!limitLabel) {
      return true;
    }

    const extractedData = {} as LimitTypeMapping[typeof limitLabel];
    if (dataSources) {
      for (const { sourceKey, fieldName } of dataSources) {
        const value = request[sourceKey][fieldName];
        if (value === undefined || value === null) {
          new Logger().error(
            `[FEATURE_LIMIT]: Missing required field! url: ${request.url} handler: ${handler.name} field: ${fieldName}`,
          );
          throw new BadRequestException(`Missing required field: ${fieldName}`);
        }
        extractedData[fieldName] = value;
      }
    }

    const limit = await this.featureLimitsUseCases.getLimitByLabelAndTier(
      limitLabel,
      user.tierId,
    );

    if (!limit) {
      new Logger().error(
        `[FEATURE_LIMIT]: Limit configuration not found for limit: ${limitLabel} tier: ${user.tierId}`,
      );
      return true;
    }

    if (limit.isLimitBoolean()) {
      return limit.isFeatureEnabled();
    }

    const isLimitExceeded =
      await this.featureLimitsUseCases.checkLimit<LimitLabels>(
        user,
        limit,
        extractedData,
      );

    return !isLimitExceeded;
  }
}
