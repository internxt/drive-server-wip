import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ConvertSizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('ConvertSizeInterceptor');
    const req = context.switchToHttp().getRequest();
    const client = req.headers['internxt-client'] as string;
    const clientVersion = req.headers['internxt-version'] as string;
    const userAgent = req.headers['user-agent'];

    if (
      client !== 'drive-desktop' ||
      !userAgent.toLowerCase().includes('mac') ||
      this.compareVersion(clientVersion, '2.2.0.50') > 0
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (typeof data === 'object' && !Array.isArray(data)) {
          if ('size' in data && typeof data.size !== 'string') {
            data.size = data.size.toString();
          }
        }

        if ('result' in data && Array.isArray(data['result'])) {
          data.result = data.result.map((item) => {
            if (typeof item === 'object' && 'size' in item) {
              return { ...item, size: item.size.toString() };
            }

            return item;
          });
        }

        if (Array.isArray(data)) {
          return data.map((item) => {
            if (typeof item === 'object' && 'size' in item) {
              return { ...item, size: item.size.toString() };
            }

            return item;
          });
        }

        return data;
      }),
    );
  }

  private cleanAndSplitVersion(version: string): number[] {
    return version
      .replace(/[^0-9.]/g, '')
      .split('.')
      .map(Number);
  }

  private compareVersion(v1: string, v2: string): number {
    let v1Parts = this.cleanAndSplitVersion(v1);
    let v2Parts = this.cleanAndSplitVersion(v2);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    v1Parts = [...v1Parts, ...new Array(maxLength - v1Parts.length).fill(0)];
    v2Parts = [...v2Parts, ...new Array(maxLength - v2Parts.length).fill(0)];

    for (let i = 0; i < v1Parts.length; i++) {
      if (v1Parts[i] > v2Parts[i]) {
        return 1;
      } else if (v1Parts[i] < v2Parts[i]) {
        return -1;
      }
    }

    return 0;
  }
}
