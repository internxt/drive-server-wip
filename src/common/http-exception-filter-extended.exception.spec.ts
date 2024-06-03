import { ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BaseExceptionFilter } from '@nestjs/core';
import { newUser } from '../../test/fixtures';
import { ExtendedHttpExceptionFilter } from './http-exception-filter-extended.exception';

describe('ExtendedHttpExceptionFilter', () => {
  let filter: ExtendedHttpExceptionFilter;
  let loggerErrorSpy: jest.SpyInstance;
  let baseExceptionFilterCatchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExtendedHttpExceptionFilter],
    }).compile();

    filter = module.get<ExtendedHttpExceptionFilter>(
      ExtendedHttpExceptionFilter,
    );
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    baseExceptionFilterCatchSpy = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockArgumentsHost = (url: string, method: string, user: any) =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url,
          method,
          user,
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 500,
          headers: {},
          getHeader: jest.fn(),
          setHeader: jest.fn(),
          isHeadersSent: false,
        }),
        getNext: jest.fn(),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    }) as unknown as ArgumentsHost;

  it('When non expected error are sent, then it should log details and call parent catch', () => {
    const mockException = new Error('Unexpected error');
    const user = newUser();
    const mockHost = createMockArgumentsHost('/my-endpoint', 'GET', user);

    filter.catch(mockException, mockHost);

    expect(loggerErrorSpy).toHaveBeenCalled();
    expect(baseExceptionFilterCatchSpy).toHaveBeenCalledWith(
      mockException,
      mockHost,
    );
  });

  it('When expected exception is sent, then it should not log detailss and call parent catch', () => {
    const mockException = new HttpException('This is an http error', 400);
    const user = newUser();
    const mockHost = createMockArgumentsHost('/my-endpoint', 'GET', user);

    filter.catch(mockException, mockHost);

    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(baseExceptionFilterCatchSpy).toHaveBeenCalledWith(
      mockException,
      mockHost,
    );
  });
});
