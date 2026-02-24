import {
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  type Logger,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ValidationError } from 'sequelize';
import { AxiosError } from 'axios';
import { HttpGlobalExceptionFilter } from './http-global-exception-filter.exception';
import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { newUser } from '../../test/fixtures';
import { v4 } from 'uuid';

jest.mock('../common/decorators/client.decorator', () => ({
  getClientIdFromHeaders: jest.fn().mockReturnValue('drive-web'),
}));

describe('HttpGlobalExceptionFilter', () => {
  let filter: HttpGlobalExceptionFilter;
  let mockHttpAdapter: DeepMocked<HttpAdapterHost['httpAdapter']>;
  let mockHttpAdapterHost: DeepMocked<HttpAdapterHost>;
  let loggerMock: DeepMocked<Logger>;

  beforeEach(async () => {
    mockHttpAdapter = createMock<HttpAdapterHost['httpAdapter']>();
    mockHttpAdapterHost = createMock<HttpAdapterHost>({
      httpAdapter: mockHttpAdapter,
    });
    loggerMock = createMock<Logger>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpGlobalExceptionFilter,
        {
          provide: HttpAdapterHost,
          useValue: mockHttpAdapterHost,
        },
      ],
    })
      .setLogger(loggerMock)
      .compile();
    filter = module.get<HttpGlobalExceptionFilter>(HttpGlobalExceptionFilter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When HttpException is sent, it should format response and not log errors', () => {
    const mockUser = newUser();
    const exceptionMessage = 'Test exception';
    const mockException = new HttpException(
      exceptionMessage,
      HttpStatus.BAD_REQUEST,
    );
    const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

    filter.catch(mockException, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: exceptionMessage,
      },
      HttpStatus.BAD_REQUEST,
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  describe('Not HTTP errors logs', () => {
    it('When unexpected error is sent, it should log details and return 500 error', () => {
      const mockUser = newUser();
      const mockException = new Error('Unexpected error');
      const requestId = v4();
      const mockHost = createMockArgumentsHost(
        '/test-url',
        'GET',
        mockUser,
        {},
        requestId,
      );

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
          requestId,
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('When SequelizeError is sent, it should log with DATABASE tag', () => {
      const mockUser = newUser();
      const mockException = new ValidationError(
        'Database validation error',
        [],
      );
      const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(loggerMock.error.mock.calls[0][1]).toContain(
        'UNEXPECTED_ERROR/DATABASE',
      );
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('When AxiosError is sent, it should log with EXTERNAL_SERVICE tag', () => {
      const mockException = new AxiosError(
        'External service error',
        'ETIMEDOUT',
        {} as any,
        {},
        {
          status: 500,
          data: 'Error',
          statusText: 'Error',
          headers: {},
          config: {} as any,
        },
      );
      const mockUser = newUser();
      const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(loggerMock.error.mock.calls[0][1]).toContain(
        'UNEXPECTED_ERROR/EXTERNAL_SERVICE',
      );
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('When a query timeout error is sent, it should respond with 408 Request Timeout', () => {
      const mockUser = newUser();
      const mockException = new Error('Query timed out');
      const requestId = v4();
      const mockHost = createMockArgumentsHost(
        '/test-url',
        'GET',
        mockUser,
        {},
        requestId,
      );

      filter.catch(mockException, mockHost);

      expect(loggerMock.warn).toHaveBeenCalled();
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message: 'Request timed out',
          requestId,
        }),
        HttpStatus.REQUEST_TIMEOUT,
      );
    });

    it('When a postgres cancellation error (57014) is sent, it should respond with 408 Request Timeout', () => {
      const mockUser = newUser();
      const mockException = {
        original: { code: '57014' },
        message: 'canceling statement due to statement timeout',
      };
      const requestId = v4();
      const mockHost = createMockArgumentsHost(
        '/test-url',
        'GET',
        mockUser,
        {},
        requestId,
      );

      filter.catch(mockException, mockHost);

      expect(loggerMock.warn).toHaveBeenCalled();
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.REQUEST_TIMEOUT,
          message: 'Request timed out',
          requestId,
        }),
        HttpStatus.REQUEST_TIMEOUT,
      );
    });

    it('When request does not contain user, it should be able to handle it gracefully', () => {
      const mockException = new Error('Unexpected error');
      const mockHost = createMockArgumentsHost('/test-url', 'GET', null);

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('Parent class fallback', () => {
    it('When an error occurs in the exception handler, it should let the parent class handle it', () => {
      const mockUser = newUser();
      const mockException = new Error('Original error');
      const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

      loggerMock.error.mockImplementationOnce(() => {
        throw new Error('Error in filter');
      });

      const superCatchSpy = jest
        .spyOn(BaseExceptionFilter.prototype, 'catch')
        .mockImplementation(() => undefined);

      filter.catch(mockException, mockHost);

      expect(superCatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error in filter',
        }),
        mockHost,
      );

      superCatchSpy.mockRestore();
    });
  });

  describe('isExceptionObject', () => {
    it('When an object is an exception object, it should return true', () => {
      expect(filter.isExceptionObject(new Error('test'))).toBe(true);
      expect(filter.isExceptionObject({ message: 'test message' })).toBe(true);
    });

    it('When an object is not an exception object, it should return false', () => {
      expect(filter.isExceptionObject({ something: 'else' })).toBe(false);
      expect(filter.isExceptionObject(null)).toBe(false);
      expect(filter.isExceptionObject(undefined)).toBe(false);
    });
  });
});

const createMockArgumentsHost = (
  url: string,
  method: string,
  user: any,
  body: any = {},
  id: string = v4(),
) =>
  createMock<ArgumentsHost>({
    switchToHttp: () => ({
      getRequest: () => ({
        url,
        method,
        user,
        body,
        id,
      }),
      getResponse: () => ({ setHeader: jest.fn() }),
    }),
  });
