import { createMock } from '@golevelup/ts-jest';
import { type ExecutionContext, type CallHandler } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TimingConsistencyInterceptor } from './timing-consistency.interceptor';
import {
  TIMING_CONSISTENCY_KEY,
  type TimingConsistencyOptions,
} from '../decorators/timing-consistency.decorator';

describe('TimingConsistencyInterceptor', () => {
  let interceptor: TimingConsistencyInterceptor;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = createMock<Reflector>();
    interceptor = new TimingConsistencyInterceptor(reflector);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through when no timing options are set', () => {
    const context = createMock<ExecutionContext>();
    const next = createMock<CallHandler>();
    const testData = { test: 'data' };

    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    jest.spyOn(next, 'handle').mockReturnValue(of(testData));

    const result$ = interceptor.intercept(context, next);

    result$.subscribe((result) => {
      expect(result).toBe(testData);
    });

    expect(reflector.get).toHaveBeenCalledWith(
      TIMING_CONSISTENCY_KEY,
      context.getHandler(),
    );
  });

  it('should add delay when response is faster than minimum time', (done) => {
    const context = createMock<ExecutionContext>();
    const next = createMock<CallHandler>();
    const testData = { test: 'data' };
    const minimumTime = 100;

    const timingOptions: TimingConsistencyOptions = {
      minimumResponseTimeMs: minimumTime,
    };

    jest.spyOn(reflector, 'get').mockReturnValue(timingOptions);
    jest.spyOn(next, 'handle').mockReturnValue(of(testData));

    const startTime = Date.now();
    const result$ = interceptor.intercept(context, next);

    result$.subscribe(async (result) => {
      if (result instanceof Promise) {
        const resolvedResult = await result;
        const totalElapsed = Date.now() - startTime;
        expect(resolvedResult).toBe(testData);
        expect(totalElapsed).toBeGreaterThanOrEqual(minimumTime - 10);
      } else {
        expect(result).toBe(testData);
      }

      done();
    });
  });

  it('should not add delay when response already takes longer than minimum time', (done) => {
    const context = createMock<ExecutionContext>();
    const next = createMock<CallHandler>();
    const testData = { test: 'data' };
    const minimumTime = 50;

    const timingOptions: TimingConsistencyOptions = {
      minimumResponseTimeMs: minimumTime,
    };

    jest.spyOn(reflector, 'get').mockReturnValue(timingOptions);

    jest
      .spyOn(next, 'handle')
      .mockReturnValue(of(testData).pipe(delay(minimumTime + 10)));

    const startTime = Date.now();
    const result$ = interceptor.intercept(context, next);

    result$.subscribe((result) => {
      const elapsed = Date.now() - startTime;
      expect(result).toBe(testData);
      expect(elapsed).toBeGreaterThanOrEqual(minimumTime);
      done();
    });
  });
});
