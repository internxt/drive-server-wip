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
        `[FEATURE_LIMIT]: Missing metadata for feature limit guard! url: ${request.url} handler: ${handler.name}`,
      );
      throw new BadRequestException(`Missing Metadata`);
    }

    const { limitLabel, dataSources } = metadata;

    if (!limitLabel) {
      return true;
    }

    const extractedData = this.extractDataFromRequest(
      request,
      dataSources,
      limitLabel,
    );

    const enforceLimit =
      await this.featureLimitsUseCases.enforceLimit<LimitLabels>(
        limitLabel,
        user,
        extractedData,
      );

    const shouldActionBeAllowed = !enforceLimit;

    return shouldActionBeAllowed;
  }

  extractDataFromRequest(
    request: any,
    dataSources: ApplyLimitMetadata['dataSources'],
    limitLabel: LimitLabels,
  ) {
    const extractedData = {} as LimitTypeMapping[typeof limitLabel];

    for (const { sourceKey, fieldName } of dataSources) {
      const value = request[sourceKey][fieldName];
      const isValueUndefined = value === undefined || value === null;

      if (isValueUndefined) {
        new Logger().error(
          `[FEATURE_LIMIT]: Missing required field for feature limit! limit: ${limitLabel} field: ${fieldName}`,
        );
        throw new BadRequestException(`Missing required field: ${fieldName}`);
      }

      extractedData[fieldName] = value;
    }

    return extractedData;
  }
}
