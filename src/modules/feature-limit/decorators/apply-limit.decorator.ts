import { SetMetadata } from '@nestjs/common';
import { LimitLabels } from '../limits.enum';

interface DataSource {
  sourceKey: 'body' | 'params' | 'query' | 'headers';
  fieldName: string;
}

export interface ApplyLimitMetadata {
  limitLabel: LimitLabels;
  dataSources?: DataSource[];
}

export const FEATURE_LIMIT_KEY = 'feature-limit';

export const ApplyLimit = (metadata: ApplyLimitMetadata) =>
  SetMetadata(FEATURE_LIMIT_KEY, metadata);
