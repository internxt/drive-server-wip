import { SetMetadata } from '@nestjs/common';

export const TIMING_CONSISTENCY_KEY = 'timingConsistency';

export interface TimingConsistencyOptions {
  minimumResponseTimeMs: number;
}

export const TimingConsistency = (options: TimingConsistencyOptions) =>
  SetMetadata(TIMING_CONSISTENCY_KEY, options);
