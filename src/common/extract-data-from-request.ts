import { BadRequestException, Logger } from '@nestjs/common';

export interface DataSource {
  sourceKey?: 'body' | 'query' | 'params' | 'headers';
  newFieldName?: string; // renames field name to be passed to guard
  fieldName: string;
  value?: any;
}

export const extractDataFromRequest = (
  request: Request,
  dataSources: DataSource[],
) => {
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

    const targetFieldName = newFieldName ? newFieldName : fieldName;

    extractedData[targetFieldName] = extractedValue;
  }

  return extractedData;
};
