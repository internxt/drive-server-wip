import {
  BadRequestException,
  type ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  extractDataFromRequest,
  type DataSource,
} from './extract-data-from-request'; // Update with actual path

describe('extractDataFromRequest', () => {
  let request;
  let reflector: Reflector;
  let context: ExecutionContext;

  beforeEach(() => {
    request = {
      body: { field1: 'value1' },
      query: { field2: 'value2' },
      params: { field3: 'value3' },
      headers: { field4: 'value4' },
    };

    reflector = new Reflector();
    context = {
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(reflector, 'get').mockImplementation();
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

    (reflector.get as jest.Mock).mockReturnValue({ dataSources });
    (context.getHandler as jest.Mock).mockReturnValue('handler');

    const result = extractDataFromRequest(request, reflector, context);

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

    (reflector.get as jest.Mock).mockReturnValue({ dataSources });
    (context.getHandler as jest.Mock).mockReturnValue('handler');

    expect(() => extractDataFromRequest(request, reflector, context)).toThrow(
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

    (reflector.get as jest.Mock).mockReturnValue({ dataSources });
    (context.getHandler as jest.Mock).mockReturnValue('handler');

    const result = extractDataFromRequest(request, reflector, context);

    expect(result).toEqual({
      field1: 'providedValue',
    });
  });

  it('When the provided value is null or undefined, then it should throw BadRequestException', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'body', fieldName: 'field1', value: null },
    ];

    (reflector.get as jest.Mock).mockReturnValue({ dataSources });
    (context.getHandler as jest.Mock).mockReturnValue('handler');

    expect(() => extractDataFromRequest(request, reflector, context)).toThrow(
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

    (reflector.get as jest.Mock).mockReturnValue({ dataSources });
    (context.getHandler as jest.Mock).mockReturnValue('handler');

    const result = extractDataFromRequest(request, reflector, context);

    expect(result).toEqual({
      newField2: 'value2',
    });
  });

  it('When multiple data sources are provided, then it should handle all sources correctly', () => {
    const dataSources: DataSource[] = [
      { sourceKey: 'body', fieldName: 'field1' },
      { sourceKey: 'query', fieldName: 'field2' },
    ];

    (reflector.get as jest.Mock).mockReturnValue({ dataSources });
    (context.getHandler as jest.Mock).mockReturnValue('handler');

    const result = extractDataFromRequest(request, reflector, context);

    expect(result).toEqual({
      field1: 'value1',
      field2: 'value2',
    });
  });
});
