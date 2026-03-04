import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type LimitLabels } from './limits.enum';
import { FeatureLimitUsecases } from './feature-limit.usecase';
import {
  type ApplyLimitMetadata,
  FEATURE_LIMIT_KEY,
} from './decorators/apply-limit.decorator';
import { PaymentRequiredException } from './exceptions/payment-required.exception';
import { type LimitTypeMapping } from './domain/limits.attributes';

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
        `[FEATURE_LIMIT]: Missing metadata for feature limit guard! url: ${request.url} handler: ${handler.name}`,
      );
      throw new BadRequestException(`Missing Metadata`);
    }

    const { limitLabels, dataSources } = metadata;

    if (!limitLabels) {
      return true;
    }

    const extractedData = this.extractDataFromRequest(request, dataSources);

    await Promise.all(
      limitLabels.map(async (limitLabel) => {
        const shouldLimitBeEnforced =
          await this.featureLimitsUseCases.enforceLimit<LimitLabels>(
            limitLabel,
            user,
            extractedData as LimitTypeMapping[typeof limitLabel],
          );

        if (shouldLimitBeEnforced) {
          throw new PaymentRequiredException();
        }
      }),
    );

    return true;
  }

  extractDataFromRequest(
    request: any,
    dataSources: ApplyLimitMetadata['dataSources'],
  ) {
    const extractedData = {};

    for (const { sourceKey, fieldName } of dataSources) {
      const value = request[sourceKey][fieldName];
      const isValueUndefined = value === undefined || value === null;

      if (isValueUndefined) {
        new Logger().error(
          `[FEATURE_LIMIT]: Missing required field for feature limit! field: ${fieldName}`,
        );
        throw new BadRequestException(`Missing required field: ${fieldName}`);
      }

      extractedData[fieldName] = value;
    }

    return extractedData;
  }
}
