import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as BaseThrottlerGuard, ThrottlerModuleOptions, ThrottlerRequest, ThrottlerStorageService } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { User } from '../modules/user/user.domain';

@Injectable()
export class ThrottlerGuard extends BaseThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const trackedIp = req.ips.length ? req.ips[0] : req.ip;
    // setting app.set('trust proxy', true); makes Express check x-forwarded-for header
    return trackedIp;
  }
}

@Injectable()
export class CustomThrottlerGuard extends BaseThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorageService,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;
    if (user && (user.id || user.uuid)) {
      return `user:${user.id ?? user.uuid}`;
    }
    const auth = req.headers['authorization'] as string | undefined;
    if (auth) return `token:${auth.slice(0, 200)}`;
    const forwarded = (req.headers['x-forwarded-for'] as string) || '';
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.socket?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;

    const handlerContext = context.getHandler();
    const classContext = context.getClass();
    
    const isPublic = this.reflector.get<boolean>('isPublic', handlerContext);
    const disableGlobalAuth = this.reflector.getAllAndOverride<boolean>(
      'disableGlobalAuth',
      [handlerContext, classContext],
    );

    const req = context.switchToHttp().getRequest<Request>();

    if (isPublic || disableGlobalAuth || !req.user) {
      const anonymousLimit = this.config.get('users.rateLimit.anonymous.limit');
      const anonymousTTL = this.config.get('users.rateLimit.anonymous.ttl');

      requestProps.ttl = anonymousTTL;
      requestProps.limit = anonymousLimit;

      return super.handleRequest(requestProps);
    }

    const user = req.user as User;
    const isFreeUser = user.tierId === this.config.get('users.freeTierId');

    if (isFreeUser) {
      const freeLimit = this.config.get('users.rateLimit.free.limit');
      const freeTTL = this.config.get('users.rateLimit.free.ttl');

      requestProps.ttl = freeTTL;
      requestProps.limit = freeLimit;

      return super.handleRequest(requestProps);
    }

    const paidLimit = this.config.get('users.rateLimit.paid.limit');
    const paidTTL = this.config.get('users.rateLimit.paid.ttl');
    requestProps.ttl = paidTTL;
    requestProps.limit = paidLimit;

    return super.handleRequest(requestProps);
  }
}