import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TimingConsistencyInterceptor } from './timing-consistency.interceptor';
import {
  TIMING_CONSISTENCY_KEY,
  TimingConsistencyOptions,
} from '../decorators/timing-consistency.decorator';

describe('TimingConsistencyInterceptor', () => {
  let interceptor: TimingConsistencyInterceptor;
  let reflector: DeepMockProxy<Reflector>;

  beforeEach(() => {
    reflector = mockDeep<Reflector>();
    interceptor = new TimingConsistencyInterceptor(reflector);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through when no timing options are set', () => {
    const context = mockDeep<ExecutionContext>();
    const next = mockDeep<CallHandler>();
    const testData = { test: 'data' };

    reflector.get.mockReturnValue(undefined);
    next.handle.mockReturnValue(of(testData));

    const result$ = interceptor.intercept(context, next);

    result$.subscribe((result) => {
      expect(result).toBe(testData);
    });

    expect(reflector.get).toHaveBeenCalledWith(
      TIMING_CONSISTENCY_KEY,
      context.getHandler(),
    );
  });

  it('should add delay when response is faster than minimum time', async () => {
    const context = mockDeep<ExecutionContext>();
    const next = mockDeep<CallHandler>();
    const testData = { test: 'data' };
    const minimumTime = 100;
    const startTime = Date.now();

    const timingOptions: TimingConsistencyOptions = {
      minimumResponseTimeMs: minimumTime,
    };

    reflector.get.mockReturnValue(timingOptions);
    next.handle.mockReturnValue(of(testData));

    const result = await lastValueFrom(interceptor.intercept(context, next));
    const totalElapsed = Date.now() - startTime;

    expect(result).toBe(testData);
    expect(totalElapsed).toBeGreaterThanOrEqual(minimumTime - 10);
  });

  it('should not add delay when response already takes longer than minimum time', async () => {
    const context = mockDeep<ExecutionContext>();
    const next = mockDeep<CallHandler>();
    const testData = { test: 'data' };
    const minimumTime = 50;
    const startTime = Date.now();

    const timingOptions: TimingConsistencyOptions = {
      minimumResponseTimeMs: minimumTime,
    };

    reflector.get.mockReturnValue(timingOptions);
    next.handle.mockReturnValue(
      of(testData).pipe(delay(minimumTime + 10)) as any,
    );

    const result = await lastValueFrom(interceptor.intercept(context, next));
    const totalElapsed = Date.now() - startTime;

    expect(result).toBe(testData);
    expect(totalElapsed).toBeGreaterThanOrEqual(minimumTime);
  });
});
