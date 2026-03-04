import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  TIMING_CONSISTENCY_KEY,
  type TimingConsistencyOptions,
} from '../decorators/timing-consistency.decorator';

@Injectable()
export class TimingConsistencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timingOptions = this.reflector.get<TimingConsistencyOptions>(
      TIMING_CONSISTENCY_KEY,
      context.getHandler(),
    );

    if (!timingOptions) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(
          0,
          timingOptions.minimumResponseTimeMs - elapsed,
        );

        if (remainingTime > 0) {
          return new Promise((resolve) =>
            setTimeout(() => resolve(data), remainingTime),
          );
        }

        return data;
      }),
    );
  }
}
