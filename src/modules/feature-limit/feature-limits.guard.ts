import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LimitLabels } from './limits.enum';
import { LimitCheckService } from './limit-check.service';
import { LimitTypeMapping } from './limits.attributes';
import {
  ApplyLimitMetadata,
  FEATURE_LIMIT_KEY,
} from './decorators/apply-limit.decorator';

@Injectable()
export class FeatureLimit implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limitsCheckService: LimitCheckService,
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
        `Missing metada for feature limit guard! url: ${request.url} handler: ${handler.name}`,
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

    const limit = await this.limitsCheckService.getLimitByLabelAndTier(
      limitLabel,
      // TODO: Replace with uÏser.tier_id
      'dfd536ca-7284-47ff-800f-957a80d98084',
    );

    if (!limit) {
      new Logger().error(`Limit configuration not found for ${limitLabel}`);
      return false;
    }

    if (limit.isLimitBooleanAndEnabled()) {
      return true;
    }

    const isLimitExceeded =
      await this.limitsCheckService.checkLimit<LimitLabels>(
        user,
        limit,
        extractedData,
      );

    return !isLimitExceeded;
  }
}
