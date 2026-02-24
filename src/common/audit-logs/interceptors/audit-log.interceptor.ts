import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  type AuditLogConfig,
  AUDIT_LOG_METADATA_KEY,
  type ValueExtractor,
} from '../decorators/audit-log.decorator';
import { AuditLogService } from '../audit-log.service';
import { AuditEntityType, AuditPerformerType } from '../audit-logs.attributes';
import { extractByPath, extractMultiple } from '../utils/path-extractor.util';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const auditConfig = this.reflector.get<AuditLogConfig>(
      AUDIT_LOG_METADATA_KEY,
      handler,
    );

    if (!auditConfig) {
      this.logger.debug('No audit log config found on handler');
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((response) => {
        this.createAuditLog(auditConfig, request, response).catch((error) => {
          this.logger.error(
            {
              action: auditConfig.action,
              error: (error as Error).message,
            },
            'Failed to create audit log',
          );
        });
      }),
    );
  }

  private async createAuditLog(
    config: AuditLogConfig,
    request: any,
    response: any,
  ): Promise<void> {
    const entityId = this.extractValue(
      request,
      response,
      config.entityId || 'user.uuid',
    );
    const performerId = this.extractValue(
      request,
      response,
      config.performerId || 'user.uuid',
    );

    if (!entityId) {
      this.logger.warn(
        {
          action: config.action,
          entityIdExtractor: config.entityId || 'user.uuid',
        },
        'Could not extract entityId for audit log',
      );
      return;
    }

    const extractedMetadata = this.extractMetadata(
      request,
      response,
      config.metadata,
    );

    const auditLogDto = {
      action: config.action,
      entityType: config.entityType || AuditEntityType.User,
      entityId,
      performerType: config.performerType || AuditPerformerType.User,
      performerId,
      metadata: extractedMetadata,
    };

    await this.auditLogService.log(auditLogDto);
  }

  /**
   * Extracts a value using either a string path or callback function
   */
  private extractValue(
    request: any,
    response: any,
    extractor: ValueExtractor<string>,
  ): string | undefined {
    if (typeof extractor === 'function') {
      return extractor(request, response);
    }

    return extractByPath(request, extractor);
  }

  private extractMetadata(
    request: any,
    response: any,
    metadataConfig:
      | string[]
      | ((req: any, res: any) => Record<string, any> | undefined)
      | undefined,
  ): Record<string, any> | undefined {
    if (!metadataConfig) {
      return undefined;
    }

    if (typeof metadataConfig === 'function') {
      return metadataConfig(request, response);
    }

    if (Array.isArray(metadataConfig)) {
      const extracted = extractMultiple(request, metadataConfig);
      return Object.keys(extracted).length > 0 ? extracted : undefined;
    }

    return undefined;
  }
}
