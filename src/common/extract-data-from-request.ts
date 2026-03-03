import {
  BadRequestException,
  type ExecutionContext,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { type Reflector } from '@nestjs/core';

const extractDataFromRequestMetaName = 'dataFromRequest';

export const GetDataFromRequest = (dataSources: DataSource[]) =>
  SetMetadata(extractDataFromRequestMetaName, { dataSources });

export interface DataSource {
  sourceKey?: 'body' | 'query' | 'params' | 'headers';
  newFieldName?: string; // renames field name to be passed to guard
  fieldName: string;
  value?: any;
}

export const extractDataFromRequest = (
  request: Request,
  reflector: Reflector,
  context: ExecutionContext,
) => {
  const metadataOptions = reflector.get<{ dataSources: DataSource[] }>(
    extractDataFromRequestMetaName,
    context.getHandler(),
  );

  const { dataSources = [] } = metadataOptions || {};

  const extractedData = {};

  for (const { sourceKey, fieldName, value, newFieldName } of dataSources) {
    const extractedValue =
      value !== undefined ? value : request[sourceKey][fieldName];

    const isValueUndefined =
      extractedValue === undefined || extractedValue === null;

    if (isValueUndefined) {
      new Logger().error(
        `Missing required field for guard! field: ${fieldName}`,
      );
      throw new BadRequestException(`Missing required field: ${fieldName}`);
    }

    const targetFieldName = newFieldName ?? fieldName;

    extractedData[targetFieldName] = extractedValue;
  }

  return extractedData;
};
