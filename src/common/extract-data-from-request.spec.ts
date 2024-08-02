import { BadRequestException, Logger } from '@nestjs/common';
import {
  DataSource,
  extractDataFromRequest,
} from './extract-data-from-request';

describe('extractDataFromRequest', () => {
  let request;

  beforeEach(() => {
    request = {
      body: { field1: 'value1' },
      query: { field2: 'value2' },
      params: { field3: 'value3' },
      headers: { field4: 'value4' },
    };
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('When all fields are present, then it should extract data correctly', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'body', fieldName: 'field1' },
      { sourceKey: 'query', fieldName: 'field2' },
      {
        sourceKey: 'params',
        fieldName: 'field3',
        newFieldName: 'renamedField3',
      },
      { sourceKey: 'headers', fieldName: 'field4' },
    ];

    const result = extractDataFromRequest(request, dataSources);

    expect(result).toEqual({
      field1: 'value1',
      field2: 'value2',
      renamedField3: 'value3',
      field4: 'value4',
    });
  });

  it('When a required field is missing, then it should throw BadRequestException', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'body', fieldName: 'missingField' },
    ];

    expect(() => extractDataFromRequest(request, dataSources)).toThrow(
      BadRequestException,
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Missing required field for guard! field: missingField',
    );
  });

  it('When a provided value is given, then it should use the provided value', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'body', fieldName: 'field1', value: 'providedValue' },
    ];

    const result = extractDataFromRequest(request, dataSources);

    expect(result).toEqual({
      field1: 'providedValue',
    });
  });

  it('When the provided value is null or undefined, then it should throw BadRequestException', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'body', fieldName: 'field1', value: null },
    ];

    expect(() => extractDataFromRequest(request, dataSources)).toThrow(
      BadRequestException,
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Missing required field for guard! field: field1',
    );
  });

  it('When fields need to be renamed, then it should rename fields correctly', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'query', fieldName: 'field2', newFieldName: 'newField2' },
    ];

    const result = extractDataFromRequest(request, dataSources);

    expect(result).toEqual({
      newField2: 'value2',
    });
  });

  it('When multiple data sources are provided, then it should handle all sources correctly', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'body', fieldName: 'field1' },
      { sourceKey: 'query', fieldName: 'field2' },
    ];

    const result = extractDataFromRequest(request, dataSources);

    expect(result).toEqual({
      field1: 'value1',
      field2: 'value2',
    });
  });
});
